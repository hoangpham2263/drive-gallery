// Memories API — keeps a long-lived Google Drive connection (refresh token in KV),
// so the site never asks to sign in again. Photos live in a private Drive folder;
// the photo list (metadata) lives in KV and is mirrored to memories.json in Drive.
const ORIGINS = ["https://hoangpham.is-a.dev", "http://localhost:8000", "http://localhost:4334"];
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "Hoang's Memories";
const LIST_KEY = "photos";

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });

function cors(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "access-control-allow-origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, x-admin-key",
    "vary": "origin",
  };
}

// Constant-time-ish compare so the password is not guessable by timing.
function sameKey(a = "", b = "") {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const isAdmin = (req, env) => !!env.ADMIN_PASSWORD && sameKey(req.headers.get("x-admin-key") || "", env.ADMIN_PASSWORD);

// ---------- Google auth ----------
async function accessToken(env) {
  const cached = await env.MEM.get("access_token", "json");
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const refresh = await env.MEM.get("refresh_token");
  if (!refresh) throw new Error("Chưa kết nối Google Drive.");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const t = await r.json();
  if (!t.access_token) throw new Error("Google từ chối làm mới phiên: " + (t.error || r.status));
  await env.MEM.put("access_token", JSON.stringify({ token: t.access_token, exp: Date.now() + t.expires_in * 1000 }));
  return t.access_token;
}

async function drive(env, path, init = {}) {
  const token = await accessToken(env);
  const r = await fetch(`https://www.googleapis.com${path}`, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
  if (!r.ok && r.status !== 204) throw new Error(`Drive ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r;
}

async function folderId(env) {
  const saved = await env.MEM.get("folder_id");
  if (saved) return saved;
  const meta = { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" };
  const r = await drive(env, "/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(meta),
  });
  const { id } = await r.json();
  await env.MEM.put("folder_id", id);
  return id;
}

// multipart/related upload of one file (+ JSON metadata) into the folder
async function uploadFile(env, name, mime, bytes) {
  const parent = await folderId(env);
  const boundary = "mem" + crypto.randomUUID();
  const head = `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [parent] })}\r\n--${boundary}\r\ncontent-type: ${mime}\r\n\r\n`;
  const body = new Blob([head, bytes, `\r\n--${boundary}--`]);
  const r = await drive(env, "/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await r.json()).id;
}

// ---------- Photo list ----------
const readList = async (env) => (await env.MEM.get(LIST_KEY, "json")) || [];
async function writeList(env, list) {
  await env.MEM.put(LIST_KEY, JSON.stringify(list));
  // Mirror to Drive so the metadata survives even without KV
  try {
    const saved = await env.MEM.get("list_file_id");
    const bytes = new TextEncoder().encode(JSON.stringify(list, null, 1));
    if (saved) {
      await drive(env, `/upload/drive/v3/files/${saved}?uploadType=media`, { method: "PATCH", headers: { "content-type": "application/json" }, body: bytes });
    } else {
      await env.MEM.put("list_file_id", await uploadFile(env, "memories.json", "application/json", bytes));
    }
  } catch {}
}

const FIELDS = ["title", "note", "province", "takenAt", "lat", "lng"];
function cleanMeta(input = {}) {
  const out = {};
  for (const k of FIELDS) if (k in input) out[k] = input[k] === "" ? null : input[k];
  if (out.title) out.title = String(out.title).slice(0, 120);
  if (out.note) out.note = String(out.note).slice(0, 1000);
  for (const k of ["lat", "lng"]) if (out[k] != null) out[k] = Number(out[k]);
  return out;
}

// ---------- Routes ----------
async function handle(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === "/oauth/start") {
    if (!sameKey(url.searchParams.get("key") || "", env.ADMIN_PASSWORD || "")) return new Response("Sai mật khẩu.", { status: 401 });
    const q = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${url.origin}/oauth/callback`,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
    });
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
  }

  if (path === "/oauth/callback") {
    const code = url.searchParams.get("code");
    if (!code) return new Response("Thiếu mã xác thực.", { status: 400 });
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${url.origin}/oauth/callback`,
        grant_type: "authorization_code",
      }),
    });
    const t = await r.json();
    if (!t.refresh_token) return new Response("Google không trả refresh token: " + JSON.stringify(t), { status: 400 });
    await env.MEM.put("refresh_token", t.refresh_token);
    await env.MEM.put("access_token", JSON.stringify({ token: t.access_token, exp: Date.now() + t.expires_in * 1000 }));
    return new Response("<meta charset=utf-8><p style='font:16px system-ui;padding:24px'>✓ Đã kết nối Google Drive. Bạn có thể đóng tab này.</p>", { headers: { "content-type": "text/html; charset=utf-8" } });
  }

  if (path === "/api/photos" && req.method === "GET") {
    const list = await readList(env);
    return json(list, 200, { "cache-control": "no-store" });
  }

  if (path === "/api/status" && req.method === "GET") {
    return json({ admin: isAdmin(req, env), connected: !!(await env.MEM.get("refresh_token")) });
  }

  // Image proxy: thumbnails and full-size, cached at the edge
  const img = path.match(/^\/api\/img\/([\w-]+)$/);
  if (img && req.method === "GET") {
    const cache = caches.default;
    const hit = await cache.match(req);
    if (hit) return hit;
    const list = await readList(env);
    const item = list.find((p) => p.id === img[1]);
    if (!item) return new Response("Không tìm thấy ảnh.", { status: 404 });
    const size = url.searchParams.get("size") === "thumb" ? item.thumbId || item.fileId : item.fileId;
    const r = await drive(env, `/drive/v3/files/${size}?alt=media`);
    const res = new Response(r.body, {
      headers: { "content-type": r.headers.get("content-type") || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" },
    });
    ctx.waitUntil(cache.put(req, res.clone()));
    return res;
  }

  // ----- admin only below -----
  if (!path.startsWith("/api/")) return new Response("Not found", { status: 404 });
  if (!isAdmin(req, env)) return json({ error: "Sai mật khẩu quản lý." }, 401);

  if (path === "/api/photos" && req.method === "POST") {
    const form = await req.formData();
    const file = form.get("file");
    const thumb = form.get("thumb");
    if (!(file instanceof File)) return json({ error: "Thiếu file ảnh." }, 400);
    const meta = cleanMeta(JSON.parse(form.get("meta") || "{}"));
    const fileId = await uploadFile(env, file.name, file.type || "image/jpeg", await file.arrayBuffer());
    const thumbId = thumb instanceof File ? await uploadFile(env, `thumb-${file.name}`, thumb.type || "image/webp", await thumb.arrayBuffer()) : null;
    const item = {
      id: crypto.randomUUID().slice(0, 12),
      fileId,
      thumbId,
      name: file.name,
      width: Number(form.get("width")) || null,
      height: Number(form.get("height")) || null,
      camera: String(form.get("camera") || "").slice(0, 80) || null,
      createdAt: new Date().toISOString(),
      ...meta,
    };
    const list = await readList(env);
    list.push(item);
    await writeList(env, list);
    return json(item);
  }

  const one = path.match(/^\/api\/photos\/([\w-]+)$/);
  if (one && req.method === "PATCH") {
    const list = await readList(env);
    const item = list.find((p) => p.id === one[1]);
    if (!item) return json({ error: "Không tìm thấy ảnh." }, 404);
    Object.assign(item, cleanMeta(await req.json()));
    await writeList(env, list);
    return json(item);
  }
  if (one && req.method === "DELETE") {
    const list = await readList(env);
    const item = list.find((p) => p.id === one[1]);
    if (!item) return json({ error: "Không tìm thấy ảnh." }, 404);
    for (const id of [item.fileId, item.thumbId].filter(Boolean)) {
      try { await drive(env, `/drive/v3/files/${id}`, { method: "DELETE" }); } catch {}
    }
    await writeList(env, list.filter((p) => p.id !== item.id));
    return json({ ok: true });
  }

  return json({ error: "Không hỗ trợ." }, 404);
}

export default {
  async fetch(req, env, ctx) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
    let res;
    try {
      res = await handle(req, env, ctx);
    } catch (e) {
      res = json({ error: e.message || "Lỗi máy chủ." }, 500);
    }
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors(req))) h.set(k, v);
    return new Response(res.body, { status: res.status, headers: h });
  },
};

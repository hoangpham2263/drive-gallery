// Hoang's Memories — travel map of Vietnam (34 provinces, 2025) with photo milestones.
// Photos and their metadata are served by the Cloudflare Worker in worker/ (Google Drive behind it).
(() => {
  const API = "https://memories-api.hoangpham2263.workers.dev";
  const ABROAD = "Nước ngoài";
  const OTHER = "Other";
  const PALETTE = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#f87171", "#818cf8", "#a3e635"];
  const ISLANDS = [
    { name: "Quần đảo Hoàng Sa", sub: "(Đà Nẵng)", lat: 16.5, lng: 112.0 },
    { name: "Quần đảo Trường Sa", sub: "(Khánh Hòa)", lat: 9.6, lng: 114.2 },
  ];

  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };

  let photos = [];
  let manual = []; // provinces ticked as visited without photos
  let geo = null;
  let provinces = []; // names, sorted
  let selected = null; // province name or null
  let adminKey = store.get("mem-admin");
  let map, layer;
  const labels = {};

  // ---------- helpers ----------
  let toastTimer;
  function toast(text) {
    let el = document.querySelector(".toast");
    if (!el) { el = Object.assign(document.createElement("div"), { className: "toast", role: "status" }); document.body.append(el); }
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const imgUrl = (p, size) => `${API}/api/img/${p.id}${size ? `?size=${size}` : ""}`;
  const photoDate = (p) => p.takenAt || p.createdAt || "";
  const fmtDate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d) ? "" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const byProvince = () => {
    const m = new Map();
    for (const p of photos) if (p.province) m.set(p.province, [...(m.get(p.province) || []), p]);
    return m;
  };

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (adminKey) headers["x-admin-key"] = adminKey;
    const r = await fetch(API + path, { ...opts, headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Lỗi ${r.status}`);
    return data;
  }

  // ---------- geometry ----------
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function provinceAt(lat, lng) {
    if (!geo || lat == null || lng == null) return null;
    for (const f of geo.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) {
        if (inRing(lng, lat, poly[0]) && !poly.slice(1).some((hole) => inRing(lng, lat, hole))) return f.properties.name;
      }
    }
    return null;
  }

  // ---------- map ----------
  function colorOf(name) {
    const i = provinces.indexOf(name);
    return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
  }

  // Visited = has photos, or ticked by hand
  const visitedSet = () => new Set([...byProvince().keys(), ...manual].filter((n) => n !== ABROAD && n !== OTHER && provinces.includes(n)));

  function styleFor(feature) {
    const hasPhotos = byProvince().has(feature.properties.name);
    const visited = hasPhotos || manual.includes(feature.properties.name);
    const active = feature.properties.name === selected;
    return {
      color: active ? cssVar("--fg") : cssVar("--bg"),
      weight: active ? 2 : 1,
      fillColor: visited ? colorOf(feature.properties.name) : cssVar("--land"),
      fillOpacity: visited ? (hasPhotos ? 0.85 : 0.5) : 1,
    };
  }

  function initMap() {
    map = L.map("map", { zoomControl: true, attributionControl: false, zoomSnap: 0.25, minZoom: 4.5, maxZoom: 10 });
    layer = L.geoJSON(geo, {
      style: styleFor,
      onEachFeature: (f, lyr) => {
        lyr.on("click", () => selectProvince(f.properties.name));
        lyr.on("mouseover", () => lyr.setStyle({ weight: 2, color: cssVar("--fg") }));
        lyr.on("mouseout", () => layer.resetStyle(lyr));
        lyr.bindTooltip(() => {
          const n = byProvince().get(f.properties.name)?.length || 0;
          return `${f.properties.name}${n ? ` · ${n} ảnh` : manual.includes(f.properties.name) ? " · Đã đến" : ""}`;
        }, { sticky: true, className: "tip", direction: "top" });
      },
    }).addTo(map);

    for (const f of geo.features) {
      const [lng, lat] = f.properties.label;
      labels[f.properties.name] = L.marker([lat, lng], {
        interactive: false,
        icon: L.divIcon({ className: "province-label", html: `<span>${f.properties.name}</span>`, iconSize: [0, 0] }),
      }).addTo(map);
    }
    for (const is of ISLANDS) {
      L.marker([is.lat, is.lng], {
        interactive: false,
        icon: L.divIcon({ className: "island-label", html: `<span><b></b>${is.name}<br>${is.sub}</span>`, iconSize: [0, 0] }),
      }).addTo(map);
    }

    const fit = () => map.fitBounds(L.latLngBounds([8.2, 102.1], [23.4, 115.5]), { padding: [10, 10] });
    fit();
    map.setMaxBounds(L.latLngBounds([4, 96], [27, 121]));
    map.on("zoomend", updateLabels);
    window.addEventListener("resize", () => map.invalidateSize());
    updateLabels();
  }

  // Names of all provinces once zoomed in; only visited ones on the overview
  function updateLabels() {
    const z = map.getZoom();
    const visited = visitedSet();
    for (const [name, m] of Object.entries(labels)) {
      const v = visited.has(name);
      const node = m.getElement();
      if (!node) continue;
      node.classList.toggle("visited", v);
      node.style.display = z >= 6.25 || (v && z >= 5) ? "" : "none";
    }
  }

  function refreshMap() {
    if (!layer) return;
    layer.setStyle(styleFor);
    updateLabels();
  }

  function selectProvince(name) {
    selected = name;
    refreshMap();
    renderSide();
    const f = geo.features.find((x) => x.properties.name === name);
    if (f) map.flyToBounds(L.geoJSON(f).getBounds(), { padding: [30, 30], maxZoom: 8, duration: 0.6 });
  }

  // ---------- side panel ----------
  function thumbButton(p, list) {
    const b = el("button", { type: "button", className: "thumb", title: p.title || p.province || "" },
      el("img", { src: imgUrl(p, "thumb"), alt: p.title || "", loading: "lazy" }));
    b.onclick = () => openViewer(list, list.indexOf(p));
    return b;
  }

  function renderSide() {
    const groups = byProvince();
    $("sideBack").hidden = !selected;
    if (selected) {
      const list = (groups.get(selected) || []).sort((a, b) => photoDate(b).localeCompare(photoDate(a)));
      $("sideTitle").textContent = `${selected} · ${list.length} ảnh`;
      const ticked = manual.includes(selected);
      const toggle = isAdmin() && provinces.includes(selected) && !list.length
        ? el("button", { type: "button", className: ticked ? "" : "primary", textContent: ticked ? "Bỏ đánh dấu đã đến" : "✓ Đánh dấu đã đến" })
        : null;
      if (toggle) toggle.onclick = () => saveManual(ticked ? manual.filter((n) => n !== selected) : [...manual, selected]);
      $("sideBody").replaceChildren(
        list.length
          ? el("div", { className: "grid" }, ...list.map((p) => thumbButton(p, list)))
          : el("p", { className: "empty", textContent: ticked ? "Đã đến, chưa có ảnh." : "Chưa có ảnh ở nơi này." }),
        toggle);
      return;
    }
    $("sideTitle").textContent = "Nơi đã đến";
    const rows = [...groups.entries()].filter(([n]) => n !== ABROAD).sort((a, b) => b[1].length - a[1].length);
    for (const n of manual) if (!groups.has(n)) rows.push([n, []]);
    const abroad = groups.get(ABROAD);
    if (abroad) rows.push([ABROAD, abroad]);
    // Photos with no place chosen are kept under "Other"
    const other = photos.filter((p) => !p.province);
    if (other.length) rows.push([OTHER, other]);
    if (!rows.length) {
      $("sideBody").replaceChildren(el("p", { className: "empty", textContent: "Chưa có ảnh nào." }));
      return;
    }
    $("sideBody").replaceChildren(...rows.map(([name, list]) => {
      const b = el("button", { type: "button", className: "prov" },
        el("i", { style: `background:${name === ABROAD || name === OTHER ? cssVar("--muted") : colorOf(name)}` }),
        el("span", { textContent: name }),
        el("small", { textContent: list.length ? `${list.length} ảnh` : "Đã đến" }));
      b.onclick = () => (name === ABROAD || name === OTHER ? showList(name, list) : selectProvince(name));
      return b;
    }));
  }

  function showList(title, list) {
    selected = title;
    $("sideBack").hidden = false;
    $("sideTitle").textContent = `${title} · ${list.length} ảnh`;
    $("sideBody").replaceChildren(el("div", { className: "grid" }, ...list.map((p) => thumbButton(p, list))));
  }

  // ---------- stats & timeline ----------
  function renderStats() {
    const visited = visitedSet().size;
    $("visitedText").textContent = `Đã đến ${visited}/34 tỉnh, thành phố · ${photos.length} ảnh`;
    $("visitedBar").style.width = `${(visited / 34) * 100}%`;
    $("photoCount").textContent = photos.length ? `${photos.length} ảnh` : "";
  }

  function renderTimeline() {
    if (!photos.length) {
      $("timeline").replaceChildren(el("p", { className: "empty", textContent: "Chưa có ảnh nào." }));
      return;
    }
    const sorted = [...photos].sort((a, b) => photoDate(b).localeCompare(photoDate(a)));
    // Month headings, then one row per day with its places
    const months = new Map();
    for (const p of sorted) {
      const d = new Date(photoDate(p));
      const month = isNaN(d) ? "Không rõ thời gian" : `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
      const day = isNaN(d) ? "" : fmtDate(photoDate(p));
      if (!months.has(month)) months.set(month, new Map());
      const days = months.get(month);
      days.set(day, [...(days.get(day) || []), p]);
    }
    $("timeline").replaceChildren(...[...months.entries()].map(([month, days]) =>
      el("div", { className: "tl-month" },
        el("h3", { textContent: month }),
        ...[...days.entries()].map(([day, list]) => {
          const places = [...new Set(list.map((p) => [p.place, p.province].filter(Boolean).join(", ")).filter(Boolean))].join(" · ");
          return el("div", { className: "tl-day" },
            el("p", { className: "tl-day-head" }, el("span", { textContent: day || "Không rõ ngày" }), places ? el("small", { textContent: ` · ${places}` }) : null),
            el("div", { className: "grid" }, ...list.map((p) => thumbButton(p, sorted))));
        }))));
  }

  function renderAll() {
    renderStats();
    renderSide();
    renderTimeline();
    refreshMap();
  }

  // ---------- viewer ----------
  let viewList = [], viewIndex = 0;
  function openViewer(list, index) {
    viewList = list;
    viewIndex = index;
    showViewer();
    $("viewer").showModal();
  }
  function showViewer() {
    const p = viewList[viewIndex];
    if (!p) return;
    $("viewerImg").src = imgUrl(p);
    $("viewerImg").alt = p.title || "";
    const meta = [[p.place, p.province].filter(Boolean).join(", "), fmtDate(photoDate(p)), p.camera].filter(Boolean).join(" · ");
    $("viewerText").replaceChildren(
      p.title ? el("p", {}, el("strong", { textContent: p.title })) : null,
      el("p", { className: "muted small", textContent: meta }),
      p.note ? el("p", { textContent: p.note }) : null,
    );
    $("viewerPrev").hidden = viewIndex <= 0;
    $("viewerNext").hidden = viewIndex >= viewList.length - 1;
    const f = $("editForm");
    f.hidden = !adminKey;
    if (adminKey) {
      f.title.value = p.title || "";
      f.province.value = p.province || "";
      f.place.value = p.place || "";
      f.takenAt.value = (photoDate(p) || "").slice(0, 10);
      f.note.value = p.note || "";
    }
  }
  const step = (d) => { if (viewList[viewIndex + d]) { viewIndex += d; showViewer(); } };
  $("viewerPrev").onclick = () => step(-1);
  $("viewerNext").onclick = () => step(1);
  $("viewerClose").onclick = () => $("viewer").close();
  $("viewer").addEventListener("click", (e) => { if (e.target.classList.contains("viewer-box")) $("viewer").close(); });
  document.addEventListener("keydown", (e) => {
    if (!$("viewer").open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });

  $("editForm").onsubmit = async (e) => {
    e.preventDefault();
    const p = viewList[viewIndex];
    const f = e.target;
    try {
      const updated = await api(`/api/photos/${p.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: f.title.value, province: f.province.value, place: f.place.value, takenAt: f.takenAt.value, note: f.note.value }),
      });
      Object.assign(p, updated);
      Object.assign(photos.find((x) => x.id === p.id) || {}, updated);
      renderAll();
      showViewer();
      toast("✓ Đã lưu");
    } catch (err) { toast(err.message); }
  };
  $("deleteBtn").onclick = async () => {
    const p = viewList[viewIndex];
    if (!confirm("Xóa ảnh này khỏi bản đồ và Google Drive?")) return;
    try {
      await api(`/api/photos/${p.id}`, { method: "DELETE" });
      photos = photos.filter((x) => x.id !== p.id);
      $("viewer").close();
      renderAll();
      toast("✓ Đã xóa");
    } catch (err) { toast(err.message); }
  };

  // ---------- admin ----------
  function provinceOptions(select, value) {
    select.replaceChildren(el("option", { value: "", textContent: "— Chọn tỉnh —" }),
      ...[...provinces, ABROAD].map((n) => el("option", { value: n, textContent: n })));
    select.value = value || "";
  }

  const connectDrive = () => {
    toast("Chọn tài khoản Google để lưu ảnh");
    window.open(`${API}/oauth/start?key=${encodeURIComponent(adminKey)}`, "_blank");
  };

  function logout() {
    adminKey = null;
    store.set("mem-admin", null);
    renderAdmin(null);
    if ($("viewer").open) showViewer();
    toast("Đã thoát chế độ quản lý");
  }

  // Signed out: lock button only. Signed in: green bar with Drive account, + Thêm ảnh, edit in viewer.
  function renderAdmin(status) {
    const on = !!(adminKey && status?.admin);
    $("adminBtn").hidden = on;
    $("adminActions").hidden = !(on && status.connected);
    $("adminBar").hidden = !on;
    if (geo) renderSide();
    if (!on) return;
    $("adminBar").classList.toggle("warn", !status.connected);
    $("adminText").textContent = status.connected
      ? `Đang quản lý · Ảnh lưu vào Google Drive: ${status.email || "đã kết nối"}`
      : "Đang quản lý · Chưa kết nối Google Drive";
    $("connectBtn").textContent = status.connected ? "Đổi tài khoản Drive" : "Kết nối Drive";
    $("driveLink").hidden = !status.folder;
    if (status.folder) $("driveLink").href = `https://drive.google.com/drive/folders/${status.folder}`;
  }

  async function checkAdmin() {
    if (!adminKey) return renderAdmin(null);
    try {
      const s = await api("/api/status");
      if (!s.admin) throw new Error("Sai mật khẩu quản lý.");
      renderAdmin(s);
      return s;
    } catch (err) {
      adminKey = null;
      store.set("mem-admin", null);
      renderAdmin(null);
      toast(err.message);
    }
  }

  $("adminBtn").onclick = async () => {
    const key = prompt("Mật khẩu quản lý:");
    if (!key) return;
    adminKey = key.trim();
    store.set("mem-admin", adminKey);
    const s = await checkAdmin();
    if (!s) return;
    toast("✓ Đã vào chế độ quản lý");
    if (!s.connected) connectDrive();
  };
  $("logoutBtn").onclick = logout;
  $("connectBtn").onclick = connectDrive;
  // Coming back from the Google tab: refresh the Drive status
  window.addEventListener("focus", () => adminKey && checkAdmin());

  // ---------- places visited without photos ----------
  const isAdmin = () => !$("adminBar").hidden;
  async function saveManual(list) {
    try {
      manual = await api("/api/visited", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ provinces: list }) });
      renderAll();
      toast("✓ Đã lưu nơi đã đến");
    } catch (err) { toast(err.message); }
  }

  $("visitedBtn").onclick = () => {
    const withPhotos = byProvince();
    $("visitedList").replaceChildren(...provinces.map((n) => {
      const has = withPhotos.has(n);
      const box = el("input", { type: "checkbox", value: n, checked: has || manual.includes(n), disabled: has });
      return el("label", { className: "vis-item", title: has ? "Đã có ảnh" : "" }, box, el("span", { textContent: n }), has ? el("small", { textContent: "có ảnh" }) : null);
    }));
    $("visitedDlg").showModal();
  };
  $("visitedSave").onclick = async () => {
    const list = [...$("visitedList").querySelectorAll("input:checked:not(:disabled)")].map((x) => x.value);
    await saveManual(list);
    $("visitedDlg").close();
  };

  // ---------- upload ----------
  let pending = [];

  // Run tasks with at most `limit` in flight
  async function pool(items, limit, task) {
    const out = new Array(items.length);
    let next = 0;
    const worker = async () => { while (next < items.length) { const i = next++; out[i] = await task(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return out;
  }

  async function resize(bitmap, max, type, quality) {
    const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * s), h = Math.round(bitmap.height * s);
    const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
    c.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise((r) => c.toBlob(r, type, quality));
    return { blob, width: w, height: h };
  }

  const localDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // GPS → "Hội An" style place name (free client-side geocoder, no key)
  const geoCache = new Map();
  async function placeName(lat, lng) {
    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    if (!geoCache.has(key)) {
      geoCache.set(key, fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=vi`)
        .then((r) => r.json())
        // "Phường Hội An" / "Phuong Hoi An" → "Hội An"
        .then((d) => (d.locality || d.city || "").replace(/^(phường|phuong|xã|xa|thị trấn|thi tran|quận|quan)\s+/i, ""))
        .catch(() => ""));
    }
    return geoCache.get(key);
  }

  async function prepare(file) {
    let exif = {};
    try { exif = (await exifr.parse(file, { gps: true, tiff: true, exif: true })) || {}; } catch {}
    let source = file;
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
      if (!window.heic2any) throw new Error("Chưa tải xong bộ đọc HEIC, thử lại sau vài giây.");
      source = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    }
    const bitmap = await createImageBitmap(source);
    const [full, thumb] = await Promise.all([resize(bitmap, 2560, "image/jpeg", 0.88), resize(bitmap, 480, "image/webp", 0.8)]);
    bitmap.close();
    const lat = exif.latitude ?? null, lng = exif.longitude ?? null;
    const date = exif.DateTimeOriginal || exif.CreateDate || (file.lastModified ? new Date(file.lastModified) : null);
    return {
      name: file.name.replace(/\.(heic|heif|png|webp|avif)$/i, ".jpg"),
      preview: URL.createObjectURL(thumb.blob),
      full, thumb, lat, lng,
      province: lat != null ? provinceAt(lat, lng) || ABROAD : "",
      place: lat != null ? await placeName(lat, lng) : "",
      takenAt: date instanceof Date && !isNaN(date) ? localDay(date) : "",
      camera: [exif.Make, exif.Model].filter(Boolean).join(" ").replace(/^(\w+) \1/i, "$1").trim(),
    };
  }

  $("addBtn").onclick = () => $("fileInput").click();
  $("fileInput").onchange = (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    handleFiles(files);
  };

  // Drag photos anywhere on the page (manage mode, Drive connected)
  let dragDepth = 0;
  const canDrop = (e) => !$("addBtn").closest("[hidden]") && [...(e.dataTransfer?.types || [])].includes("Files");
  window.addEventListener("dragenter", (e) => { if (!canDrop(e)) return; e.preventDefault(); dragDepth++; $("dropOverlay").hidden = false; });
  window.addEventListener("dragover", (e) => { if (canDrop(e)) e.preventDefault(); });
  window.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; $("dropOverlay").hidden = true; } });
  window.addEventListener("drop", (e) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    dragDepth = 0;
    $("dropOverlay").hidden = true;
    handleFiles([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name)));
  });

  async function handleFiles(files) {
    if (!files.length) return;
    pending = [];
    $("uploadList").replaceChildren(el("p", { className: "muted small", textContent: `Đang đọc ${files.length} ảnh…` }));
    $("upProgress").hidden = true;
    $("uploadDlg").showModal();
    let done = 0;
    const note = $("uploadList").firstChild;
    const ready = await pool(files, Math.max(2, Math.min(4, navigator.hardwareConcurrency || 4)), async (f) => {
      try { return await prepare(f); }
      catch (err) { toast(`${f.name}: ${err.message}`); return null; }
      finally { note.textContent = `Đang đọc ảnh ${++done}/${files.length}…`; }
    });
    pending = ready.filter(Boolean);
    renderPending();
  }

  // Simple review: every photo keeps its own date/GPS; one province for photos without GPS
  function renderPending() {
    if ($("upProvince").options.length < 2) {
      provinceOptions($("upProvince"));
      $("upProvince").options[0].textContent = "Other (không chọn tỉnh)";
    }
    $("upProvince").value = "";
    const noGps = pending.filter((p) => p.lat == null).length;
    $("upSummary").textContent = `${pending.length} ảnh` + (pending.length - noGps ? ` · ${pending.length - noGps} ảnh có GPS (tự gán nơi)` : "") + (noGps ? ` · ${noGps} ảnh không có GPS` : "");
    $("upPlaceRow").hidden = !noGps;
    $("uploadList").replaceChildren(...pending.map((p) => {
      p.box = el("div", { className: "up-item", title: [p.place, p.province, p.takenAt].filter(Boolean).join(" · ") },
        el("img", { src: p.preview, alt: "" }),
        el("span", { textContent: p.place || p.province || "" }));
      return p.box;
    }));
    $("uploadGo").disabled = !pending.length;
  }

  const UPLOAD_LIMIT = 4;
  // XHR instead of fetch so upload progress can be shown
  const sendFile = (blob, name, type, extra, onProgress) => new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", new File([blob], name, { type }));
    for (const [k, v] of Object.entries(extra)) fd.append(k, v || "");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/upload`);
    xhr.setRequestHeader("x-admin-key", adminKey);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded);
    xhr.onload = () => {
      let data = {};
      try { data = JSON.parse(xhr.responseText); } catch {}
      xhr.status < 300 && data.id ? (onProgress(blob.size), resolve(data.id)) : reject(new Error(data.error || `Lỗi ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Mất kết nối khi tải lên."));
    xhr.send(fd);
  });

  $("uploadGo").onclick = async () => {
    const todo = pending.filter((p) => !p.done);
    // Photos without GPS take the chosen province, or "Other" when none is chosen
    const chosen = $("upProvince").value;
    for (const p of todo) if (p.lat == null) p.province = chosen;
    $("uploadGo").disabled = true;
    const t0 = performance.now();
    // Overall progress: bytes sent across every photo + photos finished
    const total = todo.reduce((n, p) => n + p.full.blob.size + p.thumb.blob.size, 0);
    const sent = new Map();
    let finished = 0;
    const paint = () => {
      const bytes = [...sent.values()].reduce((a, b) => a + b, 0);
      const pct = Math.min(99, Math.round((bytes / total) * 100));
      $("upBar").style.width = `${pct}%`;
      $("upText").textContent = pct >= 99 ? `Đang lưu lên Google Drive… (${finished}/${todo.length} ảnh xong)` : `Đang tải lên ${finished}/${todo.length} ảnh · ${pct}%`;
    };
    $("upProgress").hidden = false;
    $("upText").textContent = "Đang chuẩn bị thư mục trên Drive…";
    try {
      const groups = [...new Map(todo.map((p) => [`${p.province}|${(p.takenAt || "").slice(0, 4)}`, { province: p.province, takenAt: p.takenAt }])).values()];
      await api("/api/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groups }) });
    } catch (err) { toast(err.message); }
    paint();
    // 1) files to Drive, several photos at once (full + thumbnail in parallel per photo)
    await pool(todo, UPLOAD_LIMIT, async (p) => {
      try {
        const track = (key) => (n) => { sent.set(key, n); paint(); };
        const [fileId, thumbId] = await Promise.all([
          sendFile(p.full.blob, p.name, "image/jpeg", { province: p.province, takenAt: p.takenAt, place: p.place }, track(p.name + "f")),
          sendFile(p.thumb.blob, p.name.replace(/\.\w+$/, ".webp"), "image/webp", { kind: "thumb" }, track(p.name + "t")),
        ]);
        Object.assign(p, { fileId, thumbId });
        finished++;
        paint();
      } catch (err) {
        p.box.className = "up-item err";
        p.box.title = err.message;
      }
    });
    // 2) add them all to the list in one request
    const uploaded = todo.filter((p) => p.fileId);
    $("upText").textContent = `Đang lưu ${uploaded.length} ảnh vào bản đồ…`;
    if (uploaded.length) {
      try {
        const added = await api("/api/photos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ items: uploaded.map((p) => ({
            fileId: p.fileId, thumbId: p.thumbId, name: p.name, width: p.full.width, height: p.full.height,
            camera: p.camera, province: p.province, place: p.place || "", takenAt: p.takenAt, title: p.title || "", lat: p.lat, lng: p.lng,
          })) }),
        });
        photos.push(...added);
        for (const p of uploaded) { p.done = true; p.box.className = "up-item ok"; }
      } catch (err) {
        for (const p of uploaded) { p.box.className = "up-item err"; p.box.title = err.message; }
      }
    }
    renderAll();
    $("uploadGo").disabled = false;
    const ok = todo.filter((p) => p.done).length;
    $("upBar").style.width = "100%";
    $("upText").textContent = `✓ Xong ${ok}/${todo.length} ảnh`;
    toast(`✓ Đã tải lên ${ok}/${todo.length} ảnh trong ${((performance.now() - t0) / 1000).toFixed(1)} giây`);
    if (pending.every((p) => p.done)) setTimeout(() => $("uploadDlg").close(), 800);
  };

  // ---------- start ----------
  async function start() {
    geo = await (await fetch("vn-34.json")).json();
    provinces = geo.features.map((f) => f.properties.name).sort((a, b) => a.localeCompare(b, "vi"));
    provinceOptions($("editForm").province);
    initMap();
    try {
      [photos, manual] = await Promise.all([api("/api/photos"), api("/api/visited").catch(() => [])]);
    } catch (err) {
      toast(`Không tải được ảnh: ${err.message}`);
    }
    renderAll();
    $("sideBack").onclick = () => {
      selected = null;
      renderAll();
      map.flyToBounds(L.latLngBounds([8.2, 102.1], [23.4, 115.5]), { padding: [10, 10], duration: 0.6 });
    };
    checkAdmin();
  }
  start();
})();

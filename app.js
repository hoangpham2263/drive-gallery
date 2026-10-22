// Hoang's Memories — travel map of Vietnam (34 provinces, 2025) with photo milestones.
// Photos and their metadata are served by the Cloudflare Worker in worker/ (Google Drive behind it).
(() => {
  const API = "https://memories-api.hoangpham2263.workers.dev";
  const ABROAD = "Nước ngoài";
  const OTHER = "Other";
  const TRIP_GAP_DAYS = 2; // photos in the same province within 2 days belong to one trip
  const PALETTE = ["#60a5fa", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#fb923c", "#2dd4bf", "#f87171", "#818cf8", "#a3e635"];
  const ISLANDS = [
    { name: "Quần đảo Hoàng Sa", sub: "(Đà Nẵng)", lat: 16.5, lng: 112.0 },
    { name: "Quần đảo Trường Sa", sub: "(Khánh Hòa)", lat: 9.6, lng: 114.2 },
  ];
  const VN_BOUNDS = [[8.2, 102.1], [23.4, 115.5]];

  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
  };

  let photos = [];
  let manual = []; // provinces ticked as visited without photos
  let places = []; // specific places visited: { name, province, lat, lng }
  let meta = { trips: {}, covers: {} }; // trip names/notes/covers, province covers
  let geo = null;
  let provinces = []; // names, sorted
  let selected = null; // province name, list title, or null
  let adminKey = store.get("mem-admin");
  let admin = false;
  let selecting = false;
  const picked = new Set();
  let map, layer, pinLayer, placeLayer;
  const labels = {};

  // ---------- helpers ----------
  let toastTimer;
  function toast(text, ms = 2200) {
    let el = document.querySelector(".toast");
    if (!el) { el = Object.assign(document.createElement("div"), { className: "toast", role: "status" }); document.body.append(el); }
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }
  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children.filter((c) => c != null));
    return node;
  };
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const photoDate = (p) => p.takenAt || p.createdAt || "";
  const fmtDate = (s) => {
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d) ? "" : d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };
  const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const byProvince = () => {
    const m = new Map();
    for (const p of photos) if (p.province) m.set(p.province, [...(m.get(p.province) || []), p]);
    return m;
  };
  const newestFirst = (list) => [...list].sort((a, b) => photoDate(b).localeCompare(photoDate(a)));
  const download = (blob, name) => {
    const a = el("a", { href: URL.createObjectURL(blob), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (adminKey) headers["x-admin-key"] = adminKey;
    const r = await fetch(API + path, { ...opts, headers });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Lỗi ${r.status}`);
    return data;
  }
  const jsonBody = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  // Public photos load straight from the Worker; private ones need the admin key, so they are fetched as blobs
  const blobCache = new Map();
  function setImg(img, p, size) {
    const url = `${API}/api/img/${p.id}${size ? `?size=${size}` : ""}`;
    if (!p.private) { img.src = url; return; }
    if (!blobCache.has(url)) {
      blobCache.set(url, fetch(url, { headers: { "x-admin-key": adminKey || "" } }).then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : "")));
    }
    blobCache.get(url).then((src) => { if (src) img.src = src; });
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
    // Coast and islands: the simplified borders miss some points, take the nearest province within ~30 km
    let best = null, bestD = 0.3 ** 2;
    for (const f of geo.features) {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
      for (const poly of polys) for (const [x, y] of poly[0]) {
        const d = (x - lng) ** 2 + (y - lat) ** 2;
        if (d < bestD) { bestD = d; best = f.properties.name; }
      }
    }
    return best;
  }
  const labelOf = (name) => geo.features.find((f) => f.properties.name === name)?.properties.label; // [lng, lat]

  // ---------- trips ----------
  // Consecutive photos in the same province, at most TRIP_GAP_DAYS apart, form one trip
  function computeTrips() {
    const dated = photos.filter((p) => p.takenAt && p.province).sort((a, b) => a.takenAt.localeCompare(b.takenAt));
    const trips = [];
    let cur = null;
    for (const p of dated) {
      const gap = cur ? (new Date(p.takenAt) - new Date(cur.end)) / 86400000 : Infinity;
      if (cur && cur.province === p.province && gap <= TRIP_GAP_DAYS) {
        cur.photos.push(p);
        cur.end = p.takenAt;
      } else {
        cur = { province: p.province, start: p.takenAt, end: p.takenAt, photos: [p] };
        trips.push(cur);
      }
    }
    for (const t of trips) {
      t.key = `${slug(t.province)}-${t.start}`;
      const m = meta.trips[t.key] || {};
      t.name = m.name || t.province;
      t.note = m.note || "";
      t.cover = t.photos.find((p) => p.id === m.cover) || t.photos[0];
      t.places = [...new Set(t.photos.map((p) => p.place).filter(Boolean))];
    }
    return trips.reverse();
  }
  const tripRange = (t) => {
    const a = new Date(t.start), b = new Date(t.end);
    if (t.start === t.end) return fmtDate(t.start);
    if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${a.getDate()}–${fmtDate(t.end)}`;
    return `${fmtDate(t.start)} – ${fmtDate(t.end)}`;
  };
  const coverOf = (province) => {
    const list = byProvince().get(province) || [];
    return list.find((p) => p.id === meta.covers[province]) || newestFirst(list)[0];
  };
  const saveMeta = async (next) => {
    meta = await api("/api/meta", jsonBody("PUT", next));
    renderAll();
  };

  // ---------- map ----------
  function colorOf(name) {
    const i = provinces.indexOf(name);
    return PALETTE[(i < 0 ? 0 : i) % PALETTE.length];
  }
  const placesIn = (province) => places.filter((x) => x.province === province);
  // Visited = has photos, a pinned place, or ticked by hand
  const visitedSet = () => new Set([...byProvince().keys(), ...manual, ...places.map((x) => x.province)].filter((n) => provinces.includes(n)));

  function styleFor(feature) {
    const hasPhotos = byProvince().has(feature.properties.name);
    const visited = hasPhotos || visitedSet().has(feature.properties.name);
    const active = feature.properties.name === selected;
    return {
      color: active ? cssVar("--primary") : cssVar("--bg"),
      weight: active ? 1.25 : 1,
      fillColor: visited ? colorOf(feature.properties.name) : cssVar("--land"),
      fillOpacity: visited ? (hasPhotos ? 0.85 : 0.5) : 1,
    };
  }

  function initMap() {
    // Fixed view of the whole country: no zoom, no panning
    map = L.map("map", { zoomControl: false, attributionControl: false, zoomSnap: 0.25, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false });
    layer = L.geoJSON(geo, {
      style: styleFor,
      onEachFeature: (f, lyr) => {
        lyr.on("click", () => selectProvince(f.properties.name));
        // Hovered province on top so neighbours don't cover half of its border
        lyr.on("mouseover", () => { lyr.setStyle({ weight: 1.25, color: cssVar("--primary") }); lyr.bringToFront(); });
        lyr.on("mouseout", () => { layer.resetStyle(lyr); raiseSelected(); });
        lyr.bindTooltip(() => {
          const n = byProvince().get(f.properties.name)?.length || 0;
          const spots = placesIn(f.properties.name).map((x) => x.name).join(", ");
          return `${f.properties.name}${n ? ` · ${n} ảnh` : visitedSet().has(f.properties.name) ? " · Đã đến" : ""}${spots ? `<br><small>${spots}</small>` : ""}`;
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
    pinLayer = L.layerGroup().addTo(map);
    placeLayer = L.layerGroup().addTo(map);

    map.fitBounds(VN_BOUNDS, { padding: [10, 10] });
    window.addEventListener("resize", () => { map.invalidateSize(); map.fitBounds(VN_BOUNDS, { padding: [10, 10] }); });
  }

  // One small pin per GPS photo
  function drawMarkers() {
    pinLayer.clearLayers();
    const sorted = newestFirst(photos.filter((p) => p.lat != null && p.lng != null));
    for (const p of sorted) {
      const pin = L.circleMarker([p.lat, p.lng], { radius: 5, color: "#fff", weight: 1.5, fillColor: cssVar("--primary"), fillOpacity: 1 });
      pin.bindTooltip([p.place, fmtDate(photoDate(p))].filter(Boolean).join(" · "), { className: "tip", direction: "top" });
      pin.on("click", () => openViewer(sorted, sorted.indexOf(p)));
      pinLayer.addLayer(pin);
    }
    // Places visited: small ring, always visible
    placeLayer.clearLayers();
    for (const x of places) {
      if (x.lat == null || x.lng == null) continue;
      const m = L.circleMarker([x.lat, x.lng], { radius: 4, color: cssVar("--fg"), weight: 1.5, fillColor: cssVar("--bg"), fillOpacity: 1 });
      m.bindTooltip(x.name, { className: "tip", direction: "top" });
      if (x.province) m.on("click", () => selectProvince(x.province));
      placeLayer.addLayer(m);
    }
    updateLayers();
  }

  function updateLayers() {
    const visited = visitedSet();
    for (const [name, m] of Object.entries(labels)) {
      const node = m.getElement();
      if (!node) continue;
      node.classList.toggle("visited", visited.has(name));
      node.style.display = "";
    }
  }

  function refreshMap() {
    if (!layer) return;
    layer.setStyle(styleFor);
    drawMarkers();
  }

  // Selected province on top so its whole border shows
  const raiseSelected = () => layer.eachLayer((l) => l.feature.properties.name === selected && l.bringToFront());

  function selectProvince(name) {
    selected = name;
    layer.setStyle(styleFor);
    raiseSelected();
    renderSide();
  }

  // ---------- photo tiles ----------
  function thumbButton(p, list) {
    const img = el("img", { alt: p.title || "", loading: "lazy" });
    setImg(img, p, "thumb");
    const b = el("button", { type: "button", className: "thumb", title: p.title || p.place || p.province || "" }, img,
      p.private ? el("span", { className: "lock", textContent: "🔒" }) : null);
    b.classList.toggle("sel", picked.has(p.id));
    b.onclick = () => {
      if (!selecting) return openViewer(list, list.indexOf(p));
      picked.has(p.id) ? picked.delete(p.id) : picked.add(p.id);
      b.classList.toggle("sel", picked.has(p.id));
      renderSelBar();
    };
    return b;
  }
  const grid = (list) => el("div", { className: "grid" }, ...list.map((p) => thumbButton(p, list)));

  // ---------- side panel ----------
  function renderSide() {
    const groups = byProvince();
    $("sideBack").hidden = !selected;
    if (selected && provinces.concat(ABROAD).includes(selected)) {
      const list = newestFirst(groups.get(selected) || []);
      $("sideTitle").textContent = `${selected} · ${list.length} ảnh`;
      const ticked = visitedSet().has(selected);
      const spots = placesIn(selected);
      $("sideBody").replaceChildren(...[
        spots.length ? el("div", { className: "chip-row" }, ...spots.map((x) => el("span", { className: "chip", textContent: x.name }))) : null,
        list.length ? grid(list) : el("p", { className: "empty", textContent: ticked ? "Đã đến, chưa có ảnh." : "Chưa có ảnh ở nơi này." }),
      ].filter(Boolean));
      return;
    }
    if (selected === OTHER) return showList(OTHER, newestFirst(photos.filter((p) => !p.province)));
    selected = null;
    $("sideTitle").textContent = "Nơi đã đến";
    const rows = [...groups.entries()].filter(([n]) => n !== ABROAD).sort((a, b) => b[1].length - a[1].length);
    for (const n of visitedSet()) if (!groups.has(n)) rows.push([n, []]);
    if (groups.get(ABROAD)) rows.push([ABROAD, groups.get(ABROAD)]);
    const other = photos.filter((p) => !p.province);
    if (other.length) rows.push([OTHER, other]);
    if (!rows.length) return $("sideBody").replaceChildren(el("p", { className: "empty", textContent: "Chưa có nơi nào." }));
    $("sideBody").replaceChildren(...rows.map(([name, list]) => {
      const cover = name === OTHER ? null : coverOf(name);
      const icon = cover ? el("img", { className: "prov-cover", alt: "" }) : el("i", { style: `background:${name === OTHER || name === ABROAD ? cssVar("--muted") : colorOf(name)}` });
      if (cover) setImg(icon, cover, "thumb");
      const b = el("button", { type: "button", className: "prov" }, icon,
        el("span", { textContent: name }),
        el("small", { textContent: list.length ? `${list.length} ảnh` : placesIn(name).length ? `${placesIn(name).length} địa điểm` : "Đã đến" }));
      b.onclick = () => (name === OTHER ? showList(OTHER, newestFirst(list)) : selectProvince(name));
      return b;
    }));
  }

  function showList(title, list, head) {
    selected = title;
    $("sideBack").hidden = false;
    $("sideTitle").textContent = `${title} · ${list.length} ảnh`;
    $("sideBody").replaceChildren(...(head || []), grid(list));
  }

  // ---------- trips ----------
  function openTrip(t, scroll = true) {
    selected = t.key;
    layer.setStyle(styleFor);
    const share = el("button", { type: "button", textContent: "Sao chép link" });
    share.onclick = async () => {
      try { await navigator.clipboard.writeText(`${location.origin}${location.pathname}#trip=${t.key}`); toast("✓ Đã sao chép link chuyến đi"); }
      catch { toast("Không sao chép được"); }
    };
    const edit = admin ? el("button", { type: "button", textContent: "Sửa" }) : null;
    if (edit) edit.onclick = () => editTrip(t);
    const head = [
      el("div", { className: "trip-head" },
        el("p", { className: "muted small", textContent: [tripRange(t), t.places.slice(0, 4).join(", ")].filter(Boolean).join(" · ") }),
        t.note ? el("p", { className: "trip-note", textContent: t.note }) : null,
        el("div", { className: "actions" }, edit, share)),
    ];
    showList(t.name, t.photos, head);
    history.replaceState(null, "", `#trip=${t.key}`);
    if (scroll) document.querySelector(".map-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  let editingTrip = null;
  function editTrip(t) {
    editingTrip = t;
    const f = $("tripForm");
    f.name.value = meta.trips[t.key]?.name || "";
    f.name.placeholder = t.province;
    f.note.value = t.note;
    $("tripDlg").showModal();
  }
  $("tripSave").onclick = async () => {
    const t = editingTrip, f = $("tripForm");
    try {
      await saveMeta({ ...meta, trips: { ...meta.trips, [t.key]: { ...(meta.trips[t.key] || {}), name: f.name.value.trim(), note: f.note.value.trim() } } });
      $("tripDlg").close();
      const fresh = computeTrips().find((x) => x.key === t.key);
      if (fresh) openTrip(fresh, false);
      toast("✓ Đã lưu chuyến đi");
    } catch (err) { toast(err.message); }
  };

  function renderTrips() {
    const trips = computeTrips();
    $("tripCount").textContent = trips.length ? `${trips.length} chuyến` : "";
    if (!trips.length) return $("trips").replaceChildren(el("p", { className: "empty", textContent: "Chưa có chuyến đi nào." }));
    $("trips").replaceChildren(...trips.map((t) => {
      const img = el("img", { alt: "", loading: "lazy" });
      setImg(img, t.cover, "thumb");
      const b = el("button", { type: "button", className: "trip" }, img,
        el("span", { className: "trip-info" },
          el("strong", { textContent: t.name }),
          el("small", { textContent: `${tripRange(t)} · ${t.photos.length} ảnh` })));
      b.onclick = () => openTrip(t);
      return b;
    }));
  }

  // ---------- stats ----------
  function renderStats() {
    const visited = visitedSet();
    $("visitedText").textContent = `Đã đến ${visited.size}/34 tỉnh, thành phố · ${photos.length} ảnh`;
    $("visitedBar").style.width = `${(visited.size / 34) * 100}%`;
    $("photoCount").textContent = photos.length ? `${photos.length} ảnh` : "";
    $("statsCard").hidden = !photos.length;
    if (!photos.length) return;
    const trips = computeTrips();
    const days = new Set(photos.map((p) => p.takenAt).filter(Boolean)).size;
    const top = [...byProvince().entries()].filter(([n]) => n !== ABROAD).sort((a, b) => b[1].length - a[1].length)[0];
    const years = new Map();
    for (const t of trips) years.set(t.start.slice(0, 4), (years.get(t.start.slice(0, 4)) || 0) + 1);
    const topYear = [...years.entries()].sort((a, b) => b[1] - a[1])[0];
    const byLat = [...visited].map((n) => [n, labelOf(n)?.[1]]).filter(([, lat]) => lat != null).sort((a, b) => b[1] - a[1]);
    const items = [
      [trips.length, "chuyến đi"],
      [days, "ngày đã đi"],
      [visited.size, "tỉnh, thành phố"],
      top ? [top[0], `đến nhiều nhất · ${top[1].length} ảnh`] : null,
      topYear ? [topYear[0], `đi nhiều nhất · ${topYear[1]} chuyến`] : null,
      byLat.length ? [byLat[0][0], "xa nhất phía Bắc"] : null,
      byLat.length ? [byLat.at(-1)[0], "xa nhất phía Nam"] : null,
    ].filter(Boolean);
    $("stats").replaceChildren(...items.map(([v, label]) => el("div", { className: "stat" }, el("strong", { textContent: v }), el("span", { textContent: label }))));
  }

  // ---------- timeline ----------
  function renderTimeline() {
    if (!photos.length) return $("timeline").replaceChildren(el("p", { className: "empty", textContent: "Chưa có ảnh nào." }));
    const sorted = newestFirst(photos);
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
    renderTrips();
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
  const current = () => viewList[viewIndex];
  function showViewer() {
    const p = current();
    if (!p) return;
    $("viewerImg").removeAttribute("src");
    setImg($("viewerImg"), p);
    $("viewerImg").alt = p.title || "";
    const where = [p.place, p.province].filter(Boolean).join(", ");
    $("viewerText").replaceChildren(...[
      p.title ? el("p", {}, el("strong", { textContent: p.title })) : null,
      el("p", { className: "muted small", textContent: [where, fmtDate(photoDate(p)), p.camera, p.private ? "🔒 Chỉ mình xem" : ""].filter(Boolean).join(" · ") }),
      p.note ? el("p", { textContent: p.note }) : null,
    ].filter(Boolean));
    $("viewerPrev").hidden = viewIndex <= 0;
    $("viewerNext").hidden = viewIndex >= viewList.length - 1;
    $("viewerTools").hidden = !admin;
    $("editForm").hidden = !admin;
    if (admin) {
      const f = $("editForm");
      f.title.value = p.title || "";
      f.province.value = p.province || "";
      f.place.value = p.place || "";
      f.takenAt.value = (photoDate(p) || "").slice(0, 10);
      f.note.value = p.note || "";
      $("coverProvince").hidden = !p.province;
      $("coverTrip").hidden = !computeTrips().some((t) => t.photos.includes(p));
      $("togglePrivate").textContent = p.private ? "Công khai ảnh này" : "Chỉ mình xem";
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

  const applyUpdate = (updated) => {
    for (const u of [].concat(updated)) {
      const p = photos.find((x) => x.id === u.id);
      if (p) Object.assign(p, u);
    }
  };

  $("editForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      applyUpdate(await api(`/api/photos/${current().id}`, jsonBody("PATCH", { title: f.title.value, province: f.province.value, place: f.place.value, takenAt: f.takenAt.value, note: f.note.value })));
      renderAll();
      showViewer();
      toast("✓ Đã lưu");
    } catch (err) { toast(err.message); }
  };
  $("deleteBtn").onclick = async () => {
    const p = current();
    if (!confirm("Xóa ảnh này khỏi bản đồ và Google Drive?")) return;
    try {
      await api(`/api/photos/${p.id}`, { method: "DELETE" });
      photos = photos.filter((x) => x.id !== p.id);
      $("viewer").close();
      renderAll();
      toast("✓ Đã xóa");
    } catch (err) { toast(err.message); }
  };
  $("coverProvince").onclick = async () => {
    const p = current();
    try { await saveMeta({ ...meta, covers: { ...meta.covers, [p.province]: p.id } }); toast(`✓ Đã đặt ảnh bìa cho ${p.province}`); }
    catch (err) { toast(err.message); }
  };
  $("coverTrip").onclick = async () => {
    const p = current();
    const t = computeTrips().find((x) => x.photos.includes(p));
    if (!t) return;
    try { await saveMeta({ ...meta, trips: { ...meta.trips, [t.key]: { ...(meta.trips[t.key] || {}), cover: p.id } } }); toast("✓ Đã đặt ảnh bìa chuyến đi"); }
    catch (err) { toast(err.message); }
  };
  $("togglePrivate").onclick = async () => {
    const p = current();
    try {
      applyUpdate(await api(`/api/photos/${p.id}`, jsonBody("PATCH", { private: !p.private })));
      renderAll();
      showViewer();
      toast(p.private ? "🔒 Ảnh chỉ mình bạn xem được" : "✓ Ảnh đã công khai");
    } catch (err) { toast(err.message); }
  };

  // ---------- multi-select ----------
  function renderSelBar() {
    $("selBar").hidden = !selecting;
    $("selCount").textContent = `Đã chọn ${picked.size} ảnh`;
    for (const id of ["selMove", "selPrivate", "selPublic", "selDelete"]) $(id).disabled = !picked.size;
  }
  function setSelecting(on) {
    selecting = on;
    picked.clear();
    document.body.classList.toggle("selecting", on);
    $("selectBtn").classList.toggle("on", on);
    renderSelBar();
    renderAll();
    if (on) toast("Bấm vào ảnh để chọn");
  }
  async function batch(action, changes) {
    const ids = [...picked];
    try {
      const res = await api("/api/photos/batch", jsonBody("POST", { action, ids, changes }));
      if (action === "delete") photos = photos.filter((p) => !picked.has(p.id));
      else applyUpdate(res);
      picked.clear();
      renderSelBar();
      renderAll();
      toast(action === "delete" ? `✓ Đã xóa ${ids.length} ảnh` : `✓ Đã cập nhật ${ids.length} ảnh`);
    } catch (err) { toast(err.message); }
  }
  $("selectBtn").onclick = () => setSelecting(!selecting);
  $("selDone").onclick = () => setSelecting(false);
  $("selMove").onclick = () => {
    const province = $("selProvince").value;
    if (!province && !confirm("Chưa chọn tỉnh: các ảnh sẽ chuyển vào Other. Tiếp tục?")) return;
    batch("update", { province });
  };
  $("selPrivate").onclick = () => batch("update", { private: true });
  $("selPublic").onclick = () => batch("update", { private: false });
  $("selDelete").onclick = () => confirm(`Xóa ${picked.size} ảnh khỏi bản đồ và Google Drive?`) && batch("delete");

  // ---------- admin ----------
  function provinceOptions(select, value, empty = "— Chọn tỉnh —") {
    select.replaceChildren(el("option", { value: "", textContent: empty }),
      ...[...provinces, ABROAD].map((n) => el("option", { value: n, textContent: n })));
    select.value = value || "";
  }

  const connectDrive = () => {
    toast("Chọn tài khoản Google để lưu ảnh");
    window.open(`${API}/oauth/start?key=${encodeURIComponent(adminKey)}`, "_blank");
  };

  // Signed out: lock button only. Signed in: bar with Drive account, + Thêm ảnh, edit tools.
  function renderAdmin(status) {
    admin = !!(adminKey && status?.admin);
    $("adminBtn").hidden = admin;
    $("adminActions").hidden = !(admin && status.connected);
    $("adminBar").hidden = !admin;
    if (!admin && selecting) setSelecting(false);
    if (admin) {
      $("adminBar").classList.toggle("warn", !status.connected);
      $("adminText").textContent = status.connected
        ? `Đang quản lý · Ảnh lưu vào Google Drive: ${status.email || "đã kết nối"}`
        : "Đang quản lý · Chưa kết nối Google Drive";
      $("connectBtn").textContent = status.connected ? "Đổi tài khoản Drive" : "Kết nối Drive";
      $("driveLink").hidden = !status.folder;
      if (status.folder) $("driveLink").href = `https://drive.google.com/drive/folders/${status.folder}`;
    }
  }

  async function checkAdmin() {
    if (!adminKey) return renderAdmin(null);
    try {
      const s = await api("/api/status");
      if (!s.admin) throw new Error("Sai mật khẩu quản lý.");
      const wasAdmin = admin;
      renderAdmin(s);
      // Owner also sees private photos
      if (!wasAdmin) { photos = await api("/api/photos"); renderAll(); }
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
  $("logoutBtn").onclick = async () => {
    adminKey = null;
    store.set("mem-admin", null);
    renderAdmin(null);
    photos = photos.filter((p) => !p.private);
    renderAll();
    toast("Đã thoát chế độ quản lý");
  };
  $("connectBtn").onclick = connectDrive;
  // Coming back from the Google tab: refresh the Drive status
  window.addEventListener("focus", () => adminKey && checkAdmin());

  // ---------- backup ----------
  $("backupJson").onclick = () => {
    const data = { exportedAt: new Date().toISOString(), photos, visited: manual, places, meta };
    download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `memories-${new Date().toISOString().slice(0, 10)}.json`);
  };
  $("backupZip").onclick = async () => {
    if (!window.JSZip) return toast("Đang tải bộ nén ZIP, thử lại sau vài giây");
    if (!photos.length) return toast("Chưa có ảnh để tải");
    const zip = new JSZip();
    zip.file("memories.json", JSON.stringify({ photos, visited: manual, places, meta }, null, 2));
    let done = 0;
    $("backupZip").disabled = true;
    await pool(photos, 4, async (p) => {
      try {
        const r = await fetch(`${API}/api/img/${p.id}`, { headers: { "x-admin-key": adminKey } });
        if (r.ok) zip.file(`${p.province || OTHER}/${(p.takenAt || "").slice(0, 4) || OTHER}/${p.takenAt || "x"} ${p.id} ${p.name}`, await r.blob());
      } catch {}
      toast(`Đang tải album… ${++done}/${photos.length}`, 60000);
    });
    toast("Đang nén ZIP…", 60000);
    download(await zip.generateAsync({ type: "blob" }), `memories-album-${new Date().toISOString().slice(0, 10)}.zip`);
    $("backupZip").disabled = false;
    toast(`✓ Đã tải ${done} ảnh`);
  };

  // ---------- places visited without photos ----------
  async function saveManual(list) {
    try {
      manual = await api("/api/visited", jsonBody("PUT", { provinces: list }));
      renderAll();
      toast("✓ Đã lưu nơi đã đến");
    } catch (err) { toast(err.message); }
  }
  // Places draft while the dialog is open
  let draft = [];
  function renderDraft() {
    $("placeList").replaceChildren(...draft.map((x, i) => {
      const del = el("button", { type: "button", textContent: "✕", title: "Bỏ" });
      del.onclick = () => { draft.splice(i, 1); renderDraft(); };
      return el("span", { className: "chip" }, el("span", { textContent: x.name }), el("small", { textContent: x.province || OTHER }), del);
    }));
  }
  // Free OpenStreetMap search (Photon), limited to Vietnam
  async function searchPlace() {
    const q = $("placeQuery").value.trim();
    if (!q) return;
    $("placeResults").replaceChildren(el("p", { className: "muted small", textContent: "Đang tìm…" }));
    let found = [];
    try {
      const data = await (await fetch(`https://photon.komoot.io/api/?limit=6&bbox=102,8,110,23.5&q=${encodeURIComponent(q)}`)).json();
      found = data.features.map((f) => {
        const [lng, lat] = f.geometry.coordinates, pr = f.properties;
        return { lat, lng, label: [pr.name, pr.district || pr.city, pr.state].filter(Boolean).join(", ") };
      });
    } catch {}
    const add = (lat, lng) => {
      draft.push({ name: q, lat, lng, province: lat != null ? provinceAt(lat, lng) || "" : "" });
      $("placeQuery").value = "";
      $("placeResults").replaceChildren();
      renderDraft();
    };
    $("placeResults").replaceChildren(...[
      ...found.map((r) => {
        const b = el("button", { type: "button" }, el("span", { textContent: r.label }), el("small", { textContent: `→ ${provinceAt(r.lat, r.lng) || OTHER}` }));
        b.onclick = () => add(r.lat, r.lng);
        return b;
      }),
      found.length ? null : el("p", { className: "muted small", textContent: "Không tìm thấy, thử gõ rõ hơn (vd: Mũi Né Phan Thiết)." }),
      // Keep the name without a pin when the search has no good match
      (() => { const b = el("button", { type: "button", className: "link", textContent: `Thêm "${q}" không ghim vị trí` }); b.onclick = () => add(null, null); return b; })(),
    ].filter(Boolean));
  }
  $("placeSearch").onclick = searchPlace;
  $("placeQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); searchPlace(); } });

  $("visitedBtn").onclick = () => {
    draft = places.map((x) => ({ ...x }));
    renderDraft();
    $("placeResults").replaceChildren();
    const withPhotos = byProvince();
    $("visitedList").replaceChildren(...provinces.map((n) => {
      const has = withPhotos.has(n);
      const box = el("input", { type: "checkbox", value: n, checked: has || manual.includes(n), disabled: has });
      return el("label", { className: "vis-item", title: has ? "Đã có ảnh" : "" }, box, el("span", { textContent: n }), has ? el("small", { textContent: "có ảnh" }) : null);
    }));
    $("visitedDlg").showModal();
  };
  $("visitedSave").onclick = async () => {
    try { places = await api("/api/places", jsonBody("PUT", { places: draft })); }
    catch (err) { return toast(err.message); }
    await saveManual([...$("visitedList").querySelectorAll("input:checked:not(:disabled)")].map((x) => x.value));
    $("visitedDlg").close();
  };

  // ---------- upload ----------
  let pending = [];

  // Run tasks with at most `limit` in flight
  async function pool(items, limit, task) {
    const out = new Array(items.length);
    let next = 0;
    const run = async () => { while (next < items.length) { const i = next++; out[i] = await task(items[i], i); } };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
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

  // Same file → same fingerprint, used to skip photos that are already uploaded
  async function fingerprint(file) {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function prepare(file, hash) {
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
      hash,
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
    $("uploadGo").textContent = "Tải lên";
    $("uploadGo").disabled = true; // until every photo is read
    $("uploadDlg").showModal();
    // Skip files already in the album, and repeats inside this batch
    const known = new Set(photos.map((p) => p.hash).filter(Boolean));
    let skipped = 0, done = 0;
    const note = $("uploadList").firstChild;
    const ready = await pool(files, Math.max(2, Math.min(4, navigator.hardwareConcurrency || 4)), async (f) => {
      try {
        const hash = await fingerprint(f);
        if (known.has(hash)) { skipped++; return null; }
        known.add(hash);
        return await prepare(f, hash);
      } catch (err) { toast(`${f.name}: ${err.message}`); return null; }
      finally { note.textContent = `Đang đọc ảnh ${++done}/${files.length}…`; }
    });
    pending = ready.filter(Boolean);
    if (skipped) toast(`Bỏ qua ${skipped} ảnh đã có trong album`, 3000);
    if (!pending.length) {
      $("uploadList").replaceChildren(el("p", { className: "empty", textContent: "Tất cả ảnh đã có trong album." }));
      $("uploadGo").disabled = true;
      $("upSummary").textContent = "";
      $("upPlaceRow").hidden = true;
      return;
    }
    renderPending(skipped);
  }

  // Simple review: every photo keeps its own date/GPS; one province for photos without GPS
  function renderPending(skipped = 0) {
    if ($("upProvince").options.length < 2) provinceOptions($("upProvince"), "", "Other (không chọn tỉnh)");
    $("upProvince").value = "";
    const noGps = pending.filter((p) => p.lat == null).length;
    $("upSummary").textContent = `${pending.length} ảnh`
      + (pending.length - noGps ? ` · ${pending.length - noGps} ảnh có GPS (tự gán nơi)` : "")
      + (noGps ? ` · ${noGps} ảnh không có GPS` : "")
      + (skipped ? ` · bỏ qua ${skipped} ảnh trùng` : "");
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
  const sendOnce = (blob, name, type, extra, onProgress) => new Promise((resolve, reject) => {
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
  // Up to 3 tries with a short pause, so a flaky connection does not fail the photo
  async function sendFile(...args) {
    for (let attempt = 1; ; attempt++) {
      try { return await sendOnce(...args); }
      catch (err) {
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }

  $("uploadGo").onclick = async () => {
    const todo = pending.filter((p) => !p.done);
    // Photos without GPS take the chosen province, or "Other" when none is chosen
    const chosen = $("upProvince").value;
    for (const p of todo) if (p.lat == null) p.province = chosen;
    $("uploadGo").disabled = true;
    const t0 = performance.now();
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
      await api("/api/folders", jsonBody("POST", { groups }));
    } catch (err) { toast(err.message); }
    paint();
    // 1) files to Drive, several photos at once (full + thumbnail in parallel per photo)
    await pool(todo, UPLOAD_LIMIT, async (p) => {
      p.box.className = "up-item";
      try {
        const track = (key) => (n) => { sent.set(key, n); paint(); };
        const [fileId, thumbId] = await Promise.all([
          p.fileId || sendFile(p.full.blob, p.name, "image/jpeg", { province: p.province, takenAt: p.takenAt, place: p.place }, track(p.name + "f")),
          p.thumbId || sendFile(p.thumb.blob, p.name.replace(/\.\w+$/, ".webp"), "image/webp", { kind: "thumb" }, track(p.name + "t")),
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
    const uploaded = todo.filter((p) => p.fileId && p.thumbId);
    $("upText").textContent = `Đang lưu ${uploaded.length} ảnh vào bản đồ…`;
    if (uploaded.length) {
      try {
        const added = await api("/api/photos", jsonBody("POST", { items: uploaded.map((p) => ({
          fileId: p.fileId, thumbId: p.thumbId, name: p.name, width: p.full.width, height: p.full.height, hash: p.hash,
          camera: p.camera, province: p.province, place: p.place || "", takenAt: p.takenAt, title: "", lat: p.lat, lng: p.lng,
        })) }));
        photos.push(...added);
        for (const p of uploaded) { p.done = true; p.box.className = "up-item ok"; }
      } catch (err) {
        for (const p of uploaded) { p.box.className = "up-item err"; p.box.title = err.message; }
      }
    }
    renderAll();
    const ok = todo.filter((p) => p.done).length;
    const failed = pending.filter((p) => !p.done).length;
    $("uploadGo").disabled = false;
    $("uploadGo").textContent = failed ? `Tải lại ${failed} ảnh lỗi` : "Tải lên";
    $("upBar").style.width = "100%";
    $("upText").textContent = failed ? `Xong ${ok}/${todo.length} ảnh · ${failed} ảnh lỗi, bấm "Tải lại" để thử tiếp` : `✓ Xong ${ok}/${todo.length} ảnh`;
    toast(`✓ Đã tải lên ${ok}/${todo.length} ảnh trong ${((performance.now() - t0) / 1000).toFixed(1)} giây`);
    if (!failed) setTimeout(() => $("uploadDlg").close(), 800);
  };

  // ---------- start ----------
  async function start() {
    geo = await (await fetch("vn-34.json")).json();
    provinces = geo.features.map((f) => f.properties.name).sort((a, b) => a.localeCompare(b, "vi"));
    provinceOptions($("editForm").province);
    provinceOptions($("selProvince"), "", "Chọn tỉnh…");
    initMap();
    try {
      [photos, manual, meta, places] = await Promise.all([
        api("/api/photos"),
        api("/api/visited").catch(() => []),
        api("/api/meta").catch(() => ({ trips: {}, covers: {} })),
        api("/api/places").catch(() => []),
      ]);
    } catch (err) {
      toast(`Không tải được ảnh: ${err.message}`);
    }
    await checkAdmin();
    renderAll();
    $("sideBack").onclick = () => {
      selected = null;
      history.replaceState(null, "", location.pathname);
      renderAll();
    };
    // Shared trip link: #trip=<key>
    const key = new URLSearchParams(location.hash.slice(1)).get("trip");
    const trip = key && computeTrips().find((t) => t.key === key);
    if (trip) openTrip(trip);
  }
  start();
})();

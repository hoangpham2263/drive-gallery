// Drive Gallery — Google Drive Photo Manager with EXIF & Location Extractor
// MIT License © Pham Quoc Hoang

(function () {
  'use strict';

  // --- Constants & Storage Keys ---
  const STORAGE_KEY_ITEMS = 'drive_gallery_items_v1';
  const STORAGE_KEY_CONFIG = 'drive_gallery_config_v1';

  // State
  let photos = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let sortBy = 'date-desc';
  let activePhoto = null;
  let accessToken = null;
  let tokenClient = null;
  let driveFolderId = null;

  // View & Map State
  let travelMap = null;
  let markersLayer = null;
  let markerMap = new Map();
  let currentView = 'map';

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadQueue = document.getElementById('uploadQueue');
  const galleryGrid = document.getElementById('galleryGrid');
  const searchInput = document.getElementById('searchInput');
  const folderSelect = document.getElementById('folderSelect');
  const sortSelect = document.getElementById('sortSelect');
  const statsLabel = document.getElementById('statsLabel');
  const toast = document.getElementById('toast');

  // View Switcher & Sections
  const viewMapBtn = document.getElementById('viewMapBtn');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewTimelineBtn = document.getElementById('viewTimelineBtn');
  const mapSection = document.getElementById('mapSection');
  const gallerySection = document.getElementById('gallerySection');
  const timelineSection = document.getElementById('timelineSection');

  // Map Elements
  const travelMapEl = document.getElementById('travelMap');
  const mapPlacesCount = document.getElementById('mapPlacesCount');
  const resetMapZoomBtn = document.getElementById('resetMapZoomBtn');
  const layerGoogleBtn = document.getElementById('layerGoogleBtn');
  const layerSatBtn = document.getElementById('layerSatBtn');
  const layerTerrainBtn = document.getElementById('layerTerrainBtn');
  const layerDarkBtn = document.getElementById('layerDarkBtn');
  const scopeVietnamBtn = document.getElementById('scopeVietnamBtn');
  const scopeGlobalBtn = document.getElementById('scopeGlobalBtn');
  const citiesVisitedCount = document.getElementById('citiesVisitedCount');
  const destinationsList = document.getElementById('destinationsList');
  const timelineContainer = document.getElementById('timelineContainer');

  // Badges & Actions
  const globalDropOverlay = document.getElementById('globalDropOverlay');
  const openDriveFolderBtn = document.getElementById('openDriveFolderBtn');
  const quickConnectDriveBtn = document.getElementById('quickConnectDriveBtn');
  const connectionBadge = document.getElementById('connectionBadge');
  const connectionText = document.getElementById('connectionText');

  // Lightbox Modal
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxFolder = document.getElementById('lightboxFolder');
  const lightboxLocation = document.getElementById('lightboxLocation');
  const lightboxMapLink = document.getElementById('lightboxMapLink');
  const lightboxMapLinkWrapper = document.getElementById('lightboxMapLinkWrapper');
  const lightboxCamera = document.getElementById('lightboxCamera');
  const lightboxSettings = document.getElementById('lightboxSettings');
  const lightboxDate = document.getElementById('lightboxDate');
  const lightboxSize = document.getElementById('lightboxSize');
  const lightboxDriveLink = document.getElementById('lightboxDriveLink');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const deletePhotoBtn = document.getElementById('deletePhotoBtn');

  // Copy Link Inputs
  const directLinkInput = document.getElementById('directLinkInput');
  const markdownLinkInput = document.getElementById('markdownLinkInput');
  const htmlLinkInput = document.getElementById('htmlLinkInput');
  const copyDirectLinkBtn = document.getElementById('copyDirectLinkBtn');
  const copyMarkdownBtn = document.getElementById('copyMarkdownBtn');
  const copyHtmlBtn = document.getElementById('copyHtmlBtn');

  // Config Modal
  const configModal = document.getElementById('configModal');
  const openConfigBtn = document.getElementById('openConfigBtn');
  const closeConfigBtn = document.getElementById('closeConfigBtn');
  const clientIdInput = document.getElementById('clientIdInput');
  const folderNameInput = document.getElementById('folderNameInput');
  const saveAndConnectBtn = document.getElementById('saveAndConnectBtn');
  const resetDemoBtn = document.getElementById('resetDemoBtn');
  const disconnectBtn = document.getElementById('disconnectBtn');

  // Default Demo Photos (Real landscapes with GPS and EXIF)
  const DEMO_PHOTOS = [
    {
      id: 'demo-1',
      title: 'Hoàng hôn Hồ Hoàn Kiếm',
      url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1600&q=80',
      directUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1600&q=80',
      driveLink: 'https://drive.google.com/',
      folder: 'travel',
      size: 3245000,
      width: 4032,
      height: 3024,
      date: '2026-10-18T17:45:00.000Z',
      camera: 'Apple iPhone 15 Pro',
      settings: 'f/1.78 • 1/320s • ISO 64 • 24mm',
      location: 'Hoàn Kiếm, Hà Nội, Việt Nam',
      gps: { lat: 21.0285, lng: 105.8542 }
    },
    {
      id: 'demo-2',
      title: 'Cầu Rồng lung linh về đêm',
      url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=80',
      directUrl: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=80',
      driveLink: 'https://drive.google.com/',
      folder: 'travel',
      size: 5120000,
      width: 6000,
      height: 4000,
      date: '2026-09-24T20:15:30.000Z',
      camera: 'Sony ILCE-7M4 (A7 IV)',
      settings: 'f/2.8 • 1/60s • ISO 1600 • 35mm',
      location: 'Hải Châu, Đà Nẵng, Việt Nam',
      gps: { lat: 16.0612, lng: 108.2272 }
    },
    {
      id: 'demo-3',
      title: 'Mù Cang Chải mùa lúa chín',
      url: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=80',
      directUrl: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=80',
      driveLink: 'https://drive.google.com/',
      folder: 'travel',
      size: 4780000,
      width: 5472,
      height: 3648,
      date: '2026-09-12T06:30:00.000Z',
      camera: 'Canon EOS R5',
      settings: 'f/8.0 • 1/200s • ISO 100 • 50mm',
      location: 'Mù Cang Chải, Yên Bái, Việt Nam',
      gps: { lat: 21.8488, lng: 104.0833 }
    },
    {
      id: 'demo-4',
      title: 'Phố đi bộ Nguyễn Huệ nhộn nhịp',
      url: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1600&q=80',
      directUrl: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1600&q=80',
      driveLink: 'https://drive.google.com/',
      folder: 'daily',
      size: 2890000,
      width: 4000,
      height: 3000,
      date: '2026-08-30T19:05:00.000Z',
      camera: 'Fujifilm X-T5',
      settings: 'f/1.4 • 1/125s • ISO 400 • 35mm',
      location: 'Quận 1, TP. Hồ Chí Minh, Việt Nam',
      gps: { lat: 10.7743, lng: 106.7029 }
    },
    {
      id: 'demo-5',
      title: 'Bãi Sao biển xanh ngát',
      url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
      directUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
      driveLink: 'https://drive.google.com/',
      folder: 'travel',
      size: 3410000,
      width: 4032,
      height: 3024,
      date: '2026-07-15T15:20:00.000Z',
      camera: 'Apple iPhone 15 Pro',
      settings: 'f/2.2 • 1/500s • ISO 50 • 13mm',
      location: 'An Thới, Phú Quốc, Kiên Giang, Việt Nam',
      gps: { lat: 10.0538, lng: 104.0326 }
    },
    {
      id: 'demo-6',
      title: 'Góc làm việc & Setup Code',
      url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1600&q=80',
      directUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1600&q=80',
      driveLink: 'https://drive.google.com/',
      folder: 'work',
      size: 1950000,
      width: 3840,
      height: 2160,
      date: '2026-10-15T14:10:00.000Z',
      camera: 'MacBook Pro Camera',
      settings: 'f/2.0 • 1/60s • ISO 200',
      location: 'Hà Nội, Việt Nam',
      gps: { lat: 21.0285, lng: 105.8542 }
    }
  ];

  // Popular Vietnam destinations for 1-click GPS assignment
  const POPULAR_LOCATIONS = [
    { name: 'Hà Nội', fullName: 'Hoàn Kiếm, Hà Nội, Việt Nam', lat: 21.0285, lng: 105.8542 },
    { name: 'Đà Nẵng', fullName: 'Hải Châu, Đà Nẵng, Việt Nam', lat: 16.0612, lng: 108.2272 },
    { name: 'TP. Hồ Chí Minh', fullName: 'Quận 1, TP. Hồ Chí Minh, Việt Nam', lat: 10.7743, lng: 106.7029 },
    { name: 'Đà Lạt', fullName: 'Đà Lạt, Lâm Đồng, Việt Nam', lat: 11.9404, lng: 108.4583 },
    { name: 'Phú Quốc', fullName: 'An Thới, Phú Quốc, Kiên Giang, Việt Nam', lat: 10.0538, lng: 104.0326 },
    { name: 'Hội An', fullName: 'Hội An, Quảng Nam, Việt Nam', lat: 15.8801, lng: 108.3380 },
    { name: 'Nha Trang', fullName: 'Nha Trang, Khánh Hòa, Việt Nam', lat: 12.2388, lng: 109.1967 },
    { name: 'Sa Pa', fullName: 'Sa Pa, Lào Cai, Việt Nam', lat: 22.3364, lng: 103.8438 },
    { name: 'Huế', fullName: 'Huế, Thừa Thiên Huế, Việt Nam', lat: 16.4637, lng: 107.5909 },
    { name: 'Hải Phòng', fullName: 'Hải Phòng, Việt Nam', lat: 20.8449, lng: 106.6881 },
    { name: 'Cần Thơ', fullName: 'Ninh Kiều, Cần Thơ, Việt Nam', lat: 10.0452, lng: 105.7469 },
    { name: 'Quy Nhơn', fullName: 'Quy Nhơn, Bình Định, Việt Nam', lat: 13.7820, lng: 109.2197 },
    { name: 'Vũng Tàu', fullName: 'Vũng Tàu, Bà Rịa - Vũng Tàu, Việt Nam', lat: 10.3460, lng: 107.0843 }
  ];

  // --- Helper Functions ---
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }

  function loadSavedConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg));
  }

  function loadPhotos() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          photos = parsed;
          return;
        }
      }
    } catch (e) {
      console.warn('Error reading stored photos', e);
    }
    // Sample items for initial exploration
    photos = [...DEMO_PHOTOS];
  }

  function savePhotos() {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(photos));
    } catch (e) {
      console.warn('Storage quota exceeded, keeping in memory', e);
    }
  }

  // --- Reverse Geocoding (Convert GPS Lat/Lng to Location Name) ---
  async function reverseGeocode(lat, lng) {
    if (!lat || !lng) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=14&addressdetails=1`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': 'vi,en;q=0.9' }
      });
      if (!res.ok) throw new Error('Geocoding response failed');
      const data = await res.json();
      if (!data || !data.address) return null;

      const addr = data.address;
      const parts = [];
      const sub = addr.suburb || addr.quarter || addr.neighbourhood || addr.road;
      const city = addr.city || addr.town || addr.county || addr.state;
      const country = addr.country || 'Việt Nam';

      if (sub) parts.push(sub);
      if (city && city !== sub) parts.push(city);
      if (country) parts.push(country);

      return parts.join(', ');
    } catch (err) {
      console.warn('Reverse geocode fallback:', err);
      return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    }
  }

  // --- Format Camera Settings from EXIF ---
  function formatExifSettings(exif) {
    if (!exif) return 'Chưa có thông số';
    const parts = [];
    if (exif.FNumber) parts.push(`f/${exif.FNumber}`);
    if (exif.ExposureTime) {
      if (exif.ExposureTime < 1) {
        parts.push(`1/${Math.round(1 / exif.ExposureTime)}s`);
      } else {
        parts.push(`${exif.ExposureTime}s`);
      }
    }
    if (exif.ISO || exif.ISOSpeedRatings) parts.push(`ISO ${exif.ISO || exif.ISOSpeedRatings}`);
    if (exif.FocalLength) parts.push(`${Math.round(exif.FocalLength)}mm`);
    return parts.length ? parts.join(' • ') : 'Thông số tiêu chuẩn';
  }

  function formatCameraName(exif) {
    if (!exif) return 'Không rõ thiết bị';
    const make = exif.Make || '';
    const model = exif.Model || '';
    if (model.includes(make)) return model.trim();
    return `${make} ${model}`.trim() || 'Camera';
  }

  // --- Travel Map (Google Maps Vietnam Default + Satellite / Terrain / Dark Switcher + Dual Scope) ---
  const VIETNAM_GEOJSON = {
    "type": "Feature",
    "properties": { "name": "Vietnam" },
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[108.05018, 21.55238], [106.715068, 20.696851], [105.881682, 19.75205], [105.662006, 19.058165], [106.426817, 18.004121], [107.361954, 16.697457], [108.269495, 16.079742], [108.877107, 15.276691], [109.33527, 13.426028], [109.200136, 11.666859], [108.36613, 11.008321], [107.220929, 10.364484], [106.405113, 9.53084], [105.158264, 8.59976], [104.795185, 9.241038], [105.076202, 9.918491], [104.334335, 10.486544], [105.199915, 10.88931], [106.24967, 10.961812], [105.810524, 11.567615], [107.491403, 12.337206], [107.614548, 13.535531], [107.382727, 14.202441], [107.564525, 15.202173], [107.312706, 15.908538], [106.556008, 16.604284], [105.925762, 17.485315], [105.094598, 18.666975], [103.896532, 19.265181], [104.183388, 19.624668], [104.822574, 19.886642], [104.435, 20.758733], [103.203861, 20.766562], [102.754896, 21.675137], [102.170436, 22.464753], [102.706992, 22.708795], [103.504515, 22.703757], [104.476858, 22.81915], [105.329209, 23.352063], [105.811247, 22.976892], [106.725403, 22.794268], [106.567273, 22.218205], [107.04342, 21.811899], [108.05018, 21.55238]]]
    }
  };
  const VIETNAM_BOUNDS = [[8.18, 102.14], [23.39, 109.46]];
  const VIETNAM_MAX_BOUNDS = [[7.0, 99.5], [25.0, 114.5]];
  let currentMapScope = localStorage.getItem('travel_memories_map_scope') || 'vietnam';
  let vietnamBorderLayer = null;

  let googleStreetLayer = null;
  let googleHybridLayer = null;
  let googleTerrainLayer = null;
  let darkLayer = null;
  let currentLayerType = 'google';

  function isLocationInVietnam(lat, lng) {
    return (lat >= 8.0 && lat <= 24.0 && lng >= 102.0 && lng <= 110.5);
  }

  function flyToMapLocation(lat, lng, zoom = 13) {
    if (!travelMap) return;
    if (!isLocationInVietnam(lat, lng) && currentMapScope === 'vietnam') {
      switchMapScope('global');
    }
    travelMap.flyTo([lat, lng], zoom, { duration: 1.2 });
  }

  function initTravelMap() {
    if (travelMap || !window.L || !travelMapEl) return;
    try {
      const isVN = (currentMapScope === 'vietnam');
      travelMap = L.map('travelMap', {
        center: isVN ? [16.0, 107.0] : [20.0, 10.0],
        zoom: isVN ? 6 : 2.5,
        minZoom: isVN ? 5.2 : 2,
        maxBounds: isVN ? VIETNAM_MAX_BOUNDS : null,
        maxBoundsViscosity: 0.85,
        zoomControl: true,
        scrollWheelZoom: true
      });

      // 1. Google Maps Vietnam (Standard Street - Crystal clear, official Vietnamese labels & full borders)
      googleStreetLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=m&hl=vi&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps',
        maxZoom: 20
      });

      // 2. Google Hybrid (Real Satellite + Sharp Vietnamese roads & place names)
      googleHybridLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&hl=vi&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps Vệ tinh',
        maxZoom: 20
      });

      // 3. Google Terrain (Elevation & mountains + Vietnamese labels)
      googleTerrainLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=p&hl=vi&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        attribution: '&copy; Google Maps Địa hình',
        maxZoom: 20
      });

      // 4. Dark Midnight Mode
      darkLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        className: 'map-tiles-midnight',
        maxZoom: 18
      });

      // Default layer: Google Maps Vietnam (Crystal clear)
      googleStreetLayer.addTo(travelMap);

      // Vietnam S-Shape Glowing Border Layer
      vietnamBorderLayer = L.geoJSON(VIETNAM_GEOJSON, {
        style: {
          color: '#ff4d4f',
          weight: 2.2,
          opacity: 0.85,
          dashArray: '5, 5',
          fillColor: '#ff4d4f',
          fillOpacity: 0.035,
          className: 'vietnam-border-glow'
        },
        interactive: false
      });

      if (isVN) {
        vietnamBorderLayer.addTo(travelMap);
      }

      markersLayer = L.layerGroup().addTo(travelMap);

      if (layerGoogleBtn) layerGoogleBtn.addEventListener('click', () => switchMapLayer('google'));
      if (layerSatBtn) layerSatBtn.addEventListener('click', () => switchMapLayer('sat'));
      if (layerTerrainBtn) layerTerrainBtn.addEventListener('click', () => switchMapLayer('terrain'));
      if (layerDarkBtn) layerDarkBtn.addEventListener('click', () => switchMapLayer('dark'));

      if (scopeVietnamBtn) scopeVietnamBtn.addEventListener('click', () => switchMapScope('vietnam'));
      if (scopeGlobalBtn) scopeGlobalBtn.addEventListener('click', () => switchMapScope('global'));

      if (resetMapZoomBtn) {
        resetMapZoomBtn.addEventListener('click', fitMapToBounds);
      }

      switchMapScope(currentMapScope);
    } catch (e) {
      console.warn('Error initTravelMap', e);
    }
  }

  function switchMapScope(scope) {
    currentMapScope = scope;
    try {
      localStorage.setItem('travel_memories_map_scope', scope);
    } catch (e) {}

    if (scopeVietnamBtn) scopeVietnamBtn.classList.toggle('active', scope === 'vietnam');
    if (scopeGlobalBtn) scopeGlobalBtn.classList.toggle('active', scope === 'global');

    if (mapPlacesCount) {
      const gpsPhotos = photos.filter(p => p.gps && typeof p.gps.lat === 'number' && typeof p.gps.lng === 'number');
      const vnPhotos = gpsPhotos.filter(p => isLocationInVietnam(p.gps.lat, p.gps.lng));
      if (scope === 'vietnam') {
        mapPlacesCount.textContent = `${vnPhotos.length} điểm tại VN`;
      } else {
        mapPlacesCount.textContent = `${gpsPhotos.length} điểm toàn cầu`;
      }
    }

    if (!travelMap) return;

    if (scope === 'vietnam') {
      travelMap.options.minZoom = 5.2;
      travelMap.setMaxBounds(VIETNAM_MAX_BOUNDS);
      if (vietnamBorderLayer && !travelMap.hasLayer(vietnamBorderLayer)) {
        vietnamBorderLayer.addTo(travelMap);
      }
      fitMapToBounds();
    } else {
      // Global
      travelMap.setMaxBounds(null);
      travelMap.options.minZoom = 2;
      if (vietnamBorderLayer && travelMap.hasLayer(vietnamBorderLayer)) {
        travelMap.removeLayer(vietnamBorderLayer);
      }
      fitMapToBounds();
    }
  }

  function switchMapLayer(type) {
    if (!travelMap) return;
    currentLayerType = type;
    [layerGoogleBtn, layerSatBtn, layerTerrainBtn, layerDarkBtn].forEach(btn => btn && btn.classList.remove('active'));

    [googleStreetLayer, googleHybridLayer, googleTerrainLayer, darkLayer].forEach(layer => {
      if (layer && travelMap.hasLayer(layer)) travelMap.removeLayer(layer);
    });

    if (type === 'sat' && googleHybridLayer) {
      googleHybridLayer.addTo(travelMap);
      if (layerSatBtn) layerSatBtn.classList.add('active');
    } else if (type === 'terrain' && googleTerrainLayer) {
      googleTerrainLayer.addTo(travelMap);
      if (layerTerrainBtn) layerTerrainBtn.classList.add('active');
    } else if (type === 'dark' && darkLayer) {
      darkLayer.addTo(travelMap);
      if (layerDarkBtn) layerDarkBtn.classList.add('active');
    } else if (googleStreetLayer) {
      googleStreetLayer.addTo(travelMap);
      if (layerGoogleBtn) layerGoogleBtn.classList.add('active');
    }
  }

  function fitMapToBounds() {
    if (!travelMap || !markersLayer) return;
    const bounds = [];
    markersLayer.eachLayer((marker) => {
      const latlng = marker.getLatLng();
      if (currentMapScope === 'vietnam') {
        if (isLocationInVietnam(latlng.lat, latlng.lng)) {
          bounds.push(latlng);
        }
      } else {
        bounds.push(latlng);
      }
    });

    if (currentMapScope === 'vietnam') {
      if (bounds.length === 1) {
        travelMap.setView(bounds[0], 12);
      } else if (bounds.length > 1) {
        travelMap.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } else {
        travelMap.fitBounds(VIETNAM_BOUNDS, { padding: [25, 25] });
      }
    } else {
      // Global
      if (bounds.length === 1) {
        travelMap.setView(bounds[0], 10);
      } else if (bounds.length > 1) {
        travelMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      } else {
        travelMap.setView([20.0, 10.0], 2.5);
      }
    }
  }

  function renderMapMarkers() {
    if (!travelMap || !markersLayer || !window.L) return;
    markersLayer.clearLayers();
    markerMap.clear();

    const gpsPhotos = photos.filter(p => p.gps && typeof p.gps.lat === 'number' && typeof p.gps.lng === 'number');
    const vnPhotos = gpsPhotos.filter(p => isLocationInVietnam(p.gps.lat, p.gps.lng));

    if (mapPlacesCount) {
      if (currentMapScope === 'vietnam') {
        mapPlacesCount.textContent = `${vnPhotos.length} điểm tại VN`;
      } else {
        mapPlacesCount.textContent = `${gpsPhotos.length} điểm toàn cầu`;
      }
    }

    gpsPhotos.forEach((photo) => {
      // Concentric glowing radar pin marker matching user reference screenshot
      const pinIcon = L.divIcon({
        className: 'map-photo-pin',
        html: `
          <div class="pin-wrapper" title="${photo.title} (${photo.location || ''})">
            <div class="pin-pulse"></div>
            <div class="pin-ring">
              <div class="pin-dot"></div>
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });

      const marker = L.marker([photo.gps.lat, photo.gps.lng], { icon: pinIcon });

      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-media">
            <img src="${photo.url}" alt="${photo.title}" loading="lazy" />
          </div>
          <div class="map-popup-body">
            <h4 class="map-popup-title">${photo.title}</h4>
            <div class="map-popup-meta">
              <span>📍 ${photo.location || 'Địa điểm chưa đặt tên'}</span>
              <span>📅 ${formatDate(photo.date)}</span>
              <span>📷 ${photo.camera || 'Thiết bị chụp'}</span>
            </div>
            <button class="map-popup-btn" type="button">Xem ảnh chi tiết</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 260 });
      marker.on('popupopen', (e) => {
        const popupEl = e.popup.getElement();
        if (popupEl) {
          const detailBtn = popupEl.querySelector('.map-popup-btn');
          if (detailBtn) {
            detailBtn.onclick = () => openLightbox(photo);
          }
        }
      });

      marker.addTo(markersLayer);
      markerMap.set(photo.id, marker);
    });

    fitMapToBounds();
  }

  // --- Location Assignment Helper ---
  function assignLocationToPhoto(photoId, loc) {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return;
    photo.gps = { lat: loc.lat, lng: loc.lng };
    photo.location = loc.fullName;
    if (!accessToken) savePhotos();
    updateAllViews();
    showToast(`📍 Đã ghim ảnh vào "${loc.name}"!`);
    if (travelMap) {
      switchView('map');
      flyToMapLocation(loc.lat, loc.lng, 13);
      setTimeout(() => {
        const marker = markerMap.get(photo.id);
        if (marker) marker.openPopup();
      }, 1250);
    }
  }

  // --- Destinations Drawer (Grouped by place like user screenshot) ---
  function renderDestinationsDrawer() {
    if (!destinationsList) return;
    destinationsList.innerHTML = '';

    const destMap = new Map();
    photos.forEach((p) => {
      const locKey = p.location ? p.location.split(',')[0].trim() : 'Chưa định vị';
      if (!destMap.has(locKey)) {
        destMap.set(locKey, {
          name: locKey,
          fullName: p.location || 'Địa điểm kỷ niệm',
          photos: [],
          lat: p.gps?.lat,
          lng: p.gps?.lng,
          latestDate: p.date
        });
      }
      const group = destMap.get(locKey);
      group.photos.push(p);
      if (!group.lat && p.gps?.lat) {
        group.lat = p.gps.lat;
        group.lng = p.gps.lng;
      }
    });

    const destArray = Array.from(destMap.values());

    if (citiesVisitedCount) {
      citiesVisitedCount.textContent = destArray.length;
    }

    if (destArray.length === 0) {
      destinationsList.innerHTML = `<div class="muted small" style="grid-column: 1/-1; padding: 14px 0;">Chưa có điểm đến nào. Hãy tải ảnh kỷ niệm vào để tạo điểm đến!</div>`;
      return;
    }

    destArray.forEach((dest) => {
      const coverPhoto = dest.photos[0];
      const hasGps = !!(dest.lat && dest.lng);
      const card = document.createElement('div');
      card.className = hasGps ? 'destination-card' : 'destination-card no-gps';
      card.innerHTML = `
        <div class="destination-thumb">
          <img src="${coverPhoto.url}" alt="${dest.name}" loading="lazy" />
          <span class="places-badge">${dest.photos.length} kỷ niệm</span>
          ${!hasGps ? '<span class="no-gps-badge">📍 Chưa có GPS</span>' : ''}
        </div>
        <div class="destination-info">
          <div class="destination-name" title="${dest.fullName}">
            ${hasGps ? '📍' : '⚠️'} ${dest.fullName}
          </div>
          <div class="destination-sub">
            ${hasGps ? formatDate(dest.latestDate) : '<span style="color:#ff7875;font-weight:600;">Bấm vào để ghim toạ độ</span>'}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (dest.lat && dest.lng && travelMap) {
          switchView('map');
          flyToMapLocation(dest.lat, dest.lng, 13);
          const marker = markerMap.get(coverPhoto.id);
          if (marker) {
            setTimeout(() => marker.openPopup(), 1200);
          }
        } else {
          openLightbox(coverPhoto);
        }
      });

      destinationsList.appendChild(card);
    });
  }

  // --- Timeline View ---
  function renderTimeline() {
    if (!timelineContainer) return;
    timelineContainer.innerHTML = '';

    if (photos.length === 0) {
      timelineContainer.innerHTML = '<div class="muted small">Chưa có ảnh kỷ niệm nào trong dòng thời gian.</div>';
      return;
    }

    const sorted = [...photos].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const groups = new Map();
    sorted.forEach((p) => {
      let groupKey = 'Kho ảnh kỷ niệm';
      if (p.date) {
        const d = new Date(p.date);
        groupKey = `Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
      }
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey).push(p);
    });

    groups.forEach((items, monthStr) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'timeline-group';

      let itemsHtml = '';
      items.forEach((item) => {
        itemsHtml += `
          <div class="photo-card" style="margin-bottom:0;">
            <div class="card-media" style="height:140px;cursor:pointer;" data-id="${item.id}">
              <img src="${item.url}" alt="${item.title}" loading="lazy" />
              ${item.location ? `<span class="location-badge">${item.location}</span>` : ''}
            </div>
            <div class="card-body" style="padding:10px 12px;">
              <h4 class="card-title">${item.title}</h4>
              <div class="card-meta">
                <span>${formatDate(item.date)}</span>
                <span>•</span>
                <span>${item.camera || 'Camera'}</span>
              </div>
            </div>
          </div>
        `;
      });

      groupEl.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-group-header">
          <span>📅 ${monthStr}</span>
          <span class="muted small">(${items.length} bức ảnh)</span>
        </div>
        <div class="timeline-items-grid">
          ${itemsHtml}
        </div>
      `;

      groupEl.querySelectorAll('.card-media').forEach((mediaEl) => {
        mediaEl.addEventListener('click', () => {
          const id = mediaEl.getAttribute('data-id');
          const p = photos.find(x => x.id === id);
          if (p) openLightbox(p);
        });
      });

      timelineContainer.appendChild(groupEl);
    });
  }

  // --- View Switcher ---
  function switchView(viewName) {
    currentView = viewName;
    if (viewMapBtn) {
      viewMapBtn.classList.toggle('active', viewName === 'map');
      viewMapBtn.setAttribute('aria-selected', viewName === 'map');
    }
    if (viewGridBtn) {
      viewGridBtn.classList.toggle('active', viewName === 'grid');
      viewGridBtn.setAttribute('aria-selected', viewName === 'grid');
    }
    if (viewTimelineBtn) {
      viewTimelineBtn.classList.toggle('active', viewName === 'timeline');
      viewTimelineBtn.setAttribute('aria-selected', viewName === 'timeline');
    }

    if (mapSection) mapSection.hidden = (viewName !== 'map');
    if (gallerySection) gallerySection.hidden = (viewName !== 'grid');
    if (timelineSection) timelineSection.hidden = (viewName !== 'timeline');

    if (viewName === 'map') {
      if (!travelMap) {
        initTravelMap();
      }
      setTimeout(() => {
        if (travelMap) travelMap.invalidateSize();
      }, 150);
    } else if (viewName === 'timeline') {
      renderTimeline();
    } else if (viewName === 'grid') {
      renderGallery();
    }
  }

  function updateAllViews() {
    renderGallery();
    renderMapMarkers();
    renderDestinationsDrawer();
    if (currentView === 'timeline') {
      renderTimeline();
    }
  }

  // --- Render Gallery Grid ---
  function renderGallery() {
    if (!galleryGrid) return;
    galleryGrid.innerHTML = '';

    // Filter & search
    let list = photos.filter((item) => {
      if (currentFilter !== 'all' && item.folder !== currentFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inTitle = item.title && item.title.toLowerCase().includes(q);
        const inLoc = item.location && item.location.toLowerCase().includes(q);
        const inCam = item.camera && item.camera.toLowerCase().includes(q);
        return inTitle || inLoc || inCam;
      }
      return true;
    });

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date || 0) - new Date(a.date || 0);
      if (sortBy === 'date-asc') return new Date(a.date || 0) - new Date(b.date || 0);
      if (sortBy === 'name-asc') return (a.title || '').localeCompare(b.title || '');
      if (sortBy === 'size-desc') return (b.size || 0) - (a.size || 0);
      return 0;
    });

    // Update stats
    const totalBytes = list.reduce((sum, i) => sum + (i.size || 0), 0);
    if (statsLabel) {
      statsLabel.textContent = `${list.length} ảnh • ${formatBytes(totalBytes)}`;
    }

    if (list.length === 0) {
      const emptyMsg = accessToken
        ? `<p><b>Thư mục DriveGallery trên Google Drive của bạn chưa có ảnh nào</b></p>
           <p class="muted small">Hãy kéo thả hoặc bấm vào ô bên trên để tải bức ảnh đầu tiên lên Google Drive của bạn!</p>
           ${driveFolderId ? `<p style="margin-top:12px;"><a href="https://drive.google.com/drive/folders/${driveFolderId}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">📁 Mở thư mục DriveGallery trên Google Drive ↗</a></p>` : ''}`
        : `<p><b>Không tìm thấy ảnh nào</b></p>
           <p class="muted small">Hãy thử tìm từ khóa khác hoặc kéo thả ảnh mới vào để tải lên.</p>`;
      galleryGrid.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="muted" style="margin-bottom:8px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          ${emptyMsg}
        </div>
      `;
      return;
    }

    list.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'photo-card';

      const locationBadgeHtml = item.location
        ? `<span class="location-badge" title="${item.location}">
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
             ${item.location}
           </span>`
        : '';

      const dateBadgeHtml = item.date
        ? `<span class="date-badge">${new Date(item.date).toLocaleDateString('vi-VN')}</span>`
        : '';

      const isDrive = !!item.driveLink;
      const storageBadge = isDrive
        ? `<span style="color:var(--good);font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:3px;" title="Ảnh đã lưu trên Google Drive">☁️ Google Drive</span>`
        : `<span style="color:var(--warn);font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:3px;" title="Ảnh chỉ lưu tạm trên máy bạn (Chưa lên Drive)">💻 Lưu tạm (Demo)</span>`;

      card.innerHTML = `
        <div class="card-media">
          <img src="${item.url}" alt="${item.title}" loading="lazy" />
          ${locationBadgeHtml}
          ${dateBadgeHtml}
        </div>
        <div class="card-body">
          <h4 class="card-title" title="${item.title}">${item.title}</h4>
          <div class="card-meta">
            <span>${storageBadge}</span>
            <span>•</span>
            <span>${formatBytes(item.size)}</span>
            <span>•</span>
            <span>${item.camera || 'Camera'}</span>
          </div>
          <div class="card-actions">
            <button class="btn btn-outline btn-sm copy-btn" data-url="${item.directUrl || item.url}" type="button" title="Sao chép link trực tiếp">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              Link
            </button>
            <button class="btn btn-outline btn-sm detail-btn" type="button">Chi tiết</button>
          </div>
        </div>
      `;

      // Event listeners on card
      const media = card.querySelector('.card-media');
      const detailBtn = card.querySelector('.detail-btn');
      const copyBtn = card.querySelector('.copy-btn');

      const openDetails = () => openLightbox(item);
      media.addEventListener('click', openDetails);
      detailBtn.addEventListener('click', openDetails);

      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = copyBtn.getAttribute('data-url');
        navigator.clipboard.writeText(url).then(() => {
          showToast('Đã sao chép direct link ảnh!');
        });
      });

      galleryGrid.appendChild(card);
    });
  }

  // --- Lightbox Inspector Modal ---
  function openLightbox(item) {
    activePhoto = item;
    lightboxImg.src = item.url;
    lightboxTitle.textContent = item.title;
    lightboxFolder.innerHTML = item.driveLink
      ? `<span style="color:var(--good);font-weight:600;">☁️ Vị trí: Đã lưu trên Google Drive (Thư mục DriveGallery)</span>`
      : `<span style="color:var(--warn);font-weight:600;">💻 Vị trí: Đang lưu tạm trên máy (Chưa lên Drive)</span>`;

    // Location
    if (item.gps && item.gps.lat && item.gps.lng) {
      lightboxLocation.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <strong>${item.location || 'Đã có toạ độ GPS'}</strong>
      `;
      lightboxMapLink.href = `https://www.google.com/maps?q=${item.gps.lat},${item.gps.lng}`;
      lightboxMapLinkWrapper.hidden = false;
    } else {
      lightboxLocation.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;align-items:center;gap:6px;color:#ff7875;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style="font-size:12.5px;font-weight:600;">Ảnh chưa có toạ độ GPS (thường do lưu từ Facebook/Zalo)</span>
          </div>
          <div style="font-size:12px;color:var(--muted);">📍 Bấm chọn nhanh địa điểm để ghim bức ảnh này lên bản đồ:</div>
          <div class="loc-chips-grid">
            ${POPULAR_LOCATIONS.map(l => `<button type="button" class="loc-chip-btn" data-name="${l.name}" data-lat="${l.lat}" data-lng="${l.lng}">📍 ${l.name}</button>`).join('')}
          </div>
        </div>
      `;
      lightboxMapLinkWrapper.hidden = true;

      lightboxLocation.querySelectorAll('.loc-chip-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const name = btn.getAttribute('data-name');
          const lat = parseFloat(btn.getAttribute('data-lat'));
          const lng = parseFloat(btn.getAttribute('data-lng'));
          item.gps = { lat, lng };
          item.location = name + ', Việt Nam';
          if (!accessToken) savePhotos();
          updateAllViews();
          closeLightbox();
          switchView('map');
          if (travelMap) {
            flyToMapLocation(lat, lng, 13);
            const marker = markerMap.get(item.id);
            if (marker) setTimeout(() => marker.openPopup(), 1200);
          }
          showToast(`📍 Đã ghim ảnh "${item.title}" tại ${name}!`);
        });
      });
    }

    // Camera & settings
    lightboxCamera.textContent = item.camera || 'Không rõ thông số camera';
    lightboxSettings.textContent = item.settings || 'f/2.8 • 1/125s • ISO 100';

    // File info
    lightboxDate.textContent = formatDate(item.date);
    const dimensions = item.width && item.height ? ` • ${item.width} × ${item.height} px` : '';
    lightboxSize.textContent = `${formatBytes(item.size)}${dimensions}`;

    // Embed links
    const directUrl = item.directUrl || item.url;
    directLinkInput.value = directUrl;
    markdownLinkInput.value = `![${item.title}](${directUrl})`;
    htmlLinkInput.value = `<img src="${directUrl}" alt="${item.title}" loading="lazy" />`;

    // Google Drive link
    if (item.driveLink) {
      lightboxDriveLink.href = item.driveLink;
      lightboxDriveLink.hidden = false;
    } else {
      lightboxDriveLink.hidden = true;
    }

    lightboxModal.classList.add('open');
  }

  function closeLightbox() {
    lightboxModal.classList.remove('open');
    activePhoto = null;
  }

  // --- Upload & File Processing with EXIF / GPS Extraction ---
  async function processFile(file) {
    const queueItem = document.createElement('div');
    queueItem.className = 'upload-item';
    queueItem.innerHTML = `
      <div class="upload-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--soft);">⏳</div>
      <div class="upload-info">
        <div class="upload-title">${file.name}</div>
        <div class="upload-status">Đang đọc EXIF &amp; vị trí GPS...</div>
        <div class="progress-bar"><div class="progress-fill" style="width: 25%"></div></div>
      </div>
    `;
    uploadQueue.appendChild(queueItem);
    uploadQueue.hidden = false;

    const statusEl = queueItem.querySelector('.upload-status');
    const fillEl = queueItem.querySelector('.progress-fill');
    const thumbEl = queueItem.querySelector('.upload-thumb');

    try {
      // 1. Create local preview
      const previewUrl = URL.createObjectURL(file);
      thumbEl.innerHTML = `<img src="${previewUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" />`;

      // 2. Parse EXIF & GPS
      let exifData = null;
      let gps = null;
      let locationName = null;

      if (window.exifr) {
        try {
          exifData = await window.exifr.parse(file, {
            tiff: true,
            exif: true,
            gps: true,
            reviveValues: true
          });

          if (exifData && exifData.latitude && exifData.longitude) {
            gps = { lat: exifData.latitude, lng: exifData.longitude };
            statusEl.textContent = '📍 Đang tìm địa danh từ GPS...';
            fillEl.style.width = '50%';
            locationName = await reverseGeocode(gps.lat, gps.lng);
          }
        } catch (exifErr) {
          console.warn('EXIF read error on', file.name, exifErr);
        }
      }

      // 3. Read image dimensions
      const dimensions = await getImageDimensions(previewUrl);

      // 4. Determine destination (Google Drive or Demo Storage)
      fillEl.style.width = '75%';
      let uploadedItem = null;

      if (accessToken) {
        statusEl.textContent = '☁️ Đang tải lên Google Drive...';
        uploadedItem = await uploadToGoogleDrive(file, {
          title: file.name.replace(/\.[^/.]+$/, ''),
          folder: folderSelect.value === 'all' ? 'travel' : folderSelect.value,
          location: locationName,
          gps: gps,
          camera: formatCameraName(exifData),
          settings: formatExifSettings(exifData),
          date: exifData?.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toISOString() : new Date().toISOString(),
          width: dimensions.width,
          height: dimensions.height,
          size: file.size
        });
      } else {
        // Demo mode: compress thumbnail for memory / localStorage
        statusEl.textContent = 'Hoàn tất trích xuất thông tin!';
        fillEl.style.width = '100%';
        const dataUrl = await fileToCompressedDataUrl(file);

        uploadedItem = {
          id: 'local-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          title: file.name.replace(/\.[^/.]+$/, ''),
          url: dataUrl || previewUrl,
          directUrl: previewUrl,
          folder: folderSelect.value === 'all' ? 'travel' : folderSelect.value,
          size: file.size,
          width: dimensions.width,
          height: dimensions.height,
          date: exifData?.DateTimeOriginal ? new Date(exifData.DateTimeOriginal).toISOString() : new Date().toISOString(),
          camera: formatCameraName(exifData),
          settings: formatExifSettings(exifData),
          location: locationName || 'Chưa có GPS trong ảnh',
          gps: gps
        };
      }

      photos.unshift(uploadedItem);
      if (!accessToken) savePhotos();
      updateAllViews();

      if (uploadedItem.gps && uploadedItem.gps.lat && travelMap) {
        if (currentView === 'map') {
          flyToMapLocation(uploadedItem.gps.lat, uploadedItem.gps.lng, 13);
        }
      }

      // Complete queue item
      statusEl.textContent = '✓ Hoàn thành';
      statusEl.style.color = 'var(--good)';
      fillEl.style.width = '100%';
      fillEl.style.background = 'var(--good)';

      if (accessToken) {
        showToast(`☁️ Đã lưu lên Google Drive (thư mục DriveGallery): ${uploadedItem.title}`);
      } else {
        showToast(`💻 Ảnh đã lưu tạm trên máy (Hãy bấm "Kết nối Google Drive" để lưu lên Drive)`);
      }

      setTimeout(() => {
        queueItem.remove();
        if (uploadQueue.children.length === 0) uploadQueue.hidden = true;
      }, 2500);
    } catch (err) {
      console.error('File process failed', err);
      statusEl.textContent = `❌ ${err.message || 'Lỗi xử lý ảnh'}`;
      statusEl.style.color = 'var(--danger)';
      fillEl.style.background = 'var(--danger)';
      showToast(`❌ Không thể tải ảnh: ${err.message || 'Lỗi không xác định'}`);
    }
  }

  function getImageDimensions(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = url;
    });
  }

  function fileToCompressedDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  let ensureFolderPromise = null;

  // --- Google Drive REST API v3 Integration ---
  async function uploadToGoogleDrive(file, meta) {
    let mimeType = file.type;
    if (!mimeType) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'heic') mimeType = 'image/heic';
      else if (ext === 'heif') mimeType = 'image/heif';
      else mimeType = 'image/jpeg';
    }

    const boundary = '-------DriveGallery' + Date.now();
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: file.name,
      mimeType: mimeType,
      description: JSON.stringify({
        location: meta.location,
        gps: meta.gps,
        camera: meta.camera,
        settings: meta.settings,
        width: meta.width,
        height: meta.height
      })
    };

    await ensureDriveFolder();
    if (driveFolderId) {
      metadata.parents = [driveFolderId];
    }

    const fileBytes = await file.arrayBuffer();

    const multipartRequestBody = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${mimeType}\r\n\r\n`,
      fileBytes,
      closeDelimiter
    ], { type: `multipart/related; boundary=${boundary}` });

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!res.ok) {
      if (res.status === 401) {
        sessionStorage.removeItem('drive_access_token');
        sessionStorage.removeItem('drive_token_expires');
        accessToken = null;
        setConnectedState(false);
        throw new Error('Phiên đăng nhập Google Drive đã hết hạn. Vui lòng bấm Kết nối lại.');
      }
      const errJson = await res.json().catch(() => null);
      const errMsg = errJson?.error?.message || `Lỗi Drive HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    const driveFile = await res.json();

    // Make file readable by anyone with link (for direct embed)
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });
    } catch (e) {
      console.warn('Set permission warning', e);
    }

    const directUrl = `https://lh3.googleusercontent.com/d/${driveFile.id}`;

    return {
      id: driveFile.id,
      title: meta.title,
      url: directUrl,
      directUrl: directUrl,
      driveLink: driveFile.webViewLink,
      folder: meta.folder,
      size: meta.size,
      width: meta.width,
      height: meta.height,
      date: meta.date,
      camera: meta.camera,
      settings: meta.settings,
      location: meta.location,
      gps: meta.gps
    };
  }

  // --- Ensure "DriveGallery" folder exists on Google Drive ---
  async function ensureDriveFolder() {
    if (driveFolderId) return driveFolderId;
    if (!accessToken) return null;
    if (ensureFolderPromise) return ensureFolderPromise;

    ensureFolderPromise = (async () => {
      try {
        const config = loadSavedConfig();
        const folderName = config.folderName || 'DriveGallery';
        const q = `mimeType = 'application/vnd.google-apps.folder' and name = '${folderName}' and trashed = false`;
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name)`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.files && data.files.length > 0) {
            driveFolderId = data.files[0].id;
            updateDriveFolderUI(driveFolderId);
            return driveFolderId;
          }
        }

        // If not exists, create folder
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (createRes.ok) {
          const newFolder = await createRes.json();
          driveFolderId = newFolder.id;
          updateDriveFolderUI(driveFolderId);
          return driveFolderId;
        }
      } catch (e) {
        console.warn('Error ensureDriveFolder', e);
      } finally {
        ensureFolderPromise = null;
      }
      return null;
    })();

    return ensureFolderPromise;
  }

  function updateDriveFolderUI(fId) {
    if (openDriveFolderBtn && fId) {
      openDriveFolderBtn.href = `https://drive.google.com/drive/folders/${fId}`;
      openDriveFolderBtn.innerHTML = '📁 Thư mục DriveGallery ↗';
      openDriveFolderBtn.hidden = false;
      openDriveFolderBtn.style.display = 'inline-flex';
    }
  }

  // --- Sync photos from Drive folder ---
  async function syncDrivePhotos() {
    if (!accessToken) return;
    await ensureDriveFolder();
    if (!driveFolderId) return;

    try {
      const q = `'${driveFolderId}' in parents and trashed = false and mimeType contains 'image/'`;
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id, name, mimeType, webViewLink, webContentLink, thumbnailLink, size, createdTime, description)&orderBy=createdTime desc`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        const drivePhotos = data.files.map((file) => {
          let descData = {};
          try {
            if (file.description) descData = JSON.parse(file.description);
          } catch (e) {}
          const directUrl = `https://lh3.googleusercontent.com/d/${file.id}`;
          return {
            id: file.id,
            title: file.name.replace(/\.[^/.]+$/, ''),
            url: directUrl,
            directUrl: directUrl,
            driveLink: file.webViewLink,
            folder: 'travel',
            size: parseInt(file.size || '0', 10),
            date: file.createdTime,
            camera: descData.camera || 'Google Drive',
            settings: descData.settings || 'Đã đồng bộ từ Drive',
            location: descData.location || null,
            gps: descData.gps || null
          };
        });

        // Show only real Google Drive photos when connected
        photos = drivePhotos;
        updateAllViews();
        // Merge Drive photos with local photos (prioritize Drive photos)
        const driveIds = new Set(drivePhotos.map(d => d.id));
        const localOnly = photos.filter(p => !driveIds.has(p.id) && !p.id.startsWith('demo-'));
        photos = [...drivePhotos, ...localOnly];
        savePhotos();
        updateAllViews();
      }
    } catch (err) {
      console.warn('Sync drive photos failed', err);
    }
  }

  // --- Token Persistence & Storage ---
  function saveAuthToken(token, expiresInMs) {
    accessToken = token;
    const expiresAt = Date.now() + expiresInMs;
    localStorage.setItem('drive_access_token', token);
    localStorage.setItem('drive_token_expires', expiresAt.toString());
    sessionStorage.setItem('drive_access_token', token);
    sessionStorage.setItem('drive_token_expires', expiresAt.toString());
  }

  function clearAuthToken() {
    accessToken = null;
    localStorage.removeItem('drive_access_token');
    localStorage.removeItem('drive_token_expires');
    sessionStorage.removeItem('drive_access_token');
    sessionStorage.removeItem('drive_token_expires');
  }

  function restoreAuthToken() {
    const token = localStorage.getItem('drive_access_token') || sessionStorage.getItem('drive_access_token');
    const expiresAt = parseInt(localStorage.getItem('drive_token_expires') || sessionStorage.getItem('drive_token_expires') || '0', 10);
    if (token && expiresAt > Date.now()) {
      accessToken = token;
      return true;
    }
    return false;
  }

  // --- Google OAuth Connection ---
  function initGoogleAuth() {
    const config = loadSavedConfig();
    if (config.clientId && window.google?.accounts?.oauth2) {
      try {
        tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: config.clientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: async (tokenResponse) => {
            if (tokenResponse.error !== undefined) {
              console.error('OAuth token error', tokenResponse);
              showToast('Lỗi xác thực Google Drive');
              setConnectedState('reauth');
              return;
            }
            const expiresIn = (tokenResponse.expires_in || 3500) * 1000;
            saveAuthToken(tokenResponse.access_token, expiresIn);
            config.hasConnected = true;
            saveConfig(config);

            setConnectedState('connected');
            showToast('✅ Đã kết nối Google Drive! Đang đồng bộ ảnh...');

            const fId = await ensureDriveFolder();
            if (fId) updateDriveFolderUI(fId);
            await syncDrivePhotos();
          }
        });

        checkAndApplyAuthState();
      } catch (e) {
        console.warn('Error initTokenClient', e);
      }
    }
  }

  function checkAndApplyAuthState() {
    const config = loadSavedConfig();
    const hasToken = restoreAuthToken();

    if (hasToken) {
      setConnectedState('connected');
      ensureDriveFolder().then(() => syncDrivePhotos());
    } else if (config.hasConnected && config.clientId) {
      setConnectedState('reauth');
      if (tokenClient) {
        try {
          tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
          console.warn('Silent refresh error', e);
        }
      }
    } else {
      setConnectedState('local');
    }
  }

  function setConnectedState(state) {
    // state: 'connected' | 'reauth' | 'local'
    if (state === 'connected') {
      connectionBadge.className = 'status-pill connected';
      connectionText.textContent = 'Google Drive: Đã kết nối';
      if (quickConnectDriveBtn) {
        quickConnectDriveBtn.hidden = true;
        quickConnectDriveBtn.style.display = 'none';
      }
      if (driveFolderId) updateDriveFolderUI(driveFolderId);
      if (disconnectBtn) disconnectBtn.hidden = false;
    } else if (state === 'reauth') {
      connectionBadge.className = 'status-pill reauth';
      connectionText.textContent = 'Drive: Cần làm mới phiên';
      if (quickConnectDriveBtn) {
        quickConnectDriveBtn.innerHTML = '🔄 Kết nối lại Drive';
        quickConnectDriveBtn.hidden = false;
        quickConnectDriveBtn.style.display = 'inline-flex';
      }
      if (openDriveFolderBtn) {
        openDriveFolderBtn.hidden = true;
        openDriveFolderBtn.style.display = 'none';
      }
      if (disconnectBtn) disconnectBtn.hidden = false;
    } else {
      connectionBadge.className = 'status-pill local';
      connectionText.textContent = 'Bộ nhớ thiết bị (Đã lưu)';
      if (quickConnectDriveBtn) {
        quickConnectDriveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg> Đồng bộ Google Drive';
        quickConnectDriveBtn.hidden = false;
        quickConnectDriveBtn.style.display = 'inline-flex';
      }
      if (openDriveFolderBtn) {
        openDriveFolderBtn.hidden = true;
        openDriveFolderBtn.style.display = 'none';
      }
      if (disconnectBtn) disconnectBtn.hidden = true;
    }
  }

  function connectGoogleDrive() {
    const config = loadSavedConfig();
    if (!config.clientId) {
      configModal.classList.add('open');
      clientIdInput.focus();
      return;
    }
    if (!tokenClient) {
      initGoogleAuth();
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      showToast('Đang tải thư viện Google, vui lòng thử lại sau 1-2 giây...');
      configModal.classList.add('open');
    }
  }

  // --- Event Listeners Setup ---
  function setupEvents() {
    // Compact Upload Bar
    if (dropzone) {
      dropzone.addEventListener('click', () => fileInput && fileInput.click());
      dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (fileInput) fileInput.click();
        }
      });

      ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('drag-over');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
        if (files.length) {
          files.forEach(processFile);
        } else {
          showToast('Vui lòng chọn tệp hình ảnh');
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(processFile);
        fileInput.value = '';
      });
    }

    // Global Drag & Drop Overlay (drag anywhere on screen)
    let dragCounter = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (globalDropOverlay) globalDropOverlay.hidden = false;
    });

    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (globalDropOverlay) globalDropOverlay.hidden = true;
      }
    });

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (globalDropOverlay) globalDropOverlay.hidden = true;
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
        const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
        if (files.length) {
          files.forEach(processFile);
        } else {
          showToast('Vui lòng chọn tệp hình ảnh (JPG, PNG, HEIC, WEBP)');
        }
      }
    });

    // Paste from clipboard (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            showToast('Đang xử lý ảnh từ clipboard...');
          }
        }
      }
    });

    // View Switcher Buttons
    if (viewMapBtn) {
      viewMapBtn.addEventListener('click', () => switchView('map'));
    }
    if (viewGridBtn) {
      viewGridBtn.addEventListener('click', () => switchView('grid'));
    }
    if (viewTimelineBtn) {
      viewTimelineBtn.addEventListener('click', () => switchView('timeline'));
    }

    // Search & Filter
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      updateAllViews();
    });

    folderSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      updateAllViews();
    });

    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      updateAllViews();
    });

    // Lightbox
    closeLightboxBtn.addEventListener('click', closeLightbox);
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeLightbox();
        configModal.classList.remove('open');
      }
    });

    // Copy embed link buttons
    copyDirectLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(directLinkInput.value).then(() => showToast('Đã copy Direct Link!'));
    });
    copyMarkdownBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(markdownLinkInput.value).then(() => showToast('Đã copy Markdown syntax!'));
    });
    copyHtmlBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(htmlLinkInput.value).then(() => showToast('Đã copy HTML tag!'));
    });

    // Delete photo
    deletePhotoBtn.addEventListener('click', () => {
      if (!activePhoto) return;
      if (confirm(`Bạn có chắc muốn xóa ảnh "${activePhoto.title}" không?`)) {
        photos = photos.filter((p) => p.id !== activePhoto.id);
        savePhotos();
        updateAllViews();
        closeLightbox();
        showToast('Đã xóa ảnh khỏi danh sách.');
      }
    });

    // Config Modal
    openConfigBtn.addEventListener('click', () => {
      const cfg = loadSavedConfig();
      clientIdInput.value = cfg.clientId || '';
      folderNameInput.value = cfg.folderName || 'DriveGallery';
      configModal.classList.add('open');
    });

    closeConfigBtn.addEventListener('click', () => {
      configModal.classList.remove('open');
    });

    configModal.addEventListener('click', (e) => {
      if (e.target === configModal) configModal.classList.remove('open');
    });

    if (quickConnectDriveBtn) {
      quickConnectDriveBtn.addEventListener('click', connectGoogleDrive);
    }

    saveAndConnectBtn.addEventListener('click', () => {
      const clientId = clientIdInput.value.trim();
      const folderName = folderNameInput.value.trim() || 'DriveGallery';
      if (!clientId) {
        alert('Vui lòng nhập Google OAuth Client ID');
        return;
      }
      saveConfig({ clientId, folderName });
      configModal.classList.remove('open');
      showToast('Đã lưu cấu hình. Đang kích hoạt kết nối Google...');
      initGoogleAuth();
      setTimeout(connectGoogleDrive, 300);
    });

    resetDemoBtn.addEventListener('click', () => {
      if (confirm('Khôi phục danh sách ảnh mẫu khám phá ban đầu?')) {
        photos = [...DEMO_PHOTOS];
        savePhotos();
        updateAllViews();
        configModal.classList.remove('open');
        showToast('Đã tải lại danh sách ảnh mẫu');
      }
    });

    if (disconnectBtn) {
      disconnectBtn.addEventListener('click', () => {
        clearAuthToken();
        driveFolderId = null;
        const cfg = loadSavedConfig();
        cfg.hasConnected = false;
        saveConfig(cfg);
        setConnectedState('local');
        updateAllViews();
        configModal.classList.remove('open');
        showToast('Đã ngắt kết nối Google Drive. Dữ liệu lưu trên máy');
      });
    }
  }

  // --- Initialize App ---
  function init() {
    loadPhotos();
    checkAndApplyAuthState();
    initTravelMap();
    updateAllViews();
    setupEvents();
    switchView('map');

    // Check Google Auth library
    const checkGisInterval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkGisInterval);
        initGoogleAuth();
      }
    }, 200);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

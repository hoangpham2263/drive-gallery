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

  // Badges & Banner
  const openDriveFolderBtn = document.getElementById('openDriveFolderBtn');
  const connectionBadge = document.getElementById('connectionBadge');
  const connectionText = document.getElementById('connectionText');
  const demoBanner = document.getElementById('demoBanner');
  const connectDrivePromptBtn = document.getElementById('connectDrivePromptBtn');

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
    // Fallback to demo items
    photos = [...DEMO_PHOTOS];
    savePhotos();
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
      galleryGrid.innerHTML = `
        <div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="muted" style="margin-bottom:8px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <p><b>Không tìm thấy ảnh nào</b></p>
          <p class="muted small">Hãy thử tìm từ khóa khác hoặc kéo thả ảnh mới vào để tải lên.</p>
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

      card.innerHTML = `
        <div class="card-media">
          <img src="${item.url}" alt="${item.title}" loading="lazy" />
          ${locationBadgeHtml}
          ${dateBadgeHtml}
        </div>
        <div class="card-body">
          <h4 class="card-title" title="${item.title}">${item.title}</h4>
          <div class="card-meta">
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
    lightboxFolder.textContent = `Thư mục: ${folderSelect.querySelector(`option[value="${item.folder}"]`)?.textContent || 'Tất cả'}`;

    // Location
    if (item.location) {
      lightboxLocation.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <strong>${item.location}</strong>
      `;
      if (item.gps && item.gps.lat && item.gps.lng) {
        lightboxMapLink.href = `https://www.google.com/maps?q=${item.gps.lat},${item.gps.lng}`;
        lightboxMapLinkWrapper.hidden = false;
      } else {
        lightboxMapLinkWrapper.hidden = true;
      }
    } else {
      lightboxLocation.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="muted"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        <span class="muted">Không tìm thấy toạ độ GPS trong ảnh</span>
      `;
      lightboxMapLinkWrapper.hidden = true;
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
      savePhotos();
      renderGallery();

      // Complete queue item
      statusEl.textContent = '✓ Hoàn thành';
      statusEl.style.color = 'var(--good)';
      fillEl.style.width = '100%';
      fillEl.style.background = 'var(--good)';

      showToast(`Đã thêm: ${uploadedItem.title} ${locationName ? '• ' + locationName : ''}`);

      setTimeout(() => {
        queueItem.remove();
        if (uploadQueue.children.length === 0) uploadQueue.hidden = true;
      }, 2500);
    } catch (err) {
      console.error('File process failed', err);
      statusEl.textContent = '❌ Lỗi xử lý ảnh';
      statusEl.style.color = 'var(--danger)';
      fillEl.style.background = 'var(--danger)';
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

  // --- Google Drive REST API v3 Integration ---
  async function uploadToGoogleDrive(file, meta) {
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: file.name,
      mimeType: file.type || 'image/jpeg',
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

    const fileReader = new FileReader();
    const fileDataPromise = new Promise((resolve) => {
      fileReader.onload = () => resolve(fileReader.result);
      fileReader.readAsArrayBuffer(file);
    });
    const fileBytes = await fileDataPromise;

    const multipartRequestBody = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${file.type || 'image/jpeg'}\r\n\r\n`,
      fileBytes,
      closeDelimiter
    ]);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,thumbnailLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      },
      body: multipartRequestBody
    });

    if (!res.ok) throw new Error('Google Drive upload failed');
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
    }
    return null;
  }

  function updateDriveFolderUI(fId) {
    if (openDriveFolderBtn && fId) {
      openDriveFolderBtn.href = `https://drive.google.com/drive/folders/${fId}`;
      openDriveFolderBtn.hidden = false;
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

        // Prepend to photos avoiding duplicate IDs
        const existingIds = new Set(photos.map(p => p.id));
        const newItems = drivePhotos.filter(p => !existingIds.has(p.id));
        if (newItems.length > 0) {
          photos = [...newItems, ...photos];
          renderGallery();
        }
      }
    } catch (err) {
      console.warn('Sync drive photos failed', err);
    }
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
              return;
            }
            accessToken = tokenResponse.access_token;
            setConnectedState(true);
            showToast('Đã kết nối Google Drive! Đang chuẩn bị thư mục DriveGallery...');
            await ensureDriveFolder();
            await syncDrivePhotos();
          }
        });
      } catch (e) {
        console.warn('Error initTokenClient', e);
      }
    }
  }

  function setConnectedState(isConnected) {
    if (isConnected) {
      connectionBadge.className = 'status-pill connected';
      connectionText.textContent = 'Đã kết nối Drive';
      demoBanner.hidden = true;
      if (driveFolderId) updateDriveFolderUI(driveFolderId);
    } else {
      connectionBadge.className = 'status-pill demo';
      connectionText.textContent = 'Chế độ Demo';
      demoBanner.hidden = false;
      if (openDriveFolderBtn) openDriveFolderBtn.hidden = true;
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
      showToast('Vui lòng kiểm tra lại Google Client ID trong cài đặt');
      configModal.classList.add('open');
    }
  }

  // --- Event Listeners Setup ---
  function setupEvents() {
    // Dropzone
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      files.forEach(processFile);
      fileInput.value = '';
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

    // Search & Filter
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      renderGallery();
    });

    folderSelect.addEventListener('change', (e) => {
      currentFilter = e.target.value;
      renderGallery();
    });

    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      renderGallery();
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
        renderGallery();
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

    connectDrivePromptBtn.addEventListener('click', connectGoogleDrive);

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
      if (confirm('Khôi phục danh sách ảnh mẫu Demo ban đầu?')) {
        photos = [...DEMO_PHOTOS];
        savePhotos();
        renderGallery();
        configModal.classList.remove('open');
        showToast('Đã khôi phục dữ liệu Demo thành công');
      }
    });
  }

  // --- Initialize App ---
  function init() {
    loadPhotos();
    renderGallery();
    setupEvents();

    // Check Google Auth library
    const checkGisInterval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(checkGisInterval);
        initGoogleAuth();
      }
    }, 300);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

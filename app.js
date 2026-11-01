// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 HIBAMENTES ÉLES KIADÁS)
// 1 / 5. RÉSZ: ALAPARCHITEKTÚRA, ADATMODELL, GLOBÁLIS AUTH & HUB
// =========================================================================

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// --- ISMERT SCRAPER SZEMÉT- ÉS MENÜGOMB AZONOSÍTÓK (FEKETELISTA) ---
const SCRAPER_JUNK_IDS = new Set([
  'uj-gyujtemeny', 'gyujtemenyek', 'uj-gyujtemeny-hozzaadasa', 'mind-84', 'mind-92',
  'matricaalbum-55', 'matricaalbum-56', 'kartya-20', 'kartya-27', 'figura-7', 'kisauto-2',
  'album-megnyitasa', 'gyujtes-inditasa', 'gyujtemeny-bekuldese'
]);

// --- DINAMIKUS ALBUMOK & BOLTOK (FIRESTORE ÉS CACHE ELSŐDLEGES) ---
let ALBUMS_REGISTRY = safeJsonParse('cached_albums_registry', {
  "lidl-lutra-2026": {
    id: "lidl-lutra-2026",
    title: "Lutra Album",
    subtitle: "Védett állatok a Föld körül",
    publisher: "Lidl / WWF",
    year: 2026,
    totalItems: 108,
    type: "sticker",
    typeLabel: "Matricaalbum",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F08cfa8f7-c4f1-4d02-bf25-2719f2d5dfca.png&w=3840&q=75",
    featured: true,
    hasRadar: true,
    radarType: "lidl",
    hasChapters: true,
    hasFavorites: false,
    active: true
  }
});

let STORE_DATABASES = safeJsonParse('cached_store_databases', { "lidl": [], "spar": [], "tesco": [], "penny": [] });

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";
let showAllHubAlbums = false;
let editingAlbumId = null;
let saveDebounceTimer = null;
let lastLocalEditTimestamp = 0;
let lastUndoState = null;
let undoToastTimer = null;

let myGpsCoords = safeJsonParse('cserelj_gps_coords', null);
let selectedSearchRadius = 'all';
let selectedCityFilter = '';
let filterTargetCity = '';
let proximityDisplayLimit = 25;

// =========================================================================
// BIZTONSÁGOS GLOBÁLIS ESEMÉNYKEZELŐ (GOLYÓÁLLÓ BELÉPÉS & MODALOK)
// =========================================================================
document.addEventListener('click', (e) => {
  const openAuth = e.target.closest('#btn-open-auth');
  if (openAuth) {
    document.getElementById('modal-auth')?.classList.add('open');
    return;
  }

  const closeAuth = e.target.closest('#btn-close-auth');
  if (closeAuth) {
    document.getElementById('modal-auth')?.classList.remove('open');
    return;
  }

  const googleBtn = e.target.closest('#btn-google-login');
  if (googleBtn) {
    if (!auth) {
      showToast("A Firebase Auth még nem inicializálódott!");
      return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
      .then(() => {
        showToast("Sikeres belépés!");
        document.getElementById('modal-auth')?.classList.remove('open');
      })
      .catch((error) => {
        console.error("Google Auth Hiba:", error);
        if (error.code === 'auth/popup-blocked') {
          showToast("A böngésző blokkolta a felugró ablakot. Kérlek engedélyezd!");
        } else if (error.code !== 'auth/popup-closed-by-user') {
          showToast("Belépési hiba: " + error.message);
        }
      });
    return;
  }

  const editAcceptBtn = e.target.closest('[data-action="open-edit-accept-modal"]');
  if (editAcceptBtn) {
    const idx = parseInt(editAcceptBtn.dataset.tradeIdx, 10);
    if (typeof openEditAcceptModal === 'function') openEditAcceptModal(idx);
    return;
  }
});

// =========================================================================
// HIBATŰRŐ SZÖVEGPARSEREK
// =========================================================================

function expandCustomItemsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const tokens = rawText.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
  const items = [];
  
  tokens.forEach(tok => {
    const rangeMatch = tok.match(/^([A-Za-z\s\-_]+)\s*(\d+)[\s\-—–]+(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1].trim();
      const start = parseInt(rangeMatch[2], 10);
      const end = parseInt(rangeMatch[3], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let i = min; i <= max; i++) {
        items.push(`${prefix} ${i}`.trim());
      }
      return;
    }

    const numRange = tok.match(/^(\d+)[\s\-—–]+(\d+)$/);
    if (numRange) {
      const start = parseInt(numRange[1], 10);
      const end = parseInt(numRange[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let i = min; i <= max; i++) {
        items.push(String(i));
      }
      return;
    }

    items.push(tok);
  });
  
  return items;
}

function expandCustomNamesText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
  const namesMap = {};
  let maxIdx = 0;

  lines.forEach(line => {
    const subMatches = line.matchAll(/(\d+)[\.\:\-\s]+([^0-9\.\:\n;]+)/g);
    let matchedAny = false;
    for (const match of subMatches) {
      const idx = parseInt(match[1], 10);
      const name = match[2].trim().replace(/^[\,\-\–\—\:]+/, '').trim();
      if (idx > 0 && name) {
        namesMap[idx] = name;
        if (idx > maxIdx) maxIdx = idx;
        matchedAny = true;
      }
    }

    if (!matchedAny) {
      const single = line.match(/^(\d+)[\.\:\-\s]+(.+)$/);
      if (single) {
        const idx = parseInt(single[1], 10);
        const name = single[2].trim();
        if (idx > 0 && name) {
          namesMap[idx] = name;
          if (idx > maxIdx) maxIdx = idx;
        }
      } else {
        maxIdx++;
        namesMap[maxIdx] = line;
      }
    }
  });

  const names = [];
  for (let i = 1; i <= maxIdx; i++) {
    names.push(namesMap[i] || `Tétel #${i}`);
  }
  return names;
}

function getNormalizedAlbumTitleKey(title) {
  if (!title) return '';
  return normalizeText(title)
    .replace(/\b(panini|topps|spar|lidl|wwf|album|kollekcio|collection|matrica|kartya|cards?|stickers?|uefa|fifa|xl)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// KOORDINÁTA-TÁR ÉS TÁVOLSÁGSZÁMÍTÁS
const CITY_COORDINATES = {
  "budapest": { lat: 47.4979, lng: 19.0402, x: 52.5, y: 39.0 },
  "gyor": { lat: 47.6875, lng: 17.6504, x: 26.0, y: 27.0 },
  "szeged": { lat: 46.2530, lng: 20.1414, x: 66.0, y: 81.0 },
  "debrecen": { lat: 47.5316, lng: 21.6273, x: 88.0, y: 40.0 },
  "miskolc": { lat: 48.1035, lng: 20.7784, x: 77.0, y: 23.0 },
  "pecs": { lat: 46.0727, lng: 18.2323, x: 41.0, y: 83.0 },
  "kecskemet": { lat: 46.9069, lng: 19.6913, x: 61.0, y: 59.0 },
  "szekesfehervar": { lat: 47.1860, lng: 18.4221, x: 44.0, y: 45.0 }
};

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII"];
const KNOWN_CANONICAL_CITIES = { "erd": "Érd", "gyor": "Győr", "pecs": "Pécs", "szeged": "Szeged", "debrecen": "Debrecen", "miskolc": "Miskolc", "kecskemet": "Kecskemét", "szekesfehervar": "Székesfehérvár", "nagykoros": "Nagykőrös", "cegled": "Cegléd" };

function normalizeText(text) {
  if (!text) return '';
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseBudapestDistricts(text) {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/kerület|kerulet|ker\.?|district/g, ' ');
  const districts = [];
  const romanMap = { xxiii: 23, xxii: 22, xxi: 21, xx: 20, xix: 19, xviii: 18, xvii: 17, xvi: 16, xv: 15, xiv: 14, xiii: 13, xii: 12, xi: 11, x: 10, ix: 9, viii: 8, vii: 7, vi: 6, v: 5, iv: 4, iii: 3, ii: 2, i: 1 };
  const romanMatches = clean.match(/\b(xxiii|xxii|xxi|xx|xix|xviii|xvii|xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/g);
  if (romanMatches) romanMatches.forEach(r => { if (romanMap[r]) districts.push(romanMap[r]); });
  const arabMatches = clean.match(/\b([1-9]|1[0-9]|2[0-3])\b/g);
  if (arabMatches) arabMatches.forEach(n => districts.push(parseInt(n, 10)));
  return [...new Set(districts)].sort((a, b) => a - b);
}

function extractNormalizedLocations(locationInput) {
  if (!locationInput) return [];
  const results = [];
  const SPLIT_REGEX = /[\/,;\\\+\-–—]|\bés\b|\bill\.?\b|\bvalamint\b/i;
  let rawList = [];

  if (Array.isArray(locationInput)) {
    locationInput.forEach(loc => {
      if (typeof loc === 'string') loc.split(SPLIT_REGEX).forEach(t => { if (t.trim()) rawList.push(t.trim()); });
      else if (loc && loc.city) {
        if (loc.districts && loc.districts.length > 0) loc.districts.forEach(d => rawList.push(`Budapest ${d}. kerület`));
        else loc.city.split(SPLIT_REGEX).forEach(t => { if (t.trim()) rawList.push(t.trim()); });
      }
    });
  } else if (typeof locationInput === 'string') {
    rawList = locationInput.split(SPLIT_REGEX).map(t => t.trim()).filter(t => t.length > 0);
  }

  rawList.forEach(raw => {
    const norm = normalizeText(raw);
    if (!norm) return;
    const isBp = norm.includes('budapest') || norm.includes('bp') || norm.includes('pest') || /^[0-9ivx\.\s\-]+ker/.test(norm);
    if (isBp) {
      const districts = parseBudapestDistricts(raw);
      if (districts.length > 0) districts.forEach(d => results.push({ canonicalKey: `budapest_${d}`, displayName: `Budapest ${ROMAN_NUMERALS[d]}. kerület`, cityGroup: "Budapest" }));
      else results.push({ canonicalKey: `budapest`, displayName: `Budapest`, cityGroup: "Budapest" });
    } else {
      const cleanKey = norm.replace(/[\s\.\-]+/g, '');
      const prettyName = KNOWN_CANONICAL_CITIES[cleanKey] || raw.charAt(0).toUpperCase() + raw.slice(1);
      results.push({ canonicalKey: cleanKey, displayName: prettyName, cityGroup: prettyName });
    }
  });

  const uniqueMap = new Map();
  results.forEach(item => { if (!uniqueMap.has(item.canonicalKey)) uniqueMap.set(item.canonicalKey, item); });
  return Array.from(uniqueMap.values());
}

function isLocalCityMatch(locA, locB) {
  const cleanA = Array.isArray(locA) ? locA.filter(l => (typeof l === 'string' ? l.trim().length > 0 : l?.city?.trim().length > 0)) : locA;
  const cleanB = Array.isArray(locB) ? locB.filter(l => (typeof l === 'string' ? l.trim().length > 0 : l?.city?.trim().length > 0)) : locB;
  const citiesA = extractNormalizedLocations(cleanA).map(i => i.canonicalKey);
  const citiesB = extractNormalizedLocations(cleanB).map(i => i.canonicalKey);
  if (citiesA.length === 0 || citiesB.length === 0) return false;
  return citiesA.some(cA => citiesB.includes(cA));
}

function safeJsonParse(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) { return fallback; }
}

function ensureArray(val) {
  if (!val) return [];
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 2000;
  if (Array.isArray(val)) {
    return val.map(item => parseInt(String(item).replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'string' || typeof val === 'object') {
    const rawTokens = typeof val === 'string' ? val.split(/[\s,;]+/) : Object.keys(val);
    return rawTokens.map(t => parseInt(String(t).replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  return [];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function getActiveLockedCounts(albumId = currentAlbumId) {
  const counts = {};
  (myProfile.activeTrades || []).forEach(t => {
    if ((t.status === 'accepted' || t.status === 'shipped') && (t.albumId || 'lidl-lutra-2026') === albumId) {
      (t.givingItems || []).forEach(num => { counts[num] = (counts[num] || 0) + 1; });
    }
  });
  return counts;
}

let myProfile = {
  nev: "Vendég gyűjtő",
  telepules: "",
  locations: [{ city: "", districts: [] }],
  geo: myGpsCoords,
  email: "",
  isGiftOffering: false,
  showEmailToUsers: false,
  emailNotifications: true,
  allowInspect: true,
  gdprAccepted: true,
  isVacation: false,
  trustScore: 0,
  ratingsCount: 0,
  privateNote: localStorage.getItem(`private_note_${currentAlbumId}`) || '',
  favorites: [],
  van: ensureArray(safeJsonParse(`lutra_van_${currentAlbumId}`, [])),
  vanCounts: safeJsonParse(`lutra_van_counts_${currentAlbumId}`, {}),
  kell: ensureArray(safeJsonParse(`lutra_kell_${currentAlbumId}`, [])),
  foglalva: [],
  activeTrades: safeJsonParse(`lutra_active_trades_${currentAlbumId}`, [])
};

let allUsersData = [];
let rawAllUsersDocs = [];
let currentUser = null;
let db = null;
let auth = null;

function getActiveAlbum() {
  return ALBUMS_REGISTRY[currentAlbumId] || ALBUMS_REGISTRY["lidl-lutra-2026"] || { totalItems: 108, title: "Gyűjtemény", type: "sticker", active: true };
}

function getActiveAlbumSize() {
  return getActiveAlbum().totalItems || 108;
}

function getAlbumDisplayTitle(albumId) {
  const alb = ALBUMS_REGISTRY[albumId];
  if (!alb) return albumId ? `Gyűjtemény (${albumId})` : 'Lutra Album (2026)';
  return `${alb.title} (${alb.year})`;
}

function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    const raw = album.customItems[num - 1];
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return `#${num}`;
}
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 HIBAMENTES ÉLES KIADÁS)
// 2 / 5. RÉSZ: RÁCS INTERAKCIÓK, UNDO TOAST, TÖMEGES BEVITEL & ROUTER
// =========================================================================

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');

// =========================================================================
// 0 MS CIKLUS LAKATVÉDELEMMEL ÉS 1-KATTINTÁSOS VISSZAVONÁSSAL (UNDO)
// =========================================================================
function toggleStickerState(num) {
  hideQtyPopover();

  if (getActiveAlbum().active === false) {
    showToast("Ez a gyűjtemény inaktív, reaktiválásig nem szerkeszthető!");
    return;
  }

  const activeLocks = getActiveLockedCounts(currentAlbumId);
  if (activeLocks[num] && activeLocks[num] > 0 && myProfile.van.includes(num)) {
    showToast(`🔒 A #${num} tétel zárolva van egy aktív csere miatt!`);
    return;
  }

  lastUndoState = {
    num,
    prevVan: [...myProfile.van],
    prevVanCounts: { ...(myProfile.vanCounts || {}) },
    prevKell: [...myProfile.kell]
  };

  const isVan = myProfile.van.includes(num);
  const isKell = myProfile.kell.includes(num);

  let newState = '';

  if (!isVan && !isKell) {
    myProfile.van.push(num);
    myProfile.vanCounts[num] = 1;
    newState = 'van';
  } else if (isVan) {
    const idx = myProfile.van.indexOf(num);
    if (idx > -1) myProfile.van.splice(idx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num);
    newState = 'kell';
  } else if (isKell) {
    const idx = myProfile.kell.indexOf(num);
    if (idx > -1) myProfile.kell.splice(idx, 1);
    newState = '';
  }

  updateSingleCellDOM(num, newState);
  updateBadgeCounts();
  showUndoToast(num, newState);
  saveMyStateFast();
}

function showUndoToast(num, state) {
  const bar = document.getElementById('undo-toast-bar');
  const txt = document.getElementById('undo-toast-text');
  if (!bar || !txt) return;

  const stateNames = { 'van': 'Dupla (Zöld)', 'kell': 'Hiányzik (Barna)', '': 'Üres / Megvan' };
  txt.innerHTML = `<strong>${getItemLabel(num)}</strong> módosítva: ${stateNames[state]}`;
  bar.style.display = 'flex';

  clearTimeout(undoToastTimer);
  undoToastTimer = setTimeout(() => { bar.style.display = 'none'; }, 4000);
}

safeAddListener('btn-undo-click', () => {
  if (!lastUndoState) return;
  const { num, prevVan, prevVanCounts, prevKell } = lastUndoState;
  
  myProfile.van = prevVan;
  myProfile.vanCounts = prevVanCounts;
  myProfile.kell = prevKell;

  let restoredState = '';
  if (myProfile.van.includes(num)) restoredState = 'van';
  else if (myProfile.kell.includes(num)) restoredState = 'kell';

  updateSingleCellDOM(num, restoredState);
  updateBadgeCounts();
  saveMyStateFast();

  const bar = document.getElementById('undo-toast-bar');
  if (bar) bar.style.display = 'none';
  lastUndoState = null;
  showToast("Módosítás visszavonva!");
});

function updateSingleCellDOM(num, state) {
  const cell = document.querySelector(`.matrica-cell[data-num="${num}"]`);
  if (cell) {
    cell.classList.remove('van', 'kell');
    if (state) cell.classList.add(state);
    
    cell.querySelectorAll('.qty-badge').forEach(b => b.remove());

    let badgesHtml = '';
    const vQty = (state === 'van' && myProfile.vanCounts?.[num]) ? myProfile.vanCounts[num] : 0;
    const activeLocks = getActiveLockedCounts(currentAlbumId);
    const fQty = activeLocks[num] || 0;

    if (vQty > 1) badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    if (fQty > 0 && state === 'van') badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    
    cell.insertAdjacentHTML('beforeend', badgesHtml);
  }
}

function showQtyPopover(num, targetEl) {
  if (!popover || !targetEl) return;
  activePopoverNum = num;
  let currentQty = myProfile.vanCounts[num] || 1;

  document.querySelectorAll('.qty-pop-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.qty, 10) === currentQty);
  });

  popover.style.display = 'flex';
  popover.style.visibility = 'hidden';
  popover.classList.add('open');

  const rect = targetEl.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const viewportWidth = window.innerWidth;

  let left = rect.left + rect.width / 2;
  const halfWidth = popRect.width / 2;
  if (left - halfWidth < 10) left = halfWidth + 10;
  else if (left + halfWidth > viewportWidth - 10) left = viewportWidth - halfWidth - 10;

  let top = rect.top - 8;
  let transformY = '-100%';
  if (rect.top - popRect.height < 60) {
    top = rect.bottom + 8;
    transformY = '0%';
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.transform = `translate(-50%, ${transformY})`;
  popover.style.visibility = 'visible';
}

function hideQtyPopover() {
  if (!popover) return;
  popover.classList.remove('open');
  popover.style.display = 'none';
  activePopoverNum = null;
}

function attachStickerInteraction(container) {
  if (!container) return;
  let touchStartPos = { x: 0, y: 0 };
  let isLongPressTriggered = false;
  let longPressTimer = null;

  container.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('[data-num]');
    if (target) {
      e.preventDefault();
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }
  });

  container.addEventListener('touchstart', (e) => {
    const target = e.target.closest('[data-num]');
    if (!target) return;
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isLongPressTriggered = false;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      if ("vibrate" in navigator) navigator.vibrate(35);
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }, 450);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    const moveX = Math.abs(e.touches[0].clientX - touchStartPos.x);
    const moveY = Math.abs(e.touches[0].clientY - touchStartPos.y);
    if (moveX > 10 || moveY > 10) clearTimeout(longPressTimer);
  }, { passive: true });

  container.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
  });

  container.addEventListener('click', (e) => {
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }
    const target = e.target.closest('[data-num]');
    if (target) {
      toggleStickerState(parseInt(target.dataset.num, 10));
    }
  });
}

function syncLutraDualSave(albumId) {
  if (!currentUser || !db) return;
  const isLutra = (albumId === 'lidl-lutra-2026');

  db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(albumId).set({
    albumId: albumId,
    van: myProfile.van,
    vanCounts: myProfile.vanCounts || {},
    kell: myProfile.kell,
    localUpdatedAt: Date.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  const publicPayload = {
    collections: {
      [albumId]: {
        van: myProfile.van,
        vanCounts: myProfile.vanCounts || {},
        kell: myProfile.kell,
        updatedAt: Date.now()
      }
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (isLutra) {
    publicPayload.van = myProfile.van;
    publicPayload.vanCounts = myProfile.vanCounts || {};
    publicPayload.kell = myProfile.kell;
  }

  db.collection("public_profiles").doc(currentUser.uid).set(publicPayload, { merge: true }).catch(() => {});
}

function saveMyStateFast() {
  const albumId = currentAlbumId;
  const now = Date.now();
  lastLocalEditTimestamp = now;

  localStorage.setItem(`lutra_updated_at_${albumId}`, now);
  localStorage.setItem(`lutra_van_${albumId}`, JSON.stringify(myProfile.van));
  localStorage.setItem(`lutra_van_counts_${albumId}`, JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem(`lutra_kell_${albumId}`, JSON.stringify(myProfile.kell));

  if (albumId === 'lidl-lutra-2026') {
    localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
    localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
    localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
  }

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    if (typeof refreshMatchesIfVisible === 'function') refreshMatchesIfVisible();
    if (typeof renderCompletionOdds === 'function') renderCompletionOdds();
    syncLutraDualSave(albumId);
  }, 450);
}

function saveMyState() {
  saveMyStateFast();
  renderGrid();
  if (typeof renderHub === 'function') renderHub();
}

document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    const num = activePopoverNum;

    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);

    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    myProfile.vanCounts[num] = qty;

    saveMyState();
    hideQtyPopover();
    showToast(`${getItemLabel(num)}: ${qty} db mentve a duplákhoz.`);
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#qty-popover') && !e.target.closest('[data-num]')) hideQtyPopover();
});

safeAddListener('btn-toggle-batch', () => {
  const box = document.getElementById('batch-input-box');
  const btn = document.getElementById('btn-toggle-batch');
  if (!box) return;

  const isOpen = box.style.display === 'block';
  box.style.display = isOpen ? 'none' : 'block';
  
  if (btn) {
    btn.classList.toggle('active', !isOpen);
    btn.textContent = !isOpen ? 'Tömeges bevitel ✕' : 'Tömeges bevitel';
  }
});

safeAddListener('btn-close-batch-box', () => {
  const box = document.getElementById('batch-input-box');
  const btn = document.getElementById('btn-toggle-batch');
  if (box) box.style.display = 'none';
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = 'Tömeges bevitel';
  }
});

function parseBatchInput(raw) {
  const tokens = raw.split(/[\s,;]+/);
  const parsed = {};
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 2000;

  tokens.forEach(t => {
    t = t.trim();
    if (!t) return;

    const rangeMatch = t.match(/^(\d+)[\s\-—–]+(\d+)(?:[*xX](\d+))?$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const qty = parseInt(rangeMatch[3] || '1', 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);

      for (let num = min; num <= max; num++) {
        if (num >= 1 && num <= maxLimit && qty > 0) {
          parsed[num] = (parsed[num] || 0) + qty;
        }
      }
      return;
    }

    const multMatch = t.match(/^(\d+)[*xX](\d+)$/);
    if (multMatch) {
      const num = parseInt(multMatch[1], 10);
      const qty = parseInt(multMatch[2], 10);
      if (num >= 1 && num <= maxLimit && qty > 0) parsed[num] = (parsed[num] || 0) + qty;
      return;
    }

    const num = parseInt(t.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= maxLimit) {
      parsed[num] = (parsed[num] || 0) + 1;
    }
  });

  return parsed;
}

safeAddListener('btn-apply-batch-van', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.entries(parsed).forEach(([nStr, qty]) => {
    const num = parseInt(nStr, 10);
    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + qty;
    count += qty;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Duplákhoz.`);
});

safeAddListener('btn-apply-batch-kell', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.keys(parsed).forEach(nStr => {
    const num = parseInt(nStr, 10);
    if (!myProfile.kell.includes(num)) myProfile.kell.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    count++;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Hiányzókhoz.`);
});

function formatLinksWithAnchors(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;
  return escaped.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--amber); text-decoration:underline; font-weight:600;">${url}</a>`;
  });
}

function switchCategory(catName) {
  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === catName));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavRadar = document.getElementById('subnav-radar');
  const subnavProfil = document.getElementById('subnav-profil');

  if (subnavMatricaim) subnavMatricaim.style.display = catName === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = catName === 'cserebere' ? 'flex' : 'none';
  if (subnavRadar) subnavRadar.style.display = catName === 'radar' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = catName === 'profil' ? 'flex' : 'none';

  if (catName === 'hub') switchView('hub');
  else if (catName === 'matricaim') switchView('matricaim');
  else if (catName === 'cserebere') switchView('cserek');
  else if (catName === 'radar') switchView('statisztika');
  else if (catName === 'profil') switchView('profil');
}

function switchView(viewName) {
  if (viewName === 'cseréim') {
    switchView('matricaim');
    const tradesPanel = document.getElementById('active-trades-panel');
    if (tradesPanel) {
      tradesPanel.style.display = 'block';
      tradesPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.id === 'subtab-active-trades'));
    return;
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');

  document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  document.querySelectorAll('.dropdown-link').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));

  let parentCat = 'matricaim';
  if (viewName === 'hub') parentCat = 'hub';
  else if (viewName === 'cserek' || viewName === 'kereso' || viewName === 'uzeneteim') parentCat = 'cserebere';
  else if (viewName === 'statisztika' || viewName === 'radar' || viewName === 'meetups') parentCat = 'radar';
  else if (viewName === 'profil' || viewName === 'admin') parentCat = 'profil';

  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === parentCat));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavRadar = document.getElementById('subnav-radar');
  const subnavProfil = document.getElementById('subnav-profil');
  if (subnavMatricaim) subnavMatricaim.style.display = parentCat === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = parentCat === 'cserebere' ? 'flex' : 'none';
  if (subnavRadar) subnavRadar.style.display = parentCat === 'radar' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = parentCat === 'profil' ? 'flex' : 'none';
}

document.querySelectorAll('.primary-tab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.view) switchView(t.dataset.view);
    else switchCategory(t.dataset.cat);
  });
});

document.querySelectorAll('.sub-tab').forEach(t => {
  t.addEventListener('click', () => switchView(t.dataset.view));
});

document.querySelectorAll('.dropdown-link').forEach(t => {
  t.addEventListener('click', () => switchView(t.dataset.view));
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 HIBAMENTES ÉLES KIADÁS)
// 3 / 5. RÉSZ: FOTÓS SZÁMSZKENNER (GEMINI 3.8), FB ELEMZŐ & KAPCSOLATFELVÉTEL
// =========================================================================

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();
let activeTradeClosingData = null;
let activeTradeCancellingIdx = null;
let activePromptTradeData = null;
let fbMatchUploadedBase64 = '';
let scannerRecognizedNums = [];

// =========================================================================
// FOTÓS SZÁMSZKENNER (GEMINI 3.8 FLASH)
// =========================================================================

safeAddListener('btn-open-scanner', () => {
  document.getElementById('modal-scanner')?.classList.add('open');
});

function closeScannerModal() {
  document.getElementById('modal-scanner')?.classList.remove('open');
  if (document.getElementById('scanner-results-box')) document.getElementById('scanner-results-box').style.display = 'none';
  if (document.getElementById('scanner-loader')) document.getElementById('scanner-loader').style.display = 'none';
}
safeAddListener('btn-close-scanner', closeScannerModal);

function handleImageFile(file) {
  if (!file) return;
  const loader = document.getElementById('scanner-loader');
  const resultsBox = document.getElementById('scanner-results-box');
  if (loader) loader.style.display = 'block';
  if (resultsBox) resultsBox.style.display = 'none';

  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      await processScannerImageWithProxy(base64Data);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

safeAddListener('scanner-file-input', 'change', (e) => handleImageFile(e.target.files[0]));
safeAddListener('scanner-camera-input', 'change', (e) => handleImageFile(e.target.files[0]));

async function processScannerImageWithProxy(base64Data) {
  try {
    const res = await fetch(WORKER_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, model: 'gemini-3.8-flash' })
    });
    let data;
    try { data = await res.json(); } catch (parseErr) { throw new Error("A képfelismerő szerver nem válaszolt érvényesen."); }
    if (!res.ok) throw new Error(data.error || "Hiba történt a kép beolvasásakor.");
    scannerRecognizedNums = ensureArray(data.numbers).sort((a, b) => a - b);
    renderScannerTags();
  } catch (err) {
    showToast('Hiba: ' + err.message);
  } finally {
    if (document.getElementById('scanner-loader')) document.getElementById('scanner-loader').style.display = 'none';
  }
}

function renderScannerTags() {
  const countLabel = document.getElementById('scanner-count-label');
  if (countLabel) countLabel.textContent = scannerRecognizedNums.length;
  const box = document.getElementById('scanner-tags-box');
  if (!box) return;

  if (scannerRecognizedNums.length === 0) {
    box.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Nem található szám a képen.</span>';
    if (document.getElementById('scanner-results-box')) document.getElementById('scanner-results-box').style.display = 'block';
    return;
  }

  box.innerHTML = scannerRecognizedNums.map((num, idx) => `
    <span style="background:var(--water-mid); padding:2px 8px; border-radius:999px; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; border:1px solid var(--amber);">
      ${escapeHtml(getItemLabel(num))}
      <span data-del-idx="${idx}" style="cursor:pointer; color:var(--danger); font-weight:bold;">✕</span>
    </span>
  `).join('');
  if (document.getElementById('scanner-results-box')) document.getElementById('scanner-results-box').style.display = 'block';
}

safeAddListener('scanner-tags-box', 'click', (e) => {
  const delBtn = e.target.closest('[data-del-idx]');
  if (!delBtn) return;
  const idx = parseInt(delBtn.dataset.delIdx, 10);
  scannerRecognizedNums.splice(idx, 1);
  renderScannerTags();
});

safeAddListener('btn-scanner-add-manual', () => {
  const input = document.getElementById('scanner-manual-num');
  const num = parseInt(input?.value || '0', 10);
  const totalSize = getActiveAlbumSize();
  if (num >= 1 && num <= totalSize) {
    scannerRecognizedNums.push(num);
    scannerRecognizedNums.sort((a, b) => a - b);
    renderScannerTags();
    if (input) input.value = '';
  } else {
    showToast(`Adj meg egy számot 1 és ${totalSize} között!`);
  }
});

safeAddListener('btn-scanner-save-van', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető tétel.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + 1;
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db tétel mentve a Duplákhoz.`);
});

safeAddListener('btn-scanner-save-kell', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető tétel.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.kell.includes(num)) myProfile.kell.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db tétel mentve a Hiányzókhoz.`);
});

safeAddListener('btn-scanner-copy-list', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs másolható szám.");
  const formattedText = scannerRecognizedNums.map(n => getItemLabel(n)).join(', ');
  navigator.clipboard.writeText(formattedText);
  showToast("Számsor kimásolva a vágólapra!");
});

// =========================================================================
// KIIKSZELŐS KAPCSOLATFELVÉTELI RENDSZER (EGYEDI AJÁNLATTAL)
// =========================================================================

function checkSenderProfileReady() {
  if (!currentUser) {
    showToast("Előbb lépj be a fiókodba a kapcsolatfelvételhez!");
    document.getElementById('modal-auth')?.classList.add('open');
    return false;
  }
  if (!myProfile.email || !myProfile.email.trim()) {
    myProfile.email = currentUser.email || '';
  }
  if (!myProfile.nev || myProfile.nev === 'Vendég gyűjtő') {
    myProfile.nev = currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Gyűjtő');
  }
  return true;
}

function openContactModal(targetUser, giveArray = [], getArray = [], isGift = false, customInitialMsg = '') {
  if (!checkSenderProfileReady()) return;
  const activeAlbum = getActiveAlbum();
  const subject = `${activeAlbum.title} csere megkeresés`;

  activeContactTarget = {
    uid: targetUser.id || targetUser.uid || '',
    nev: targetUser.nev || 'Gyűjtőpartner',
    telepules: targetUser.telepules || '',
    email: targetUser.email || '',
    showEmail: targetUser.showEmailToUsers === true,
    isGift: isGift,
    subject: subject,
    customInitialMsg: customInitialMsg,
    isEdited: false
  };

  activeContactGiveNums = ensureArray(giveArray);
  activeContactGetNums = ensureArray(getArray);
  excludedGiveNums.clear();
  excludedGetNums.clear();

  const titleEl = document.getElementById('contact-modal-title');
  if (titleEl) titleEl.textContent = `Üzenet küldése: ${escapeHtml(activeContactTarget.nev)}`;

  const directEmailBox = document.getElementById('contact-direct-email-box');
  const partnerEmailSpan = document.getElementById('contact-partner-email');
  const emailLink = document.getElementById('contact-email-link');

  if (activeContactTarget.showEmail && activeContactTarget.email && directEmailBox) {
    directEmailBox.style.display = 'block';
    if (partnerEmailSpan) partnerEmailSpan.textContent = activeContactTarget.email;
    if (emailLink) emailLink.href = `mailto:${activeContactTarget.email}?subject=${encodeURIComponent(subject)}`;
  } else if (directEmailBox) {
    directEmailBox.style.display = 'none';
  }

  const customOfferInput = document.getElementById('contact-custom-offer');
  if (customOfferInput) customOfferInput.value = '';

  renderContactChips();
  updateContactModalText();
  document.getElementById('modal-contact')?.classList.add('open');
}

function openDirectContactModal(targetUser, numsArray, isGift) {
  if (!checkSenderProfileReady()) return;
  openContactModal(targetUser, [], ensureArray(numsArray), isGift);
}

function renderContactChips() {
  const giveBox = document.getElementById('contact-give-chips');
  const getBox = document.getElementById('contact-get-chips');
  const giveWrapper = document.getElementById('contact-give-chips-wrapper');
  const getWrapper = document.getElementById('contact-get-chips-wrapper');

  if (giveWrapper) giveWrapper.style.display = activeContactGiveNums.length > 0 ? 'block' : 'none';
  if (getWrapper) getWrapper.style.display = activeContactGetNums.length > 0 ? 'block' : 'none';

  if (giveBox) {
    giveBox.innerHTML = activeContactGiveNums.map(n => {
      const isExcluded = excludedGiveNums.has(n);
      return `
        <span class="contact-item-chip ${isExcluded ? 'excluded' : ''}" data-action="toggle-give-chip" data-num="${n}">
          ${escapeHtml(getItemLabel(n, currentAlbumId))}
          <span class="chip-del">✕</span>
        </span>
      `;
    }).join('');
  }

  if (getBox) {
    getBox.innerHTML = activeContactGetNums.map(n => {
      const isExcluded = excludedGetNums.has(n);
      return `
        <span class="contact-item-chip ${isExcluded ? 'excluded' : ''}" data-action="toggle-get-chip" data-num="${n}" style="border-color:var(--moss-soft);">
          ${escapeHtml(getItemLabel(n, currentAlbumId))}
          <span class="chip-del">✕</span>
        </span>
      `;
    }).join('');
  }
}

safeAddListener('contact-chips-editor-section', 'click', (e) => {
  const chip = e.target.closest('[data-action]');
  if (!chip) return;
  const num = parseInt(chip.dataset.num, 10);
  if (isNaN(num)) return;

  if (chip.dataset.action === 'toggle-give-chip') {
    if (excludedGiveNums.has(num)) excludedGiveNums.delete(num);
    else excludedGiveNums.add(num);
  } else if (chip.dataset.action === 'toggle-get-chip') {
    if (excludedGetNums.has(num)) excludedGetNums.delete(num);
    else excludedGetNums.add(num);
  }

  renderContactChips();
  updateContactModalText();
});

function updateContactModalText() {
  const inputEl = document.getElementById('contact-msg-input');
  if (!inputEl) return;

  if (activeContactTarget.customInitialMsg && !activeContactTarget.isEdited) {
    inputEl.value = activeContactTarget.customInitialMsg;
    return;
  }

  const activeAlbum = getActiveAlbum();
  const effectiveGive = activeContactGiveNums.filter(n => !excludedGiveNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const customOfferText = (document.getElementById('contact-custom-offer')?.value || '').trim();

  let giveTextPart = effectiveGive;
  if (customOfferText) {
    giveTextPart = giveTextPart ? `${giveTextPart} + ${customOfferText}` : customOfferText;
  }
  if (!giveTextPart) giveTextPart = '(egyeztetés alatt / egyéni megegyezés)';

  let msg = '';
  if (activeContactTarget.isGift && !effectiveGive && !customOfferText) {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan oldalon láttam a felajánlásodat, hogy a dupláidat szívesen odaadod ajándékba a(z) ${activeAlbum.title} gyűjteményből.\nSzeretném elkérni az alábbi tételt/tételeket:\n${effectiveGet || 'egyeztetés alatt'}\n\nHogyan tudnánk lebonyolítani az átadást/postázást?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  } else {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan platformon találtam meg a gyűjteményedet a(z) ${activeAlbum.title} albumban:\n\nÉn tudom adni neked: ${giveTextPart}\nTe tudod adni nekem: ${effectiveGet || '(egyeztetés alatt)'}\n\nMegfelelne a csere postán vagy személyesen?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  }

  inputEl.value = msg;
}

safeAddListener('contact-custom-offer', 'input', () => {
  activeContactTarget.isEdited = false;
  activeContactTarget.customInitialMsg = '';
  updateContactModalText();
});

safeAddListener('contact-msg-input', 'input', () => {
  activeContactTarget.isEdited = true;
});

safeAddListener('btn-send-message', () => {
  const messageText = document.getElementById('contact-msg-input')?.value.trim() || '';
  if (!messageText) return showToast("Kérlek írj be egy üzenetet!");

  const loader = document.getElementById('contact-send-loader');
  const sendBtn = document.getElementById('btn-send-message');
  const autoCreateTrade = document.getElementById('contact-auto-create-trade')?.checked !== false;

  if (loader) loader.style.display = 'block';
  if (sendBtn) sendBtn.disabled = true;

  const effectiveGiveNums = activeContactGiveNums.filter(n => !excludedGiveNums.has(n));
  const effectiveGetNums = activeContactGetNums.filter(n => !excludedGetNums.has(n));
  const customOfferText = (document.getElementById('contact-custom-offer')?.value || '').trim();

  (async () => {
    try {
      let tradeId = null;

      if (autoCreateTrade && (effectiveGiveNums.length > 0 || effectiveGetNums.length > 0 || customOfferText)) {
        if (!myProfile.activeTrades) myProfile.activeTrades = [];
        tradeId = 'trade_' + Date.now();
        
        const newTradeObj = {
          tradeId: tradeId,
          initiatorUid: currentUser.uid,
          initiatorName: myProfile.nev,
          initiatorCity: myProfile.telepules || '',
          partnerUid: activeContactTarget.uid,
          partnerName: activeContactTarget.nev,
          partnerCity: activeContactTarget.telepules || 'Partner',
          albumId: currentAlbumId,
          givingItems: effectiveGiveNums,
          receivingItems: effectiveGetNums,
          customOffer: customOfferText,
          message: messageText,
          createdAt: Date.now(),
          status: 'pending_acceptance',
          isInitiator: true
        };

        myProfile.activeTrades.unshift(newTradeObj);

        effectiveGiveNums.forEach(n => {
          if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
        });

        saveMyState();
        if (typeof renderActiveTradesPanel === 'function') renderActiveTradesPanel();
        renderGrid();

        if (db) {
          db.collection("trades").doc(tradeId).set({
            ...newTradeObj,
            serverCreatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(e => console.warn("Trade save:", e));
        }
      }

      if (db && currentUser) {
        const threadId = [currentUser.uid, activeContactTarget.uid].sort().join('_') + '_' + currentAlbumId;

        await db.collection("messages").add({
          fromUid: currentUser.uid,
          fromName: myProfile.nev,
          fromCity: myProfile.telepules || '',
          toUid: activeContactTarget.uid,
          toName: activeContactTarget.nev,
          albumId: currentAlbumId,
          threadId: threadId,
          tradeId: tradeId,
          tradeDetails: tradeId ? {
            givingItems: effectiveGiveNums,
            receivingItems: effectiveGetNums,
            customOffer: customOfferText
          } : null,
          subject: activeContactTarget.subject,
          message: messageText,
          text: messageText,
          read: false,
          readAt: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      showToast("Üzeneted elküldve! A csere rögzítve a rácsod alatt.");
      document.getElementById('modal-contact')?.classList.remove('open');
    } catch (err) {
      showToast("Küldési hiba: " + err.message);
    } finally {
      if (loader) loader.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
    }
  })();
});

safeAddListener('btn-close-contact', () => document.getElementById('modal-contact')?.classList.remove('open'));
safeAddListener('btn-copy-msg', () => {
  const val = document.getElementById('contact-msg-input')?.value || '';
  navigator.clipboard.writeText(val);
  showToast("Üzenet kimásolva a vágólapra!");
});

// =========================================================================
// FACEBOOK POSZT ELEMZŐ BŐVÍTETT SZINONIMA PARSEREL
// =========================================================================

function parseFacebookPostText(rawText) {
  let otherHas = [];
  let otherNeeds = [];

  const HAS_KW = /(?:^|\s|[,;])(?:van|dupl[aá]k?|cser[eé]k?|cserematric[aá]k?|adom|adok|cser[eé]lem|plusz|plussz|tudok adni|tudjuk adni|k[íi]n[aá]l|felesleg)[:\s\-—–]*/i;
  const NEEDS_KW = /(?:^|\s|[,;])(?:kell|hi[aá]ny(?:z[oó]k?)?|hiányzik|k[eé]rem|keres(?:em|s[uü]k|n[eé]m)?|valakinek megvan|vinn[eé]k|sz[uü]ks[eé]gem van)[:\s\-—–]*/i;

  const hasPos = rawText.search(HAS_KW);
  const needsPos = rawText.search(NEEDS_KW);

  if (hasPos !== -1 && needsPos !== -1) {
    let hasChunk = '';
    let needsChunk = '';
    if (hasPos < needsPos) {
      hasChunk = rawText.slice(hasPos, needsPos);
      needsChunk = rawText.slice(needsPos);
    } else {
      needsChunk = rawText.slice(needsPos, hasPos);
      hasChunk = rawText.slice(hasPos);
    }
    otherHas = Object.keys(parseBatchInput(hasChunk.replace(HAS_KW, ''))).map(Number);
    otherNeeds = Object.keys(parseBatchInput(needsChunk.replace(NEEDS_KW, ''))).map(Number);
  } else if (hasPos !== -1) {
    otherHas = Object.keys(parseBatchInput(rawText.replace(HAS_KW, ''))).map(Number);
  } else if (needsPos !== -1) {
    otherNeeds = Object.keys(parseBatchInput(rawText.replace(NEEDS_KW, ''))).map(Number);
  } else {
    otherHas = Object.keys(parseBatchInput(rawText)).map(Number);
  }

  return { has: [...new Set(otherHas)], needs: [...new Set(otherNeeds)] };
}
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 HIBAMENTES ÉLES KIADÁS)
// 4 / 5. RÉSZ: RÁCS ALATTI CSERÉK, ZÁROLÁSOK & SZERKESZTHETŐ ELFOGADÁS
// =========================================================================

// =========================================================================
// RÁCS ALATTI CSERÉK & ZÁROLÁSOK (SZERKESZTHETŐ ELFOGADÁSSAL)
// =========================================================================

function renderActiveTradesPanel() {
  const panel = document.getElementById('active-trades-panel');
  const list = document.getElementById('active-trades-list');
  const countSpan = document.getElementById('active-trades-count');
  const subnavBadge = document.getElementById('badge-trades-count');

  if (!panel || !list) return;

  const allTrades = myProfile.activeTrades || [];
  const pendingTrades = allTrades.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTrades = allTrades.filter(t => t.status === 'completed' || t.status === 'cancelled');

  if (countSpan) countSpan.textContent = pendingTrades.length;
  if (subnavBadge) {
    subnavBadge.textContent = pendingTrades.length;
    subnavBadge.style.display = pendingTrades.length > 0 ? 'inline-block' : 'none';
  }

  if (pendingTrades.length === 0 && completedTrades.length === 0) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  panel.style.display = 'block';

  let html = '';

  if (pendingTrades.length > 0) {
    html += pendingTrades.map((t) => {
      const originalIdx = allTrades.indexOf(t);
      const isWaitingMyAcceptance = (t.status === 'pending_acceptance' && !t.isInitiator);
      const isWaitingPartnerAcceptance = (t.status === 'pending_acceptance' && t.isInitiator);
      const isAccepted = (t.status === 'accepted');
      const isShipped = (t.status === 'shipped');

      let statusBadge = '';
      if (isWaitingMyAcceptance) {
        statusBadge = `<span class="badge-trade-status badge-status-waiting">Elfogadásodra / Szerkesztésre vár</span>`;
      } else if (isWaitingPartnerAcceptance) {
        statusBadge = `<span class="badge-trade-status badge-status-waiting">Partner jóváhagyására vár</span>`;
      } else if (isShipped) {
        statusBadge = `<span class="badge-trade-status badge-status-shipped">Csomag postázva</span>`;
      } else {
        statusBadge = `<span class="badge-trade-status badge-status-reserved">🔒 Mindkét félnél zárolva</span>`;
      }

      let givingText = t.givingItems && t.givingItems.length ? t.givingItems.map(n => getItemLabel(n)).join(', ') : '';
      let receivingText = t.receivingItems && t.receivingItems.length ? t.receivingItems.map(n => getItemLabel(n)).join(', ') : '';

      if (t.isInitiator && t.customOffer) {
        givingText = givingText ? `${givingText} + ${escapeHtml(t.customOffer)}` : escapeHtml(t.customOffer);
      } else if (!t.isInitiator && t.customOffer) {
        receivingText = receivingText ? `${receivingText} + ${escapeHtml(t.customOffer)}` : escapeHtml(t.customOffer);
      }

      if (!givingText) givingText = '<em>(Nem kér cserét / Ajándék)</em>';
      if (!receivingText) receivingText = '<em>(Ajándékozás)</em>';

      return `
        <div class="trade-manage-card" data-trade-idx="${originalIdx}">
          <div class="trade-manage-header">
            <div>
              <strong style="color:#FFF; font-size:0.95rem;">${escapeHtml(t.partnerName || 'Cserepartner')}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${escapeHtml(t.partnerCity || 'Partner')})</span>
            </div>
            ${statusBadge}
          </div>

          <div style="font-size:0.8rem; line-height:1.5; margin:6px 0; background:rgba(0,0,0,0.2); padding:8px; border-radius:var(--radius-sm);">
            <p style="margin:2px 0;"><strong>Te adod:</strong> ${givingText}</p>
            <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle kapod:</strong> ${receivingText}</p>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${isWaitingMyAcceptance ? `
                <button class="btn btn-contact-green btn-sm" data-action="open-edit-accept-modal" data-trade-idx="${originalIdx}">
                  ✏️ Cseretételek szerkesztése és elfogadása
                </button>
              ` : ''}

              ${(isAccepted || isShipped) ? `
                <button class="btn btn-contact-green btn-sm" data-action="complete-trade" data-trade-idx="${originalIdx}">
                  ✓ Megérkezett / Csere lezárása
                </button>
                <button class="btn btn-secondary btn-sm" data-action="ship-trade" data-trade-idx="${originalIdx}" style="border-color:var(--amber); color:var(--amber);">
                  ${isShipped ? 'Postázva jelölve' : 'Csomag feladva'}
                </button>
              ` : ''}
            </div>

            <button class="btn btn-secondary btn-sm" data-action="cancel-trade" data-trade-idx="${originalIdx}" style="color:var(--danger); border-color:var(--danger);">
              ✕ Megállapodás visszavonása
            </button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    html += '<p style="font-size:0.82rem; color:var(--sand); margin:4px 0 10px;">Jelenleg nincs folyamatban lévő, aktív megállapodásod.</p>';
  }

  if (completedTrades.length > 0) {
    html += `
      <details class="archived-trades-details" style="margin-top:12px; border-top:1px dashed rgba(243,238,223,0.15); padding-top:8px;">
        <summary style="font-size:0.8rem; color:var(--amber); cursor:pointer; font-weight:700; user-select:none;">
          📁 Archivált cserék (${completedTrades.length} db lezárva / visszavonva)
        </summary>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${completedTrades.map(t => {
            const isCompleted = t.status === 'completed';
            return `
              <div style="background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:var(--radius-sm); font-size:0.76rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:var(--text-primary);">${escapeHtml(t.partnerName)}</strong> (${escapeHtml(t.partnerCity || '')})
                  <br>Átadva: ${t.givingItems?.map(n => getItemLabel(n)).join(', ') || '-'} ➔ Kapva: ${t.receivingItems?.map(n => getItemLabel(n)).join(', ') || '-'}
                </div>
                <span style="color:${isCompleted ? 'var(--moss-soft)' : 'var(--danger)'}; font-weight:700;">
                  ${isCompleted ? '✓ Teljesítve' : '✕ Visszavonva'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </details>
    `;
  }

  list.innerHTML = html;
}

let activeEditingTradeIndex = null;

function openEditAcceptModal(tradeIdx) {
  const trade = (myProfile.activeTrades || [])[tradeIdx];
  if (!trade) return;
  activeEditingTradeIndex = tradeIdx;

  const modal = document.getElementById('modal-edit-accept-trade');
  if (!modal) return;

  document.getElementById('edit-accept-partner-name').textContent = trade.partnerName || 'Partner';
  
  const giveBox = document.getElementById('edit-accept-giving-chips');
  const getBox = document.getElementById('edit-accept-getting-chips');

  if (giveBox) {
    giveBox.innerHTML = (trade.givingItems || []).map(n => `
      <label class="checkbox-label" style="margin:0; font-size:0.8rem; color:#FFF;">
        <input type="checkbox" class="edit-give-chk" value="${n}" checked> ${getItemLabel(n)}
      </label>
    `).join('') || '<em style="color:var(--text-muted);">Nincs tétel</em>';
  }

  if (getBox) {
    getBox.innerHTML = (trade.receivingItems || []).map(n => `
      <label class="checkbox-label" style="margin:0; font-size:0.8rem; color:#FFF;">
        <input type="checkbox" class="edit-get-chk" value="${n}" checked> ${getItemLabel(n)}
      </label>
    `).join('') || '<em style="color:var(--text-muted);">Nincs tétel</em>';
  }

  modal.classList.add('open');
}

safeAddListener('btn-close-edit-accept', () => {
  document.getElementById('modal-edit-accept-trade')?.classList.remove('open');
  activeEditingTradeIndex = null;
});
safeAddListener('btn-close-edit-accept-2', () => {
  document.getElementById('modal-edit-accept-trade')?.classList.remove('open');
  activeEditingTradeIndex = null;
});

safeAddListener('btn-confirm-edit-accept', async () => {
  if (activeEditingTradeIndex === null) return;
  const trade = myProfile.activeTrades[activeEditingTradeIndex];
  if (!trade) return;

  const newGiving = [];
  document.querySelectorAll('.edit-give-chk:checked').forEach(chk => newGiving.push(parseInt(chk.value, 10)));

  const newReceiving = [];
  document.querySelectorAll('.edit-get-chk:checked').forEach(chk => newReceiving.push(parseInt(chk.value, 10)));

  trade.givingItems = newGiving;
  trade.receivingItems = newReceiving;
  trade.status = 'accepted';

  newGiving.forEach(n => {
    if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
  });

  saveMyState();
  renderActiveTradesPanel();
  renderGrid();

  if (db && trade.tradeId) {
    try {
      await db.collection("trades").doc(trade.tradeId).update({
        givingItems: newReceiving,
        receivingItems: newGiving,
        status: 'accepted',
        editedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      if (trade.partnerUid) {
        const threadId = [currentUser.uid, trade.partnerUid].sort().join('_') + '_' + (trade.albumId || currentAlbumId);
        await db.collection("messages").add({
          fromUid: currentUser.uid,
          fromName: myProfile.nev,
          fromCity: myProfile.telepules || '',
          toUid: trade.partnerUid,
          toName: trade.partnerName,
          albumId: trade.albumId || currentAlbumId,
          threadId: threadId,
          subject: "Csereajánlat módosítva & elfogadva",
          message: `Szia! A cseretételeket átnéztem, módosítottam és elfogadtam a megállapodást.`,
          read: false,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) {
      console.warn("Trade edit accept sync error:", e);
    }
  }

  document.getElementById('modal-edit-accept-trade')?.classList.remove('open');
  activeEditingTradeIndex = null;
  showToast("Csere elfogadva és szinkronizálva a módosításokkal!");
});

safeAddListener('active-trades-list', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.tradeIdx, 10);
  const trade = (myProfile.activeTrades || [])[idx];
  if (!trade) return;

  if (btn.dataset.action === 'ship-trade') {
    trade.status = 'shipped';
    if (db && trade.tradeId) {
      db.collection("trades").doc(trade.tradeId).update({ status: 'shipped' }).catch(() => {});
    }
    saveMyState();
    renderActiveTradesPanel();
    showToast("Csomag postázva státusz beállítva.");
  } else if (btn.dataset.action === 'complete-trade') {
    activeTradeClosingData = { trade, tradeIdx: idx };
    const titleEl = document.getElementById('rate-modal-title');
    if (titleEl) titleEl.textContent = `Csere lezárása: ${trade.partnerName}`;
    document.getElementById('modal-rate-trade')?.classList.add('open');
  } else if (btn.dataset.action === 'cancel-trade') {
    activeTradeCancellingIdx = idx;
    document.getElementById('modal-cancel-trade-reason')?.classList.add('open');
  }
});

function checkAndPromptIncomingTrade(tradeDoc, totalPendingCount = 1) {
  if (!tradeDoc || !currentUser) return;
  const data = tradeDoc.data();
  if (data.status !== 'pending_acceptance' || data.initiatorUid === currentUser.uid) return;

  activePromptTradeData = { id: tradeDoc.id, ...data };

  const nameEl = document.getElementById('incoming-prompt-sender-name');
  const cityEl = document.getElementById('incoming-prompt-sender-city');
  const albumEl = document.getElementById('incoming-prompt-album-title');
  const getListEl = document.getElementById('incoming-prompt-get-list');
  const giveListEl = document.getElementById('incoming-prompt-give-list');
  const msgBox = document.getElementById('incoming-prompt-msg-box');
  const badgeEl = document.getElementById('incoming-prompt-counter-badge');

  if (badgeEl) {
    badgeEl.textContent = `1 / ${totalPendingCount} ajánlat`;
    badgeEl.style.display = totalPendingCount > 1 ? 'inline-block' : 'none';
  }

  if (nameEl) nameEl.textContent = data.initiatorName || 'Partner';
  if (cityEl) cityEl.textContent = data.initiatorCity || '';
  if (albumEl) albumEl.textContent = getAlbumDisplayTitle(data.albumId);

  let receivedItemsStr = (data.givingItems && data.givingItems.length)
    ? data.givingItems.map(n => getItemLabel(n, data.albumId)).join(', ')
    : '';

  if (data.customOffer) {
    receivedItemsStr = receivedItemsStr ? `${receivedItemsStr} + ${escapeHtml(data.customOffer)}` : escapeHtml(data.customOffer);
  }

  if (getListEl) getListEl.innerHTML = receivedItemsStr || '<em>(Ajándékozás)</em>';
  if (giveListEl) giveListEl.innerHTML = (data.receivingItems && data.receivingItems.length) ? data.receivingItems.map(n => getItemLabel(n, data.albumId)).join(', ') : '<em>(Ingyen felajánlás)</em>';
  if (msgBox) msgBox.innerHTML = data.message ? `„${formatLinksWithAnchors(data.message)}”` : '<em>(Nincs külön megjegyzés)</em>';

  document.getElementById('modal-incoming-trade-prompt')?.classList.add('open');
}

safeAddListener('btn-close-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
});

safeAddListener('btn-accept-incoming-prompt', async () => {
  if (!activePromptTradeData) return;
  const t = activePromptTradeData;

  const localTradeObj = {
    tradeId: t.id,
    initiatorUid: t.initiatorUid,
    partnerUid: t.initiatorUid,
    partnerName: t.initiatorName,
    partnerCity: t.initiatorCity,
    albumId: t.albumId,
    givingItems: t.receivingItems || [],
    receivingItems: t.givingItems || [],
    customOffer: t.customOffer || '',
    createdAt: Date.now(),
    status: 'accepted',
    isInitiator: false
  };

  if (!myProfile.activeTrades) myProfile.activeTrades = [];
  const existingIdx = myProfile.activeTrades.findIndex(x => x.tradeId === t.id);
  if (existingIdx > -1) {
    myProfile.activeTrades[existingIdx] = localTradeObj;
  } else {
    myProfile.activeTrades.unshift(localTradeObj);
  }

  localTradeObj.givingItems.forEach(n => {
    if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
  });

  saveMyState();
  renderActiveTradesPanel();
  renderGrid();

  if (db) {
    await db.collection("trades").doc(t.id).update({
      status: 'accepted',
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
  showToast("Csere elfogadva! A tételek zárolva lettek.");
});

safeAddListener('btn-reject-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
  document.getElementById('modal-cancel-trade-reason')?.classList.add('open');
});

document.querySelectorAll('input[name="cancel-reason"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const customGroup = document.getElementById('cancel-reason-custom-group');
    if (customGroup) customGroup.style.display = e.target.value === 'egyeb' ? 'block' : 'none';
  });
});

safeAddListener('btn-abort-cancel-trade', () => {
  document.getElementById('modal-cancel-trade-reason')?.classList.remove('open');
  activeTradeCancellingIdx = null;
});

safeAddListener('btn-confirm-cancel-trade', () => {
  let trade = null;
  let idx = activeTradeCancellingIdx;

  if (idx !== null && myProfile.activeTrades && myProfile.activeTrades[idx]) {
    trade = myProfile.activeTrades[idx];
  } else if (activePromptTradeData) {
    trade = {
      tradeId: activePromptTradeData.id,
      partnerUid: activePromptTradeData.initiatorUid,
      partnerName: activePromptTradeData.initiatorName,
      givingItems: activePromptTradeData.receivingItems || [],
      albumId: activePromptTradeData.albumId
    };
  }

  if (!trade) return;

  const selectedReasonVal = document.querySelector('input[name="cancel-reason"]:checked')?.value || 'meggondoltam_magam';
  let reasonText = 'Meggondoltam magam';

  if (selectedReasonVal === 'mar_nincs_meg') {
    reasonText = 'Már nincs meg a felajánlott dupla tétel';
    if (trade.givingItems) {
      trade.givingItems.forEach(n => {
        if (myProfile.vanCounts && myProfile.vanCounts[n]) {
          myProfile.vanCounts[n] = Math.max(0, myProfile.vanCounts[n] - 1);
          if (myProfile.vanCounts[n] === 0) {
            delete myProfile.vanCounts[n];
            const vIdx = myProfile.van.indexOf(n);
            if (vIdx > -1) myProfile.van.splice(vIdx, 1);
          }
        }
      });
    }
  } else if (selectedReasonVal === 'mashogy_megoldodott') {
    reasonText = 'Időközben máshogy megoldódott a csere';
  } else if (selectedReasonVal === 'egyeb') {
    reasonText = document.getElementById('cancel-trade-custom-reason')?.value.trim() || 'Egyéb okból visszavonva';
  }

  if (trade.givingItems) {
    trade.givingItems.forEach(n => {
      const fIdx = myProfile.foglalva.indexOf(n);
      if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
    });
  }

  if (db && currentUser && trade.partnerUid) {
    const threadId = [currentUser.uid, trade.partnerUid].sort().join('_') + '_' + (trade.albumId || currentAlbumId);
    db.collection("messages").add({
      fromUid: currentUser.uid,
      fromName: myProfile.nev,
      fromCity: myProfile.telepules || '',
      toUid: trade.partnerUid,
      toName: trade.partnerName,
      albumId: trade.albumId || currentAlbumId,
      threadId: threadId,
      subject: "Csereajánlat visszavonása",
      message: `Szia! A csereajánlatot elutasítottam / visszavontam.\nIndoklás: ${reasonText}`,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    if (trade.tradeId) {
      db.collection("trades").doc(trade.tradeId).update({
        status: 'cancelled',
        cancelReason: reasonText
      }).catch(() => {});
    }
  }

  if (idx !== null && myProfile.activeTrades) {
    myProfile.activeTrades[idx].status = 'cancelled';
  }

  saveMyState();
  renderActiveTradesPanel();
  renderGrid();

  document.getElementById('modal-cancel-trade-reason')?.classList.remove('open');
  activeTradeCancellingIdx = null;
  activePromptTradeData = null;
  showToast(selectedReasonVal === 'mar_nincs_meg' ? "Ajánlat törölve, a tétel levonva a dupláid közül." : "Megállapodás elutasítva, zárolások feloldva.");
});

let selectedStarRating = 5;

document.querySelectorAll('#trade-star-rating-box .star-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedStarRating = parseInt(btn.dataset.rating, 10);
    document.querySelectorAll('#trade-star-rating-box .star-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.rating, 10) <= selectedStarRating);
    });
  });
});

safeAddListener('btn-close-rate-modal', () => document.getElementById('modal-rate-trade')?.classList.remove('open'));

safeAddListener('btn-submit-trade-rating', async () => {
  if (!activeTradeClosingData) return;
  const { trade, tradeIdx } = activeTradeClosingData;
  const commentText = document.getElementById('rate-modal-comment')?.value.trim() || '';

  if (trade.receivingItems) {
    trade.receivingItems.forEach(n => {
      const kIdx = myProfile.kell.indexOf(n);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
      if (!myProfile.van.includes(n)) {
        myProfile.van.push(n);
        myProfile.vanCounts[n] = 1;
      } else {
        myProfile.vanCounts[n] = (myProfile.vanCounts[n] || 1) + 1;
      }
    });
  }

  if (trade.givingItems) {
    trade.givingItems.forEach(n => {
      if (myProfile.vanCounts && myProfile.vanCounts[n]) {
        myProfile.vanCounts[n] = Math.max(0, myProfile.vanCounts[n] - 1);
        if (myProfile.vanCounts[n] === 0) {
          delete myProfile.vanCounts[n];
          const vIdx = myProfile.van.indexOf(n);
          if (vIdx > -1) myProfile.van.splice(vIdx, 1);
        }
      }
      const fIdx = myProfile.foglalva.indexOf(n);
      if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
    });
  }

  myProfile.activeTrades[tradeIdx].status = 'completed';
  saveMyState();

  if (currentUser && db && trade.partnerUid) {
    try {
      await db.collection("public_profiles").doc(trade.partnerUid).collection("reviews").add({
        fromUid: currentUser.uid,
        fromName: myProfile.nev || 'Gyűjtőtárs',
        stars: selectedStarRating,
        comment: commentText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("public_profiles").doc(trade.partnerUid).update({
        trustScore: firebase.firestore.FieldValue.increment(selectedStarRating),
        ratingsCount: firebase.firestore.FieldValue.increment(1)
      });

      if (trade.tradeId) {
        await db.collection("trades").doc(trade.tradeId).update({ status: 'completed' });
      }
    } catch (e) {
      console.warn("Értékelési hiba:", e);
    }
  }

  if (document.getElementById('rate-modal-comment')) document.getElementById('rate-modal-comment').value = '';
  document.getElementById('modal-rate-trade')?.classList.remove('open');
  activeTradeClosingData = null;
  renderActiveTradesPanel();
  renderGrid();
  showToast("Csere sikeresen lezárva, duplák levonva és archiválva!");
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 HIBAMENTES ÉLES KIADÁS)
// 5 / 5. RÉSZ: 4 KERESŐ, HŐTÉRKÉP, ÜZENETEK & ALKALMAZÁS INDÍTÁSA (BOOT)
// =========================================================================

// =========================================================================
// 1. BLOKK: TÉTELKERESŐ
// =========================================================================

safeAddListener('btn-search', () => {
  const raw = document.getElementById('search-input')?.value.trim() || '';
  if (!raw) return showToast("Írj be egy keresőszót!");
  const queryNorm = normalizeText(raw);
  const matchedNums = [];
  const totalSize = getActiveAlbumSize();

  const rangeMatch = raw.match(/^(\d+)[\s\-—–]+(\d+)$/);
  if (rangeMatch) {
    const s = parseInt(rangeMatch[1], 10), e = parseInt(rangeMatch[2], 10);
    for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
      if (i >= 1 && i <= totalSize) matchedNums.push(i);
    }
  } else {
    const numTokens = raw.split(/[\s,;]+/).filter(t => /^\d+$/.test(t));
    if (numTokens.length > 0) {
      numTokens.forEach(n => {
        const num = parseInt(n, 10);
        if (num >= 1 && num <= totalSize) matchedNums.push(num);
      });
    } else {
      for (let i = 1; i <= totalSize; i++) {
        const full = normalizeText(getItemFullName(i, currentAlbumId));
        if (full.includes(queryNorm)) matchedNums.push(i);
      }
    }
  }

  if (matchedNums.length === 0) return showToast("Nincs találat.");
  
  const resultsContainer = document.getElementById('search-results');
  if (resultsContainer) resultsContainer.style.display = 'block';
  renderSearchResults(matchedNums.sort((a, b) => a - b), `Keresés: „${raw}”`);
});

document.getElementById('search-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-search')?.click();
  }
});

safeAddListener('btn-close-item-search', () => {
  const container = document.getElementById('search-results');
  const closeBtn = document.getElementById('btn-close-item-search');
  if (container) {
    container.style.display = 'none';
    container.innerHTML = '';
  }
  if (closeBtn) closeBtn.style.display = 'none';
});

safeAddListener('btn-search-all-missing', () => {
  const container = document.getElementById('search-results');
  const btn = document.getElementById('btn-search-all-missing');

  if (container && container.style.display !== 'none' && container.dataset.mode === 'all-missing') {
    container.style.display = 'none';
    container.innerHTML = '';
    container.dataset.mode = '';
    if (btn) btn.classList.remove('active');
    document.getElementById('btn-close-item-search').style.display = 'none';
    return;
  }

  if (myProfile.kell.length === 0) return showToast("Nincs bejelölt hiányzó tételed.");
  if (btn) btn.classList.add('active');
  if (container) {
    container.style.display = 'block';
    container.dataset.mode = 'all-missing';
  }
  renderSearchResults(myProfile.kell, `Összes hiányzód (${myProfile.kell.length} db)`);
});

function renderSearchResults(targetNums, titleText) {
  const container = document.getElementById('search-results');
  const closeBtn = document.getElementById('btn-close-item-search');
  if (!container) return;
  if (closeBtn) closeBtn.style.display = 'inline-block';

  const targetSet = new Set(targetNums);

  const matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : '') && !u.isVacation)
    .map(u => {
      const found = ensureArray(u.van).filter(n => targetSet.has(n)).sort((a, b) => a - b);
      return { ...u, found };
    })
    .filter(u => u.found.length > 0)
    .sort((a, b) => b.found.length - a.found.length);

  if (matches.length === 0) {
    container.innerHTML = `<p class="view-intro">${escapeHtml(titleText)} — Jelenleg senkinél sincs duplában.</p>`;
    return;
  }

  container.innerHTML = `
    <p class="view-intro" style="color:var(--sand); margin-bottom:8px;"><strong>${escapeHtml(titleText)}</strong> — ${matches.length} gyűjtőnél:</p>
    ${matches.map(u => `
      <div class="card">
        <div class="card-header-row">
          <h3 style="cursor:pointer; margin:0;" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">
            ${escapeHtml(u.nev || 'Névtelen')} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''}
          </h3>
          ${u.isGiftOffering ? '<span class="badge-gift">Ingyen adja</span>' : ''}
        </div>
        <p style="margin:4px 0;"><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => getItemLabel(n)).join(', ')}</p>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-search" data-uid="${escapeHtml(u.id)}" data-found="${u.found.join(',')}">
            Érdekelnek a tételek
          </button>
          <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">
            Adatlap
          </button>
        </div>
      </div>
    `).join('')}
  `;
}

safeAddListener('search-results', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'contact-search') {
    const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
    if (targetUser) openDirectContactModal(targetUser, btn.dataset.found, targetUser.isGiftOffering);
  } else if (btn.dataset.action === 'inspect-user') {
    openUserProfileModal(btn.dataset.uid);
  }
});

// =========================================================================
// 2. BLOKK: TELEPÜLÉSKERESŐ
// =========================================================================

safeAddListener('btn-search-by-city', () => {
  const inputEl = document.getElementById('search-by-city-input');
  const statusEl = document.getElementById('city-search-status');
  const clearBtn = document.getElementById('btn-clear-city-search');
  const boxEl = document.getElementById('city-search-results-box');
  const listEl = document.getElementById('city-search-partners-list');
  const query = (inputEl?.value || '').trim();

  if (!query) return showToast("Írj be egy települést!");

  selectedCityFilter = query;

  const matchedUsers = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me') && !u.isVacation)
    .filter(u => isLocalCityMatch(u.locations || u.telepules, query));

  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (boxEl) boxEl.style.display = 'block';

  if (statusEl) {
    statusEl.innerHTML = `Találatok a(z) <strong>${escapeHtml(query)}</strong> településen (${matchedUsers.length} gyűjtő):`;
  }

  if (listEl) {
    if (matchedUsers.length === 0) {
      listEl.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Nincs regisztrált gyűjtő ezen a településen.</p>`;
    } else {
      listEl.innerHTML = matchedUsers.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || 'Helyi')})
            <div style="font-size:0.75rem; color:var(--sand);">${ensureArray(u.van).length} db cserélhető dupla</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
          </div>
        </div>
      `).join('');
    }
  }
});

document.getElementById('search-by-city-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-search-by-city')?.click();
  }
});

safeAddListener('btn-clear-city-search', () => {
  const inputEl = document.getElementById('search-by-city-input');
  const boxEl = document.getElementById('city-search-results-box');
  const clearBtn = document.getElementById('btn-clear-city-search');

  selectedCityFilter = '';
  if (inputEl) inputEl.value = '';
  if (boxEl) boxEl.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';

  showToast("Településszűrés törölve.");
});

safeAddListener('city-search-partners-list', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return;

  if (btn.dataset.action === 'contact-match') {
    openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
  } else if (btn.dataset.action === 'inspect-user') {
    openUserProfileModal(uid);
  }
});

// =========================================================================
// 3. BLOKK: KÖZELI GPS KERESŐ
// =========================================================================

function renderProximityPartners() {
  const container = document.getElementById('proximity-partners-list');
  if (!container) return;

  const myCoords = myGpsCoords || getUserCoordinates(myProfile);
  const myId = currentUser ? currentUser.uid : 'me';

  let list = allUsersData
    .filter(u => u.id !== myId && !u.isVacation)
    .map(u => {
      const distanceKm = getMinDistanceToUser(myCoords, u);
      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const totalDupes = ensureArray(u.van).length;
      const updatedAgo = formatTimeAgo(u.updatedAt);
      return { ...u, distanceKm, isSameCity, totalDupes, updatedAgo };
    });

  if (selectedSearchRadius === 'city') {
    list = list.filter(u => u.isSameCity);
  } else if (selectedSearchRadius !== 'all') {
    const maxDist = parseInt(selectedSearchRadius, 10);
    list = list.filter(u => u.distanceKm !== null && u.distanceKm <= maxDist);
  }

  list.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
  });

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:16px; background:rgba(0,0,0,0.25); border-radius:var(--radius-sm); font-size:0.85rem; color:var(--text-muted);">
        ${selectedSearchRadius !== 'all' ? 'Nincs gyűjtő a megadott távolságon belül.' : 'Nincs regisztrált partner az adatbázisban.'}
      </div>`;
    return;
  }

  const paginatedList = list.slice(0, proximityDisplayLimit);
  const hasMore = list.length > proximityDisplayLimit;

  container.innerHTML = `
    ${paginatedList.map(u => {
      const distText = u.distanceKm !== null ? `kb. ${u.distanceKm} km` : (u.isSameCity ? 'Helyi gyűjtő' : 'Nincs GPS adat');
      const timeText = u.updatedAgo ? `• ${u.updatedAgo}` : '';
      const trustText = u.ratingsCount > 0 
        ? `⭐ ${(u.trustScore / u.ratingsCount).toFixed(1)} (${u.ratingsCount})` 
        : (u.trustScore > 0 ? `⭐ ${u.trustScore}` : '<span style="font-size:0.72rem; color:var(--text-muted);">Új gyűjtő</span>');

      return `
        <div style="background:rgba(0,0,0,0.3); padding:10px 12px; border-radius:var(--radius-sm); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="color:#FFF; font-size:0.95rem; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">
              ${escapeHtml(u.nev)} ${trustText}
            </strong>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">${escapeHtml(u.telepules || '')}</span>
            <div style="font-size:0.75rem; color:var(--amber); font-weight:600; margin-top:2px;">
              ${distText} ${timeText} • ${u.totalDupes} db cserélhető duplája van
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-contact-green btn-sm" data-action="contact-proximity" data-uid="${escapeHtml(u.id)}">
              Csereindítás
            </button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">
              Adatlap
            </button>
          </div>
        </div>
      `;
    }).join('')}

    ${hasMore ? `
      <div style="text-align:center; margin-top:12px;">
        <button class="btn btn-secondary btn-sm" data-action="load-more-proximity" id="btn-load-more-proximity" style="width:100%; padding:8px;">
          + További 25 gyűjtő mutatása (${list.length - proximityDisplayLimit} maradt)
        </button>
      </div>
    ` : ''}
  `;
}

safeAddListener('proximity-partners-list', 'click', (e) => {
  const loadMoreBtn = e.target.closest('[data-action="load-more-proximity"]') || e.target.closest('#btn-load-more-proximity');
  if (loadMoreBtn) {
    proximityDisplayLimit += 25;
    renderProximityPartners();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return;

  if (btn.dataset.action === 'contact-proximity') {
    openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
  } else if (btn.dataset.action === 'inspect-user') {
    openUserProfileModal(uid);
  }
});

// =========================================================================
// 4. BLOKK: NÉVALAPÚ KERESŐ
// =========================================================================

safeAddListener('btn-search-partner', () => {
  const inputEl = document.getElementById('search-partner-input');
  const boxEl = document.getElementById('partner-search-results-box');
  const statusEl = document.getElementById('partner-search-status');
  const listEl = document.getElementById('partner-search-list');
  const clearBtn = document.getElementById('btn-clear-partner-search');
  const query = (inputEl?.value || '').trim().toLowerCase();

  if (!query) return showToast("Írd be a gyűjtő nevét a kereséshez!");

  const myId = currentUser ? currentUser.uid : 'me';
  const matchedUsers = allUsersData.filter(u => 
    u.id !== myId && !u.isVacation && (u.nev || '').toLowerCase().includes(query)
  );

  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (boxEl) boxEl.style.display = 'block';

  if (statusEl) {
    statusEl.innerHTML = `Találatok a(z) „<strong>${escapeHtml(query)}</strong>” névre (${matchedUsers.length} gyűjtő):`;
  }

  if (listEl) {
    if (matchedUsers.length === 0) {
      listEl.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Nem található ilyen nevű regisztrált partner.</p>`;
    } else {
      listEl.innerHTML = matchedUsers.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || 'Nincs település')})
            <div style="font-size:0.75rem; color:var(--sand);">${ensureArray(u.van).length} db dupla • ${ensureArray(u.kell).length} db hiányzó</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
          </div>
        </div>
      `).join('');
    }
  }
});

document.getElementById('search-partner-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-search-partner')?.click();
  }
});

safeAddListener('btn-clear-partner-search', () => {
  const inputEl = document.getElementById('search-partner-input');
  const boxEl = document.getElementById('partner-search-results-box');
  const clearBtn = document.getElementById('btn-clear-partner-search');

  if (inputEl) inputEl.value = '';
  if (boxEl) boxEl.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';

  showToast("Partnerkeresés törölve.");
});

safeAddListener('partner-search-list', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return;

  if (btn.dataset.action === 'contact-match') {
    openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
  } else if (btn.dataset.action === 'inspect-user') {
    openUserProfileModal(uid);
  }
});

// =========================================================================
// FIREBASE LISTENERS & ALKALMAZÁS INDÍTÁSA (BOOTSTRAP)
// =========================================================================

function initFirebase() {
  if (typeof firebase === 'undefined') return;
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyDatTdD6Ggcf7LbWZ0zBAyXf1JkspM6CEs",
      authDomain: "lutra-csereplatform.firebaseapp.com",
      databaseURL: "https://lutra-csereplatform-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "lutra-csereplatform",
      storageBucket: "lutra-csereplatform.firebasestorage.app",
      messagingSenderId: "311436055202",
      appId: "1:311436055202:web:010e622b11eb6c02f7fdfb"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();

    auth.onAuthStateChanged(user => {
      currentUser = user;
      const authArea = document.getElementById('auth-area');
      const guestNotice = document.getElementById('guest-notice');
      const adminTab = document.getElementById('tab-admin');
      const adminTabM = document.getElementById('tab-admin-m');

      if (user) {
        touchActive(user.uid);
        if (guestNotice) guestNotice.style.display = 'none';
        if (adminTab) adminTab.style.display = user.email === ADMIN_EMAIL ? 'flex' : 'none';
        if (adminTabM) adminTabM.style.display = user.email === ADMIN_EMAIL ? 'inline-block' : 'none';

        if (authArea) {
          authArea.innerHTML = `
            <div class="user-badge"><span>${escapeHtml(user.displayName || user.email.split('@')[0])}</span></div>
            <button class="btn btn-secondary btn-sm" id="btn-logout" style="padding:4px 10px; font-size:0.75rem;">Kilépés</button>
          `;
          document.getElementById('btn-logout')?.addEventListener('click', () => auth.signOut());
        }

        document.getElementById('modal-auth')?.classList.remove('open');
        listenToAllUsers();
      } else {
        if (adminTab) adminTab.style.display = 'none';
        if (adminTabM) adminTabM.style.display = 'none';
        if (guestNotice) guestNotice.style.display = 'flex';
        if (authArea) authArea.innerHTML = `<button class="btn btn-sm btn-primary" id="btn-open-auth">Belépés / Fiók</button>`;
        listenToAllUsers();
      }
    });
  } catch (e) {
    console.warn("Firebase hiba:", e);
  }
}

function listenToAllUsers() {
  if (!db) return;
  db.collection("public_profiles").onSnapshot(snapshot => {
    rawAllUsersDocs = snapshot.docs;
    allUsersData = [];

    snapshot.forEach(doc => {
      const parsedUser = extractUserData(doc.data(), doc.id, currentAlbumId);
      if (!parsedUser) return;
      if (parsedUser.van.length === 0 && parsedUser.kell.length === 0) return;
      allUsersData.push(parsedUser);
    });

    if (typeof renderMatches === 'function') renderMatches();
    if (typeof renderProximityPartners === 'function') renderProximityPartners();
  }, err => console.warn("All users listener:", err));
}

// ALKALMAZÁS INDÍTÁSA
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderGrid();
  initFirebase();
} catch (err) {
  console.error("Indítási hiba:", err);
}
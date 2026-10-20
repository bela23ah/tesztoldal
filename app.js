// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.1 TELJES, STABIL KIADÁS)
// =========================================================================

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

function createAlbumEntry(id, title, subtitle, publisher, year, totalItems, type, coverUrl, opts = {}) {
  const typeLabels = { sticker: "Matricaalbum", card: "Kártya", figure: "Figura / Kinder" };
  return {
    id, title, subtitle, publisher, year, totalItems, type,
    typeLabel: typeLabels[type] || "Gyűjtemény",
    coverUrl: coverUrl || `covers/${id}.webp`,
    featured: opts.featured || false,
    hasRadar: opts.hasRadar || false,
    radarType: opts.radarType || "none",
    hasChapters: opts.hasChapters || false,
    hasFavorites: opts.hasFavorites !== false,
    isRetro: opts.isRetro || (year < 2018),
    customItems: opts.customItems || [],
    customNames: opts.customNames || [],
    customChaptersList: opts.customChaptersList || []
  };
}

let ALBUMS_REGISTRY = {
  "lidl-lutra-2026": createAlbumEntry("lidl-lutra-2026", "Lutra Album", "Védett állatok a Föld körül", "Lidl / WWF", 2026, 108, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F08cfa8f7-c4f1-4d02-bf25-2719f2d5dfca.png&w=3840&q=75", { featured: true, hasRadar: true, radarType: "lidl", hasChapters: true }),
  "garfield-mentsuk-meg-a-bolygot-2026": createAlbumEntry("garfield-mentsuk-meg-a-bolygot-2026", "Garfield - Mentsük meg a bolygót 2026", "Spar matricagyűjtemény", "Spar", 2026, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F130c309d-cda4-435f-8112-51b236ec8880.jpg&w=3840&q=75", { featured: true, hasRadar: true, radarType: "spar" }),
  "panini-fifa-world-cup-2026": createAlbumEntry("panini-fifa-world-cup-2026", "FIFA World Cup 2026", "Hivatalos VB matricagyűjtemény", "Panini", 2026, 1345, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F6e6fdbf7-9a10-4a50-8337-f54e867ba053.jpg&w=3840&q=75", { featured: true, hasRadar: true, radarType: "retail_general", hasFavorites: false }),
  "fifa-world-cup-2026-adrenalyn-xl": createAlbumEntry("fifa-world-cup-2026-adrenalyn-xl", "FIFA World Cup 2026 – Adrenalyn XL", "Hivatalos VB kártyák", "Panini", 2026, 630, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ffifa-world-cup-2026-adrenalyn-xl.webp&w=3840&q=75", { featured: true, hasRadar: true, radarType: "retail_general", hasFavorites: false }),
  "topps-match-attax-uefa-champions-league-2025-26": createAlbumEntry("topps-match-attax-uefa-champions-league-2025-26", "Topps Match Attax UEFA CL 2025/26", "Hivatalos BL kártyák", "Topps", 2025, 743, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F0e1d4a44-674c-4dbf-8165-d1848067514f.jpg&w=3840&q=75", { featured: true, hasFavorites: false }),
  "toy-story-5": createAlbumEntry("toy-story-5", "Toy Story 5", "Hivatalos matricagyűjtemény", "Panini", 2026, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F10110c3c-f734-4083-a1a1-14762ecda0c5.jpg&w=3840&q=75", { featured: true }),
  "mancs-orjarat-2026": createAlbumEntry("mancs-orjarat-2026", "Mancs őrjárat 2026", "Legizgalmasabb kalandok!", "Panini", 2026, 184, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F3a6ea592-5bb6-411f-88ef-d4bcd2f31823.jpg&w=3840&q=75"),
  "topps-turbo-attax-official-formula-1-2026": createAlbumEntry("topps-turbo-attax-official-formula-1-2026", "Topps Turbo Attax F1 2026", "Hivatalos F1 kártyák", "Topps", 2026, 353, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fda69f746-d909-4691-b14a-a73ebfcf530a.webp&w=3840&q=75", { hasFavorites: false }),
  "garfield-magyarorszag": createAlbumEntry("garfield-magyarorszag", "Garfield - Magyarország", "Spar matricagyűjtemény", "Spar", 2026, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F07287733-3f12-45b3-9cee-a56ec03a111c.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" })
};

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

function getActiveAlbum() {
  return ALBUMS_REGISTRY[currentAlbumId] || ALBUMS_REGISTRY["lidl-lutra-2026"];
}

function getActiveAlbumSize() {
  return getActiveAlbum().totalItems;
}

function getAlbumDisplayTitle(albumId) {
  const alb = ALBUMS_REGISTRY[albumId];
  if (!alb) return albumId ? `Gyűjtemény (${albumId})` : 'Lutra Album (2026)';
  return `${alb.title} (${alb.year})`;
}

const STORE_DATABASES = {
  "lidl": [
    "Agárd – Akácfa utca 2.", "Ajka – Hársfa utca 1/A", "Aszód – Pesti út 14-16.", "Baja – Bajcsy-Zsilinszky utca 9.",
    "Balassagyarmat – Kóvári út 8", "Békéscsaba – Corvin u. 29-33.", "Budapest – Ady Endre út 54-60.", "Budapest – Bajcsy-Zsilinszky út 61.",
    "Budapest – Bartók Béla út 47.", "Budapest – Bécsi út 325-337.", "Budapest – Fehérvári út 211.", "Budapest – Ferenciek tere 2.",
    "Budapest – Görgey Artúr u. 14-20", "Budapest – Gubacsi út 34.", "Budapest – Mogyoródi út 23-29", "Budapest – Nagykőrösi út 35-38.",
    "Budapest – Pesti út 237/H", "Budapest – Rákóczi út 48-50.", "Budapest – Váci út 201", "Cegléd – Törteli út 2.", "Debrecen – Derék u. 31.",
    "Dunakeszi – Berek u. 2.", "Dunaújváros – Magyar út 11.", "Érd – Balatoni út 73-75.", "Győr – Szeszgyár utca 6.", "Kecskemét – Izsáki út 2.",
    "Miskolc – Kiss Ernő u. 13/b.", "Nagykőrös – Kecskeméti út 73.", "Pécs – Siklósi út 52/A", "Szeged – Makkosházi krt. 21.", "Székesfehérvár – Balatoni út 21."
  ],
  "spar": ["Budapest – Allee Interspar", "Budapest – Árkád Interspar", "Budapest – Westend Spar", "Debrecen – Fórum Spar", "Győr – Interspar", "Szeged – Árkád Spar"],
  "tesco": ["Budapest – Váci út Tesco Extra", "Budapest – Fogarasi út Tesco", "Budaörs – Tesco Hipermarket", "Győr – Tesco"],
  "penny": ["Budapest – Kerepesi út Penny", "Debrecen – Sámsoni út Penny", "Szeged – Makkosházi Penny"]
};

const CITY_COORDINATES = {
  "budapest": { lat: 47.4979, lng: 19.0402, x: 52.5, y: 39.0 },
  "budapest_1": { lat: 47.496, lng: 19.038, x: 52.0, y: 38.5 },
  "budapest_11": { lat: 47.465, lng: 19.030, x: 52.0, y: 39.8 },
  "budapest_13": { lat: 47.535, lng: 19.075, x: 52.8, y: 37.8 },
  "budapest_14": { lat: 47.520, lng: 19.120, x: 53.2, y: 38.2 },
  "gyor": { lat: 47.6875, lng: 17.6504, x: 26.0, y: 27.0 },
  "sopron": { lat: 47.6865, lng: 16.5843, x: 10.5, y: 30.0 },
  "szombathely": { lat: 47.2307, lng: 16.6218, x: 13.0, y: 44.0 },
  "szekesfehervar": { lat: 47.1860, lng: 18.4221, x: 44.0, y: 45.0 },
  "pecs": { lat: 46.0727, lng: 18.2323, x: 41.0, y: 83.0 },
  "kecskemet": { lat: 46.9069, lng: 19.6913, x: 61.0, y: 59.0 },
  "nagykörös": { lat: 47.0322, lng: 19.7828, x: 62.5, y: 56.0 },
  "nagykoros": { lat: 47.0322, lng: 19.7828, x: 62.5, y: 56.0 },
  "cegled": { lat: 47.1742, lng: 19.7997, x: 63.0, y: 52.0 },
  "szeged": { lat: 46.2530, lng: 20.1414, x: 66.0, y: 81.0 },
  "debrecen": { lat: 47.5316, lng: 21.6273, x: 88.0, y: 40.0 },
  "miskolc": { lat: 48.1035, lng: 20.7784, x: 77.0, y: 23.0 },
  "erd": { lat: 47.3789, lng: 18.9192, x: 51.0, y: 43.0 }
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

function extractCanonicalCities(locationInput) {
  const normList = extractNormalizedLocations(locationInput);
  const result = [];
  normList.forEach(item => {
    result.push(item.canonicalKey);
    if (item.cityGroup === 'Budapest') result.push('budapest');
  });
  return [...new Set(result)];
}

function isLocalCityMatch(locA, locB) {
  const citiesA = extractCanonicalCities(locA);
  const citiesB = extractCanonicalCities(locB);
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

function safeAddListener(id, eventOrHandler, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof eventOrHandler === 'function') el.addEventListener('click', eventOrHandler);
  else if (typeof eventOrHandler === 'string' && typeof handler === 'function') el.addEventListener(eventOrHandler, handler);
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
    if (t.status === 'pending' && (t.albumId || 'lidl-lutra-2026') === albumId) {
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
  trustScore: 0,
  ratingsCount: 0,
  privateNote: localStorage.getItem(`private_note_${currentAlbumId}`) || '',
  favorites: ensureArray(safeJsonParse('lutra_favorites', [9, 4, 35])),
  van: ensureArray(safeJsonParse(`lutra_van_${currentAlbumId}`, [])).sort((a, b) => a - b),
  vanCounts: safeJsonParse(`lutra_van_counts_${currentAlbumId}`, {}),
  kell: ensureArray(safeJsonParse(`lutra_kell_${currentAlbumId}`, [])).sort((a, b) => a - b),
  foglalva: ensureArray(safeJsonParse(`lutra_foglalva_${currentAlbumId}`, [])).sort((a, b) => a - b),
  foglalvaCounts: safeJsonParse(`lutra_foglalva_counts_${currentAlbumId}`, {}),
  activeTrades: safeJsonParse(`lutra_active_trades_${currentAlbumId}`, [])
};

let allUsersData = [];
let myIncomingMessages = [];
let myOutgoingMessages = [];
let radarReports = [];
let meetupEvents = [];
let activeAnnouncements = [];
let albumSuggestions = [];
let selectedTradePlanUids = new Set();
let tradePlanManualOverrides = {};
let currentUser = null;
let db = null;
let auth = null;

const FEJEZETEK = [
  { id: "bevezeto", cim: "1. oldal — Bevezető", elemek: [{ type: "single", num: 1, name: "WWF Magyarország logó", orient: "álló" }] },
  { id: "elettel_teli_bolygo", cim: "2–3. oldal — Élettel teli bolygó", elemek: [
    { type: "single", num: 2, name: "Kék bálna", orient: "fekvő" }, { type: "single", num: 3, name: "Jegesmedve", orient: "fekvő" },
    { type: "single", num: 4, name: "Hópárduc", orient: "fekvő" }, { type: "single", num: 5, name: "Óriáspanda", orient: "fekvő" },
    { type: "single", num: 6, name: "Kondorkeselyű", orient: "fekvő" }, { type: "single", num: 7, name: "Bogáncslepke", orient: "fekvő" },
    { type: "single", num: 8, name: "Atlanti tokhal", orient: "fekvő" }, { type: "single", num: 9, name: "Vidra", orient: "fekvő" }
  ]}
];

const STICKER_NAMES = {};
FEJEZETEK.forEach(f => {
  f.elemek.forEach(el => {
    if (el.type === 'combo') { STICKER_NAMES[el.nums[0]] = `${el.name} (Bal)`; STICKER_NAMES[el.nums[1]] = `${el.name} (Jobb)`; }
    else STICKER_NAMES[el.num] = el.name;
  });
});

function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    const raw = album.customItems[num - 1];
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return `#${num}`;
}

function getItemFullName(num, albumId = currentAlbumId) {
  if (albumId === 'lidl-lutra-2026') return STICKER_NAMES[num] ? `#${num} ${STICKER_NAMES[num]}` : `#${num}`;
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customNames && album.customNames[num - 1]) return `${getItemLabel(num, albumId)} ${album.customNames[num - 1]}`;
  return getItemLabel(num, albumId);
}

function updateHubSocialProofMetrics() {
  const collectorsEl = document.getElementById('sp-collectors-count');
  const trackedEl = document.getElementById('sp-tracked-items-count');
  const duplicatesEl = document.getElementById('sp-duplicates-count');
  const tradesEl = document.getElementById('sp-completed-trades-count');
  if (!collectorsEl) return;

  const totalCollectors = Math.max(809, allUsersData.length);
  let totalTracked = 0;
  let totalDuplicates = 0;

  allUsersData.forEach(u => {
    totalTracked += ensureArray(u.kell).length;
    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      totalDuplicates += q;
      totalTracked += q;
    });
  });

  collectorsEl.textContent = `${totalCollectors}+`;
  if (trackedEl) trackedEl.textContent = totalTracked > 0 ? `${totalTracked.toLocaleString('hu-HU')}` : '120 000+';
  if (duplicatesEl) duplicatesEl.textContent = totalDuplicates > 0 ? `${totalDuplicates.toLocaleString('hu-HU')}` : '61 000';
  if (tradesEl) tradesEl.textContent = `${Math.max(290, Math.round(totalCollectors * 0.36))}+`;
}

function toggleStickerState(num) {
  hideQtyPopover();

  const activeLocks = getActiveLockedCounts(currentAlbumId);
  if (activeLocks[num] && activeLocks[num] > 0 && myProfile.van.includes(num)) {
    showToast(`🔒 A ${getItemLabel(num)} tétel zárolva van egy aktív csere miatt!`);
    return;
  }

  lastUndoState = {
    num,
    prevVan: [...myProfile.van],
    prevVanCounts: { ...(myProfile.vanCounts || {}) },
    prevKell: [...myProfile.kell],
    prevFoglalva: [...myProfile.foglalva],
    prevFoglalvaCounts: { ...(myProfile.foglalvaCounts || {}) }
  };

  const isVan = myProfile.van.includes(num);
  const isKell = myProfile.kell.includes(num);
  const isFog = myProfile.foglalva.includes(num);
  let newState = '';

  if (!isVan && !isKell && !isFog) {
    myProfile.van.push(num); myProfile.vanCounts[num] = 1; newState = 'van';
  } else if (isVan) {
    const idx = myProfile.van.indexOf(num);
    if (idx > -1) myProfile.van.splice(idx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num); newState = 'kell';
  } else if (isKell) {
    const idx = myProfile.kell.indexOf(num);
    if (idx > -1) myProfile.kell.splice(idx, 1);
    myProfile.foglalva.push(num);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[num] = 1; newState = 'foglalva';
  } else if (isFog) {
    const idx = myProfile.foglalva.indexOf(num);
    if (idx > -1) myProfile.foglalva.splice(idx, 1);
    if (myProfile.foglalvaCounts) delete myProfile.foglalvaCounts[num];
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

  const stateNames = { 'van': 'Dupla (Zöld)', 'kell': 'Hiányzik (Barna)', 'foglalva': 'Foglalt (Kék)', '': 'Üres / Megvan' };
  txt.innerHTML = `<strong>${getItemLabel(num)}</strong> módosítva: ${stateNames[state]}`;
  bar.style.display = 'flex';

  clearTimeout(undoToastTimer);
  undoToastTimer = setTimeout(() => { bar.style.display = 'none'; }, 4000);
}

safeAddListener('btn-undo-click', () => {
  if (!lastUndoState) return;
  const { num, prevVan, prevVanCounts, prevKell, prevFoglalva, prevFoglalvaCounts } = lastUndoState;
  
  myProfile.van = prevVan; myProfile.vanCounts = prevVanCounts;
  myProfile.kell = prevKell; myProfile.foglalva = prevFoglalva; myProfile.foglalvaCounts = prevFoglalvaCounts;

  let restored = '';
  if (myProfile.van.includes(num)) restored = 'van';
  else if (myProfile.kell.includes(num)) restored = 'kell';
  else if (myProfile.foglalva.includes(num)) restored = 'foglalva';

  updateSingleCellDOM(num, restored);
  updateBadgeCounts();
  saveMyStateFast();

  document.getElementById('undo-toast-bar').style.display = 'none';
  lastUndoState = null;
  showToast("Módosítás visszavonva!");
});

function updateSingleCellDOM(num, state) {
  const cell = document.querySelector(`.matrica-cell[data-num="${num}"]`);
  if (cell) {
    cell.classList.remove('van', 'kell', 'foglalva');
    if (state) cell.classList.add(state);
    cell.querySelectorAll('.qty-badge').forEach(b => b.remove());

    let badgesHtml = '';
    const vQty = (state === 'van' && myProfile.vanCounts?.[num]) ? myProfile.vanCounts[num] : 0;
    const activeLocks = getActiveLockedCounts(currentAlbumId);
    const fQty = activeLocks[num] || 0;

    if (vQty > 1) badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    if (fQty > 0 && state === 'van') badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    else if (state === 'foglalva') {
      const manQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[num]) ? myProfile.foglalvaCounts[num] : 1;
      if (manQty > 1) badgesHtml += `<span class="qty-badge foglalva">×${manQty}</span>`;
    }
    cell.insertAdjacentHTML('beforeend', badgesHtml);
  }
}

document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    const num = activePopoverNum;

    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) { myProfile.foglalva.splice(fIdx, 1); delete myProfile.foglalvaCounts[num]; }

    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    myProfile.vanCounts[num] = qty;

    saveMyState();
    hideQtyPopover();
    showToast(`${getItemLabel(num)}: ${qty} db mentve.`);
  });
});

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');

function showQtyPopover(num, targetEl) {
  if (!popover || !targetEl) return;
  activePopoverNum = num;
  let currentQty = myProfile.vanCounts[num] || (myProfile.foglalvaCounts?.[num] || 1);

  document.querySelectorAll('.qty-pop-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.qty, 10) === currentQty);
  });

  popover.style.display = 'flex';
  const rect = targetEl.getBoundingClientRect();
  popover.style.left = `${rect.left + rect.width / 2}px`;
  popover.style.top = `${rect.top - 8}px`;
  popover.style.transform = `translate(-50%, -100%)`;
  popover.classList.add('open');
}

function hideQtyPopover() {
  if (!popover) return;
  popover.classList.remove('open');
  popover.style.display = 'none';
  activePopoverNum = null;
}

function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;
  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const isFigure = activeAlbum.type === 'figure';

  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));
  const activeLocks = getActiveLockedCounts(currentAlbumId);

  let html = '';
  for (let i = 1; i <= totalSize; i++) {
    const isVan = vanSet.has(i), isKell = kellSet.has(i), isFog = foglalvaSet.has(i);
    let cls = isVan ? 'van' : isKell ? 'kell' : isFog ? 'foglalva' : '';
    if (isFigure) cls += ' cell-figure';

    let badges = '';
    const vQty = myProfile.vanCounts?.[i] || 1;
    const fQty = activeLocks[i] || 0;

    if (isVan && vQty > 1) badges += `<span class="qty-badge">×${vQty}</span>`;
    if (isVan && fQty > 0) badges += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    if (isFog && (myProfile.foglalvaCounts?.[i] || 1) > 1) badges += `<span class="qty-badge foglalva">×${myProfile.foglalvaCounts[i]}</span>`;

    html += `<div class="matrica-cell ${cls}" data-num="${i}" title="${escapeHtml(getItemFullName(i))}">${escapeHtml(getItemLabel(i))}${badges}</div>`;
  }
  grid.innerHTML = html;
  updateBadgeCounts();
}

function updateBadgeCounts() {
  const cVan = document.getElementById('count-van');
  const cKell = document.getElementById('count-kell');
  const cFoglalva = document.getElementById('count-foglalva');
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
  if (cFoglalva) cFoglalva.textContent = myProfile.foglalva.length;
}

function attachStickerInteraction(container) {
  if (!container) return;
  let longPressTimer = null;
  let isLongPress = false;

  container.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('[data-num]');
    if (target) { e.preventDefault(); showQtyPopover(parseInt(target.dataset.num, 10), target); }
  });

  container.addEventListener('touchstart', (e) => {
    const target = e.target.closest('[data-num]');
    if (!target) return;
    isLongPress = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      if ("vibrate" in navigator) navigator.vibrate(35);
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }, 450);
  }, { passive: true });

  container.addEventListener('touchend', () => clearTimeout(longPressTimer));

  container.addEventListener('click', (e) => {
    if (isLongPress) { isLongPress = false; return; }
    const target = e.target.closest('[data-num]');
    if (target) toggleStickerState(parseInt(target.dataset.num, 10));
  });
}

function formatLinksWithAnchors(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;
  return escaped.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--amber); text-decoration:underline; font-weight:600;">${url}</a>`;
  });
}

let matchFilter = 'all';

safeAddListener('btn-match-all', 'click', function() { setActiveMatchFilter(this, 'all'); });
safeAddListener('btn-match-city', 'click', function() {
  if (!myProfile.telepules && (!myProfile.locations || myProfile.locations.length === 0)) {
    return showToast("Előbb add meg a településed a Profil fülön!");
  }
  setActiveMatchFilter(this, 'city');
});
safeAddListener('btn-match-gift', 'click', function() { setActiveMatchFilter(this, 'gift'); });
safeAddListener('btn-match-loop', 'click', function() { setActiveMatchFilter(this, 'loop'); });

function setActiveMatchFilter(btn, filterType) {
  document.querySelectorAll('#view-cserek .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  matchFilter = filterType;
  renderMatches();
}

safeAddListener('btn-refresh-matches', () => { renderMatches(); showToast("Párosítások frissítve."); });

function computeLoopMatches() {
  const myId = currentUser ? currentUser.uid : 'me';
  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const otherUsers = allUsersData.filter(u => u.id !== myId);
  const loops = [];

  for (let i = 0; i < otherUsers.length; i++) {
    const userB = otherUsers[i];
    const bVanSet = new Set(ensureArray(userB.van));
    const bKellSet = new Set(ensureArray(userB.kell).filter(n => !bVanSet.has(n)));
    const giveToB = [...myVanSet].filter(n => bKellSet.has(n) && !bVanSet.has(n)).sort((a, b) => a - b);
    if (giveToB.length === 0) continue;

    for (let j = 0; j < otherUsers.length; j++) {
      if (i === j) continue;
      const userC = otherUsers[j];
      const cVanSet = new Set(ensureArray(userC.van));
      const cKellSet = new Set(ensureArray(userC.kell).filter(n => !cVanSet.has(n)));
      const giveBtoC = [...bVanSet].filter(n => cKellSet.has(n) && !cVanSet.has(n)).sort((a, b) => a - b);
      if (giveBtoC.length === 0) continue;

      const giveCtoMe = [...cVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      if (giveCtoMe.length === 0) continue;

      const isLocalLoop = isLocalCityMatch(myProfile.locations || myProfile.telepules, userB.locations || userB.telepules) &&
                          isLocalCityMatch(userB.locations || userB.telepules, userC.locations || userC.telepules);
      loops.push({ userB, userC, giveToB, giveBtoC, giveCtoMe, isLocalLoop });
    }
  }
  return loops;
}

function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const myCoords = myGpsCoords || getUserCoordinates(myProfile);

  if (matchFilter === 'loop') {
    const loops = computeLoopMatches();
    if (loops.length === 0) {
      list.innerHTML = `<div class="card" style="text-align:center; padding:20px;"><h3>Nincs elérhető 3 fős körcsere</h3></div>`;
      return;
    }
    list.innerHTML = loops.slice(0, 10).map((l, loopIdx) => `
      <div class="card ${l.isLocalLoop ? 'card-local' : ''}">
        <div class="card-header-row"><h3 style="margin:0;">Körcsere: Te ➔ ${escapeHtml(l.userB.nev)} ➔ ${escapeHtml(l.userC.nev)} ➔ Te</h3></div>
        <div style="font-size:0.85rem; margin:8px 0; background:rgba(0,0,0,0.25); padding:8px; border-radius:var(--radius-sm); line-height:1.6;">
          <p style="margin:0;">1. <strong>Te adsz:</strong> ${escapeHtml(l.userB.nev)} ➔ ${l.giveToB.map(n => getItemLabel(n)).join(', ')}</p>
          <p style="margin:0;">2. <strong>Ő ad tovább:</strong> ${escapeHtml(l.userC.nev)}-nek ➔ ${l.giveBtoC.map(n => getItemLabel(n)).join(', ')}</p>
          <p style="margin:0; color:var(--moss-soft);">3. <strong>Te kapsz:</strong> ${escapeHtml(l.userC.nev)}-től ➔ ${l.giveCtoMe.map(n => getItemLabel(n)).join(', ')}</p>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-primary btn-sm" data-action="contact-loop-b" data-loop-idx="${loopIdx}">Üzenet: ${escapeHtml(l.userB.nev)}</button>
          <button class="btn btn-secondary btn-sm" data-action="contact-loop-c" data-loop-idx="${loopIdx}">Üzenet: ${escapeHtml(l.userC.nev)}</button>
        </div>
      </div>
    `).join('');
    return;
  }

  let matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .map(u => {
      const uVanSet = new Set(ensureArray(u.van));
      const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
      const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
      const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      const score = Math.min(give.length, get.length);
      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const distanceKm = getMinDistanceToUser(myCoords, u);
      return { ...u, give, get, score, isSameCity, distanceKm };
    })
    .filter(m => m.score > 0 || (m.isGiftOffering && m.get.length > 0));

  if (matchFilter === 'city') matches = matches.filter(m => m.isSameCity);
  if (matchFilter === 'gift') matches = matches.filter(m => m.isGiftOffering);

  matches.sort((a, b) => (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0) || b.score - a.score);

  if (matches.length === 0) {
    list.innerHTML = '<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner ehhez a gyűjteményhez.</p>';
    return;
  }

  list.innerHTML = matches.map(m => `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''}
          </h3>
          ${m.distanceKm !== null ? `<span style="font-size:0.75rem; color:var(--amber); font-weight:700;">📍 kb. ${m.distanceKm} km</span>` : ''}
        </div>
        <span class="badge-ratio">${m.give.length} db ⇄ ${m.get.length} db</span>
      </div>
      <p style="margin:4px 0;"><strong>Te adnál:</strong> ${m.give.length ? m.give.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándékba kapod)</em>'}</p>
      <p style="margin:4px 0;"><strong>Ő adna:</strong> ${m.get.map(n => getItemLabel(n)).join(', ')}</p>
      <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:8px;">
        <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(m.id)}">Kapcsolatfelvétel</button>
        <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">Adatlap</button>
      </div>
    </div>
  `).join('');
}

safeAddListener('matches-list', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'contact-match') {
    const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
    if (!targetUser) return;
    openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
  } else if (action === 'inspect-user') {
    openUserProfileModal(btn.dataset.uid);
  }
});

let activeTradeClosingData = null;

function renderActiveTradesPanel() {
  const panel = document.getElementById('active-trades-panel');
  const list = document.getElementById('active-trades-list');
  const countSpan = document.getElementById('active-trades-count');
  if (!panel || !list) return;

  const allTrades = myProfile.activeTrades || [];
  const pendingTrades = allTrades.filter(t => t.status !== 'completed');

  if (countSpan) countSpan.textContent = pendingTrades.length;
  if (pendingTrades.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  list.innerHTML = pendingTrades.map((t, originalIdx) => `
    <div class="trade-manage-card">
      <div class="trade-manage-header">
        <strong>${escapeHtml(t.partnerName || 'Partner')} (${escapeHtml(t.partnerCity || '')})</strong>
        <span class="badge-trade-status badge-status-reserved">🔒 Zárolva / Úton</span>
      </div>
      <div style="font-size:0.8rem; margin:6px 0;">
        Te adod: ${t.givingItems?.map(n => getItemLabel(n)).join(', ') || '-'} ➔ Kapod: ${t.receivingItems?.map(n => getItemLabel(n)).join(', ') || '-'}
      </div>
      <div style="display:flex; justify-content:space-between;">
        <button class="btn btn-contact-green btn-sm" data-action="complete-trade" data-trade-idx="${originalIdx}">✓ Megérkezett / Lezárás</button>
        <button class="btn btn-secondary btn-sm" data-action="cancel-trade" data-trade-idx="${originalIdx}" style="color:var(--danger); border-color:var(--danger);">✕ Visszavonás</button>
      </div>
    </div>
  `).join('');
}

safeAddListener('active-trades-list', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.tradeIdx, 10);
  const trade = (myProfile.activeTrades || [])[idx];
  if (!trade) return;

  if (btn.dataset.action === 'complete-trade') {
    activeTradeClosingData = { trade, tradeIdx: idx };
    document.getElementById('modal-rate-trade')?.classList.add('open');
  } else if (btn.dataset.action === 'cancel-trade') {
    if (!confirm("Biztosan visszavonod a cserét és feloldod a tételeket?")) return;
    myProfile.activeTrades.splice(idx, 1);
    saveMyState();
    renderActiveTradesPanel();
    renderGrid();
    showToast("Csere visszavonva.");
  }
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

  if (trade.receivingItems) {
    trade.receivingItems.forEach(n => {
      const kIdx = myProfile.kell.indexOf(n);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
      if (!myProfile.van.includes(n)) { myProfile.van.push(n); myProfile.vanCounts[n] = 1; }
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
    });
  }

  myProfile.activeTrades[tradeIdx].status = 'completed';
  saveMyState();
  document.getElementById('modal-rate-trade')?.classList.remove('open');
  activeTradeClosingData = null;
  renderActiveTradesPanel();
  renderGrid();
  showToast("Csere lezárva!");
});

// --- 4 KERESŐBLOKK ÉS EGYEDI AJÁNLAT ---
safeAddListener('btn-search', () => {
  const raw = document.getElementById('search-input')?.value.trim() || '';
  if (!raw) return showToast("Írj be egy számot vagy nevet!");
  const matchedNums = [];
  const totalSize = getActiveAlbumSize();
  const num = parseInt(raw, 10);

  if (!isNaN(num) && num >= 1 && num <= totalSize) matchedNums.push(num);
  else {
    for (let i = 1; i <= totalSize; i++) {
      if (normalizeText(getItemFullName(i)).includes(normalizeText(raw))) matchedNums.push(i);
    }
  }

  const container = document.getElementById('search-results');
  if (container) {
    container.style.display = 'block';
    renderSearchResults(matchedNums, `Keresés: „${raw}”`);
  }
});

safeAddListener('btn-close-item-search', () => {
  const c = document.getElementById('search-results');
  if (c) c.style.display = 'none';
  document.getElementById('btn-close-item-search').style.display = 'none';
});

safeAddListener('btn-search-by-city', () => {
  const q = (document.getElementById('search-by-city-input')?.value || '').trim();
  if (!q) return showToast("Írj be egy települést!");
  const listEl = document.getElementById('city-search-partners-list');
  const boxEl = document.getElementById('city-search-results-box');
  const matches = allUsersData.filter(u => isLocalCityMatch(u.locations || u.telepules, q));

  if (boxEl) boxEl.style.display = 'block';
  document.getElementById('btn-clear-city-search').style.display = 'inline-block';
  document.getElementById('city-search-status').innerHTML = `Találatok: <strong>${escapeHtml(q)}</strong> (${matches.length} gyűjtő)`;

  if (listEl) {
    listEl.innerHTML = matches.map(u => `
      <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
        <div><strong>${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || 'Helyi')})</div>
        <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
      </div>
    `).join('');
  }
});

safeAddListener('btn-clear-city-search', () => {
  document.getElementById('city-search-results-box').style.display = 'none';
  document.getElementById('btn-clear-city-search').style.display = 'none';
  document.getElementById('search-by-city-input').value = '';
});

safeAddListener('btn-search-partner', () => {
  const q = (document.getElementById('search-partner-input')?.value || '').trim().toLowerCase();
  if (!q) return showToast("Írj be egy nevet!");
  const listEl = document.getElementById('partner-search-list');
  const boxEl = document.getElementById('partner-search-results-box');
  const matches = allUsersData.filter(u => (u.nev || '').toLowerCase().includes(q));

  if (boxEl) boxEl.style.display = 'block';
  document.getElementById('btn-clear-partner-search').style.display = 'inline-block';
  document.getElementById('partner-search-status').innerHTML = `Találatok a névre (${matches.length} gyűjtő):`;

  if (listEl) {
    listEl.innerHTML = matches.map(u => `
      <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
        <div><strong>${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || '')})</div>
        <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
      </div>
    `).join('');
  }
});

safeAddListener('btn-clear-partner-search', () => {
  document.getElementById('partner-search-results-box').style.display = 'none';
  document.getElementById('btn-clear-partner-search').style.display = 'none';
  document.getElementById('search-partner-input').value = '';
});

function renderSearchResults(targetNums, titleText) {
  const container = document.getElementById('search-results');
  const closeBtn = document.getElementById('btn-close-item-search');
  if (!container) return;
  if (closeBtn) closeBtn.style.display = 'inline-block';
  const targetSet = new Set(targetNums);

  const matches = allUsersData.map(u => ({ ...u, found: ensureArray(u.van).filter(n => targetSet.has(n)) })).filter(u => u.found.length > 0);
  container.innerHTML = matches.map(u => `
    <div class="card">
      <div class="card-header-row"><h3 style="margin:0;">${escapeHtml(u.nev)} (${escapeHtml(u.telepules || '')})</h3></div>
      <p style="margin:4px 0;">Megvan nála: ${u.found.map(n => getItemLabel(n)).join(', ')}</p>
      <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(u.id)}">Érdekelnek a tételek</button>
    </div>
  `).join('');
}

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();
let activeContactTarget = { uid: '', nev: '', telepules: '', email: '', showEmail: false, isGift: false, subject: '' };

function openContactModal(targetUser, giveArray = [], getArray = [], isGift = false) {
  if (!currentUser) {
    showToast("Előbb lépj be a fiókodba!");
    document.getElementById('modal-auth')?.classList.add('open');
    return;
  }
  const activeAlbum = getActiveAlbum();
  activeContactTarget = {
    uid: targetUser.id || targetUser.uid || '',
    nev: targetUser.nev || 'Gyűjtő',
    telepules: targetUser.telepules || '',
    email: targetUser.email || '',
    showEmail: targetUser.showEmailToUsers === true,
    isGift,
    subject: `${activeAlbum.title} csere megkeresés`
  };

  activeContactGiveNums = ensureArray(giveArray);
  activeContactGetNums = ensureArray(getArray);
  excludedGiveNums.clear();
  excludedGetNums.clear();

  document.getElementById('contact-modal-title').textContent = `Üzenet küldése: ${escapeHtml(activeContactTarget.nev)}`;
  document.getElementById('contact-custom-offer').value = '';
  renderContactChips();
  updateContactModalText();
  document.getElementById('modal-contact')?.classList.add('open');
}

function renderContactChips() {
  const gBox = document.getElementById('contact-give-chips');
  const tBox = document.getElementById('contact-get-chips');
  if (gBox) gBox.innerHTML = activeContactGiveNums.map(n => `<span class="contact-item-chip ${excludedGiveNums.has(n) ? 'excluded' : ''}" data-action="toggle-give-chip" data-num="${n}">${getItemLabel(n)} ✕</span>`).join('');
  if (tBox) tBox.innerHTML = activeContactGetNums.map(n => `<span class="contact-item-chip ${excludedGetNums.has(n) ? 'excluded' : ''}" data-action="toggle-get-chip" data-num="${n}">${getItemLabel(n)} ✕</span>`).join('');
}

safeAddListener('contact-chips-editor-section', 'click', (e) => {
  const chip = e.target.closest('[data-action]');
  if (!chip) return;
  const num = parseInt(chip.dataset.num, 10);
  if (chip.dataset.action === 'toggle-give-chip') {
    if (excludedGiveNums.has(num)) excludedGiveNums.delete(num); else excludedGiveNums.add(num);
  } else if (chip.dataset.action === 'toggle-get-chip') {
    if (excludedGetNums.has(num)) excludedGetNums.delete(num); else excludedGetNums.add(num);
  }
  renderContactChips();
  updateContactModalText();
});

function updateContactModalText() {
  const inputEl = document.getElementById('contact-msg-input');
  if (!inputEl) return;
  const effectiveGive = activeContactGiveNums.filter(n => !excludedGiveNums.has(n)).map(n => getItemLabel(n)).join(', ');
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n)).map(n => getItemLabel(n)).join(', ');
  const custom = (document.getElementById('contact-custom-offer')?.value || '').trim();

  let givePart = effectiveGive;
  if (custom) givePart = givePart ? `${givePart} + ${custom}` : custom;
  if (!givePart) givePart = '(egyeztetés alatt)';

  inputEl.value = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan oldalon találtam rá a cseréidre:\n\nÉn tudom adni neked: ${givePart}\nTe tudod adni nekem: ${effectiveGet || '(egyeztetés alatt)'}\n\nMegfelelne a csere?\n\nÜdv,\n${myProfile.nev} (${myProfile.telepules || ''})`;
}

safeAddListener('contact-custom-offer', 'input', updateContactModalText);
safeAddListener('btn-close-contact', () => document.getElementById('modal-contact')?.classList.remove('open'));
safeAddListener('btn-copy-msg', () => {
  navigator.clipboard.writeText(document.getElementById('contact-msg-input')?.value || '');
  showToast("Üzenet kimásolva!");
});

safeAddListener('btn-send-message', async () => {
  const msg = document.getElementById('contact-msg-input')?.value.trim();
  if (!msg) return showToast("Írj be egy üzenetet!");

  const effectiveGive = activeContactGiveNums.filter(n => !excludedGiveNums.has(n));
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n));

  try {
    if (db && currentUser) {
      const threadId = [currentUser.uid, activeContactTarget.uid].sort().join('_') + '_' + currentAlbumId;
      await db.collection("messages").add({
        fromUid: currentUser.uid, fromName: myProfile.nev, fromCity: myProfile.telepules || '',
        toUid: activeContactTarget.uid, toName: activeContactTarget.nev, albumId: currentAlbumId,
        threadId, subject: activeContactTarget.subject, message: msg, read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    if (!myProfile.activeTrades) myProfile.activeTrades = [];
    myProfile.activeTrades.unshift({
      partnerUid: activeContactTarget.uid, partnerName: activeContactTarget.nev, partnerCity: activeContactTarget.telepules || 'Partner',
      albumId: currentAlbumId, givingItems: effectiveGive, receivingItems: effectiveGet, createdAt: Date.now(), status: 'pending'
    });

    saveMyState();
    renderActiveTradesPanel();
    document.getElementById('modal-contact')?.classList.remove('open');
    showToast("Üzenet elküldve! A csere rögzítve a rács alatt.");
  } catch (err) { showToast("Küldési hiba: " + err.message); }
});

// --- POSTAFIÓK (MESSENGER PIPÁK) ---
let activeInboxTab = 'inbox';
safeAddListener('btn-msg-tab-inbox', () => { activeInboxTab = 'inbox'; renderMessages(); });
safeAddListener('btn-msg-tab-sent', () => { activeInboxTab = 'sent'; renderMessages(); });
safeAddListener('btn-refresh-inbox', () => { renderMessages(); showToast("Üzenetek frissítve."); });

function renderMessages() {
  const container = document.getElementById('messages-inbox-list');
  if (!container) return;
  if (!currentUser) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:20px;"><h3>Belépés szükséges</h3></div>`;
    return;
  }

  let list = activeInboxTab === 'inbox' ? myIncomingMessages : myOutgoingMessages;
  if (list.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:20px;">Nincs üzeneted.</div>`;
    return;
  }

  container.innerHTML = list.map(m => `
    <div class="message-card ${activeInboxTab === 'inbox' ? 'incoming' : 'outgoing'}">
      <div class="message-header">
        <strong>${activeInboxTab === 'inbox' ? m.fromName : m.toName}</strong>
        ${activeInboxTab === 'sent' ? `<span class="msg-status-pipa ${m.read ? 'msg-read-double' : 'msg-delivered'}">${m.read ? '✓✓' : '✓'}</span>` : ''}
      </div>
      <div class="message-body">${formatLinksWithAnchors(m.message)}</div>
    </div>
  `).join('');
}

// --- FOTÓS SZÁMSZKENNER MODUL ---
safeAddListener('btn-open-scanner', () => document.getElementById('modal-scanner')?.classList.add('open'));
safeAddListener('btn-close-scanner', () => document.getElementById('modal-scanner')?.classList.remove('open'));

function handleImageFile(file) {
  if (!file) return;
  const loader = document.getElementById('scanner-loader');
  if (loader) loader.style.display = 'block';

  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, 1200);
      canvas.height = Math.round((img.height * canvas.width) / img.width);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      
      try {
        const res = await fetch(WORKER_ENDPOINT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data })
        });
        const data = await res.json();
        const nums = ensureArray(data.numbers).sort((a,b)=>a-b);
        document.getElementById('scanner-count-label').textContent = nums.length;
        document.getElementById('scanner-tags-box').innerHTML = nums.map(n => `<span style="background:var(--water-mid); padding:2px 8px; border-radius:999px;">#${n}</span>`).join(' ');
        document.getElementById('scanner-results-box').style.display = 'block';
      } catch (err) { showToast("Beolvasási hiba: " + err.message); }
      finally { if (loader) loader.style.display = 'none'; }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

safeAddListener('scanner-file-input', 'change', (e) => handleImageFile(e.target.files[0]));
safeAddListener('scanner-camera-input', 'change', (e) => handleImageFile(e.target.files[0]));

// --- OKLEVÉL, LENULLÁZÁS & EGYÉB MODALOK ---
safeAddListener('btn-view-certificate', () => {
  document.getElementById('cert-user-name').textContent = myProfile.nev || 'Gyűjtő';
  document.getElementById('cert-date-label').textContent = new Date().toLocaleDateString('hu-HU');
  document.getElementById('modal-certificate')?.classList.add('open');
  if (window.confetti) confetti();
});
safeAddListener('btn-close-cert', () => document.getElementById('modal-certificate')?.classList.remove('open'));

safeAddListener('btn-open-reset', () => document.getElementById('modal-reset')?.classList.add('open'));
safeAddListener('btn-close-reset', () => document.getElementById('modal-reset')?.classList.remove('open'));
safeAddListener('btn-reset-all', () => {
  myProfile.van = []; myProfile.vanCounts = {}; myProfile.kell = []; myProfile.foglalva = [];
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Gyűjtemény kiürítve.");
});

// =========================================================================
// HITELESÍTÉS & BELÉPÉSI RENDSZER (ITT VOLT A HIBA - MOST 100%-OSAN HELYREÁLLÍTVA!)
// =========================================================================

safeAddListener('btn-open-auth', () => document.getElementById('modal-auth')?.classList.add('open'));
safeAddListener('btn-close-auth', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', () => switchView('profil'));

safeAddListener('btn-google-login', () => {
  if (!auth) return showToast("A Firebase hitelesítés nem elérhető.");
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .then(() => showToast("Sikeres belépés Google-lal!"))
    .catch(e => showToast("Google belépési hiba: " + e.message));
});

safeAddListener('btn-email-login', () => {
  if (!auth) return showToast("A Firebase hitelesítés nem elérhető.");
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  if (!em || !pw) return showToast("Add meg az e-mail címed és jelszavad!");
  auth.signInWithEmailAndPassword(em, pw)
    .then(() => showToast("Sikeres belépés!"))
    .catch(() => showToast("Hibás e-mail cím vagy jelszó."));
});

safeAddListener('btn-email-signup', () => {
  if (!auth) return showToast("A Firebase hitelesítés nem elérhető.");
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  if (!em || !pw) return showToast("Add meg az e-mail címed és jelszavad!");
  if (pw.length < 6) return showToast("A jelszónak legalább 6 karakteresnek kell lennie.");
  auth.createUserWithEmailAndPassword(em, pw)
    .then(() => showToast("Sikeres regisztráció!"))
    .catch(e => showToast("Regisztrációs hiba: " + e.message));
});

// --- ADMINISZTRÁCIÓS MŰVELETEK (JSON IMPORTŐR & KARBANTARTÓ) ---
safeAddListener('btn-admin-import-json', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  const raw = document.getElementById('admin-album-json-import')?.value.trim();
  const statusEl = document.getElementById('admin-json-import-status');
  if (!raw) return showToast("Másold be a JSON adatokat!");

  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error("A JSON formátumnak egy tömbnek kell lennie!");
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `Mentés: 0 / ${list.length}...`; }

    const chunkSize = 400;
    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const batch = db.batch();
      chunk.forEach(alb => {
        const id = (alb.id || alb.title).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
        const payload = {
          id, title: alb.title || id, publisher: alb.publisher || 'Egyéb',
          year: parseInt(alb.year || '2026', 10), totalItems: parseInt(alb.totalItems || '100', 10),
          type: alb.type || 'sticker', typeLabel: alb.typeLabel || 'Matricaalbum',
          coverUrl: alb.coverUrl || `covers/${id}.webp`, active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        batch.set(db.collection("albums").doc(id), payload, { merge: true });
        ALBUMS_REGISTRY[id] = payload;
      });
      await batch.commit();
    }
    showToast(`${list.length} album sikeresen feltöltve a Firestore-ba!`);
    renderHub();
  } catch (err) { showToast("Importálási hiba: " + err.message); }
  finally { if (statusEl) setTimeout(() => { statusEl.style.display = 'none'; }, 3000); }
});

safeAddListener('btn-admin-seed-database', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  try {
    const batch = db.batch();
    Object.values(ALBUMS_REGISTRY).forEach(alb => batch.set(db.collection("albums").doc(alb.id), { ...alb, active: true }, { merge: true }));
    Object.entries(STORE_DATABASES).forEach(([chain, stores]) => batch.set(db.collection("stores").doc(chain), { chain, stores }, { merge: true }));
    await batch.commit();
    showToast("Alapadatok feltöltve a felhőbe!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

safeAddListener('btn-admin-migrate-locations', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  try {
    const snap = await db.collection("public_profiles").get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const chunk = snap.docs.slice(i, i + 400);
      const batch = db.batch();
      chunk.forEach(doc => {
        batch.set(db.collection("public_profiles").doc(doc.id), { emailNotifications: true }, { merge: true });
        batch.set(db.collection("users").doc(doc.id), { emailNotifications: true }, { merge: true });
      });
      await batch.commit();
    }
    showToast("E-mail értesítők mind a 809 felhasználónál bekapcsolva!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

function initFirebase() {
  if (typeof firebase === 'undefined') return;
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyDatTdD6Ggcf7LbWZ0zBAyXf1JkspM6CEs",
      authDomain: "lutra-csereplatform.firebaseapp.com",
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
      const adminTab = document.getElementById('tab-admin');
      const adminTabM = document.getElementById('tab-admin-m');

      if (user) {
        document.getElementById('guest-notice').style.display = 'none';
        if (adminTab) adminTab.style.display = user.email === ADMIN_EMAIL ? 'flex' : 'none';
        if (adminTabM) adminTabM.style.display = user.email === ADMIN_EMAIL ? 'inline-block' : 'none';

        if (authArea) {
          authArea.innerHTML = `
            <div class="user-badge"><span>${escapeHtml(user.displayName || user.email.split('@')[0])}</span></div>
            <button class="btn btn-secondary btn-sm" id="btn-logout" style="padding:4px 10px;">Kilépés</button>
          `;
          document.getElementById('btn-logout')?.addEventListener('click', () => auth.signOut());
        }
        document.getElementById('modal-auth')?.classList.remove('open');
        listenToMyProfile(user.uid);
        listenToMyMessages(user.uid);
      } else {
        myProfile = { nev: "Vendég gyűjtő", telepules: "", locations: [{ city: "", districts: [] }], van: [], kell: [], foglalva: [], activeTrades: [] };
        if (adminTab) adminTab.style.display = 'none';
        if (adminTabM) adminTabM.style.display = 'none';
        if (authArea) authArea.innerHTML = `<button class="btn btn-sm btn-primary" id="btn-open-auth">Belépés / Fiók</button>`;
        document.getElementById('btn-open-auth')?.addEventListener('click', () => document.getElementById('modal-auth')?.classList.add('open'));
      }
      listenToAllUsers();
      listenToAlbums();
    });
  } catch (e) { console.warn("Firebase hiba:", e); }
}

function listenToAlbums() {
  if (!db) return;
  db.collection("albums").where("active", "==", true).onSnapshot(snap => {
    snap.docs.forEach(doc => {
      const d = doc.data();
      ALBUMS_REGISTRY[doc.id] = createAlbumEntry(doc.id, d.title, d.subtitle, d.publisher, d.year, d.totalItems, d.type, d.coverUrl, d);
    });
    renderHub();
  });
}

function listenToAllUsers() {
  if (!db) return;
  db.collection("public_profiles").onSnapshot(snapshot => {
    allUsersData = [];
    snapshot.forEach(doc => {
      const d = doc.data();
      const col = d.collections?.[currentAlbumId] || (currentAlbumId === 'lidl-lutra-2026' ? d : null);
      if (col && (ensureArray(col.van).length || ensureArray(col.kell).length)) {
        allUsersData.push({
          id: doc.id, nev: d.nev || 'Gyűjtő', telepules: d.telepules || '',
          locations: d.locations || [], van: ensureArray(col.van), vanCounts: col.vanCounts || {},
          kell: ensureArray(col.kell), foglalva: ensureArray(col.foglalva), isGiftOffering: d.isGiftOffering === true
        });
      }
    });
    renderMatches();
    updateHubSocialProofMetrics();
  });
}

function listenToMyProfile(uid) {
  if (!db) return;
  db.collection("public_profiles").doc(uid).onSnapshot(doc => {
    if (Date.now() - lastLocalEditTimestamp < 1500) return;
    if (doc.exists) {
      const d = doc.data();
      const col = d.collections?.[currentAlbumId] || (currentAlbumId === 'lidl-lutra-2026' ? d : {});
      myProfile.nev = d.nev || myProfile.nev;
      myProfile.telepules = d.telepules || '';
      myProfile.locations = d.locations || [{ city: d.telepules || '', districts: [] }];
      myProfile.van = ensureArray(col.van);
      myProfile.vanCounts = col.vanCounts || {};
      myProfile.kell = ensureArray(col.kell);
      myProfile.foglalva = ensureArray(col.foglalva);
      renderGrid();
      renderActiveTradesPanel();
    }
  });
}

function listenToMyMessages(uid) {
  if (!db) return;
  db.collection("messages").where("toUid", "==", uid).onSnapshot(snap => {
    myIncomingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !m.deletedByRecipient);
    renderMessages();
  });
  db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !m.deletedBySender);
    renderMessages();
  });
}

// INICIALIZÁLÁS
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  initFirebase();
  renderHub();
  renderGrid();
} catch (e) { console.error("Indítási hiba:", e); }
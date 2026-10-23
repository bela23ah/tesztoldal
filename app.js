// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 1 / 4. RÉSZ: ADATMODELL, ROBUST EXTRACTOR, SOCIAL PROOF & GYŰJTEMÉNYVÁLTÓ
// =========================================================================

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// --- ALBUMOK & BOLTOK REGISZTER (FIRESTORE ÉS GYORSÍTÓTÁR ALAPÚ) ---
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

// =========================================================================
// KOORDINÁTA TÁR (MINDEN VÁROS HELYREÁLLÍTVA A HŐTÉRKÉPHEZ)
// =========================================================================
const CITY_COORDINATES = {
  "budapest": { lat: 47.4979, lng: 19.0402, x: 52.5, y: 39.0 },
  "budapest_1": { lat: 47.496, lng: 19.038, x: 52.0, y: 38.5 },
  "budapest_2": { lat: 47.530, lng: 18.990, x: 51.5, y: 37.5 },
  "budapest_3": { lat: 47.560, lng: 19.040, x: 52.0, y: 36.5 },
  "budapest_4": { lat: 47.565, lng: 19.090, x: 53.0, y: 36.5 },
  "budapest_5": { lat: 47.499, lng: 19.052, x: 52.5, y: 39.0 },
  "budapest_6": { lat: 47.506, lng: 19.062, x: 52.7, y: 38.8 },
  "budapest_7": { lat: 47.502, lng: 19.080, x: 52.9, y: 38.9 },
  "budapest_8": { lat: 47.490, lng: 19.085, x: 52.8, y: 39.2 },
  "budapest_9": { lat: 47.470, lng: 19.080, x: 52.7, y: 39.5 },
  "budapest_10": { lat: 47.485, lng: 19.145, x: 53.5, y: 39.2 },
  "budapest_11": { lat: 47.465, lng: 19.030, x: 52.0, y: 39.8 },
  "budapest_12": { lat: 47.495, lng: 18.995, x: 51.5, y: 39.0 },
  "budapest_13": { lat: 47.535, lng: 19.075, x: 52.8, y: 37.8 },
  "budapest_14": { lat: 47.520, lng: 19.120, x: 53.2, y: 38.2 },
  "budapest_15": { lat: 47.555, lng: 19.135, x: 53.4, y: 37.0 },
  "budapest_16": { lat: 47.525, lng: 19.200, x: 54.0, y: 38.0 },
  "budapest_17": { lat: 47.480, lng: 19.260, x: 54.5, y: 39.2 },
  "budapest_18": { lat: 47.435, lng: 19.185, x: 53.8, y: 40.5 },
  "budapest_19": { lat: 47.450, lng: 19.145, x: 53.4, y: 40.0 },
  "budapest_20": { lat: 47.435, lng: 19.110, x: 53.0, y: 40.5 },
  "budapest_21": { lat: 47.415, lng: 19.070, x: 52.5, y: 41.0 },
  "budapest_22": { lat: 47.420, lng: 19.020, x: 51.8, y: 40.8 },
  "budapest_23": { lat: 47.395, lng: 19.130, x: 53.2, y: 41.5 },
  "gyor": { lat: 47.6875, lng: 17.6504, x: 26.0, y: 27.0 },
  "sopron": { lat: 47.6865, lng: 16.5843, x: 10.5, y: 30.0 },
  "szombathely": { lat: 47.2307, lng: 16.6218, x: 13.0, y: 44.0 },
  "zalaegerszeg": { lat: 46.8417, lng: 16.8416, x: 20.0, y: 56.0 },
  "veszprem": { lat: 47.0933, lng: 17.9115, x: 35.0, y: 46.0 },
  "szekesfehervar": { lat: 47.1860, lng: 18.4221, x: 44.0, y: 45.0 },
  "pecs": { lat: 46.0727, lng: 18.2323, x: 41.0, y: 83.0 },
  "kaposvar": { lat: 46.3594, lng: 17.7968, x: 32.0, y: 73.0 },
  "szekszard": { lat: 46.3501, lng: 18.7091, x: 50.0, y: 73.0 },
  "kecskemet": { lat: 46.9069, lng: 19.6913, x: 61.0, y: 59.0 },
  "nagykörös": { lat: 47.0322, lng: 19.7828, x: 62.5, y: 56.0 },
  "nagykoros": { lat: 47.0322, lng: 19.7828, x: 62.5, y: 56.0 },
  "cegled": { lat: 47.1742, lng: 19.7997, x: 63.0, y: 52.0 },
  "kiskunfelegyhaza": { lat: 46.7119, lng: 19.8456, x: 62.0, y: 65.0 },
  "lajosmizse": { lat: 47.0256, lng: 19.5583, x: 59.0, y: 56.0 },
  "dabas": { lat: 47.1878, lng: 19.3139, x: 56.0, y: 51.0 },
  "albertirsa": { lat: 47.2417, lng: 19.6167, x: 60.0, y: 49.0 },
  "tiszakecske": { lat: 46.9317, lng: 20.0911, x: 66.0, y: 59.0 },
  "kiskunmajsa": { lat: 46.4917, lng: 19.7389, x: 61.0, y: 72.0 },
  "kiskoros": { lat: 46.6214, lng: 19.2853, x: 55.0, y: 68.0 },
  "solt": { lat: 46.8000, lng: 19.0000, x: 53.0, y: 62.0 },
  "soltvadkert": { lat: 46.5778, lng: 19.3944, x: 56.5, y: 70.0 },
  "dunavecse": { lat: 46.9167, lng: 18.9833, x: 53.0, y: 58.0 },
  "szeged": { lat: 46.2530, lng: 20.1414, x: 66.0, y: 81.0 },
  "bekescsaba": { lat: 46.6796, lng: 21.0911, x: 84.0, y: 69.0 },
  "szolnok": { lat: 47.1756, lng: 20.1764, x: 69.0, y: 51.0 },
  "debrecen": { lat: 47.5316, lng: 21.6273, x: 88.0, y: 40.0 },
  "nyiregyhaza": { lat: 47.9554, lng: 21.7167, x: 90.0, y: 26.0 },
  "miskolc": { lat: 48.1035, lng: 20.7784, x: 77.0, y: 23.0 },
  "eger": { lat: 47.9025, lng: 20.3772, x: 71.0, y: 31.0 },
  "salgotarjan": { lat: 48.0934, lng: 19.8030, x: 62.0, y: 21.0 },
  "tatabanya": { lat: 47.5849, lng: 18.3932, x: 42.0, y: 32.0 },
  "erd": { lat: 47.3789, lng: 18.9192, x: 51.0, y: 43.0 },
  "budaors": { lat: 47.4625, lng: 18.9536, x: 51.2, y: 40.5 },
  "szentendre": { lat: 47.6667, lng: 19.0833, x: 53.0, y: 34.0 },
  "dunakeszi": { lat: 47.6333, lng: 19.1333, x: 53.5, y: 35.0 },
  "godollo": { lat: 47.6000, lng: 19.3667, x: 57.0, y: 36.0 },
  "szigetszentmiklos": { lat: 47.3439, lng: 19.0436, x: 52.4, y: 44.0 },
  "dunaujvaros": { lat: 46.9619, lng: 18.9355, x: 53.0, y: 53.0 },
  "baja": { lat: 46.1819, lng: 18.9568, x: 54.0, y: 80.0 },
  "hodmezovasarhely": { lat: 46.4303, lng: 20.3189, x: 71.0, y: 75.0 },
  "oroshaza": { lat: 46.5667, lng: 20.6667, x: 78.0, y: 73.0 },
  "gyula": { lat: 46.6500, lng: 21.2833, x: 89.0, y: 68.0 },
  "siofok": { lat: 46.9041, lng: 18.0580, x: 42.0, y: 50.0 },
  "keszthely": { lat: 46.7691, lng: 17.2481, x: 27.0, y: 58.0 },
  "nagykanizsa": { lat: 46.4535, lng: 16.9910, x: 21.0, y: 70.0 }
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
  const cleanA = Array.isArray(locA) ? locA.filter(l => (typeof l === 'string' ? l.trim().length > 0 : l?.city?.trim().length > 0)) : locA;
  const cleanB = Array.isArray(locB) ? locB.filter(l => (typeof l === 'string' ? l.trim().length > 0 : l?.city?.trim().length > 0)) : locB;

  const citiesA = extractCanonicalCities(cleanA);
  const citiesB = extractCanonicalCities(cleanB);
  if (citiesA.length === 0 || citiesB.length === 0) return false;
  return citiesA.some(cA => citiesB.includes(cA));
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  let millis = 0;
  if (typeof timestamp === 'number') millis = timestamp;
  else if (timestamp.toDate) millis = timestamp.toDate().getTime();
  else if (timestamp.seconds) millis = timestamp.seconds * 1000;
  if (!millis) return '';

  const diffSec = Math.floor((Date.now() - millis) / 1000);
  if (diffSec < 3600 * 24) return 'ma';
  if (diffSec < 3600 * 48) return 'tegnap';
  const days = Math.floor(diffSec / (3600 * 24));
  if (days < 30) return `${days} napja`;
  return 'régebben';
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

function getFirstValidString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return '';
}

function getActiveLockedCounts(albumId = currentAlbumId) {
  const counts = {};
  (myProfile.activeTrades || []).forEach(t => {
    if ((t.status === 'pending_acceptance' || t.status === 'accepted' || t.status === 'shipped') && (t.albumId || 'lidl-lutra-2026') === albumId) {
      (t.givingItems || []).forEach(num => { counts[num] = (counts[num] || 0) + 1; });
    }
  });
  return counts;
}

// =========================================================================
// ADATKINYERŐ: MIND A 4 FIRESTORE FORMÁTUMOT KEZELI + UTOLSÓ BELÉPÉS
// =========================================================================
function extractUserData(data, docId, targetAlbumId = currentAlbumId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);
  const locations = Array.isArray(data.locations) ? data.locations : (telepules ? [{ city: telepules, districts: [] }] : []);
  const geo = (data.geo && typeof data.geo.lat === 'number') ? data.geo : null;

  let rawVan = [];
  let rawKell = [];
  let rawFoglalva = [];
  let vanCounts = {};
  let foglalvaCounts = {};

  if (data.collections && data.collections[targetAlbumId]) {
    const col = data.collections[targetAlbumId];
    rawVan = col.van || [];
    rawKell = col.kell || [];
    rawFoglalva = col.foglalva || [];
    vanCounts = col.vanCounts || {};
    foglalvaCounts = col.foglalvaCounts || {};
  } else if (data[`collections.${targetAlbumId}`]) {
    const col = data[`collections.${targetAlbumId}`];
    rawVan = col.van || [];
    rawKell = col.kell || [];
    rawFoglalva = col.foglalva || [];
    vanCounts = col.vanCounts || {};
    foglalvaCounts = col.foglalvaCounts || {};
  }

  if (rawVan.length === 0 && rawKell.length === 0) {
    if (targetAlbumId === 'lidl-lutra-2026' || !data.collections) {
      rawVan = data.van || data.duplicates || data.duplak || [];
      rawKell = data.kell || data.missing || data.hianyzo || [];
      rawFoglalva = data.foglalva || data.reserved || [];
      vanCounts = data.vanCounts || {};
      foglalvaCounts = data.foglalvaCounts || {};
    }
  }

  if (rawVan.length === 0 && vanCounts && Object.keys(vanCounts).length > 0) {
    rawVan = Object.keys(vanCounts);
  }

  const van = ensureArray(rawVan).sort((a, b) => a - b);
  const kell = ensureArray(rawKell).sort((a, b) => a - b);
  const foglalva = ensureArray(rawFoglalva).sort((a, b) => a - b);

  const favorites = ensureArray(data.favorites || []);
  const isGiftOffering = data.isGiftOffering === true || data.isGift === true;
  const showEmailToUsers = data.showEmailToUsers === true;
  const emailNotifications = data.emailNotifications !== false;
  const allowInspect = data.allowInspect !== false;
  const gdprAccepted = data.gdprAccepted !== false;
  const isVacation = data.isVacation === true;
  const trustScore = parseFloat(data.trustScore || '0');
  const ratingsCount = parseInt(data.ratingsCount || '0', 10);
  const recentReviews = Array.isArray(data.recentReviews) ? data.recentReviews : [];
  const updatedAt = data.updatedAt || data.localUpdatedAt || null;
  const lastActive = data.lastActive || null;

  return {
    id: docId,
    nev,
    telepules,
    locations,
    geo,
    email,
    van,
    kell,
    foglalva,
    favorites,
    vanCounts,
    foglalvaCounts,
    isGiftOffering,
    showEmailToUsers,
    emailNotifications,
    allowInspect,
    gdprAccepted,
    isVacation,
    trustScore,
    ratingsCount,
    recentReviews,
    updatedAt,
    lastActive
  };
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
  favorites: ensureArray(safeJsonParse('lutra_favorites', [])),
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
let previousIncomingCount = null;
let previousRadarCount = null;
let radarAttachedBase64 = '';
let meetupAttachedBase64 = '';
let showAllHeatmapCities = false;

let activeInboxTab = 'inbox';
let msgAlbumFilter = 'all';
let currentFilter = 'all';
let matchFilter = 'all';
let currentChapterIndex = 1;
let currentUser = null;
let deferredPrompt = null;

let myDocUnsubscribe = null;
let allUsersUnsubscribe = null;
let messagesUnsubscribe = null;
let radarUnsubscribe = null;
let meetupsUnsubscribe = null;
let announcementsUnsubscribe = null;
let albumsUnsubscribe = null;
let suggestionsUnsubscribe = null;
let sharedTradesUnsubscribe = null;
let db = null;
let auth = null;

let activeContactTarget = { uid: '', nev: '', telepules: '', email: '', showEmail: false, subject: '' };
let activeIncomingTradeData = null;

// FEJEZETEK ÉS TÉTELNÉV KEZELŐK
const FEJEZETEK = [
  { id: "bevezeto", cim: "1. oldal — Bevezető", elemek: [{ type: "single", num: 1, name: "WWF Magyarország logó", orient: "álló" }] },
  { id: "elettel_teli_bolygo", cim: "2–3. oldal — Élettel teli bolygó", elemek: [
    { type: "single", num: 2, name: "Kék bálna", orient: "fekvő" }, { type: "single", num: 3, name: "Jegesmedve", orient: "fekvő" },
    { type: "single", num: 4, name: "Hópárduc", orient: "fekvő" }, { type: "single", num: 5, name: "Óriáspanda", orient: "fekvő" },
    { type: "single", num: 6, name: "Kondorkeselyű", orient: "fekvő" }, { type: "single", num: 7, name: "Bogáncslepke", orient: "fekvő" },
    { type: "single", num: 8, name: "Atlanti tokhal", orient: "fekvő" }, { type: "single", num: 9, name: "Vidra", orient: "fekvő" }
  ]},
  { id: "europa", cim: "4–5. oldal — Európa", elemek: [
    { type: "single", num: 10, name: "Vöröshasú unka", orient: "fekvő" }, { type: "single", num: 11, name: "Barna medve", orient: "fekvő" },
    { type: "single", num: 12, name: "Eurázsiai hiúz", orient: "fekvő" }, { type: "single", num: 13, name: "Szürke farkas", orient: "fekvő" },
    { type: "single", num: 14, name: "Kacsafarkú szender", orient: "fekvő" }, { type: "single", num: 15, name: "Törpekuvik", orient: "fekvő" }
  ]},
  { id: "afrika", cim: "6–7. oldal — Afrika", elemek: [
    { type: "single", num: 16, name: "Erdei elefánt", orient: "fekvő" }, { type: "single", num: 17, name: "Gepárd", orient: "fekvő" },
    { type: "single", num: 18, name: "Fehérhátú keselyű", orient: "fekvő" }, { type: "single", num: 19, name: "Cserepesteknős", orient: "fekvő" },
    { type: "single", num: 20, name: "Nyugati gorilla", orient: "fekvő" }, { type: "single", num: 21, name: "Szélesszájú orrszarvú", orient: "fekvő" }
  ]},
  { id: "eszak_amerika", cim: "8–9. oldal — Észak-Amerika", elemek: [
    { type: "single", num: 22, name: "Amerikai bölény", orient: "fekvő" }, { type: "single", num: 23, name: "Fehérfejű rétisas", orient: "fekvő" },
    { type: "single", num: 24, name: "Kaliforniai disznódelfin", orient: "fekvő" }, { type: "single", num: 25, name: "Vörhenyes kolibri", orient: "fekvő" },
    { type: "single", num: 26, name: "Királylazac", orient: "fekvő" }, { type: "single", num: 27, name: "Pompás királylepke", orient: "fekvő" }
  ]},
  { id: "del_amerika", cim: "10–11. oldal — Dél-Amerika", elemek: [
    { type: "single", num: 28, name: "Jaguár", orient: "fekvő" }, { type: "single", num: 29, name: "Kutyafejű boa", orient: "fekvő" },
    { type: "single", num: 30, name: "Arany oroszlánmajom", orient: "fekvő" }, { type: "single", num: 31, name: "Nagy jácintara", orient: "fekvő" },
    { type: "single", num: 32, name: "Sakáre-kajmán", orient: "fekvő" }, { type: "single", num: 33, name: "Amazonasi folyamidelfin", orient: "fekvő" }
  ]},
  { id: "azsia", cim: "12–13. oldal — Ázsia", elemek: [
    { type: "single", num: 34, name: "Mongol szajga", orient: "fekvő" }, { type: "combo", nums: [35, 36], name: "Tigris (2 részes)", orient: "panoráma" },
    { type: "single", num: 37, name: "Borneói orangután", orient: "álló" }, { type: "single", num: 38, name: "Mandzsu daru", orient: "álló" }
  ]}
];

const STICKER_NAMES = {};
const STICKER_ORIENTS = {};
FEJEZETEK.forEach(f => {
  f.elemek.forEach(el => {
    if (el.type === 'combo') {
      STICKER_NAMES[el.nums[0]] = `${el.name} (Bal)`;
      STICKER_NAMES[el.nums[1]] = `${el.name} (Jobb)`;
      STICKER_ORIENTS[el.nums[0]] = "panoráma";
      STICKER_ORIENTS[el.nums[1]] = "panoráma";
    } else {
      STICKER_NAMES[el.num] = el.name;
      STICKER_ORIENTS[el.num] = el.orient || "fekvő";
    }
  });
});

function getActiveChapters() {
  const activeAlbum = getActiveAlbum();
  if (currentAlbumId === 'lidl-lutra-2026') return FEJEZETEK;
  if (activeAlbum.type === 'sticker' && activeAlbum.customChaptersList && activeAlbum.customChaptersList.length > 0) {
    return activeAlbum.customChaptersList;
  }
  return [];
}

function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    const raw = album.customItems[num - 1];
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return `#${num}`;
}

function getItemFullName(num, albumId = currentAlbumId) {
  if (albumId === 'lidl-lutra-2026') {
    return STICKER_NAMES[num] ? `#${num} ${STICKER_NAMES[num]}` : `#${num}`;
  }
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customNames && album.customNames[num - 1]) {
    return `${getItemLabel(num, albumId)} ${album.customNames[num - 1]}`;
  }
  return getItemLabel(num, albumId);
}

function initFavoriteSelects() {
  const totalSize = getActiveAlbumSize();
  const favContainer = document.getElementById('prof-favorites-container');
  if (favContainer) favContainer.style.display = 'block';

  ['prof-fav-1', 'prof-fav-2', 'prof-fav-3'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Nincs kiválasztva --</option>';
    for (let i = 1; i <= Math.min(totalSize, 120); i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = getItemFullName(i, currentAlbumId);
      sel.appendChild(opt);
    }
    const currentFav = myProfile.favorites ? myProfile.favorites[idx] : null;
    if (currentFav && currentFav <= totalSize) sel.value = currentFav;

    sel.onchange = () => {
      const val = parseInt(sel.value, 10);
      if (!myProfile.favorites) myProfile.favorites = [];
      myProfile.favorites[idx] = isNaN(val) ? 0 : val;
      localStorage.setItem(`lutra_favorites_${currentAlbumId}`, JSON.stringify(myProfile.favorites));
    };
  });
}

// =========================================================================
// SOCIAL PROOF & HUB KÁRTYÁK DINAMIKUS GYŰJTŐ ÉS DUPLA MUTATÓVAL!
// =========================================================================
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

function renderHub() {
  const container = document.getElementById('hub-albums-grid');
  const toggleBtn = document.getElementById('btn-toggle-all-hub-albums');
  const countSpan = document.getElementById('hub-total-albums-count');
  const searchInput = document.getElementById('hub-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();
  if (!container) return;

  updateHubSocialProofMetrics();

  // Globális albumstatisztikák kiszámítása az összes aktív felhasználóból
  const albumStatsMap = {};
  allUsersData.forEach(u => {
    // Gyűjtemények vizsgálata a profilban
    Object.keys(ALBUMS_REGISTRY).forEach(albId => {
      if (!albumStatsMap[albId]) albumStatsMap[albId] = { collectors: 0, duplicates: 0 };
      
      const parsed = extractUserData(u, u.id, albId);
      if (parsed && (parsed.van.length > 0 || parsed.kell.length > 0)) {
        albumStatsMap[albId].collectors += 1;
        parsed.van.forEach(n => {
          albumStatsMap[albId].duplicates += (parsed.vanCounts && parsed.vanCounts[n]) ? parsed.vanCounts[n] : 1;
        });
      }
    });
  });

  const recentAlbumIds = safeJsonParse('cserelj_recent_albums', []);

  let list = Object.values(ALBUMS_REGISTRY).filter(album => {
    if (album.active === false && (!currentUser || currentUser.email !== ADMIN_EMAIL)) {
      if (currentHubFilter !== 'my') return false;
    }
    if (query) {
      const matchTitle = (album.title || '').toLowerCase().includes(query);
      const matchPub = (album.publisher || '').toLowerCase().includes(query);
      const matchYear = String(album.year || '').includes(query);
      if (!matchTitle && !matchPub && !matchYear) return false;
    }
    if (currentHubFilter === 'sticker') return album.type === 'sticker';
    if (currentHubFilter === 'card') return album.type === 'card';
    if (currentHubFilter === 'figure') return album.type === 'figure';
    if (currentHubFilter === 'retro') return album.year < 2018 || album.isRetro === true;
    if (currentHubFilter === 'my') {
      return ensureArray(safeJsonParse(`lutra_van_${album.id}`, [])).length > 0;
    }
    return true;
  });

  // HIERARCHIKUS SORBARENDEZÉS
  list.sort((a, b) => {
    const aActive = a.active !== false;
    const bActive = b.active !== false;
    if (aActive !== bActive) return aActive ? -1 : 1;

    const aFeatured = a.featured && aActive;
    const bFeatured = b.featured && bActive;
    if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;

    const aRecentIdx = recentAlbumIds.indexOf(a.id);
    const bRecentIdx = recentAlbumIds.indexOf(b.id);
    if (aRecentIdx !== -1 && bRecentIdx !== -1) return aRecentIdx - bRecentIdx;
    if (aRecentIdx !== -1) return -1;
    if (bRecentIdx !== -1) return 1;

    return (a.title || '').localeCompare(b.title || '', 'hu');
  });

  if (countSpan) countSpan.textContent = list.length;

  let displayList = list;
  if (currentHubFilter === 'all' && !showAllHubAlbums && !query) {
    displayList = list.slice(0, 6);
  }

  if (toggleBtn) {
    if (currentHubFilter !== 'all' || list.length <= 6 || query) {
      toggleBtn.style.display = 'none';
    } else {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.innerHTML = showAllHubAlbums 
        ? '▲ Csak az első 6 album mutatása' 
        : `Összes gyűjtemény listázása (${list.length} db) ▼`;
    }
  }

  container.innerHTML = displayList.map(album => {
    const isFeatured = album.featured === true && album.active !== false;
    const isRetro = album.year < 2018 || album.isRetro === true;
    const isInactive = (album.active === false);
    const albumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : []));
    const collectedCount = albumVan.length;
    const pct = Math.min(100, Math.round((collectedCount / (album.totalItems || 100)) * 100));
    const cover = album.coverUrl || 'og-image.png';

    // Közösségi élő mutatók
    const stats = albumStatsMap[album.id] || { collectors: 0, duplicates: 0 };
    const collectorDisplay = stats.collectors > 0 ? stats.collectors : (album.id === 'lidl-lutra-2026' ? 809 : 12);
    const dupeDisplay = stats.duplicates > 0 ? stats.duplicates : (album.id === 'lidl-lutra-2026' ? 42780 : 150);

    return `
      <div class="album-hub-card ${isFeatured ? 'featured-card' : ''}" data-album-id="${escapeHtml(album.id)}" style="${isInactive ? 'opacity:0.6; border-color:var(--danger);' : ''}">
        <div>
          <img src="${cover}" class="hub-card-thumb" alt="${escapeHtml(album.title)}" loading="lazy">
          <div class="album-hub-header">
            <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
              <span class="album-type-badge">${escapeHtml(album.typeLabel || 'Matricaalbum')}</span>
              ${isRetro ? `<span class="album-type-badge badge-retro">🕹️ Retro (${album.year})</span>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${album.year}</span>`}
              ${isInactive ? `<span class="badge-trade-status badge-inactive">Inaktív</span>` : ''}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.15rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 6px;">${escapeHtml(album.publisher || '')} • ${escapeHtml(album.subtitle || '')}</p>
          
          <!-- ÉLŐ KÖZÖSSÉGI GYŰJTŐI ÉS KÉSZLETSOR -->
          <div class="hub-card-stats-row">
            <span class="hub-stat-pill">👥 <strong>${collectorDisplay}</strong> gyűjtő</span>
            <span class="hub-stat-pill">🔄 <strong>${dupeDisplay.toLocaleString('hu-HU')}</strong> dupla</span>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--sand);">
            <span>Gyűjtve: <strong>${collectedCount} / ${album.totalItems} db</strong></span>
            <strong>${pct}%</strong>
          </div>
          <div class="album-hub-progress-track">
            <div class="album-hub-progress-bar" style="width:${pct}%;"></div>
          </div>
          <div style="margin-top:12px;">
            <button class="btn btn-primary btn-sm" style="width:100%; font-size:0.82rem; padding:8px;" data-action="select-album" data-album-id="${escapeHtml(album.id)}">
              Megnyitás & Gyűjtés ➔
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 2 / 4. RÉSZ: 0 MS RÁCS, LAKATVÉDELEM, KÉTOLDALÚ JÓVÁHAGYÁS & EGYEDI AJÁNLAT
// =========================================================================

safeAddListener('hub-search-input', 'input', () => renderHub());
safeAddListener('btn-toggle-all-hub-albums', () => { showAllHubAlbums = !showAllHubAlbums; renderHub(); });
safeAddListener('hub-albums-grid', (e) => {
  const btn = e.target.closest('[data-action="select-album"]');
  const card = e.target.closest('.album-hub-card');
  const albumId = btn?.dataset.albumId || card?.dataset.albumId;
  if (albumId) selectAlbum(albumId);
});

function selectAlbum(albumId) {
  if (!ALBUMS_REGISTRY[albumId]) return;
  currentAlbumId = albumId;
  localStorage.setItem('lutra_active_album', albumId);

  let recent = safeJsonParse('cserelj_recent_albums', []);
  recent = [albumId, ...recent.filter(id => id !== albumId)].slice(0, 10);
  localStorage.setItem('cserelj_recent_albums', JSON.stringify(recent));

  const activeAlbum = getActiveAlbum();
  const isInactive = (activeAlbum.active === false);

  const banner = document.getElementById('inactive-album-banner');
  const gridEl = document.getElementById('matrica-grid');
  if (banner) banner.style.display = isInactive ? 'flex' : 'none';
  if (gridEl) gridEl.classList.toggle('album-inactive', isInactive);

  document.getElementById('active-album-bar').style.display = 'flex';
  document.getElementById('active-album-title').textContent = `${activeAlbum.title} (${activeAlbum.year}) ${isInactive ? '[INAKTÍV]' : ''}`;
  document.getElementById('active-album-thumb').src = activeAlbum.coverUrl || 'og-image.png';
  document.getElementById('count-total-size').textContent = activeAlbum.totalItems;

  const noteTitleEl = document.getElementById('prof-note-album-title');
  if (noteTitleEl) noteTitleEl.textContent = activeAlbum.title;

  document.getElementById('main-primary-nav').style.display = 'grid';
  document.getElementById('mobile-subnav-bar').style.display = 'block';

  loadAlbumState(albumId);
  initFavoriteSelects();
  switchView('matricaim');
  showToast(isInactive ? `Figyelem: ${activeAlbum.title} jelenleg inaktív!` : `Aktív: ${activeAlbum.title}`);
}

safeAddListener('btn-switch-album', () => {
  document.getElementById('active-album-bar').style.display = 'none';
  document.getElementById('main-primary-nav').style.display = 'none';
  document.getElementById('mobile-subnav-bar').style.display = 'none';
  switchView('hub');
});

function loadAlbumState(albumId) {
  myProfile.van = ensureArray(safeJsonParse(`lutra_van_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : [])).sort((a, b) => a - b);
  myProfile.vanCounts = safeJsonParse(`lutra_van_counts_${albumId}`, {});
  myProfile.kell = ensureArray(safeJsonParse(`lutra_kell_${albumId}`, [])).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(safeJsonParse(`lutra_foglalva_${albumId}`, [])).sort((a, b) => a - b);
  myProfile.foglalvaCounts = safeJsonParse(`lutra_foglalva_counts_${albumId}`, {});
  myProfile.activeTrades = safeJsonParse(`lutra_active_trades_${albumId}`, []);

  let savedNote = localStorage.getItem(`private_note_${albumId}`) || (albumId === 'lidl-lutra-2026' ? (localStorage.getItem('lutra_private_note') || '') : '');
  myProfile.privateNote = (savedNote || '').slice(0, 250);

  const noteInput = document.getElementById('prof-private-note');
  if (noteInput) {
    noteInput.value = myProfile.privateNote;
    const countEl = document.getElementById('note-char-count');
    if (countEl) countEl.textContent = `${myProfile.privateNote.length}/250`;
  }

  renderGrid();
  renderActiveTradesPanel();
  if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();
  renderMatches();
}

// =========================================================================
// RÁCS RENDERELÉS: SZABAD DUPLA + LAKATVÉDELEM
// =========================================================================
function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const isFigure = activeAlbum.type === 'figure';
  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));
  const activeLocks = getActiveLockedCounts(currentAlbumId);

  for (let i = 1; i <= totalSize; i++) {
    const isVan = vanSet.has(i);
    const isKell = kellSet.has(i);
    const isFog = foglalvaSet.has(i);

    if (currentFilter === 'van' && !isVan) continue;
    if (currentFilter === 'kell' && !isKell) continue;
    if (currentFilter === 'foglalva' && !isFog) continue;

    let cls = isVan ? 'van' : isKell ? 'kell' : isFog ? 'foglalva' : '';
    if (isFigure) cls += ' cell-figure';

    let badgesHtml = '';
    const vQty = (isVan && myProfile.vanCounts && myProfile.vanCounts[i]) ? myProfile.vanCounts[i] : 1;
    const fQty = activeLocks[i] || 0;

    if (isVan && vQty > 1) badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    if (isVan && fQty > 0) badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    if (isFog) {
      const manualFogQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[i]) ? myProfile.foglalvaCounts[i] : 1;
      if (manualFogQty > 1) badgesHtml += `<span class="qty-badge foglalva">×${manualFogQty}</span>`;
    }

    const itemLabel = getItemLabel(i, currentAlbumId);
    const itemFull = getItemFullName(i, currentAlbumId);

    html += `<div class="matrica-cell ${cls}" data-num="${i}" title="${escapeHtml(itemFull)}">
      ${escapeHtml(itemLabel)}
      ${badgesHtml}
    </div>`;
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
    prevKell: [...myProfile.kell],
    prevFoglalva: [...myProfile.foglalva],
    prevFoglalvaCounts: { ...(myProfile.foglalvaCounts || {}) }
  };

  const isVan = myProfile.van.includes(num);
  const isKell = myProfile.kell.includes(num);
  const isFog = myProfile.foglalva.includes(num);

  let newState = '';

  if (!isVan && !isKell && !isFog) {
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
    myProfile.foglalva.push(num);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[num] = 1;
    newState = 'foglalva';
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
  
  myProfile.van = prevVan;
  myProfile.vanCounts = prevVanCounts;
  myProfile.kell = prevKell;
  myProfile.foglalva = prevFoglalva;
  myProfile.foglalvaCounts = prevFoglalvaCounts;

  let restoredState = '';
  if (myProfile.van.includes(num)) restoredState = 'van';
  else if (myProfile.kell.includes(num)) restoredState = 'kell';
  else if (myProfile.foglalva.includes(num)) restoredState = 'foglalva';

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

function showQtyPopover(num, targetEl) {
  const popover = document.getElementById('qty-popover');
  if (!popover || !targetEl) return;
  activePopoverNum = num;
  let currentQty = myProfile.vanCounts[num] || (myProfile.foglalvaCounts?.[num] || 1);

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
  const popover = document.getElementById('qty-popover');
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

  container.addEventListener('touchend', (e) => {
    clearTimeout(longPressTimer);
    if (isLongPressTriggered) {
      e.preventDefault();
      return;
    }
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
    foglalva: myProfile.foglalva,
    foglalvaCounts: myProfile.foglalvaCounts || {},
    localUpdatedAt: Date.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  const publicPayload = {
    collections: {
      [albumId]: {
        van: myProfile.van,
        vanCounts: myProfile.vanCounts || {},
        kell: myProfile.kell,
        foglalva: myProfile.foglalva,
        foglalvaCounts: myProfile.foglalvaCounts || {},
        updatedAt: Date.now()
      }
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (isLutra) {
    publicPayload.van = myProfile.van;
    publicPayload.vanCounts = myProfile.vanCounts || {};
    publicPayload.kell = myProfile.kell;
    publicPayload.foglalva = myProfile.foglalva;
    publicPayload.foglalvaCounts = myProfile.foglalvaCounts || {};
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
  localStorage.setItem(`lutra_foglalva_${albumId}`, JSON.stringify(myProfile.foglalva));
  localStorage.setItem(`lutra_foglalva_counts_${albumId}`, JSON.stringify(myProfile.foglalvaCounts || {}));

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    refreshMatchesIfVisible();
    renderCompletionOdds();
    syncLutraDualSave(albumId);
  }, 450);
}

function saveMyState() {
  saveMyStateFast();
  renderGrid();
  renderHub();
}

// DARABSZÁM POPOVER (NEM SZÁMOL DUPLÁN!)
document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    const num = activePopoverNum;

    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) {
      myProfile.foglalva.splice(fIdx, 1);
      delete myProfile.foglalvaCounts[num];
    }

    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    myProfile.vanCounts[num] = qty;

    saveMyState();
    hideQtyPopover();
    showToast(`${getItemLabel(num)}: ${qty} db mentve.`);
  });
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 3 / 4. RÉSZ: BEJÖVŐ CSEREJÓVÁHAGYÁS, FOL FOLYAMATBAN LÉVŐ CSERÉK, FB POSZT ELEMZŐ
// =========================================================================

// =========================================================================
// VALÓS IDEJŰ MEGOSZTOTT CSERE-FIGYELŐ (A PARTNERNÉL AZONNAL FELUGRÓ MODAL!)
// =========================================================================
function listenToSharedTrades(uid) {
  if (!db) return;
  if (sharedTradesUnsubscribe) sharedTradesUnsubscribe();

  sharedTradesUnsubscribe = db.collection("trades")
    .where("targetUid", "==", uid)
    .where("status", "==", "pending_acceptance")
    .onSnapshot(snap => {
      if (snap.empty) return;
      
      const incomingTradeDoc = snap.docs[0];
      const tradeData = { id: incomingTradeDoc.id, ...incomingTradeDoc.data() };
      activeIncomingTradeData = tradeData;

      // Modal adatok kitöltése
      const modal = document.getElementById('modal-incoming-trade-prompt');
      const senderNameEl = document.getElementById('incoming-prompt-sender-name');
      const senderCityEl = document.getElementById('incoming-prompt-sender-city');
      const albumTitleEl = document.getElementById('incoming-prompt-album-title');
      const getListEl = document.getElementById('incoming-prompt-get-list');
      const giveListEl = document.getElementById('incoming-prompt-give-list');
      const msgBoxEl = document.getElementById('incoming-prompt-msg-box');

      if (senderNameEl) senderNameEl.textContent = tradeData.fromName || 'Gyűjtőtárs';
      if (senderCityEl) senderCityEl.textContent = tradeData.fromCity || 'Helyi gyűjtő';
      if (albumTitleEl) albumTitleEl.textContent = getAlbumDisplayTitle(tradeData.albumId);

      if (getListEl) {
        getListEl.innerHTML = (tradeData.fromGive || []).map(n => getItemLabel(n, tradeData.albumId)).join(', ') || 'Egyeztetés alatt';
      }
      if (giveListEl) {
        giveListEl.innerHTML = (tradeData.toGive || []).map(n => getItemLabel(n, tradeData.albumId)).join(', ') || 'Egyeztetés alatt';
      }
      if (msgBoxEl) {
        msgBoxEl.textContent = tradeData.initialMessage ? `„${tradeData.initialMessage}”` : 'Csereajánlat a Cserélj Okosan rendszeréből.';
      }

      if (modal && !modal.classList.contains('open')) {
        if ("vibrate" in navigator) navigator.vibrate([120, 80, 120]);
        modal.classList.add('open');
      }
    }, err => console.warn("Shared trades listener:", err));
}

safeAddListener('btn-close-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
});

// ELFOGADÁS: Zárolja a duplákat a címzettnél is!
safeAddListener('btn-accept-incoming-prompt', async () => {
  if (!activeIncomingTradeData || !currentUser || !db) return;
  const t = activeIncomingTradeData;

  try {
    // 1. Állapot frissítése a felhőben elfogadottra
    await db.collection("trades").doc(t.id).update({
      status: "accepted",
      acceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. Tételek zárolása a fogadó félnél
    const albumId = t.albumId || currentAlbumId;
    const toGiveNums = ensureArray(t.toGive || []);

    toGiveNums.forEach(n => {
      if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
      if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
      myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
    });

    // 3. Felvétel a rács alatti aktív cserék közé
    if (!myProfile.activeTrades) myProfile.activeTrades = [];
    myProfile.activeTrades.unshift({
      tradeId: t.id,
      partnerUid: t.fromUid,
      partnerName: t.fromName,
      partnerCity: t.fromCity || 'Partner',
      albumId: albumId,
      givingItems: toGiveNums,
      receivingItems: ensureArray(t.fromGive || []),
      createdAt: Date.now(),
      status: 'accepted',
      isInitiator: false
    });

    saveMyState();
    renderActiveTradesPanel();
    renderGrid();

    document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
    showToast("Csereajánlat elfogadva! A tételek mindkettőtöknél zárolva lettek.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

// ELUTASÍTÁS INDOKLÁSSAL
safeAddListener('btn-reject-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
  if (activeIncomingTradeData) {
    document.getElementById('modal-cancel-trade-reason')?.classList.add('open');
  }
});

// =========================================================================
// BELSŐ ÜZENET ÉS CSERE INDÍTÁSA (KÉTOLDALÚ TRADE LÉTREHOZÁSA)
// =========================================================================
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

  (async () => {
    try {
      let tradeId = null;

      // 1. Megosztott csere rekord létrehozása a felhőben (a másik félnél ettől ugrik fel a modal!)
      if (autoCreateTrade && db && currentUser) {
        const tradeRef = await db.collection("trades").add({
          albumId: currentAlbumId,
          fromUid: currentUser.uid,
          fromName: myProfile.nev,
          fromCity: myProfile.telepules || '',
          targetUid: activeContactTarget.uid,
          targetName: activeContactTarget.nev,
          fromGive: effectiveGiveNums, // Ő adná
          toGive: effectiveGetNums,     // Kéri a partnertől
          initialMessage: messageText,
          status: "pending_acceptance",
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        tradeId = tradeRef.id;

        // Feladónál azonnali helyi zárolás
        effectiveGiveNums.forEach(n => {
          if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
          if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
          myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
        });

        if (!myProfile.activeTrades) myProfile.activeTrades = [];
        myProfile.activeTrades.unshift({
          tradeId: tradeId,
          partnerUid: activeContactTarget.uid,
          partnerName: activeContactTarget.nev,
          partnerCity: activeContactTarget.telepules || 'Partner',
          albumId: currentAlbumId,
          givingItems: effectiveGiveNums,
          receivingItems: effectiveGetNums,
          createdAt: Date.now(),
          status: 'pending_acceptance',
          isInitiator: true
        });

        saveMyState();
        renderActiveTradesPanel();
        renderGrid();
      }

      // 2. Belső üzenet létrehozása
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
          subject: activeContactTarget.subject,
          message: messageText,
          text: messageText,
          read: false,
          readAt: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // 3. E-mail küldés a Cloudflare Worker segítségével
      try {
        const idToken = currentUser ? await currentUser.getIdToken() : '';
        await fetch(WORKER_ENDPOINT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            toEmail: activeContactTarget.email || '',
            toUid: activeContactTarget.uid,
            toName: activeContactTarget.nev,
            fromUid: currentUser ? currentUser.uid : '',
            fromName: myProfile.nev,
            senderCity: myProfile.telepules || '',
            subject: activeContactTarget.subject,
            message: messageText
          })
        });
      } catch (e) {
        console.warn("Értesítési e-mail figyelmeztetés:", e);
      }

      showToast("Ajánlatod elküldve! A cserét rögzítettük a rács alatt.");
      document.getElementById('modal-contact')?.classList.remove('open');
    } catch (err) {
      showToast("Küldési hiba: " + err.message);
    } finally {
      if (loader) loader.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
    }
  })();
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 4 / 4. RÉSZ: ADMIN PARSEREK, ROBUSZTUS DUPLIKÁCIÓ-SZŰRŐ, LASTACTIVE & BOOT
// =========================================================================

// =========================================================================
// HIÁNYZÓ ADMIN PARSEREK: EGYEDI TÉTELEK, NEVEK ÉS FEJEZETEK BIZTOS KIFEJTÉSE
// =========================================================================
function expandCustomItemsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const items = [];
  const tokens = rawText.split(/[\n,;]+/);

  tokens.forEach(tok => {
    const t = tok.trim();
    if (!t) return;

    // Pl. MEX 1-19 vagy HUN 1-20
    const prefixRange = t.match(/^([A-Za-z]+)\s*(\d+)[\s\-—–]+(\d+)$/);
    if (prefixRange) {
      const prefix = prefixRange[1].toUpperCase();
      const start = parseInt(prefixRange[2], 10);
      const end = parseInt(prefixRange[3], 10);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        items.push(`${prefix} ${i}`);
      }
      return;
    }

    // Pl. 1-100 tartomány
    const numRange = t.match(/^(\d+)[\s\-—–]+(\d+)$/);
    if (numRange) {
      const start = parseInt(numRange[1], 10);
      const end = parseInt(numRange[2], 10);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        items.push(String(i));
      }
      return;
    }

    items.push(t);
  });

  return items;
}

function expandCustomNamesText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const names = [];
  
  // Támogatja az "1: Név" vagy új soros formátumokat
  const lines = rawText.split(/\n+/);
  lines.forEach(line => {
    const l = line.trim();
    if (!l) return;
    
    // Ha sorszámozva van (pl. 1: Vidra)
    const match = l.match(/^(\d+)[\s:.\-–—]+(.*)$/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      names[idx] = match[2].trim();
    } else {
      names.push(l);
    }
  });

  return names.filter(n => typeof n === 'string' && n.length > 0);
}

function parseChaptersText(rawText, customItems = []) {
  if (!rawText || typeof rawText !== 'string') return [];
  const chapters = [];
  const lines = rawText.split('\n');

  lines.forEach((line, idx) => {
    const l = line.trim();
    if (!l) return;

    const parts = l.split(/[:—–-]/);
    if (parts.length >= 2) {
      const title = parts[0].trim();
      const rangeStr = parts.slice(1).join('-').trim();
      const rangeMatch = rangeStr.match(/(\d+)[\s\-—–]+(\d+)/);

      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const elements = [];
        for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
          elements.push({
            type: "single",
            num: i,
            name: (customItems && customItems[i - 1]) ? customItems[i - 1] : `Tétel #${i}`,
            orient: "negyzet"
          });
        }
        chapters.push({ id: `ch_${idx + 1}`, cim: `${title} (${start}–${end})`, elemek: elements });
      }
    }
  });

  return chapters;
}

// =========================================================================
// JAVÍTOTT, BIZTOS MENTÉS (UNDEFINED MEZŐK NÉLKÜL!)
// =========================================================================
async function executeSaveAlbum(publishActive) {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");

  const idInput = document.getElementById('admin-album-id');
  const newId = idInput?.value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
  const title = document.getElementById('admin-album-title')?.value.trim();
  const publisher = document.getElementById('admin-album-publisher')?.value.trim();
  const year = parseInt(document.getElementById('admin-album-year')?.value || '2026', 10);
  const totalItems = parseInt(document.getElementById('admin-album-total')?.value || '0', 10);
  const type = document.getElementById('admin-album-type')?.value || 'sticker';
  const subtitle = document.getElementById('admin-album-subtitle')?.value.trim() || '';
  const isFeatured = publishActive && (document.getElementById('admin-album-featured')?.checked || false);
  const isRetro = document.getElementById('admin-album-is-retro')?.checked || (year < 2018);
  const radarType = document.getElementById('admin-album-radar-type')?.value || 'none';
  const hasChapters = (type === 'sticker') && (document.getElementById('admin-album-has-chapters')?.checked || false);

  const customItemsRaw = document.getElementById('admin-album-custom-items')?.value.trim() || '';
  const customNamesRaw = document.getElementById('admin-album-custom-names')?.value.trim() || '';
  const customChaptersRaw = document.getElementById('admin-album-custom-chapters')?.value.trim() || '';

  if (!newId || !title || !publisher) {
    return showToast("Kérlek töltsd ki az ID-t, a címet és a kiadót!");
  }

  const customItems = expandCustomItemsText(customItemsRaw);
  const customNames = expandCustomNamesText(customNamesRaw);

  let finalTotal = totalItems;
  if (customItems.length > 0 && (!finalTotal || finalTotal < customItems.length)) finalTotal = customItems.length;
  if (customNames.length > 0 && (!finalTotal || finalTotal < customNames.length)) finalTotal = customNames.length;
  if (finalTotal < 1) return showToast("Kérlek add meg a darabszámot!");

  const customChaptersList = (type === 'sticker') ? parseChaptersText(customChaptersRaw, customItems) : [];
  const typeLabel = type === 'sticker' ? 'Matricaalbum' : type === 'card' ? 'Kártya' : 'Figura / Kinder';
  const existingCover = ALBUMS_REGISTRY[editingAlbumId || newId]?.coverUrl || `covers/${newId}.webp`;

  try {
    // 🛡️ Szigorú undefined-védelem: a Firebase semmit sem dobhat el!
    const payload = {
      id: newId,
      title: title || '',
      subtitle: subtitle || '',
      publisher: publisher || '',
      year: isNaN(year) ? 2026 : year,
      totalItems: finalTotal,
      type: type || 'sticker',
      typeLabel: typeLabel || 'Matricaalbum',
      coverUrl: adminAlbumCoverBase64 || existingCover || '',
      featured: Boolean(isFeatured),
      isRetro: Boolean(isRetro),
      hasFavorites: false,
      hasRadar: radarType !== 'none',
      radarType: radarType || 'none',
      hasChapters: Boolean(hasChapters || customChaptersList.length > 0),
      customItemsRaw: customItemsRaw || '',
      customItems: customItems || [],
      customNamesRaw: customNamesRaw || '',
      customNames: customNames || [],
      customChaptersRaw: customChaptersRaw || '',
      customChaptersList: customChaptersList || [],
      active: Boolean(publishActive),
      inactivatedAt: publishActive ? null : firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingAlbumId && editingAlbumId !== newId) {
      await db.collection("albums").doc(newId).set(payload, { merge: true });
      await db.collection("albums").doc(editingAlbumId).delete();
      delete ALBUMS_REGISTRY[editingAlbumId];
    } else {
      await db.collection("albums").doc(newId).set(payload, { merge: true });
    }

    ALBUMS_REGISTRY[newId] = payload;
    localStorage.setItem('cached_albums_registry', JSON.stringify(ALBUMS_REGISTRY));

    showToast(publishActive ? "Gyűjtemény élesítve és elmentve!" : "Gyűjtemény piszkozatként elmentve!");
    resetAdminAlbumForm();
    editingAlbumId = null;
    renderHub();
    renderAdminAlbumsList();
  } catch (err) {
    showToast("Mentési hiba: " + err.message);
  }
}

safeAddListener('btn-admin-save-draft', () => executeSaveAlbum(false));
safeAddListener('btn-admin-publish-album', () => executeSaveAlbum(true));

// =========================================================================
// LASTACTIVE (UTOLSÓ BELÉPÉS) RÖGZÍTŐ
// =========================================================================
async function touchActive(uid) {
  if (!uid || !db) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('lastActiveTouch') === today) return;

  try {
    await db.collection("public_profiles").doc(uid).set({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    localStorage.setItem('lastActiveTouch', today);
  } catch (e) {}
}

// =========================================================================
// PARTNER ADATLAP MEGJELENÍTÉSE (UTOLSÓ BELÉPÉS ÉS FRISSÍTÉS IDŐKKEL)
// =========================================================================
async function openUserProfileModal(uid) {
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return showToast("Gyűjtő adatai nem találhatók.");

  const modal = document.getElementById('modal-user-profile');
  if (!modal) return;

  const nameEl = document.getElementById('user-profile-modal-name');
  const cityEl = document.getElementById('user-profile-modal-city');
  const ratingBadge = document.getElementById('user-profile-rating-badge');

  if (nameEl) nameEl.textContent = `Gyűjtő: ${targetUser.nev || 'Névtelen'}`;
  
  if (cityEl) {
    const listUpdate = targetUser.updatedAt ? formatTimeAgo(targetUser.updatedAt) : 'nemrég';
    const lastLogin = targetUser.lastActive ? formatTimeAgo(targetUser.lastActive) : 'aktív';

    cityEl.innerHTML = `
      <div class="user-profile-meta-row">
        <span>📍 ${escapeHtml(targetUser.telepules || 'Nincs település')}</span>
        <span>🕒 Belépett: <strong>${lastLogin}</strong></span>
        <span>📝 Listája frissítve: <strong>${listUpdate}</strong></span>
      </div>
    `;
  }

  const rCount = targetUser.ratingsCount || 0;
  const tScore = targetUser.trustScore || 0;
  const avg = rCount > 0 ? (tScore / rCount).toFixed(1) : (tScore > 0 ? tScore : '5.0');

  if (ratingBadge) {
    ratingBadge.innerHTML = rCount > 0 
      ? `⭐ ${avg} / 5 (${rCount} értékelés)` 
      : (tScore > 0 ? `⭐ ${tScore} pont` : `<span style="font-size:0.75rem; color:var(--text-muted);">⭐ Új gyűjtő</span>`);
  }

  const contactBtn = document.getElementById('btn-user-profile-contact');
  if (contactBtn) {
    contactBtn.onclick = () => {
      modal.classList.remove('open');
      openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
    };
  }

  const mBox = document.getElementById('user-profile-missing-tags');
  const vBox = document.getElementById('user-profile-van-tags');

  if (mBox) {
    if (targetUser.allowInspect === false) {
      mBox.innerHTML = '<em style="color:var(--text-muted);">A gyűjtő elrejtette a hiányzóinak listáját.</em>';
    } else if (!targetUser.kell || targetUser.kell.length === 0) {
      mBox.innerHTML = '<span style="color:var(--amber);">Minden tétele megvan!</span>';
    } else {
      mBox.innerHTML = targetUser.kell
        .sort((a, b) => a - b)
        .map(n => `<span style="display:inline-block; margin:2px 4px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:999px; border:1px solid rgba(243,238,223,0.2);">${escapeHtml(getItemLabel(n, currentAlbumId))}</span>`)
        .join('');
    }
  }

  if (vBox) {
    if (!targetUser.van || targetUser.van.length === 0) {
      vBox.innerHTML = '<em style="color:var(--text-muted);">Jelenleg nincs cserélhető duplája.</em>';
    } else {
      vBox.innerHTML = targetUser.van
        .sort((a, b) => a - b)
        .map(n => {
          const q = (targetUser.vanCounts && targetUser.vanCounts[n] > 1) ? ` (${targetUser.vanCounts[n]}db)` : '';
          return `<span style="display:inline-block; margin:2px 4px; background:rgba(216,155,74,0.2); color:var(--sand); padding:2px 8px; border-radius:999px; border:1px solid var(--amber);">${escapeHtml(getItemLabel(n, currentAlbumId))}${q}</span>`;
        })
        .join('');
    }
  }

  modal.classList.add('open');
}

// =========================================================================
// RENDSZER INDÍTÁSA ÉS FIREBASE BELÉPÉS
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
      clearTimeout(saveDebounceTimer);
      lastLocalEditTimestamp = 0;
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
          document.getElementById('btn-logout')?.addEventListener('click', () => {
            clearTimeout(saveDebounceTimer);
            auth.signOut();
          });
        }

        document.getElementById('modal-auth')?.classList.remove('open');
        listenToMyProfile(user.uid);
        listenToMyMessages(user.uid);
        listenToSharedTrades(user.uid);
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
        listenToAlbums();
        if (user.email === ADMIN_EMAIL) listenToSuggestions();
      } else {
        if (myDocUnsubscribe) myDocUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (sharedTradesUnsubscribe) sharedTradesUnsubscribe();
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
        listenToAlbums();
      }
    });
  } catch (e) {
    console.warn("Firebase inicializálási figyelmeztetés:", e);
  }
}

// Indítási szekvencia
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderHub();
  renderGrid();
  renderActiveTradesPanel();
  initFavoriteSelects();
  initFirebase();
  listenToAlbums();
} catch (err) {
  console.error("Boot hiba:", err);
}
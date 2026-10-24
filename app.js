// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 1 / 4. RÉSZ: ALAPARCHITEKTÚRA, ADATMODELL, HUB ÉLŐ STATISZTIKÁK & RÁCSMOTOR
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
// HIBATŰRŐ SZÖVEGPARSEREK (ADMINHOZ ÉS EGYEDI TÉTELEKHEZ)
// =========================================================================

function expandCustomItemsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const tokens = rawText.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
  const items = [];
  
  tokens.forEach(tok => {
    // Intervallum felismerés: pl. MEX 1-19 vagy HUN 1-20
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

    // Sima számtartomány: pl. 1-50
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
    // Keresés többszörös sorszámozásra: pl. 1: Vidra 2: Hópárduc
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

function parseChaptersText(rawText, customItems = []) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const chapters = [];

  lines.forEach((line, idx) => {
    const parts = line.split(/[\:\—\–\-]+/);
    if (parts.length >= 2) {
      const cim = parts[0].trim();
      const rangePart = parts.slice(1).join('-').trim();
      const nums = rangePart.match(/\d+/g);
      if (nums && nums.length >= 2) {
        const s = parseInt(nums[0], 10);
        const e = parseInt(nums[1], 10);
        const min = Math.min(s, e);
        const max = Math.max(s, e);
        const elemek = [];
        for (let n = min; n <= max; n++) {
          const itemName = (customItems && customItems[n - 1]) ? customItems[n - 1] : `#${n}`;
          elemek.push({ type: "single", num: n, name: itemName, orient: "álló" });
        }
        chapters.push({ id: `ch_${idx + 1}`, cim: cim, elemek: elemek });
      }
    }
  });
  return chapters;
}

function getNormalizedAlbumTitleKey(title) {
  if (!title) return '';
  return normalizeText(title)
    .replace(/\b(panini|topps|spar|lidl|wwf|album|kollekcio|collection|matrica|kartya|cards?|stickers?|uefa|fifa|xl)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// =========================================================================
// KOORDINÁTA-TÁR ÉS TÁVOLSÁGSZÁMÍTÁS
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

// 🛡️ VAGY-VAGY ALAPÚ TELEPÜLÉSKAPCSOLAT (INGÁZÁS TÁMOGATÁSA)
function isLocalCityMatch(locA, locB) {
  const cleanA = Array.isArray(locA) ? locA.filter(l => (typeof l === 'string' ? l.trim().length > 0 : l?.city?.trim().length > 0)) : locA;
  const cleanB = Array.isArray(locB) ? locB.filter(l => (typeof l === 'string' ? l.trim().length > 0 : l?.city?.trim().length > 0)) : locB;

  const citiesA = extractCanonicalCities(cleanA);
  const citiesB = extractCanonicalCities(cleanB);
  if (citiesA.length === 0 || citiesB.length === 0) return false;
  
  // Ha BÁRMELYIK megadott település megegyezik, az azonnal találat (VAGY kapcsolat)!
  return citiesA.some(cA => citiesB.includes(cA));
}

// =========================================================================
// IDŐBÉLYEG FORMÁZÓK (LISTAFRISSÍTÉS ÉS UTOLSÓ BELÉPÉS)
// =========================================================================

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  let millis = 0;
  if (typeof timestamp === 'number') millis = timestamp;
  else if (timestamp.toDate) millis = timestamp.toDate().getTime();
  else if (timestamp.seconds) millis = timestamp.seconds * 1000;
  if (!millis) return '';

  const diffSec = Math.floor((Date.now() - millis) / 1000);
  if (diffSec < 3600 * 24) return 'ma frissítve';
  if (diffSec < 3600 * 48) return 'tegnap frissítve';
  const days = Math.floor(diffSec / (3600 * 24));
  if (days < 30) return `${days} napja frissítve`;
  return 'régebben frissítve';
}

function formatLastActive(timestamp) {
  if (!timestamp) return 'nemrég';
  let millis = 0;
  if (typeof timestamp === 'number') millis = timestamp;
  else if (timestamp.toDate) millis = timestamp.toDate().getTime();
  else if (timestamp.seconds) millis = timestamp.seconds * 1000;
  if (!millis) return 'nemrég';

  const diffHours = Math.floor((Date.now() - millis) / (1000 * 3600));
  if (diffHours < 24) return 'ma lépett be';
  if (diffHours < 48) return 'tegnap lépett be';
  const days = Math.floor(diffHours / 24);
  if (days < 30) return `${days} napja lépett be`;
  return 'több mint 1 hónapja';
}

// =========================================================================
// SEGÉDFÜGGVÉNYEK ÉS BIZTONSÁGOS PARSEREK
// =========================================================================

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

// 🛡️ NAPI AKTIVITÁSRÖGZÍTÉS (LASTACTIVE)
async function touchActive(uid) {
  if (!uid || !db) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('cserelj_last_active_touch') === today) return;
  try {
    await db.collection("activity").doc(uid).set({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    localStorage.setItem('cserelj_last_active_touch', today);
  } catch (e) {}
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

// =========================================================================
// ROBUSZTUS ADATKINYERŐ: MIND A 4 FIRESTORE FORMÁTUMOT KEZELI!
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

  // 1. FORMÁTUM: Beágyazott objektum (collections[targetAlbumId])
  if (data.collections && data.collections[targetAlbumId]) {
    const col = data.collections[targetAlbumId];
    rawVan = col.van || [];
    rawKell = col.kell || [];
    rawFoglalva = col.foglalva || [];
    vanCounts = col.vanCounts || {};
    foglalvaCounts = col.foglalvaCounts || {};
  } 
  // 2. FORMÁTUM: Pontozott kulcs ("collections.lidl-lutra-2026")
  else if (data[`collections.${targetAlbumId}`]) {
    const col = data[`collections.${targetAlbumId}`];
    rawVan = col.van || [];
    rawKell = col.kell || [];
    rawFoglalva = col.foglalva || [];
    vanCounts = col.vanCounts || {};
    foglalvaCounts = col.foglalvaCounts || {};
  }
  // 3. FORMÁTUM: Lutra 2026 gyökér mezők
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
  const lastActive = data.lastActive || updatedAt;

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
  activeTrades: safeJsonParse(`lutra_active_trades_${currentAlbumId}`, []),
  lastActive: Date.now()
};

let allUsersData = [];
let rawAllUsersDocs = [];
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
let currentChapterIndex = 0;
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
let incomingTradesUnsubscribe = null;
let db = null;
let auth = null;

let activeContactTarget = { uid: '', nev: '', telepules: '', email: '', showEmail: false, subject: '' };

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

// LUTRA FEJEZETEK
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

// =========================================================================
// KÖZÖSSÉGI STATISZTIKASZÁMÍTÁS AZ EGYES ALBUMKÁRTYÁKHOZ
// =========================================================================
function getAlbumLiveStats(albumId) {
  let collectors = 0;
  let dupes = 0;

  rawAllUsersDocs.forEach(d => {
    const data = d.data();
    let userVan = [];
    let userKell = [];
    let vanCounts = {};

    if (data.collections && data.collections[albumId]) {
      userVan = data.collections[albumId].van || [];
      userKell = data.collections[albumId].kell || [];
      vanCounts = data.collections[albumId].vanCounts || {};
    } else if (data[`collections.${albumId}`]) {
      userVan = data[`collections.${albumId}`].van || [];
      userKell = data[`collections.${albumId}`].kell || [];
      vanCounts = data[`collections.${albumId}`].vanCounts || {};
    } else if (albumId === 'lidl-lutra-2026' || !data.collections) {
      userVan = data.van || data.duplicates || [];
      userKell = data.kell || data.missing || [];
      vanCounts = data.vanCounts || {};
    }

    const vArr = ensureArray(userVan);
    const kArr = ensureArray(userKell);
    if (vArr.length > 0 || kArr.length > 0) collectors++;

    vArr.forEach(n => {
      dupes += (vanCounts && vanCounts[n]) ? vanCounts[n] : 1;
    });
  });

  return { collectors, dupes };
}

// =========================================================================
// HUB (KEZDŐLAP) RENDERELÉS: ÉLŐ GYŰJTŐ- ÉS DUPLASZÁMMAL!
// =========================================================================
function renderHub() {
  const container = document.getElementById('hub-albums-grid');
  const toggleBtn = document.getElementById('btn-toggle-all-hub-albums');
  const countSpan = document.getElementById('hub-total-albums-count');
  const searchInput = document.getElementById('hub-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();
  if (!container) return;

  updateHubSocialProofMetrics();
  const recentAlbumIds = safeJsonParse('cserelj_recent_albums', []);

  let list = Object.values(ALBUMS_REGISTRY).filter(album => {
    if (SCRAPER_JUNK_IDS.has(album.id) || /^(mind|kartya|matricaalbum|figura|kisauto)-\d+$/i.test(album.id)) {
      return false;
    }

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

  // HIERARCHIKUS RENDEZÉS
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

    // Élő közösségi mutatók lekérése az adott albumhoz
    const { collectors, dupes } = getAlbumLiveStats(album.id);
    const collectorsText = collectors > 0 ? `${collectors} gyűjtő` : 'Éledezve';
    const dupesText = dupes > 0 ? `${dupes.toLocaleString('hu-HU')} db dupla` : '0 dupla';

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

          <!-- ÉLŐ KÖZÖSSÉGI GYŰJTŐ- ÉS DUPLAMUTATÓ SÁV -->
          <div class="hub-card-stats-row">
            <span class="hub-stat-pill">👥 <strong>${collectorsText}</strong> gyűjti</span>
            <span class="hub-stat-pill">🔄 <strong>${dupesText}</strong></span>
          </div>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--sand); margin-top:4px;">
            <span>Saját: <strong>${collectedCount} / ${album.totalItems} db</strong></span>
            <strong>${pct}%</strong>
          </div>
          <div class="album-hub-progress-track">
            <div class="album-hub-progress-bar" style="width:${pct}%;"></div>
          </div>
          <div style="margin-top:10px;">
            <button class="btn btn-primary btn-sm" style="width:100%; font-size:0.82rem; padding:8px;" data-action="select-album" data-album-id="${escapeHtml(album.id)}">
              Megnyitás & Gyűjtés ➔
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('hub-search-input', 'input', () => renderHub());
safeAddListener('btn-toggle-all-hub-albums', () => { showAllHubAlbums = !showAllHubAlbums; renderHub(); });
safeAddListener('hub-albums-grid', (e) => {
  const btn = e.target.closest('[data-action="select-album"]');
  const card = e.target.closest('.album-hub-card');
  const albumId = btn?.dataset.albumId || card?.dataset.albumId;
  if (albumId) selectAlbum(albumId);
});

safeAddListener('btn-open-suggest-album', () => document.getElementById('modal-suggest-album')?.classList.add('open'));
safeAddListener('btn-close-suggest-album', () => document.getElementById('modal-suggest-album')?.classList.remove('open'));
safeAddListener('btn-close-suggest-album-2', () => document.getElementById('modal-suggest-album')?.classList.remove('open'));

safeAddListener('btn-submit-suggest-album', async () => {
  const title = document.getElementById('suggest-album-title')?.value.trim();
  const publisher = document.getElementById('suggest-album-publisher')?.value.trim() || 'Egyéb';
  const year = parseInt(document.getElementById('suggest-album-year')?.value || '2026', 10);
  const type = document.getElementById('suggest-album-type')?.value || 'sticker';
  const totalItems = parseInt(document.getElementById('suggest-album-total')?.value || '100', 10);
  const note = document.getElementById('suggest-album-note')?.value.trim() || '';

  if (!title) return showToast("Kérlek add meg a gyűjtemény nevét!");

  try {
    if (db) {
      await db.collection("album_suggestions").add({
        title, publisher, year, type, totalItems, note,
        submittedByUid: currentUser ? currentUser.uid : 'vendeg',
        submittedByName: myProfile.nev || 'Gyűjtő',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      });
    }
    if (document.getElementById('suggest-album-title')) document.getElementById('suggest-album-title').value = '';
    if (document.getElementById('suggest-album-note')) document.getElementById('suggest-album-note').value = '';
    document.getElementById('modal-suggest-album')?.classList.remove('open');
    showToast("Köszönjük! A javaslatodat elküldtük az adminisztrátornak.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

function updateRadarStoreDatalist() {
  const activeAlbum = getActiveAlbum();
  const datalist = document.getElementById('lidl-all-stores');
  const inputEl = document.getElementById('radar-input-store');
  if (!datalist || !inputEl) return;

  const chain = activeAlbum.radarType || (activeAlbum.hasRadar ? 'lidl' : 'none');
  datalist.innerHTML = '';

  const storeList = STORE_DATABASES[chain] || [];
  if (storeList.length > 0) {
    const chainName = chain === 'lidl' ? 'Lidl' : (activeAlbum.publisher || chain);
    inputEl.placeholder = `Válassz a(z) ${chainName} áruházak listájából...`;
    storeList.forEach(store => {
      const opt = document.createElement('option');
      opt.value = store;
      datalist.appendChild(opt);
    });
  } else {
    inputEl.placeholder = "Kezdd el gépelni a boltot vagy a várost...";
  }
}

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

  updateRadarStoreDatalist();
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
  
  // ÖNGYÓGYÍTÓ TISZTÍTÁS: fantom-foglalások lenullázása
  const activeLocks = getActiveLockedCounts(albumId);
  myProfile.foglalva = myProfile.foglalva.filter(n => (activeLocks[n] || 0) > 0 || (myProfile.foglalvaCounts[n] || 0) > 0);

  let savedNote = localStorage.getItem(`private_note_${albumId}`) || (albumId === 'lidl-lutra-2026' ? (localStorage.getItem('lutra_private_note') || '') : '');
  myProfile.privateNote = (savedNote || '').slice(0, 250);

  const noteInput = document.getElementById('prof-private-note');
  if (noteInput) {
    noteInput.value = myProfile.privateNote;
    const countEl = document.getElementById('note-char-count');
    if (countEl) countEl.textContent = `${myProfile.privateNote.length}/250`;
  }

  // Lapozó index biztonságos nullázása gyűjteményváltáskor
  currentChapterIndex = 0;

  renderGrid();
  renderActiveTradesPanel();
  if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();
  renderMatches();
}

document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedFilter = btn.dataset.hubFilter;
    document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentHubFilter = clickedFilter;
    renderHub();
  });
});

// =========================================================================
// RÁCS RENDERELÉS: SZABAD DUPLA + 🔒 DINAMIKUS LAKAT (LAKATVÉDELEMMEL)
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

function initAlbumSelect() {
  const sel = document.getElementById('album-chapter-select');
  if (!sel) return;
  const chapters = getActiveChapters();
  sel.innerHTML = '';
  chapters.forEach((f, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = f.cim;
    sel.appendChild(opt);
  });
  sel.onchange = (e) => {
    currentChapterIndex = parseInt(e.target.value, 10);
    renderAlbumChapter();
  };
}

function renderAlbumChapter() {
  const chapters = getActiveChapters();
  if (chapters.length === 0) return;
  initAlbumSelect();
  const container = document.getElementById('album-chapter-content');
  if (!container) return;

  if (currentChapterIndex >= chapters.length) currentChapterIndex = 0;
  const chapter = chapters[currentChapterIndex];
  if (!chapter) return;

  const sel = document.getElementById('album-chapter-select');
  if (sel) sel.value = currentChapterIndex;

  const btnPrev = document.getElementById('btn-album-prev');
  const btnNext = document.getElementById('btn-album-next');
  if (btnPrev) btnPrev.disabled = currentChapterIndex === 0;
  if (btnNext) btnNext.disabled = currentChapterIndex === chapters.length - 1;

  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));

  let totalInChapter = 0;
  let markedInChapter = 0;

  chapter.elemek.forEach(el => {
    const nums = el.type === 'combo' ? el.nums : [el.num];
    totalInChapter += nums.length;
    nums.forEach(n => {
      if (vanSet.has(n) || kellSet.has(n) || foglalvaSet.has(n)) markedInChapter++;
    });
  });

  const isLutra = currentAlbumId === 'lidl-lutra-2026';

  container.innerHTML = `
    <div class="page-header">
      <h3 class="page-title">${escapeHtml(chapter.cim)}</h3>
      <span class="page-progress">${markedInChapter} / ${totalInChapter} bejelölve</span>
    </div>
    <div class="slots-grid">
      ${chapter.elemek.map(el => {
        if (el.type === 'combo') {
          const [n1, n2] = el.nums;
          const isVan1 = vanSet.has(n1), isKell1 = kellSet.has(n1), isFog1 = foglalvaSet.has(n1);
          const isVan2 = vanSet.has(n2), isKell2 = kellSet.has(n2), isFog2 = foglalvaSet.has(n2);
          const q1 = isVan1 ? (myProfile.vanCounts[n1] || 1) : (myProfile.foglalvaCounts?.[n1] || 1);
          const q2 = isVan2 ? (myProfile.vanCounts[n2] || 1) : (myProfile.foglalvaCounts?.[n2] || 1);
          return `
            <div class="combo-wrapper">
              <div class="combo-title"><span>${escapeHtml(el.name)}</span></div>
              <div class="combo-halves">
                <div class="combo-half ${isVan1 ? 'van' : isKell1 ? 'kell' : isFog1 ? 'foglalva' : ''}" data-num="${n1}">
                  ${((isVan1 || isFog1) && q1 > 1) ? `<span class="qty-badge ${isFog1 ? 'foglalva' : ''}">×${q1}</span>` : ''}
                  <span class="sticker-num">${escapeHtml(getItemLabel(n1))}</span>
                  <span class="sticker-tag">${isVan1 ? 'Dupla' : isKell1 ? 'Kell' : isFog1 ? 'Foglalt' : 'Bal fél'}</span>
                </div>
                <div class="combo-half ${isVan2 ? 'van' : isKell2 ? 'kell' : isFog2 ? 'foglalva' : ''}" data-num="${n2}">
                  ${((isVan2 || isFog2) && q2 > 1) ? `<span class="qty-badge ${isFog2 ? 'foglalva' : ''}">×${q2}</span>` : ''}
                  <span class="sticker-num">${escapeHtml(getItemLabel(n2))}</span>
                  <span class="sticker-tag">${isVan2 ? 'Dupla' : isKell2 ? 'Kell' : isFog2 ? 'Foglalt' : 'Jobb fél'}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          const isVan = vanSet.has(el.num);
          const isKell = kellSet.has(el.num);
          const isFog = foglalvaSet.has(el.num);
          const q = isVan ? (myProfile.vanCounts[el.num] || 1) : (myProfile.foglalvaCounts?.[el.num] || 1);
          let cls = isVan ? 'van' : isKell ? 'kell' : isFog ? 'foglalva' : '';
          let orientClass = isLutra ? (el.orient === 'álló' ? 'orient-allo' : 'orient-fekvo') : 'orient-negyzet';

          return `
            <div class="slot ${orientClass} ${cls}" data-num="${el.num}">
              ${((isVan || isFog) && q > 1) ? `<span class="qty-badge ${isFog ? 'foglalva' : ''}">×${q}</span>` : ''}
              <span class="sticker-num">${escapeHtml(getItemLabel(el.num))}</span>
              <span class="sticker-name">${escapeHtml(el.name)}</span>
              <span class="sticker-tag">${isVan ? 'Dupla' : isKell ? 'Hiányzik' : isFog ? 'Foglalt' : 'Üres'}</span>
            </div>
          `;
        }
      }).join('')}
    </div>
  `;
}

safeAddListener('btn-mode-grid', () => {
  document.getElementById('btn-mode-grid')?.classList.add('active');
  document.getElementById('btn-mode-album')?.classList.remove('active');
  if (document.getElementById('grid-view-container')) document.getElementById('grid-view-container').style.display = 'block';
  if (document.getElementById('album-view-container')) document.getElementById('album-view-container').style.display = 'none';
  renderGrid();
});

safeAddListener('btn-mode-album', () => {
  document.getElementById('btn-mode-album')?.classList.add('active');
  document.getElementById('btn-mode-grid')?.classList.remove('active');
  if (document.getElementById('grid-view-container')) document.getElementById('grid-view-container').style.display = 'none';
  if (document.getElementById('album-view-container')) document.getElementById('album-view-container').style.display = 'block';
  renderAlbumChapter();
});

safeAddListener('btn-album-prev', () => {
  if (currentChapterIndex > 0) { currentChapterIndex--; renderAlbumChapter(); }
});

safeAddListener('btn-album-next', () => {
  const chapters = getActiveChapters();
  if (currentChapterIndex < chapters.length - 1) { currentChapterIndex++; renderAlbumChapter(); }
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 2 / 4. RÉSZ: 0 MS INTERAKCIÓK, UNDO, SZŰRŐK, PÁROSÍTÁSOK & CSERE-TERVEZŐ
// =========================================================================

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');

// =========================================================================
// ⚡ 0 MS CIKLUS LAKATVÉDELEMMEL ÉS 1-KATTINTÁSOS VISSZAVONÁSSAL (UNDO)
// =========================================================================
function toggleStickerState(num) {
  hideQtyPopover();

  if (getActiveAlbum().active === false) {
    showToast("Ez a gyűjtemény inaktív, reaktiválásig nem szerkeszthető!");
    return;
  }

  // Lakatvédelem ellenőrzése aktív megegyezéseknél
  const activeLocks = getActiveLockedCounts(currentAlbumId);
  if (activeLocks[num] && activeLocks[num] > 0 && myProfile.van.includes(num)) {
    showToast(`🔒 A #${num} tétel zárolva van egy aktív csere miatt!`);
    return;
  }

  // Előző állapot mentése az egykattintásos visszavonáshoz (Undo)
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

  const albumSlots = document.querySelectorAll(`[data-num="${num}"]`);
  albumSlots.forEach(el => {
    if (el.classList.contains('slot') || el.classList.contains('combo-half')) {
      el.classList.remove('van', 'kell', 'foglalva');
      if (state) el.classList.add(state);
      const tag = el.querySelector('.sticker-tag');
      if (tag) {
        tag.textContent = state === 'van' ? 'Dupla' : state === 'kell' ? 'Hiányzik' : state === 'foglalva' ? 'Foglalt' : 'Üres';
      }
    }
  });
}

function showQtyPopover(num, targetEl) {
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

  // Mentés a subcollection-be
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

  // Mentés a fő dokumentumba is beágyazott mezőként (Single Source of Truth)
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

  if (albumId === 'lidl-lutra-2026') {
    localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
    localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
    localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
    localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
    localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
  }

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    refreshMatchesIfVisible();
    if (typeof renderCompletionOdds === 'function') renderCompletionOdds();
    syncLutraDualSave(albumId);
  }, 450);
}

function saveMyState() {
  saveMyStateFast();
  renderGrid();
  renderHub();
}

// 🛡️ DARABSZÁM POPOVER JAVÍTVA: NEM SZÁMOL DUPLÁN A STATISZTIKÁBAN!
document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    const num = activePopoverNum;

    // Ha duplára állítjuk a tételt, azonnal kitöröljük a kell-ből és a foglaltból!
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) {
      myProfile.foglalva.splice(fIdx, 1);
      if (myProfile.foglalvaCounts) delete myProfile.foglalvaCounts[num];
    }

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
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
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
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
    count++;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Hiányzókhoz.`);
});

safeAddListener('btn-apply-batch-foglalva', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.keys(parsed).forEach(nStr => {
    const num = parseInt(nStr, 10);
    if (!myProfile.foglalva.includes(num)) myProfile.foglalva.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    count++;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Foglalthoz.`);
});

safeAddListener('btn-copy-fb-post', () => {
  const activeAlbum = getActiveAlbum();
  const vanSorted = [...myProfile.van].sort((a, b) => a - b);
  const kellSorted = [...myProfile.kell].sort((a, b) => a - b);
  const vanText = vanSorted.length ? vanSorted.map(n => {
    const q = myProfile.vanCounts[n] || 1;
    const label = getItemLabel(n, currentAlbumId);
    return q > 1 ? `${label} (${q}db)` : label;
  }).join(', ') : 'Nincs duplám';
  const kellText = kellSorted.length ? kellSorted.map(n => getItemLabel(n, currentAlbumId)).join(', ') : 'Minden megvan!';
  const userCity = myProfile.telepules ? ` (${myProfile.telepules})` : '';

  const fbPost = `${activeAlbum.title} cserebere!\nGyűjtő: ${myProfile.nev}${userCity}\n\nDUPLÁK (${vanSorted.length} féle):\n${vanText}\n\nHIÁNYZIK (${kellSorted.length} db):\n${kellText}\n\nCseréljünk itt: ${window.location.href}`;
  navigator.clipboard.writeText(fbPost);
  showToast("Csereposzt kimásolva a vágólapra!");
});

// =========================================================================
// ROUTER & NÉZETVÁLTÓ MOTOR
// =========================================================================

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

  if (viewName === 'hub') renderHub();
  if (viewName === 'cserek') renderMatches();
  if (viewName === 'kereso') renderProximityPartners();
  if (viewName === 'statisztika') {
    if (typeof renderStatistics === 'function') renderStatistics();
    if (typeof renderCompletionOdds === 'function') renderCompletionOdds();
    if (typeof renderHeatmap === 'function') renderHeatmap();
  }
  if (viewName === 'radar') {
    if (typeof renderRadarReports === 'function') renderRadarReports();
    const rBadge = document.getElementById('radar-badge');
    if (rBadge) rBadge.style.display = 'none';
  }
  if (viewName === 'meetups') {
    if (typeof renderMeetups === 'function') renderMeetups();
    const mBadge = document.getElementById('meetup-badge');
    if (mBadge) mBadge.style.display = 'none';
    updateCserebereBadge();
  }
  if (viewName === 'uzeneteim') {
    if (typeof renderMessages === 'function') renderMessages();
    const badge = document.getElementById('unread-msg-badge');
    const badgeM = document.getElementById('unread-msg-badge-m');
    if (badge) badge.classList.add('read');
    if (badgeM) badgeM.classList.add('read');
    updateCserebereBadge();
  }
  if (viewName === 'matricaim') {
    renderGrid();
    renderActiveTradesPanel();
    if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();
  }
  if (viewName === 'admin') {
    if (typeof renderAdminAnnouncements === 'function') renderAdminAnnouncements();
    if (typeof renderAdminAlbumsList === 'function') renderAdminAlbumsList();
    if (typeof renderAdminSuggestionsList === 'function') renderAdminSuggestionsList();
  }
  if (viewName === 'profil') {
    initFavoriteSelects();
    if (typeof renderProfileLocations === 'function') renderProfileLocations();
  }
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

function updateCserebereBadge() {
  const badge = document.getElementById('cserebere-badge');
  if (!badge) return;
  const unreadMsgBadge = document.getElementById('unread-msg-badge');
  const hasUnread = unreadMsgBadge && unreadMsgBadge.style.display !== 'none' && !unreadMsgBadge.classList.contains('read');
  badge.style.display = hasUnread ? 'inline-block' : 'none';
}

// =========================================================================
// GPS ÉS TÁVOLSÁG MEGHATÁROZÁSA
// =========================================================================

function getUserCoordinates(userObj) {
  if (userObj.geo && typeof userObj.geo.lat === 'number') {
    return userObj.geo;
  }
  const normList = extractNormalizedLocations(userObj.locations && userObj.locations.length > 0 ? userObj.locations : userObj.telepules);
  for (const loc of normList) {
    if (CITY_COORDINATES[loc.canonicalKey]) {
      return { lat: CITY_COORDINATES[loc.canonicalKey].lat, lng: CITY_COORDINATES[loc.canonicalKey].lng };
    }
  }
  return null;
}

function getUserAllCoordinates(userObj) {
  const coords = [];
  if (userObj.geo && typeof userObj.geo.lat === 'number') {
    coords.push(userObj.geo);
  }
  const normList = extractNormalizedLocations(userObj.locations && userObj.locations.length > 0 ? userObj.locations : userObj.telepules);
  normList.forEach(loc => {
    if (CITY_COORDINATES[loc.canonicalKey]) {
      coords.push({ lat: CITY_COORDINATES[loc.canonicalKey].lat, lng: CITY_COORDINATES[loc.canonicalKey].lng });
    }
  });
  return coords;
}

function getMinDistanceToUser(myCoords, targetUser) {
  if (!myCoords) return null;
  const targetCoordsList = getUserAllCoordinates(targetUser);
  if (targetCoordsList.length === 0) return null;

  let minDist = Infinity;
  targetCoordsList.forEach(c => {
    const d = calculateDistanceKm(myCoords.lat, myCoords.lng, c.lat, c.lng);
    if (d !== null && d < minDist) minDist = d;
  });

  return minDist === Infinity ? null : minDist;
}

function requestGpsLocation(callback) {
  const statusEl = document.getElementById('search-gps-status');
  if (!navigator.geolocation) {
    showToast("A böngésződ nem támogatja a GPS helymeghatározást.");
    if (callback) callback(false);
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = '<span style="color:var(--amber);">📍 Helyzet bemérése folyamatban...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myGpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myProfile.geo = myGpsCoords;
      localStorage.setItem('cserelj_gps_coords', JSON.stringify(myGpsCoords));
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:var(--moss-soft);">✓ Helyzet sikeresen bemérve! Távolsági szűrők aktívak.</span>';
      }
      showToast("GPS koordináták rögzítve!");
      renderMatches();
      renderProximityPartners();
      if (callback) callback(true);
    },
    (err) => {
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:var(--danger);">Nem sikerült lekérni a GPS pozíciót.</span>';
      }
      showToast("GPS hiba: " + err.message);
      if (callback) callback(false);
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

safeAddListener('btn-search-gps-locate', () => requestGpsLocation());

document.querySelectorAll('#search-radius-group .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const radius = btn.dataset.radius;
    document.querySelectorAll('#search-radius-group .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSearchRadius = radius;
    proximityDisplayLimit = 25;

    if (radius !== 'all' && radius !== 'city' && !myGpsCoords) {
      requestGpsLocation(() => renderProximityPartners());
    } else {
      renderProximityPartners();
    }
  });
});

// =========================================================================
// KOMBINÁLHATÓ PÁROSÍTÁSI SZŰRŐK (VAGY-VAGY ÉS EGYMÁSRA ÉPÜLŐ SZŰRÉS)
// =========================================================================

let filterSameCity = false;
let filterGiftOnly = false;
let filterLoopOnly = false;

safeAddListener('btn-match-all', 'click', function() {
  filterTargetCity = '';
  filterSameCity = false;
  filterGiftOnly = false;
  filterLoopOnly = false;
  document.querySelectorAll('#matches-filter-group .filter-btn').forEach(b => b.classList.remove('active'));
  this.classList.add('active');
  renderMatches();
});

safeAddListener('btn-match-city', 'click', function() {
  if (!myProfile.telepules && (!myProfile.locations || myProfile.locations.length === 0)) {
    return showToast("Előbb add meg a településed a Profil fülön!");
  }
  filterTargetCity = '';
  filterLoopOnly = false;
  document.getElementById('btn-match-loop')?.classList.remove('active');
  document.getElementById('btn-match-all')?.classList.remove('active');

  filterSameCity = !filterSameCity;
  this.classList.toggle('active', filterSameCity);
  checkAllFilterReset();
  renderMatches();
});

safeAddListener('btn-match-gift', 'click', function() {
  filterTargetCity = '';
  filterLoopOnly = false;
  document.getElementById('btn-match-loop')?.classList.remove('active');
  document.getElementById('btn-match-all')?.classList.remove('active');

  filterGiftOnly = !filterGiftOnly;
  this.classList.toggle('active', filterGiftOnly);
  checkAllFilterReset();
  renderMatches();
});

safeAddListener('btn-match-loop', 'click', function() {
  filterTargetCity = '';
  filterSameCity = false;
  filterGiftOnly = false;
  document.querySelectorAll('#matches-filter-group .filter-btn').forEach(b => b.classList.remove('active'));
  
  filterLoopOnly = !filterLoopOnly;
  this.classList.toggle('active', filterLoopOnly);
  if (!filterLoopOnly) document.getElementById('btn-match-all')?.classList.add('active');
  renderMatches();
});

function checkAllFilterReset() {
  if (!filterSameCity && !filterGiftOnly && !filterLoopOnly) {
    document.getElementById('btn-match-all')?.classList.add('active');
  }
}

safeAddListener('btn-refresh-matches', () => {
  renderMatches();
  showToast("Párosítások frissítve.");
});

function refreshMatchesIfVisible() {
  const v = document.getElementById('view-cserek');
  if (v && v.classList.contains('active')) renderMatches();
}

function computeLoopMatches() {
  const myId = currentUser ? currentUser.uid : 'me';
  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const otherUsers = allUsersData.filter(u => u.id !== myId && !u.isVacation);
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

// =========================================================================
// PÁROSÍTÁSOK MEGJELENÍTÉSE (AKTÍVAK ELŐRESOROLÁSÁVAL & VAGY-VAGY SZŰRÉSSEL)
// =========================================================================

function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const myCoords = myGpsCoords || getUserCoordinates(myProfile);

  if (filterLoopOnly) {
    const loops = computeLoopMatches();
    if (loops.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align:center; padding:20px;">
          <h3 style="margin:0 0 6px;">Nincs elérhető 3 fős körcsere</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
            Ahogy több gyűjtő rögzíti a dupláit, a rendszer automatikusan felajánlja a 3 fős kombinációkat!
          </p>
        </div>`;
      return;
    }

    list.innerHTML = `
      <div class="notice-banner" style="margin-bottom:12px;">
        <span><strong>Körcsere javaslat:</strong> Te adsz B-nek, B ad C-nek, C pedig ad Neked!</span>
      </div>
      ${loops.slice(0, 10).map((l, loopIdx) => `
        <div class="card ${l.isLocalLoop ? 'card-local' : ''}">
          <div class="card-header-row">
            <h3 style="margin:0;">Körcsere: Te ➔ ${escapeHtml(l.userB.nev || 'B')} ➔ ${escapeHtml(l.userC.nev || 'C')} ➔ Te</h3>
            ${l.isLocalLoop ? '<span class="badge-local">Helyi csere</span>' : ''}
          </div>
          <div style="font-size:0.85rem; margin:8px 0; background:rgba(0,0,0,0.25); padding:8px; border-radius:var(--radius-sm); line-height:1.6;">
            <p style="margin:0;">1. <strong>Te adsz neki:</strong> ${escapeHtml(l.userB.nev)} (${escapeHtml(l.userB.telepules || '')}) ➔ ${l.giveToB.map(n => getItemLabel(n)).join(', ')}</p>
            <p style="margin:0;">2. <strong>Ő ad tovább:</strong> ${escapeHtml(l.userB.nev)} ad ${escapeHtml(l.userC.nev)}-nek ➔ ${l.giveBtoC.map(n => getItemLabel(n)).join(', ')}</p>
            <p style="margin:0; color:var(--moss-soft);">3. <strong>Te kapsz tőle:</strong> ${escapeHtml(l.userC.nev)} (${escapeHtml(l.userC.telepules || '')}) ➔ ${l.giveCtoMe.map(n => getItemLabel(n)).join(', ')}</p>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-primary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-b" data-loop-idx="${loopIdx}">
              Üzenet: ${escapeHtml(l.userB.nev)}
            </button>
            <button class="btn btn-secondary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-c" data-loop-idx="${loopIdx}">
              Üzenet: ${escapeHtml(l.userC.nev)}
            </button>
          </div>
        </div>
      `).join('')}
    `;
    return;
  }

  let matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me') && !u.isVacation)
    .map(u => {
      const uVanSet = new Set(ensureArray(u.van));
      const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
      
      const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
      const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      const score = Math.min(give.length, get.length);

      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const isGift = u.isGiftOffering === true;
      const distanceKm = getMinDistanceToUser(myCoords, u);
      const updatedAgo = formatTimeAgo(u.updatedAt);

      // Frissességi előny: az elmúlt 5 napban frissített vagy belépett felhasználók előrekerülnek
      const isRecentlyActive = updatedAgo.includes('ma') || updatedAgo.includes('tegnap') || (parseInt(updatedAgo, 10) <= 5);

      return { ...u, give, get, score, isSameCity, isGift, distanceKm, updatedAgo, isRecentlyActive };
    })
    .filter(m => m.score > 0 || (m.isGift && m.get.length > 0));

  // Hőtérképről indított pontos településszűrés
  if (filterTargetCity) {
    matches = matches.filter(m => isLocalCityMatch(filterTargetCity, m.locations || m.telepules));
  } else {
    if (filterSameCity) matches = matches.filter(m => m.isSameCity);
    if (filterGiftOnly) matches = matches.filter(m => m.isGift);
  }

  // RENDEZÉSI HIERARCHIA: 1. Helyi egyezés ➔ 2. Friss aktivitás ➔ 3. Csereérték (Score) ➔ 4. Távolság
  matches.sort((a, b) => {
    if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
    if (b.isRecentlyActive !== a.isRecentlyActive) return (b.isRecentlyActive ? 1 : 0) - (a.isRecentlyActive ? 1 : 0);
    if (b.score !== a.score) return b.score - a.score;
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    return 0;
  });

  if (matches.length === 0) {
    list.innerHTML = `<p class="view-intro">${filterTargetCity ? `Nincs cserepartner a(z) ${filterTargetCity} településen.` : 'Jelenleg nincs a beállított szűrésnek megfelelő cserepartner.'}</p>`;
    return;
  }

  list.innerHTML = matches.map((m) => {
    const isCheckedInPlan = selectedTradePlanUids.has(m.id);
    const distText = m.distanceKm !== null ? `📍 kb. ${m.distanceKm} km` : (m.isSameCity ? '📍 Helyi gyűjtő' : '');
    const timeText = m.updatedAgo ? `• 🕒 ${m.updatedAgo}` : '';
    const trustBadge = m.ratingsCount > 0 
      ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${(m.trustScore / m.ratingsCount).toFixed(1)} (${m.ratingsCount})</span>`
      : (m.trustScore > 0 ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${m.trustScore}</span>` : '<span style="font-size:0.72rem; color:var(--text-muted);">⭐ Új gyűjtő</span>');

    return `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''} ${trustBadge}
          </h3>
          <div style="font-size:0.75rem; color:var(--amber); font-weight:600; margin-top:2px;">
            ${distText} ${timeText}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          ${m.isSameCity ? '<span class="badge-local">Helyi csere</span>' : ''}
          ${m.isGift ? '<span class="badge-gift">Ingyen felajánló</span>' : ''}
          <span class="badge-ratio">${m.give.length} db ⇄ ${m.get.length} db</span>
        </div>
      </div>
      <p style="margin:4px 0;"><strong>Te adnád neki:</strong> ${m.give.length ? m.give.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándékba kapod)</em>'}</p>
      <p style="margin:4px 0;"><strong>Ő adná neked:</strong> ${m.get.map(n => {
        const qty = (m.vanCounts && m.vanCounts[n] > 1) ? ` (${m.vanCounts[n]} db)` : '';
        return `${getItemLabel(n)}${qty}`;
      }).join(', ')}</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid rgba(243,238,223,0.1); padding-top:8px;">
        <label class="checkbox-label" style="margin:0; font-size:0.8rem; color:var(--sand); font-weight:600;">
          <input type="checkbox" class="trade-plan-check" data-uid="${escapeHtml(m.id)}" ${isCheckedInPlan ? 'checked' : ''}>
          Hozzáadás a Csere-tervhez
        </label>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(m.id)}">
            Csereindítás
          </button>
          <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            Adatlap
          </button>
        </div>
      </div>
    </div>
  `}).join('');

  updateTradePlannerBar();
}

safeAddListener('matches-list', 'change', (e) => {
  const check = e.target.closest('.trade-plan-check');
  if (!check) return;
  const uid = check.dataset.uid;
  if (check.checked) selectedTradePlanUids.add(uid);
  else selectedTradePlanUids.delete(uid);
  updateTradePlannerBar();
});

function updateTradePlannerBar() {
  const bar = document.getElementById('trade-planner-floating-bar');
  const countSpan = document.getElementById('planner-selected-count');
  const topBtn = document.getElementById('btn-top-open-planner');
  const topCount = document.getElementById('planner-top-count');

  const count = selectedTradePlanUids.size;
  if (countSpan) countSpan.textContent = count;
  if (topCount) topCount.textContent = count;

  if (count >= 2) {
    if (bar) bar.style.display = 'flex';
    if (topBtn) topBtn.style.display = 'inline-flex';
  } else {
    if (bar) bar.style.display = 'none';
    if (topBtn) topBtn.style.display = 'none';
  }
}

safeAddListener('btn-clear-trade-plan', () => {
  selectedTradePlanUids.clear();
  tradePlanManualOverrides = {};
  document.querySelectorAll('.trade-plan-check').forEach(c => c.checked = false);
  updateTradePlannerBar();
});

safeAddListener('btn-open-trade-planner', () => {
  renderTradePlannerModal();
  document.getElementById('modal-trade-planner')?.classList.add('open');
});
safeAddListener('btn-top-open-planner', () => {
  renderTradePlannerModal();
  document.getElementById('modal-trade-planner')?.classList.add('open');
});

safeAddListener('btn-close-trade-planner', () => document.getElementById('modal-trade-planner')?.classList.remove('open'));
safeAddListener('btn-close-trade-planner-2', () => document.getElementById('modal-trade-planner')?.classList.remove('open'));

function renderTradePlannerModal() {
  const conflictBox = document.getElementById('trade-plan-conflicts-section');
  const breakdownBox = document.getElementById('trade-plan-partners-breakdown');
  const summaryBox = document.getElementById('trade-plan-summary-box');

  if (!conflictBox || !breakdownBox || !summaryBox) return;

  const selectedUsers = allUsersData.filter(u => selectedTradePlanUids.has(u.id));
  if (selectedUsers.length < 2) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));

  const stickerDemandMap = {};
  selectedUsers.forEach(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
    
    const totalGivesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).length;
    const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);

    [...myVanSet].filter(n => uKellSet.has(n)).forEach(stickerNum => {
      if (!stickerDemandMap[stickerNum]) stickerDemandMap[stickerNum] = [];
      stickerDemandMap[stickerNum].push({ user: u, totalGivesToMe, isSameCity });
    });
  });

  const conflicts = [];
  const allocation = {};
  selectedUsers.forEach(u => allocation[u.id] = []);

  Object.entries(stickerDemandMap).forEach(([nStr, demandList]) => {
    const num = parseInt(nStr, 10);
    const myQty = myProfile.vanCounts?.[num] || 1;

    if (demandList.length > myQty) {
      conflicts.push({ num, demandList, myQty });

      let assignedUid = tradePlanManualOverrides[num];
      if (!assignedUid) {
        const sortedCandidate = [...demandList].sort((a, b) => {
          if (b.totalGivesToMe !== a.totalGivesToMe) return b.totalGivesToMe - a.totalGivesToMe;
          if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
          return 0;
        })[0];
        assignedUid = sortedCandidate.user.id;
      }
      if (allocation[assignedUid]) allocation[assignedUid].push(num);
    } else {
      demandList.forEach(d => {
        if (allocation[d.user.id]) allocation[d.user.id].push(num);
      });
    }
  });

  if (conflicts.length === 0) {
    conflictBox.innerHTML = `
      <div class="notice-banner" style="background:rgba(107,138,90,0.15); border-color:var(--moss-soft); color:var(--text-primary);">
        <strong>Nincs ütközés:</strong> Mind a ${selectedUsers.length} partnernek jut az általuk kért összes dupládból!
      </div>
    `;
  } else {
    conflictBox.innerHTML = `
      <div class="card" style="border:1.5px solid var(--danger); background:rgba(232,90,79,0.12);">
        <h4 style="margin:0 0 6px; color:#FFC0BA; font-size:0.95rem;">Ütköző tételek (${conflicts.length} db)</h4>
        <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 10px;">
          Ezeket a tételeket többen kérik, mint amennyi duplád van:
        </p>
        ${conflicts.map(c => {
          const currentWinnerUid = tradePlanManualOverrides[c.num] || [...c.demandList].sort((a, b) => {
            if (b.totalGivesToMe !== a.totalGivesToMe) return b.totalGivesToMe - a.totalGivesToMe;
            if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
            return 0;
          })[0].user.id;

          const label = getItemFullName(c.num, currentAlbumId);

          return `
            <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div>
                <strong>${escapeHtml(label)}</strong> (Készlet: ${c.myQty} db)
              </div>
              <div style="display:flex; gap:8px;">
                ${c.demandList.map(d => `
                  <label class="radio-label" style="margin:0; font-size:0.75rem; color:${d.user.id === currentWinnerUid ? 'var(--amber)' : 'var(--text-muted)'};">
                    <input type="radio" name="conflict-sticker-${c.num}" value="${d.user.id}" ${d.user.id === currentWinnerUid ? 'checked' : ''} data-action="override-conflict" data-num="${c.num}">
                    ${escapeHtml(d.user.nev)} ${d.isSameCity ? '(Helyi)' : ''} (+${d.totalGivesToMe} db)
                  </label>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let totalNewStickersGained = new Set();
  let totalStickersGivenCount = 0;
  const gainedStickerCounts = {};

  breakdownBox.innerHTML = selectedUsers.map(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const givesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
    
    givesToMe.forEach(n => {
      totalNewStickersGained.add(n);
      gainedStickerCounts[n] = (gainedStickerCounts[n] || 0) + 1;
    });

    const allocatedToHim = (allocation[u.id] || []).sort((a, b) => a - b);
    totalStickersGivenCount += allocatedToHim.length;

    return `
      <div class="card" style="margin-bottom:8px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <h4 style="margin:0; font-size:0.92rem;">${escapeHtml(u.nev)} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''}</h4>
          <span style="font-size:0.75rem; color:var(--amber); font-weight:700;">+${givesToMe.length} új tétel tőle</span>
        </div>
        <div style="font-size:0.8rem; line-height:1.5;">
          <p style="margin:2px 0;"><strong>Neki adod a terv szerint (${allocatedToHim.length} db):</strong> ${allocatedToHim.length ? allocatedToHim.map(n => getItemLabel(n)).join(', ') : '<em>(Nem jut neki dupla)</em>'}</p>
          <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle kapod (${givesToMe.length} db):</strong> ${givesToMe.map(n => getItemLabel(n)).join(', ')}</p>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-planned-partner" data-uid="${escapeHtml(u.id)}" data-give="${allocatedToHim.join(',')}" data-get="${givesToMe.join(',')}">
            Csereindítás (${escapeHtml(u.nev)})
          </button>
        </div>
      </div>
    `;
  }).join('');

  const formattedGainedList = [...totalNewStickersGained].sort((a, b) => a - b).map(n => {
    const qty = gainedStickerCounts[n] || 1;
    const label = getItemLabel(n, currentAlbumId);
    if (qty > 1) {
      return `<strong style="white-space: nowrap; color: var(--amber); background: rgba(216,155,74,0.18); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(216,155,74,0.4);">${escapeHtml(label)} (${qty} db)</strong>`;
    }
    return `<span style="white-space: nowrap;">${escapeHtml(label)}</span>`;
  }).join(', ');

  summaryBox.innerHTML = `
    <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--amber); margin-bottom:4px; font-weight:700;">
      Szimulált Végeredmény (${selectedUsers.length} csere után):
    </div>
    <div style="font-size:1.15rem; font-weight:800; color:#FFF;">
      +${totalNewStickersGained.size} új tétel az albumodba • -${totalStickersGivenCount} elcserélt dupla
    </div>
    <p style="font-size:0.78rem; color:var(--sand); margin:6px 0 0; line-height:1.6;">
      Megszerzett tételek: ${formattedGainedList}
    </p>
  `;
}

safeAddListener('trade-plan-conflicts-section', 'change', (e) => {
  const radio = e.target.closest('[data-action="override-conflict"]');
  if (!radio) return;
  const num = parseInt(radio.dataset.num, 10);
  tradePlanManualOverrides[num] = radio.value;
  renderTradePlannerModal();
});

safeAddListener('trade-plan-partners-breakdown', 'click', (e) => {
  const btn = e.target.closest('[data-action="contact-planned-partner"]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return;

  const giveNums = ensureArray(btn.dataset.give || '');
  const getNums = ensureArray(btn.dataset.get || '');

  document.getElementById('modal-trade-planner')?.classList.remove('open');
  openContactModal(targetUser, giveNums, getNums, targetUser.isGiftOffering);
});

// PÁROSÍTÁSOK KATTINTÁSKEZELŐJE
safeAddListener('matches-list', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'contact-match') {
    const uid = btn.dataset.uid;
    const targetUser = allUsersData.find(u => u.id === uid);
    if (!targetUser) return;
    const myVanSet = new Set(ensureArray(myProfile.van));
    const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
    const uVanSet = new Set(ensureArray(targetUser.van));
    const uKellSet = new Set(ensureArray(targetUser.kell).filter(n => !uVanSet.has(n)));
    const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
    const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
    openContactModal(targetUser, give, get, targetUser.isGiftOffering);
  } else if (action === 'inspect-user') {
    openUserProfileModal(btn.dataset.uid);
  } else if (action === 'contact-loop-b' || action === 'contact-loop-c') {
    const loopIdx = parseInt(btn.dataset.loopIdx, 10);
    const loops = computeLoopMatches();
    const loop = loops[loopIdx];
    if (!loop) return;
    if (action === 'contact-loop-b') {
      openLoopContactModal(loop.userB, loop.userC, loop.giveToB, loop.giveBtoC, loop.giveCtoMe, 'B');
    } else {
      openLoopContactModal(loop.userC, loop.userB, loop.giveCtoMe, loop.giveToB, loop.giveBtoC, 'C');
    }
  }
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 3 / 4. RÉSZ: KÉTOLDALÚ CSEREKÖVETÉS, FELUGRÓ ABLAKOK, 4 KERESŐ & FB ELEMZŐ
// =========================================================================

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();
let activeTradeClosingData = null;
let activeTradeCancellingIdx = null;
let activePromptTradeData = null;
let fbMatchUploadedBase64 = '';

// =========================================================================
// KIIKSZELŐS KAPCSOLATFELVÉTELI RENDSZER (EGYEDI AJÁNLAT BEÉPÍTÉSÉVEL)
// =========================================================================

function checkSenderProfileReady() {
  if (!currentUser) {
    showToast("Előbb lépj be a fiókodba a kapcsolatfelvételhez!");
    document.getElementById('modal-auth')?.classList.add('open');
    return false;
  }

  // Automatikus kitöltés a Google / Auth adataival, ha még nem mentett profilból
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

// 3 FŐS KÖRCSERE: SABLONÜZENETBEN VÉGIGVEZETJÜK A TELJES LÁNCOT!
function openLoopContactModal(targetUser, otherPartner, myGive, theirGive, myReceive, role) {
  if (!checkSenderProfileReady()) return;
  const activeAlbum = getActiveAlbum();

  const msg = `Szia ${targetUser.nev}!\n\nA Cserélj Okosan oldalon egy 3 fős körcsere adódott a(z) ${activeAlbum.title} albumban:\n\n1. Én (${myProfile.nev}) adom neked: ${myGive.map(n => getItemLabel(n)).join(', ')}\n2. Te adod tovább ${otherPartner.nev}-nek: ${theirGive.map(n => getItemLabel(n)).join(', ')}\n3. ${otherPartner.nev} adja nekem: ${myReceive.map(n => getItemLabel(n)).join(', ')}\n\nÍgy mindhárman megkapjuk a hiányzóinkat! Benne vagy a lebonyolításban?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;

  openContactModal(targetUser, myGive, [], false, msg);
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
  if (!giveTextPart) giveTextPart = '(egyeztetés alatt)';

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

// BELSŐ ÜZENET KÜLDÉSE & KÉTOLDALÚ CSEREINDÍTÁS
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

      // 1. Csere rögzítése a rács alatt
      if (autoCreateTrade && (effectiveGiveNums.length > 0 || effectiveGetNums.length > 0)) {
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
          createdAt: Date.now(),
          status: 'pending_acceptance', // A partner elfogadására vár!
          isInitiator: true
        };

        myProfile.activeTrades.unshift(newTradeObj);

        // Csak a feladónál zároljuk a felajánlott duplákat!
        effectiveGiveNums.forEach(n => {
          if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
          if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
          myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
        });

        saveMyState();
        renderActiveTradesPanel();
        renderGrid();

        // Közös csere mentése a Firestore-ba a partner értesítéséhez
        if (db) {
          db.collection("trades").doc(tradeId).set({
            ...newTradeObj,
            serverCreatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(e => console.warn("Trade save:", e));
        }
      }

      // 2. Üzenet mentése a Firestore-ba
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
            receivingItems: effectiveGetNums
          } : null,
          subject: activeContactTarget.subject,
          message: messageText,
          text: messageText,
          read: false,
          readAt: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // 3. E-mail értesítő kiküldése Cloudflare Worker segítségével
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

safeAddListener('btn-copy-partner-email', () => {
  const email = document.getElementById('contact-partner-email')?.textContent || '';
  if (!email) return showToast("Nincs másolható e-mail cím.");
  navigator.clipboard.writeText(email);
  showToast("Partner e-mail címe kimásolva.");
});

// =========================================================================
// RÁCS ALATTI CSERÉK & ZÁROLÁSOK (KÉTOLDALÚ JÓVÁHAGYÁS, POSTÁZÁS & LEMONDÁS)
// =========================================================================

function renderActiveTradesPanel() {
  const panel = document.getElementById('active-trades-panel');
  const list = document.getElementById('active-trades-list');
  const countSpan = document.getElementById('active-trades-count');
  const subnavBadge = document.getElementById('badge-trades-count');

  if (!panel || !list) return;

  const allTrades = myProfile.activeTrades || [];
  const pendingTrades = allTrades.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTrades = allTrades.filter(t => t.status === 'completed');

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
        statusBadge = `<span class="badge-trade-status badge-status-waiting">⏳ Elfogadásodra vár</span>`;
      } else if (isWaitingPartnerAcceptance) {
        statusBadge = `<span class="badge-trade-status badge-status-waiting">⏳ Partner jóváhagyására vár</span>`;
      } else if (isShipped) {
        statusBadge = `<span class="badge-trade-status badge-status-shipped">📦 Csomag postázva</span>`;
      } else {
        statusBadge = `<span class="badge-trade-status badge-status-reserved">🔒 Mindkét félnél zárolva</span>`;
      }

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
            <p style="margin:2px 0;"><strong>Te adod:</strong> ${t.givingItems && t.givingItems.length ? t.givingItems.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándék kapás)</em>'}</p>
            <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle kapod:</strong> ${t.receivingItems && t.receivingItems.length ? t.receivingItems.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándék adás)</em>'}</p>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              ${isWaitingMyAcceptance ? `
                <button class="btn btn-contact-green btn-sm" data-action="accept-trade" data-trade-idx="${originalIdx}">
                  ✓ Elfogadom & Tételek zárolása
                </button>
              ` : ''}

              ${(isAccepted || isShipped) ? `
                <button class="btn btn-contact-green btn-sm" data-action="complete-trade" data-trade-idx="${originalIdx}">
                  ✓ Megérkezett / Csere lezárása
                </button>
                <button class="btn btn-secondary btn-sm" data-action="ship-trade" data-trade-idx="${originalIdx}" style="border-color:var(--amber); color:var(--amber);">
                  📦 ${isShipped ? 'Postázva jelölve' : 'Csomag feladva'}
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
          ▶ Korábbi sikeres cseréid (${completedTrades.length} db lezárva)
        </summary>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${completedTrades.map(t => `
            <div style="background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:var(--radius-sm); font-size:0.76rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong style="color:var(--text-primary);">${escapeHtml(t.partnerName)}</strong> (${escapeHtml(t.partnerCity || '')})
                <br>Átadva: ${t.givingItems?.map(n => getItemLabel(n)).join(', ') || '-'} ➔ Kapva: ${t.receivingItems?.map(n => getItemLabel(n)).join(', ') || '-'}
              </div>
              <span style="color:var(--moss-soft); font-weight:700;">✓ Teljesítve</span>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  list.innerHTML = html;
}

safeAddListener('active-trades-list', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.tradeIdx, 10);
  const trade = (myProfile.activeTrades || [])[idx];
  if (!trade) return;

  if (btn.dataset.action === 'accept-trade') {
    trade.status = 'accepted';
    // Zároljuk a felajánlott duplákat ennél a félnél is
    if (trade.givingItems) {
      trade.givingItems.forEach(n => {
        if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
        if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
        myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
      });
    }

    if (db && trade.tradeId) {
      db.collection("trades").doc(trade.tradeId).update({ status: 'accepted' }).catch(() => {});
    }

    saveMyState();
    renderActiveTradesPanel();
    renderGrid();
    showToast("Csereajánlat elfogadva! A tételek mindkét félnél zárolva lettek.");
  } else if (btn.dataset.action === 'ship-trade') {
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

// =========================================================================
// KÉTOLDALÚ BEJÖVŐ CSEREAJÁNLAT MODAL KEZELÉSE
// =========================================================================

function checkAndPromptIncomingTrade(tradeDoc) {
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

  if (nameEl) nameEl.textContent = data.initiatorName || 'Partner';
  if (cityEl) cityEl.textContent = data.initiatorCity || '';
  if (albumEl) albumEl.textContent = getAlbumDisplayTitle(data.albumId);

  // A címzett szemszögéből: amit az initiator ad, azt a címzett megkapja!
  if (getListEl) {
    getListEl.innerHTML = (data.givingItems && data.givingItems.length)
      ? data.givingItems.map(n => getItemLabel(n, data.albumId)).join(', ')
      : '<em>(Ajándékozás)</em>';
  }
  if (giveListEl) {
    giveListEl.innerHTML = (data.receivingItems && data.receivingItems.length)
      ? data.receivingItems.map(n => getItemLabel(n, data.albumId)).join(', ')
      : '<em>(Ingyen felajánlás)</em>';
  }
  if (msgBox) {
    msgBox.innerHTML = data.message ? `„${formatLinksWithAnchors(data.message)}”` : '<em>(Cserekezdeményezés a rácsról)</em>';
  }

  document.getElementById('modal-incoming-trade-prompt')?.classList.add('open');
}

safeAddListener('btn-close-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
});

safeAddListener('btn-accept-incoming-prompt', async () => {
  if (!activePromptTradeData) return;
  const t = activePromptTradeData;

  // A címzettnél hozzáadjuk az aktív cserékhez a megfordított irányokkal
  const localTradeObj = {
    tradeId: t.id,
    initiatorUid: t.initiatorUid,
    partnerUid: t.initiatorUid,
    partnerName: t.initiatorName,
    partnerCity: t.initiatorCity,
    albumId: t.albumId,
    givingItems: t.receivingItems || [], // amit ő kért tőlem, azt én adom!
    receivingItems: t.givingItems || [], // amit ő felajánlott, azt én kapom!
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

  // Zároljuk a felkért duplákat a címzettnél is
  localTradeObj.givingItems.forEach(n => {
    if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
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
  showToast("Csere elfogadva! A tételek mindkettőtöknél zárolásra kerültek.");
});

safeAddListener('btn-reject-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
  // Lemondási modal megnyitása indokláshoz
  document.getElementById('modal-cancel-trade-reason')?.classList.add('open');
});

// =========================================================================
// CSERE LEMONDÁSI INDOKLÁS & AUTOMATA DUPLALEVONÁS („MÁR NINCS MEG”)
// =========================================================================

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

  // AUTOMATIKUS DUPLALEVONÁS, ha már nincs meg a tétel!
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

  // Zárolások feloldása
  if (trade.givingItems) {
    trade.givingItems.forEach(n => {
      if (myProfile.foglalvaCounts && myProfile.foglalvaCounts[n]) {
        myProfile.foglalvaCounts[n] = Math.max(0, myProfile.foglalvaCounts[n] - 1);
        if (myProfile.foglalvaCounts[n] === 0) {
          delete myProfile.foglalvaCounts[n];
          const fIdx = myProfile.foglalva.indexOf(n);
          if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
        }
      }
    });
  }

  // Automatikus üzenet a partnernek
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
    myProfile.activeTrades.splice(idx, 1);
  }

  saveMyState();
  renderActiveTradesPanel();
  renderGrid();

  document.getElementById('modal-cancel-trade-reason')?.classList.remove('open');
  activeTradeCancellingIdx = null;
  activePromptTradeData = null;
  showToast(selectedReasonVal === 'mar_nincs_meg' ? "Ajánlat törölve, a tétel levonva a dupláid közül." : "Megállapodás elutasítva, a tételek feloldva.");
});

// =========================================================================
// PARTNER ÉRTÉKELŐ ÉS CSEREZÁRÓ MOTOR
// =========================================================================

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

  // 1. Kapott tételek beemelése
  if (trade.receivingItems) {
    trade.receivingItems.forEach(n => {
      const kIdx = myProfile.kell.indexOf(n);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
      if (!myProfile.van.includes(n)) {
        myProfile.van.push(n);
        myProfile.vanCounts[n] = 1;
      }
    });
  }

  // 2. Átadott tételek végleges levonása
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
      if (myProfile.foglalvaCounts && myProfile.foglalvaCounts[n]) {
        myProfile.foglalvaCounts[n] = Math.max(0, myProfile.foglalvaCounts[n] - 1);
        if (myProfile.foglalvaCounts[n] === 0) {
          delete myProfile.foglalvaCounts[n];
          const fIdx = myProfile.foglalva.indexOf(n);
          if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
        }
      }
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
  showToast("Csere sikeresen lezárva és archiválva!");
});

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
// 2. BLOKK: TELEPÜLÉSKERESŐ (CSEREINDÍTÁS GOMBBAL)
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
// 3. BLOKK: KÖZELI GPS KERESŐ (25-ÖS LAPOZÓVAL)
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
      const distText = u.distanceKm !== null ? `📍 kb. ${u.distanceKm} km` : (u.isSameCity ? '📍 Helyi gyűjtő' : '📍 Nincs GPS adat');
      const timeText = u.updatedAgo ? `• 🕒 ${u.updatedAgo}` : '';
      const trustText = u.ratingsCount > 0 
        ? `⭐ ${(u.trustScore / u.ratingsCount).toFixed(1)} (${u.ratingsCount})` 
        : (u.trustScore > 0 ? `⭐ ${u.trustScore}` : '<span style="font-size:0.72rem; color:var(--text-muted);">⭐ Új gyűjtő</span>');

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
// 4. BLOKK: PARTNER NÉVALAPÚ KERESŐ
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
// FACEBOOK POSZT ELEMZŐ & ÖSSZEVETŐ MOTOR (SZÖVEG + FOTÓ BEOLVASÓ)
// =========================================================================

safeAddListener('btn-open-fb-crossmatch', () => {
  document.getElementById('modal-fb-crossmatch')?.classList.add('open');
});
safeAddListener('btn-close-fb-crossmatch', () => {
  document.getElementById('modal-fb-crossmatch')?.classList.remove('open');
});

safeAddListener('btn-fb-tab-text', () => {
  document.getElementById('btn-fb-tab-text')?.classList.add('active');
  document.getElementById('btn-fb-tab-photo')?.classList.remove('active');
  if (document.getElementById('fb-match-text-container')) document.getElementById('fb-match-text-container').style.display = 'block';
  if (document.getElementById('fb-match-photo-container')) document.getElementById('fb-match-photo-container').style.display = 'none';
});

safeAddListener('btn-fb-tab-photo', () => {
  document.getElementById('btn-fb-tab-photo')?.classList.add('active');
  document.getElementById('btn-fb-tab-text')?.classList.remove('active');
  if (document.getElementById('fb-match-photo-container')) document.getElementById('fb-match-photo-container').style.display = 'block';
  if (document.getElementById('fb-match-text-container')) document.getElementById('fb-match-text-container').style.display = 'none';
});

safeAddListener('fb-match-file-input', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, 1400);
      canvas.height = Math.round((img.height * canvas.width) / img.width);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      fbMatchUploadedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      const previewBox = document.getElementById('fb-match-photo-preview');
      const previewImg = document.getElementById('fb-photo-preview-img');
      if (previewBox && previewImg) {
        previewImg.src = canvas.toDataURL('image/jpeg', 0.8);
        previewBox.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

// INTELLIGENS MAGYAR SZÖVEGPARSER A FACEBOOK POSZTOKHOZ
function parseFacebookPostText(rawText) {
  let otherHas = [];
  let otherNeeds = [];

  const HAS_KW = /(?:^|\s|[,;])(?:van|dupl[aá]k?|cser[eé]k?|cserematric[aá]k?|adok|adom|cser[eé]lem|plusz|plussz|tudok adni|tudunk adni|k[íi]n[aá]l|felesleg)[:\s\-—–]*/i;
  const NEEDS_KW = /(?:^|\s|[,;])(?:kell|hi[aá]ny(?:z[oó]k?)?|k[eé]rem|keres(?:em|s[uü]k|n[eé]m)?|valakinek megvan|vinn[eé]k|sz[uü]ks[eé]gem van)[:\s\-—–]*/i;

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

safeAddListener('btn-run-fb-match', async () => {
  const isPhotoTab = document.getElementById('btn-fb-tab-photo')?.classList.contains('active');
  const rawText = document.getElementById('fb-match-raw-text')?.value.trim() || '';
  const loader = document.getElementById('fb-match-loader');
  const resultsBox = document.getElementById('fb-match-results-box');

  if (!isPhotoTab && !rawText) return showToast("Másolj be egy Facebook posztot a szövegdobozba!");
  if (isPhotoTab && !fbMatchUploadedBase64) return showToast("Válassz ki egy fotót a listáról!");

  if (loader) loader.style.display = 'block';
  if (resultsBox) resultsBox.style.display = 'none';

  let postData = { has: [], needs: [] };

  try {
    if (isPhotoTab && fbMatchUploadedBase64) {
      const res = await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data: fbMatchUploadedBase64, mode: 'table_ocr' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "A fotó felismerése sikertelen.");
      postData = parseFacebookPostText(data.text || '');
    } else {
      postData = parseFacebookPostText(rawText);
    }

    const myVanSet = new Set(ensureArray(myProfile.van));
    const myKellSet = new Set(ensureArray(myProfile.kell));

    // 1. Tőle kaphatsz (Neki duplája van ÉS neked hiányzik)
    const iCanGet = postData.has.filter(n => myKellSet.has(n)).sort((a, b) => a - b);

    // 2. Neki adhatsz (Neki hiányzik ÉS neked duplád van)
    const iCanGive = postData.needs.filter(n => myVanSet.has(n)).sort((a, b) => a - b);

    const getCountEl = document.getElementById('fb-match-get-count');
    const giveCountEl = document.getElementById('fb-match-give-count');
    const getPillsEl = document.getElementById('fb-match-get-pills');
    const givePillsEl = document.getElementById('fb-match-give-pills');
    const replyTextEl = document.getElementById('fb-match-reply-text');

    if (getCountEl) getCountEl.textContent = iCanGet.length;
    if (giveCountEl) giveCountEl.textContent = iCanGive.length;

    if (getPillsEl) {
      getPillsEl.innerHTML = iCanGet.length 
        ? iCanGet.map(n => `<span class="fb-match-pill get">${escapeHtml(getItemLabel(n))}</span>`).join(' ')
        : '<em style="color:var(--text-muted);">Sajnos ebből a posztból most nincs hiányzód.</em>';
    }

    if (givePillsEl) {
      givePillsEl.innerHTML = iCanGive.length
        ? iCanGive.map(n => `<span class="fb-match-pill give">${escapeHtml(getItemLabel(n))}</span>`).join(' ')
        : '<em style="color:var(--text-muted);">Neki nincs olyan hiányzója, amiből duplád lenne.</em>';
    }

    const activeAlbum = getActiveAlbum();
    let replyMsg = `Szia! Összevetettem a listádat a Cserélj Okosanon a(z) ${activeAlbum.title} gyűjteményemhez:\n\n`;

    if (iCanGet.length > 0) {
      replyMsg += `🟢 Tőled ezek kellenének nekem (${iCanGet.length} db): ${iCanGet.map(n => getItemLabel(n)).join(', ')}\n`;
    }
    if (iCanGive.length > 0) {
      replyMsg += `🟡 Cserébe én ezeket tudom adni a dupláimból (${iCanGive.length} db): ${iCanGive.map(n => getItemLabel(n)).join(', ')}\n`;
    }
    if (iCanGet.length === 0 && iCanGive.length === 0) {
      replyMsg += `Megnéztem a posztodat, de most sajnos nincs közvetlen egyezésünk a dupláink között.\n`;
    }

    const cityText = myProfile.telepules ? ` (${myProfile.telepules})` : '';
    replyMsg += `\nMegfelelne a csere személyesen vagy postán?\nÜdvözlettel: ${myProfile.nev}${cityText} (https://csereljokosan.hu)`;

    if (replyTextEl) replyTextEl.value = replyMsg;
    if (resultsBox) resultsBox.style.display = 'block';

  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
});

safeAddListener('btn-copy-fb-reply', () => {
  const replyEl = document.getElementById('fb-match-reply-text');
  if (!replyEl || !replyEl.value) return;
  navigator.clipboard.writeText(replyEl.value);
  showToast("Komment kimásolva! Már illesztheted is be a Facebook poszt alá.");
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.4 ÉLES KIADÁS)
// 4 / 4. RÉSZ: HŐTÉRKÉP, MESSENGER PIPÁK, ADATLAP, ADMIN MOTOR & BOOTSTRAP
// =========================================================================

// =========================================================================
// BOLTI KÉSZLETRADAR & TALÁLKOZÓK
// =========================================================================

safeAddListener('radar-photo-input', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      radarAttachedBase64 = canvas.toDataURL('image/jpeg', 0.55);
      const preview = document.getElementById('radar-photo-preview');
      const previewBox = document.getElementById('radar-photo-preview-box');
      if (preview && previewBox) {
        preview.src = radarAttachedBase64;
        previewBox.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

document.querySelectorAll('input[name="radar-status"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const tag = document.getElementById('radar-photo-recommended-tag');
    if (tag) {
      tag.style.display = e.target.value === 'van' ? 'inline-block' : 'none';
    }
  });
});

safeAddListener('btn-submit-radar', async () => {
  if (!currentUser) return showToast("Bejelentéshez előbb lépj be a fiókodba!");
  const lastReportTime = parseInt(localStorage.getItem('lutra_last_radar_report') || '0', 10);
  const now = Date.now();
  if (now - lastReportTime < 10 * 60 * 1000) {
    const remMin = Math.ceil((10 * 60 * 1000 - (now - lastReportTime)) / 60000);
    return showToast(`Kérlek várj még ${remMin} percet az újabb bejelentés előtt!`);
  }

  const rawStore = document.getElementById('radar-input-store')?.value.trim() || '';
  const note = document.getElementById('radar-input-note')?.value.trim() || '';
  const statusEl = document.querySelector('input[name="radar-status"]:checked');
  const status = statusEl ? statusEl.value === 'van' : true;

  if (!rawStore) return showToast("Kérlek válaszd ki vagy add meg a boltot!");

  let city = '';
  let storeName = rawStore;
  if (rawStore.includes('–')) {
    const parts = rawStore.split('–');
    city = parts[0].trim();
    storeName = parts[1].trim();
  } else if (rawStore.includes('-')) {
    const parts = rawStore.split('-');
    city = parts[0].trim();
    storeName = parts[1].trim();
  } else {
    city = myProfile.telepules || 'Magyarország';
  }

  try {
    await db.collection("album_reports").add({
      albumId: currentAlbumId,
      city: city,
      storeName: storeName,
      fullStoreName: rawStore,
      note: note,
      status: status,
      photoBase64: radarAttachedBase64 || '',
      likes: [],
      reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reporterName: myProfile.nev || 'Gyűjtő',
      userId: currentUser.uid
    });

    localStorage.setItem('lutra_last_radar_report', now.toString());
    radarAttachedBase64 = '';
    if (document.getElementById('radar-input-store')) document.getElementById('radar-input-store').value = '';
    if (document.getElementById('radar-input-note')) document.getElementById('radar-input-note').value = '';
    if (document.getElementById('radar-photo-input')) document.getElementById('radar-photo-input').value = '';
    if (document.getElementById('radar-photo-preview-box')) document.getElementById('radar-photo-preview-box').style.display = 'none';

    showToast("Köszönjük! A bolti jelentésed mentve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

safeAddListener('btn-refresh-radar', () => {
  renderRadarReports();
  showToast("Radar lista frissítve.");
});

async function toggleRadarReportLike(reportId) {
  if (!currentUser) return showToast("A kedveléshez előbb lépj be!");
  try {
    const docRef = db.collection("album_reports").doc(reportId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    const likes = docSnap.data().likes || [];
    const hasLiked = likes.includes(currentUser.uid);

    await docRef.update({
      likes: hasLiked
        ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        : firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  } catch (e) {
    showToast("Hiba: " + e.message);
  }
}

function renderRadarReports() {
  const container = document.getElementById('radar-reports-list');
  if (!container) return;

  const filterQuery = (document.getElementById('radar-filter-input')?.value || '').toLowerCase().trim();

  const filtered = radarReports
    .filter(r => (r.albumId || 'lidl-lutra-2026') === currentAlbumId)
    .filter(r => {
      if (!filterQuery) return true;
      const matchCity = (r.city || '').toLowerCase().includes(filterQuery);
      const matchStore = (r.storeName || '').toLowerCase().includes(filterQuery);
      const matchFull = (r.fullStoreName || '').toLowerCase().includes(filterQuery);
      return matchCity || matchStore || matchFull;
    });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="view-intro">Nincs a szűrésnek megfelelő készletjelentés ehhez a gyűjteményhez.</p>';
    return;
  }

  container.innerHTML = filtered.map(r => {
    const timeStr = r.reportedAt?.toDate ? r.reportedAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';
    const isOwnerOrAdmin = currentUser && (r.userId === currentUser.uid || currentUser.email === ADMIN_EMAIL);
    const storeLabel = r.fullStoreName ? r.fullStoreName : `${r.city} – ${r.storeName}`;
    const likesCount = (r.likes || []).length;
    const hasLiked = currentUser && (r.likes || []).includes(currentUser.uid);

    return `
      <div class="radar-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div><strong>${escapeHtml(storeLabel)}</strong></div>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">${r.status ? 'Kapható' : 'Elfogyott'}</span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${formatLinksWithAnchors(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>${escapeHtml(r.reporterName || 'Gyűjtő')} • ${timeStr}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-like ${hasLiked ? 'liked' : ''}" data-action="like-radar" data-id="${r.id}">
              ${hasLiked ? '❤️' : '🤍'} ${likesCount > 0 ? likesCount : 'Tetszik'}
            </button>
            ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-radar" data-id="${r.id}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('radar-filter-input', 'input', () => renderRadarReports());

safeAddListener('radar-reports-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'like-radar') {
    toggleRadarReportLike(btn.dataset.id);
  } else if (btn.dataset.action === 'delete-radar') {
    if (!confirm("Biztosan törölni szeretnéd ezt a jelentést?")) return;
    try {
      await db.collection("album_reports").doc(btn.dataset.id).delete();
      showToast("Jelentés törölve.");
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
  }
});

function listenToRadarReports() {
  if (!db) return;
  if (radarUnsubscribe) radarUnsubscribe();

  radarUnsubscribe = db.collection("album_reports")
    .orderBy("reportedAt", "desc")
    .limit(35)
    .onSnapshot(snap => {
      const isInitial = (previousRadarCount === null);
      const newCount = snap.docs.length;

      radarReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const currentAlbumReports = radarReports.filter(r => (r.albumId || 'lidl-lutra-2026') === currentAlbumId);
      const rBadge = document.getElementById('radar-badge');
      if (rBadge && currentAlbumReports.length > 0) {
        rBadge.textContent = currentAlbumReports.length;
        rBadge.style.display = 'inline-block';
      }

      if (!isInitial && newCount > previousRadarCount && radarReports.length > 0) {
        const latest = radarReports[0];
        triggerTopNotification(`Új készletjelentés: ${latest.city} (${latest.status ? 'Kapható' : 'Elfogyott'})`, () => switchView('radar'));
      }
      previousRadarCount = newCount;

      renderRadarReports();
    }, err => console.warn("Radar listener:", err));
}

// =========================================================================
// TALÁLKOZÓK KEZELÉSE
// =========================================================================

safeAddListener('meetup-photo-input', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      meetupAttachedBase64 = canvas.toDataURL('image/jpeg', 0.55);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

safeAddListener('btn-submit-meetup', async () => {
  if (!currentUser) return showToast("Találkozó meghirdetéséhez lépj be a fiókodba!");
  const city = document.getElementById('meetup-input-city')?.value.trim() || '';
  const time = document.getElementById('meetup-input-time')?.value.trim() || '';
  const place = document.getElementById('meetup-input-place')?.value.trim() || '';
  const desc = document.getElementById('meetup-input-desc')?.value.trim() || '';

  if (!city || !time || !place) return showToast("Kérlek töltsd ki a várost, időpontot és helyszínt!");

  try {
    await db.collection("meetups").add({
      albumId: currentAlbumId,
      city, time, place, description: desc,
      photoBase64: meetupAttachedBase64 || '',
      likes: [],
      postedAt: firebase.firestore.FieldValue.serverTimestamp(),
      organizerName: myProfile.nev || 'Gyűjtő',
      userId: currentUser.uid
    });

    meetupAttachedBase64 = '';
    if (document.getElementById('meetup-input-city')) document.getElementById('meetup-input-city').value = '';
    if (document.getElementById('meetup-input-time')) document.getElementById('meetup-input-time').value = '';
    if (document.getElementById('meetup-input-place')) document.getElementById('meetup-input-place').value = '';
    if (document.getElementById('meetup-input-desc')) document.getElementById('meetup-input-desc').value = '';
    if (document.getElementById('meetup-photo-input')) document.getElementById('meetup-photo-input').value = '';

    showToast("Találkozó sikeresen közzétéve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

safeAddListener('btn-refresh-meetups', () => {
  renderMeetups();
  showToast("Találkozók frissítve.");
});

async function toggleMeetupLike(meetupId) {
  if (!currentUser) return showToast("A kedveléshez előbb lépj be!");
  try {
    const docRef = db.collection("meetups").doc(meetupId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    const likes = docSnap.data().likes || [];
    const hasLiked = likes.includes(currentUser.uid);

    await docRef.update({
      likes: hasLiked
        ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        : firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  } catch (e) {
    showToast("Hiba: " + e.message);
  }
}

function renderMeetups() {
  const container = document.getElementById('meetups-list');
  if (!container) return;

  if (meetupEvents.length === 0) {
    container.innerHTML = '<p class="view-intro">Jelenleg nincs meghirdetett közös találkozó. Hozz létre egyet!</p>';
    return;
  }

  container.innerHTML = meetupEvents.map(m => {
    const isOwnerOrAdmin = currentUser && (m.userId === currentUser.uid || currentUser.email === ADMIN_EMAIL);
    const likesCount = (m.likes || []).length;
    const hasLiked = currentUser && (m.likes || []).includes(currentUser.uid);

    return `
      <div class="meetup-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div><h3 style="margin:0; font-size:1.05rem;">${escapeHtml(m.city)} — ${escapeHtml(m.place)}</h3></div>
          <span class="meetup-time-badge">${escapeHtml(m.time)}</span>
        </div>
        ${m.description ? `<p style="font-size:0.86rem; margin:6px 0; color:var(--text-primary); white-space:pre-wrap;">${formatLinksWithAnchors(m.description)}</p>` : ''}
        ${m.photoBase64 ? `<img src="${m.photoBase64}" class="radar-attached-img" alt="Plakát" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>Szervező: <strong>${escapeHtml(m.organizerName || 'Gyűjtő')}</strong></span>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-like ${hasLiked ? 'liked' : ''}" data-action="like-meetup" data-id="${m.id}">
              ${hasLiked ? '❤️' : '🤍'} ${likesCount > 0 ? likesCount : 'Ott leszek'}
            </button>
            ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-meetup" data-id="${m.id}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('meetups-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'like-meetup') {
    toggleMeetupLike(btn.dataset.id);
  } else if (btn.dataset.action === 'delete-meetup') {
    if (!confirm("Biztosan törölni szeretnéd ezt a találkozót?")) return;
    try {
      await db.collection("meetups").doc(btn.dataset.id).delete();
      showToast("Találkozó törölve.");
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
  }
});

function listenToMeetups() {
  if (!db) return;
  if (meetupsUnsubscribe) meetupsUnsubscribe();

  meetupsUnsubscribe = db.collection("meetups")
    .orderBy("postedAt", "desc")
    .limit(30)
    .onSnapshot(snap => {
      meetupEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const mBadge = document.getElementById('meetup-badge');
      const mBadgeM = document.getElementById('meetup-badge-m');
      if (mBadge && meetupEvents.length > 0) {
        mBadge.textContent = meetupEvents.length;
        mBadge.style.display = 'inline-block';
      }
      if (mBadgeM && meetupEvents.length > 0) {
        mBadgeM.textContent = meetupEvents.length;
        mBadgeM.style.display = 'inline-block';
      }

      renderMeetups();
    }, err => console.warn("Meetups listener:", err));
}

// =========================================================================
// STATISZTIKA & HŐTÉRKÉP MOTOR
// =========================================================================

function renderFavoritesRanking() {
  const favScores = {};
  const totalSize = getActiveAlbumSize();
  for (let i = 1; i <= totalSize; i++) favScores[i] = 0;

  allUsersData.forEach(u => {
    const favs = ensureArray(u.favorites || []);
    if (favs[0] && favs[0] <= totalSize) favScores[favs[0]] = (favScores[favs[0]] || 0) + 3;
    if (favs[1] && favs[1] <= totalSize) favScores[favs[1]] = (favScores[favs[1]] || 0) + 2;
    if (favs[2] && favs[2] <= totalSize) favScores[favs[2]] = (favScores[favs[2]] || 0) + 1;
  });

  const rankedFavs = Object.entries(favScores)
    .map(([num, score]) => ({
      num: parseInt(num, 10),
      score,
      name: getItemFullName(parseInt(num, 10), currentAlbumId)
    }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score);

  const container = document.getElementById('stats-favorites-ranking');
  if (!container) return;

  if (rankedFavs.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Még senki sem jelölt meg kedvencet ebben a gyűjteményben.</span>';
    return;
  }

  const medals = ['1.', '2.', '3.', '4.', '5.'];
  container.innerHTML = rankedFavs.slice(0, 5).map((f, idx) => `
    <div class="stats-ranking-item">
      <span><strong>${medals[idx]} #${f.num}</strong> ${escapeHtml(f.name)}</span>
      <span style="color:var(--amber); font-weight:700; font-size:0.8rem;">${f.score} pont</span>
    </div>
  `).join('');
}

function renderCompletionDistribution() {
  let complete = 0, near = 0, half = 0, starter = 0;
  const totalUsers = allUsersData.length;
  const totalSize = getActiveAlbumSize();

  if (totalUsers === 0) return;

  allUsersData.forEach(u => {
    const missingCount = ensureArray(u.kell).length;
    const haveCount = totalSize - missingCount;
    const pct = Math.round((haveCount / totalSize) * 100);

    if (pct === 100) complete++;
    else if (pct >= 80) near++;
    else if (pct >= 50) half++;
    else starter++;
  });

  const pComplete = Math.round((complete / totalUsers) * 100);
  const pNear = Math.round((near / totalUsers) * 100);
  const pHalf = Math.round((half / totalUsers) * 100);
  const pStarter = Math.round((starter / totalUsers) * 100);

  const barC = document.getElementById('dist-bar-complete');
  const barN = document.getElementById('dist-bar-near');
  const barH = document.getElementById('dist-bar-half');
  const barS = document.getElementById('dist-bar-starter');

  if (barC) barC.style.width = `${pComplete}%`;
  if (barN) barN.style.width = `${pNear}%`;
  if (barH) barH.style.width = `${pHalf}%`;
  if (barS) barS.style.width = `${pStarter}%`;

  const grid = document.getElementById('dist-segments-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="segment-card" style="border-top:3px solid #FFD166;">
        <div style="font-size:0.75rem; color:var(--sand);">Betelt (100%)</div>
        <strong style="font-size:1rem; color:#FFF;">${complete} fő</strong>
        <div style="font-size:0.7rem; color:var(--text-muted);">${pComplete}%</div>
      </div>
      <div class="segment-card" style="border-top:3px solid var(--amber);">
        <div style="font-size:0.75rem; color:var(--sand);">Célegyenes (80-99%)</div>
        <strong style="font-size:1rem; color:#FFF;">${near} fő</strong>
        <div style="font-size:0.7rem; color:var(--text-muted);">${pNear}%</div>
      </div>
      <div class="segment-card" style="border-top:3px solid var(--moss-soft);">
        <div style="font-size:0.75rem; color:var(--sand);">Félúton (50-79%)</div>
        <strong style="font-size:1rem; color:#FFF;">${half} fő</strong>
        <div style="font-size:0.7rem; color:var(--text-muted);">${pHalf}%</div>
      </div>
      <div class="segment-card" style="border-top:3px solid var(--water-light);">
        <div style="font-size:0.75rem; color:var(--sand);">Kezdők (0-49%)</div>
        <strong style="font-size:1rem; color:#FFF;">${starter} fő</strong>
        <div style="font-size:0.7rem; color:var(--text-muted);">${pStarter}%</div>
      </div>
    `;
  }
}

function renderChapterDifficulty() {
  const chapters = getActiveChapters();
  if (chapters.length === 0) return;
  const chapterMissing = {};
  const chapterDupes = {};

  chapters.forEach(f => {
    chapterMissing[f.id] = 0;
    chapterDupes[f.id] = 0;
  });

  allUsersData.forEach(u => {
    const kSet = new Set(ensureArray(u.kell));
    const vSet = new Set(ensureArray(u.van));

    chapters.forEach(f => {
      f.elemek.forEach(el => {
        const nums = el.type === 'combo' ? el.nums : [el.num];
        nums.forEach(n => {
          if (kSet.has(n)) chapterMissing[f.id] += 1;
          if (vSet.has(n)) chapterDupes[f.id] += (u.vanCounts?.[n] || 1);
        });
      });
    });
  });

  const rankedChapters = chapters.map(f => {
    const miss = chapterMissing[f.id] || 0;
    const dupes = chapterDupes[f.id] || 0;
    const diffScore = miss / (dupes + 1);
    return {
      id: f.id,
      title: f.cim.split('—')[1] || f.cim,
      missing: miss,
      dupes: dupes,
      score: diffScore
    };
  }).sort((a, b) => b.score - a.score);

  const container = document.getElementById('stats-difficulty-bars');
  if (!container || rankedChapters.length === 0) return;

  const maxScore = rankedChapters[0].score || 1;

  container.innerHTML = rankedChapters.map((c, idx) => {
    const pct = Math.max(15, Math.round((c.score / maxScore) * 100));
    const color = idx < 2 ? '#E85A4F' : idx < 5 ? '#D89B4A' : '#6B8A5A';
    const tag = idx < 2 ? 'Nehéz' : idx < 5 ? 'Közepes' : 'Könnyű';

    return `
      <div class="difficulty-bar-row">
        <div class="difficulty-bar-header">
          <span><strong>#${idx + 1} ${escapeHtml(c.title)}</strong> (${tag})</span>
          <span style="color:var(--sand); font-size:0.75rem;">${c.missing} hiányzik / ${c.dupes} dupla</span>
        </div>
        <div class="difficulty-bar-track">
          <div class="difficulty-bar-fill" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderCompletionOdds() {
  const oddsPct = document.getElementById('completion-odds-pct');
  const oddsBar = document.getElementById('completion-odds-bar');
  const oddsText = document.getElementById('completion-odds-text');

  if (!oddsPct || !oddsBar || !oddsText) return;

  const myMissing = ensureArray(myProfile.kell);
  if (myMissing.length === 0) {
    oddsPct.textContent = '100%';
    oddsBar.style.width = '100%';
    oddsText.innerHTML = '<span style="color:var(--amber);">Gratulálunk! Az albumod betelt!</span>';
    return;
  }

  const availablePool = new Set();
  allUsersData.forEach(u => {
    if (u.id !== (currentUser ? currentUser.uid : 'me') && !u.isVacation) {
      ensureArray(u.van).forEach(n => availablePool.add(n));
    }
  });

  const matchedMissing = myMissing.filter(n => availablePool.has(n));
  const percentage = Math.round((matchedMissing.length / myMissing.length) * 100);

  oddsPct.textContent = `${percentage}%`;
  oddsBar.style.width = `${percentage}%`;
  oddsText.innerHTML = `A hiányzóidból <strong>${matchedMissing.length} / ${myMissing.length} db</strong> azonnal beszerezhető a közösségtől!`;
}

function renderHeatmap() {
  const cityStats = {};
  let totalPoolCount = 0;
  let totalMissingCount = 0;
  const totalSize = getActiveAlbumSize();

  const stickerHolderCount = {};
  const stickerTotalQty = {};
  for (let i = 1; i <= totalSize; i++) {
    stickerHolderCount[i] = 0;
    stickerTotalQty[i] = 0;
  }

  allUsersData.forEach(u => {
    const normalizedLocs = extractNormalizedLocations(u.locations && u.locations.length > 0 ? u.locations : u.telepules);
    const userMissing = ensureArray(u.kell);
    totalMissingCount += userMissing.length;

    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      totalPoolCount += q;
      stickerHolderCount[n] = (stickerHolderCount[n] || 0) + 1;
      stickerTotalQty[n] = (stickerTotalQty[n] || 0) + q;
    });

    if (normalizedLocs.length === 0) return;

    normalizedLocs.forEach(loc => {
      if (!cityStats[loc.canonicalKey]) {
        cityStats[loc.canonicalKey] = {
          canonicalKey: loc.canonicalKey,
          name: loc.displayName,
          users: 0,
          duplicates: 0,
          missing: 0
        };
      }
      cityStats[loc.canonicalKey].users += 1;
      cityStats[loc.canonicalKey].missing += userMissing.length;
      
      ensureArray(u.van).forEach(n => {
        const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
        cityStats[loc.canonicalKey].duplicates += q;
      });
    });
  });

  const poolEl = document.getElementById('stats-total-pool-count');
  if (poolEl) poolEl.textContent = `${totalPoolCount.toLocaleString('hu-HU')} db`;

  const usersCountEl = document.getElementById('stats-users-count');
  if (usersCountEl) usersCountEl.textContent = `${Math.max(809, allUsersData.length)} fő`;

  const avgDupesEl = document.getElementById('stats-avg-dupes');
  if (avgDupesEl && allUsersData.length > 0) {
    avgDupesEl.textContent = `${Math.round(totalPoolCount / allUsersData.length)} db/fő`;
  }

  const avgProgressEl = document.getElementById('stats-avg-progress');
  if (avgProgressEl && allUsersData.length > 0) {
    const avgMissing = totalMissingCount / allUsersData.length;
    const avgProg = Math.max(0, Math.min(100, Math.round(((totalSize - avgMissing) / totalSize) * 100)));
    avgProgressEl.textContent = `${avgProg}%`;
  }

  let maxHoardAvg = 0;
  let maxHoardNum = null;
  for (let i = 1; i <= totalSize; i++) {
    if (stickerHolderCount[i] >= 2) {
      const avg = stickerTotalQty[i] / stickerHolderCount[i];
      if (avg > maxHoardAvg) {
        maxHoardAvg = avg;
        maxHoardNum = i;
      }
    }
  }

  const hoardingEl = document.getElementById('stats-hoarding-sticker');
  if (hoardingEl) {
    if (maxHoardNum) {
      const label = getItemFullName(maxHoardNum, currentAlbumId);
      hoardingEl.textContent = `${getItemLabel(maxHoardNum)} (${maxHoardAvg.toFixed(1)} db/fő)`;
      hoardingEl.title = `${label}: Összesen ${stickerTotalQty[maxHoardNum]} db ${stickerHolderCount[maxHoardNum]} gyűjtőnél`;
    } else {
      hoardingEl.textContent = 'Még nincs adat';
    }
  }

  const totalMeters = (totalPoolCount * 0.076);
  const totalKm = (totalMeters / 1000).toFixed(2);
  const highwayKmEl = document.getElementById('fun-stat-highway-km');
  const highwayTextEl = document.getElementById('fun-stat-highway-text');
  if (highwayKmEl) highwayKmEl.textContent = totalKm;
  if (highwayTextEl) {
    const margitRatio = (totalMeters / 607).toFixed(1);
    const eiffelRatio = (totalMeters / 330).toFixed(1);
    highwayTextEl.innerHTML = `Több mint <strong>${margitRatio}× olyan hosszú</strong>, mint a Margit híd (607 m), élére állítva <strong>${eiffelRatio}× magasabb</strong>, mint az Eiffel-torony!`;
  }

  const totalTowerM = (totalPoolCount * 0.00015).toFixed(2);
  const towerMEl = document.getElementById('fun-stat-tower-m');
  const towerTextEl = document.getElementById('fun-stat-tower-text');
  if (towerMEl) towerMEl.textContent = totalTowerM;
  if (towerTextEl) {
    const humanRatio = (totalTowerM / 2.51).toFixed(1);
    towerTextEl.innerHTML = `Magasabb, mint egy lakás belmagassága (2.6 m), és <strong>${humanRatio}× olyan magas</strong>, mint a világ legmagasabb embere!`;
  }

  const getCityHeatData = (c) => {
    const score = (c.users * 15) + (c.duplicates * 2) + c.missing;
    let heatCls = 'cool', label = 'Éledezve', pinSize = 18;

    if (c.users >= 3 && score >= 75) {
      heatCls = 'fire'; label = 'Izzik a csere'; pinSize = 32;
    } else if ((c.users >= 2 && score >= 35) || (c.users === 1 && c.duplicates >= 25)) {
      heatCls = 'warm'; label = 'Pörög'; pinSize = 24;
    } else {
      heatCls = 'cool'; label = 'Éledezve'; pinSize = 18;
    }

    return { score, heatCls, label, pinSize };
  };

  const sortedCities = Object.values(cityStats).sort((a, b) => getCityHeatData(b).score - getCityHeatData(a).score);

  const pinsOverlay = document.getElementById('heatmap-overlay-pins');
  if (pinsOverlay) {
    pinsOverlay.innerHTML = '';
    sortedCities.forEach(c => {
      const coords = CITY_COORDINATES[c.canonicalKey] || CITY_COORDINATES[normalizeText(c.name)];
      if (coords) {
        const { score, heatCls, pinSize } = getCityHeatData(c);
        const pin = document.createElement('div');
        pin.className = `heat-pin ${heatCls}`;
        pin.style.left = `${coords.x}%`;
        pin.style.top = `${coords.y}%`;
        pin.style.width = `${pinSize}px`;
        pin.style.height = `${pinSize}px`;
        pin.title = `${c.name}: ${c.users} gyűjtő, ${c.duplicates} dupla (Aktivitási pont: ${score})`;
        pin.textContent = c.users;
        pin.onclick = () => filterMatchesByCityName(c.name);
        pinsOverlay.appendChild(pin);
      }
    });
  }

  const cityListEl = document.getElementById('heatmap-city-list');
  if (cityListEl) {
    if (sortedCities.length === 0) {
      cityListEl.innerHTML = '<p class="view-intro">Nincs elegendő adat a hőtérképhez.</p>';
      return;
    }

    const displayedCities = showAllHeatmapCities ? sortedCities : sortedCities.slice(0, 8);
    cityListEl.innerHTML = displayedCities.map((c, idx) => {
      const { heatCls, label } = getCityHeatData(c);
      const badgeCls = heatCls === 'fire' ? 'heat-chip-fire' : heatCls === 'warm' ? 'heat-chip-warm' : 'heat-chip-cool';
      return `
        <div class="stats-ranking-item" data-action="filter-city-jump" data-city="${escapeHtml(c.name)}">
          <div>
            <strong>#${idx + 1} ${escapeHtml(c.name)}</strong>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${c.users} gyűjtő • ${c.duplicates} dupla)</span>
          </div>
          <span class="${badgeCls}">${label}</span>
        </div>
      `;
    }).join('');
  }
}

// 🛡️ JAVÍTVA: A hőtérképről kattintva pontosan az adott város gyűjtőit listázza ki!
function filterMatchesByCityName(cityName) {
  filterTargetCity = cityName;
  switchView('cserek');
  renderMatches();
  showToast(`Szűrés: ${cityName} cserélői`);
}

safeAddListener('heatmap-city-list', 'click', (e) => {
  const item = e.target.closest('[data-action="filter-city-jump"]');
  if (item && item.dataset.city) {
    filterMatchesByCityName(item.dataset.city);
  }
});

safeAddListener('btn-toggle-all-cities', () => {
  showAllHeatmapCities = !showAllHeatmapCities;
  const btn = document.getElementById('btn-toggle-all-cities');
  if (btn) btn.textContent = showAllHeatmapCities ? '▲ Csak a legaktívabb városok mutatása' : 'Összes aktív város mutatása';
  renderHeatmap();
});

document.querySelectorAll('.btn-stat-jump').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const targetEl = document.getElementById(targetId);
    if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

function renderStatistics() {
  const demandCount = {};
  const supplyCount = {};
  const totalSize = getActiveAlbumSize();
  for (let i = 1; i <= totalSize; i++) { demandCount[i] = 0; supplyCount[i] = 0; }

  allUsersData.forEach(u => {
    ensureArray(u.kell).forEach(n => { if (demandCount[n] !== undefined) demandCount[n]++; });
    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      if (supplyCount[n] !== undefined) supplyCount[n] += q;
    });
  });

  const rarest = [];
  for (let i = 1; i <= totalSize; i++) {
    const itemName = getItemFullName(i, currentAlbumId);
    rarest.push({ num: i, name: itemName, demand: demandCount[i], supply: supplyCount[i], score: demandCount[i] - supplyCount[i] });
  }
  rarest.sort((a, b) => b.score - a.score || b.demand - a.demand);
  const common = [...rarest].sort((a, b) => b.supply - a.supply || a.demand - b.demand);

  const rEl = document.getElementById('stats-rarest-list');
  const cEl = document.getElementById('stats-common-list');
  if (rEl) rEl.innerHTML = rarest.slice(0, 5).map(r => `
    <div class="stats-ranking-item">
      <span><strong>#${r.num}</strong> ${escapeHtml(r.name)}</span>
      <span style="color:var(--amber); font-size:0.8rem;">${r.demand} gyűjtő keresi (${r.supply} dupla)</span>
    </div>
  `).join('');
  if (cEl) cEl.innerHTML = common.slice(0, 5).map(c => `
    <div class="stats-ranking-item">
      <span><strong>#${c.num}</strong> ${escapeHtml(c.name)}</span>
      <span style="color:var(--sand); font-size:0.8rem;">${c.supply} db dupla</span>
    </div>
  `).join('');

  renderFavoritesRanking();
  renderCompletionDistribution();
  if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderChapterDifficulty();
  renderCompletionOdds();
  renderHeatmap();
}

safeAddListener('btn-refresh-stats', () => {
  renderStatistics();
  showToast("Statisztika és hőtérkép frissítve.");
});

// =========================================================================
// BELSŐ ÜZENETEK: MESSENGER PIPÁK (✓/✓✓)
// =========================================================================

safeAddListener('btn-msg-tab-inbox', () => {
  activeInboxTab = 'inbox';
  document.getElementById('btn-msg-tab-inbox')?.classList.add('active');
  document.getElementById('btn-msg-tab-sent')?.classList.remove('active');
  renderMessages();
});

safeAddListener('btn-msg-tab-sent', () => {
  activeInboxTab = 'sent';
  document.getElementById('btn-msg-tab-sent')?.classList.add('active');
  document.getElementById('btn-msg-tab-inbox')?.classList.remove('active');
  renderMessages();
});

safeAddListener('btn-refresh-inbox', () => {
  renderMessages();
  showToast("Üzenetek frissítve.");
});

function updateMsgAlbumFilterOptions() {
  const sel = document.getElementById('msg-album-filter-select');
  if (!sel) return;

  const usedAlbumIds = new Set();
  [...myIncomingMessages, ...myOutgoingMessages].forEach(m => {
    if (m.albumId) usedAlbumIds.add(m.albumId);
  });

  const currentVal = sel.value;
  sel.innerHTML = '<option value="all">📦 Minden gyűjtemény üzenetei</option>';

  usedAlbumIds.forEach(id => {
    const albTitle = getAlbumDisplayTitle(id);
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `📦 ${albTitle}`;
    sel.appendChild(opt);
  });

  if (currentVal && [...usedAlbumIds, 'all'].includes(currentVal)) {
    sel.value = currentVal;
  }
}

safeAddListener('msg-album-filter-select', 'change', (e) => {
  msgAlbumFilter = e.target.value;
  renderMessages();
});

function renderMessages() {
  const container = document.getElementById('messages-inbox-list');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:24px;">
        <h3>Belépés szükséges</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:6px 0 14px;">Az üzeneteid megtekintéséhez kérlek lépj be a fiókodba.</p>
        <button class="btn btn-primary" onclick="document.getElementById('modal-auth')?.classList.add('open')">Belépés / Fiók</button>
      </div>`;
    return;
  }

  updateMsgAlbumFilterOptions();

  // Olvasottság automata beállítása a címzettnél (✓✓ a feladónál!)
  if (activeInboxTab === 'inbox' && db && myIncomingMessages.length > 0) {
    myIncomingMessages.forEach(msg => {
      if (msg.read !== true) {
        db.collection("messages").doc(msg.id).update({
          read: true,
          readAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    });
  }

  let list = activeInboxTab === 'inbox' ? myIncomingMessages : myOutgoingMessages;

  if (msgAlbumFilter !== 'all') {
    list = list.filter(m => (m.albumId || 'lidl-lutra-2026') === msgAlbumFilter);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:24px;">
        <h3 style="margin:0 0 4px;">Nincs ${activeInboxTab === 'inbox' ? 'beérkező' : 'elküldött'} üzeneted</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
          ${msgAlbumFilter !== 'all' ? 'Ehhez a gyűjteményhez jelenleg nincs üzenet.' : 'Még nem érkezett üzeneted.'}
        </p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(msg => {
    const isIncoming = activeInboxTab === 'inbox';
    const partnerName = isIncoming ? msg.fromName : msg.toName;
    const partnerCity = isIncoming ? (msg.fromCity ? `(${msg.fromCity})` : '') : '';
    const dateStr = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';
    const albumDisplay = getAlbumDisplayTitle(msg.albumId);

    let pipaHtml = '';
    if (!isIncoming) {
      if (msg.read === true) {
        pipaHtml = `<span class="msg-status-pipa msg-read-double" title="Megnyitva / Elolvasva">✓✓</span>`;
      } else {
        pipaHtml = `<span class="msg-status-pipa msg-delivered" title="Kézbesítve">✓</span>`;
      }
    }

    return `
      <div class="message-card ${isIncoming ? 'incoming' : 'outgoing'}">
        <div class="message-header">
          <div>
            <strong>${isIncoming ? 'Feladó:' : 'Címzett:'} ${escapeHtml(partnerName)} ${escapeHtml(partnerCity)}</strong>
            <span class="message-album-badge" style="margin-left:6px; cursor:pointer;" data-action="filter-by-album" data-album-id="${escapeHtml(msg.albumId || 'lidl-lutra-2026')}">
              📦 ${escapeHtml(albumDisplay)}
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
            ${pipaHtml}
          </div>
        </div>
        <div class="message-body">${formatLinksWithAnchors(msg.message || msg.text || '')}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          ${isIncoming ? `
            <button class="btn btn-sm btn-primary" data-action="reply-message" data-sender-uid="${escapeHtml(msg.fromUid)}" data-sender-name="${escapeHtml(msg.fromName)}">
              Válasz ${escapeHtml(msg.fromName)}-nek
            </button>
          ` : '<div></div>'}
          <button class="btn btn-secondary btn-sm" data-action="delete-message" data-msg-id="${escapeHtml(msg.id)}" style="color:var(--danger); border-color:var(--danger);">
            Törlés
          </button>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('messages-inbox-list', (e) => {
  const badge = e.target.closest('[data-action="filter-by-album"]');
  if (badge) {
    const albumId = badge.dataset.albumId;
    msgAlbumFilter = albumId;
    const sel = document.getElementById('msg-album-filter-select');
    if (sel) sel.value = albumId;
    renderMessages();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'reply-message') {
    const targetUser = { id: btn.dataset.senderUid, nev: btn.dataset.senderName };
    openContactModal(targetUser, [], [], false);
  } else if (btn.dataset.action === 'delete-message') {
    if (!confirm("Biztosan törölni szeretnéd ezt az üzenetet?")) return;
    (async () => {
      try {
        const msgId = btn.dataset.msgId;
        const isIncoming = activeInboxTab === 'inbox';
        await db.collection("messages").doc(msgId).update({
          [isIncoming ? "deletedByRecipient" : "deletedBySender"]: true
        });
        showToast("Üzenet eltávolítva.");
      } catch (err) {
        showToast("Hiba: " + err.message);
      }
    })();
  }
});

// =========================================================================
// GYŰJTŐ ADATLAPJA (LASTACTIVE ÉS FRISSÍTÉSI IDŐVEL)
// =========================================================================

async function openUserProfileModal(uid) {
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return showToast("Gyűjtő adatai nem találhatók.");

  const modal = document.getElementById('modal-user-profile');
  if (!modal) return;

  const nameEl = document.getElementById('user-profile-modal-name');
  const cityEl = document.getElementById('user-profile-modal-city');
  const ratingBadge = document.getElementById('user-profile-rating-badge');
  const lastActiveEl = document.getElementById('user-profile-last-active');
  const lastUpdatedEl = document.getElementById('user-profile-last-updated');

  if (nameEl) nameEl.textContent = `Gyűjtő: ${targetUser.nev || 'Névtelen'}`;
  if (cityEl) cityEl.textContent = targetUser.telepules ? `Település: ${targetUser.telepules}` : `Nincs megadva település`;

  if (lastActiveEl) lastActiveEl.textContent = formatLastActive(targetUser.lastActive);
  if (lastUpdatedEl) lastUpdatedEl.textContent = formatTimeAgo(targetUser.updatedAt);

  const rCount = targetUser.ratingsCount || 0;
  const tScore = targetUser.trustScore || 0;
  const avg = rCount > 0 ? (tScore / rCount).toFixed(1) : (tScore > 0 ? tScore : '5.0');

  if (ratingBadge) {
    ratingBadge.innerHTML = rCount > 0 
      ? `⭐ ${avg} / 5 (${rCount} értékelés)` 
      : (tScore > 0 ? `⭐ ${tScore} pont` : `<span style="font-size:0.75rem; color:var(--text-muted);">⭐ Új gyűjtő</span>`);
  }

  const reviewsDetails = document.getElementById('user-profile-reviews-details');
  const reviewsCountEl = document.getElementById('user-profile-reviews-count');
  const reviewsListEl = document.getElementById('user-profile-reviews-list');

  if (reviewsDetails && reviewsCountEl && reviewsListEl) {
    reviewsListEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Értékelések betöltése...</span>';
    try {
      const snap = await db.collection("public_profiles").doc(uid).collection("reviews").orderBy("createdAt", "desc").limit(10).get();
      if (!snap.empty) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = snap.docs.length;
        reviewsListEl.innerHTML = snap.docs.map(doc => {
          const r = doc.data();
          return `
            <div class="review-bubble">
              <strong>${escapeHtml(r.fromName || 'Partner')}:</strong> ⭐ ${r.stars || 5}/5
              <div style="color:var(--sand); font-style:italic;">„${escapeHtml(r.comment || 'Minden rendben és gyorsan zajlott!')}”</div>
            </div>
          `;
        }).join('');
      } else if (rCount > 0) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = rCount;
        reviewsListEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Korábbi sikeres cserékből jóváírt megbízhatósági pontok.</span>';
      } else {
        reviewsDetails.style.display = 'none';
      }
    } catch (e) {
      reviewsDetails.style.display = 'none';
    }
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

safeAddListener('btn-close-user-profile', () => document.getElementById('modal-user-profile')?.classList.remove('open'));
safeAddListener('btn-close-user-profile-2', () => document.getElementById('modal-user-profile')?.classList.remove('open'));

function triggerTopNotification(iconOrText, textOrActionFn, actionFn) {
  const banner = document.getElementById('top-notification-banner');
  const iconEl = document.getElementById('top-banner-icon');
  const textEl = document.getElementById('top-banner-text');
  const actionBtn = document.getElementById('btn-top-banner-action');
  const closeBtn = document.getElementById('btn-top-banner-close');

  if (!banner || !textEl) return;
  let icon = '', text = '', fn = null;

  if (typeof textOrActionFn === 'function') {
    text = iconOrText || '';
    fn = textOrActionFn;
  } else {
    icon = iconOrText || '';
    text = textOrActionFn || '';
    fn = actionFn;
  }

  if (iconEl) { iconEl.textContent = icon; iconEl.style.display = icon ? 'inline' : 'none'; }
  textEl.textContent = text;
  banner.style.display = 'flex';

  if (actionBtn) {
    actionBtn.onclick = () => { banner.style.display = 'none'; if (fn) fn(); };
  }
  if (closeBtn) closeBtn.onclick = () => { banner.style.display = 'none'; };
}

function listenToMyMessages(uid) {
  if (!db) return;
  if (messagesUnsubscribe) messagesUnsubscribe();

  const refresh = () => {
    myIncomingMessages.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    myOutgoingMessages.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    const badge = document.getElementById('unread-msg-badge');
    const badgeM = document.getElementById('unread-msg-badge-m');
    const unreadCount = myIncomingMessages.filter(m => m.read !== true).length;
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    if (badgeM) {
      badgeM.textContent = unreadCount;
      badgeM.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    updateCserebereBadge();
    renderMessages();
  };

  const unsubIn = db.collection("messages").where("toUid", "==", uid).onSnapshot(snap => {
    const isInitial = (previousIncomingCount === null);
    const newCount = snap.docs.length;

    if (!isInitial && newCount > previousIncomingCount) {
      if ("vibrate" in navigator) navigator.vibrate([180, 90, 180]);
      triggerTopNotification("Új belső üzeneted érkezett egy cserepartnertől!", () => switchView('uzeneteim'));
      showToast("Új üzeneted érkezett!");
    }
    previousIncomingCount = newCount;
    myIncomingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.deletedByRecipient !== true);
    refresh();
  }, err => console.error("messages listener:", err));

  const unsubOut = db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.deletedBySender !== true);
    refresh();
  }, err => console.error("messages listener:", err));

  messagesUnsubscribe = () => { unsubIn(); unsubOut(); };
}

function listenToIncomingTrades(uid) {
  if (!db || !uid) return;
  if (incomingTradesUnsubscribe) incomingTradesUnsubscribe();

  incomingTradesUnsubscribe = db.collection("trades")
    .where("partnerUid", "==", uid)
    .where("status", "==", "pending_acceptance")
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') {
          checkAndPromptIncomingTrade(change.doc);
        }
      });
    }, err => console.warn("Incoming trades listener:", err));
}

// =========================================================================
// PROFIL TELEPÜLÉS-KEZELŐ & BUDAPEST KERÜLETI CHIPEK
// =========================================================================

function renderProfileLocations() {
  const container = document.getElementById('profile-locations-list');
  const bpPicker = document.getElementById('bp-districts-picker');
  if (!container) return;

  if (!myProfile.locations || myProfile.locations.length === 0) {
    myProfile.locations = [{ city: myProfile.telepules || '', districts: [] }];
  }

  let hasBp = false;

  container.innerHTML = myProfile.locations.map((loc, idx) => {
    const isBp = (loc.city || '').toLowerCase().includes('budapest') || (loc.city || '').toLowerCase().includes('bp');
    if (isBp) hasBp = true;

    return `
      <div class="location-row" data-loc-idx="${idx}">
        <input type="text" 
               class="input-field profile-location-input" 
               list="hungarian-cities-list" 
               data-idx="${idx}" 
               value="${escapeHtml(loc.city)}" 
               placeholder="${idx === 0 ? '1. Település (pl. Szeged vagy Budapest)' : (idx + 1) + '. Helyszín (Ingázás / Munkahely)'}" 
               autocomplete="off" 
               spellcheck="false">
        ${idx > 0 ? `<button class="btn btn-secondary btn-sm btn-del-location" data-idx="${idx}" type="button" style="color:var(--danger); border-color:var(--danger); padding:4px 8px;">✕</button>` : ''}
      </div>
    `;
  }).join('');

  if (bpPicker) {
    bpPicker.style.display = hasBp ? 'block' : 'none';
    if (hasBp) renderBpDistrictChips();
  }
}

function renderBpDistrictChips() {
  const container = document.getElementById('bp-district-chips');
  if (!container) return;

  const bpLoc = (myProfile.locations || []).find(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
  const activeDists = new Set(bpLoc ? (bpLoc.districts || []) : []);

  const romanDistricts = [
    'I.', 'II.', 'III.', 'IV.', 'V.', 'VI.', 'VII.', 'VIII.', 'IX.', 'X.',
    'XI.', 'XII.', 'XIII.', 'XIV.', 'XV.', 'XVI.', 'XVII.', 'XVIII.', 'XIX.', 'XX.',
    'XXI.', 'XXII.', 'XXIII.'
  ];

  container.innerHTML = romanDistricts.map((name, idx) => {
    const dNum = idx + 1;
    const isAct = activeDists.has(dNum);
    return `<div class="bp-chip ${isAct ? 'active' : ''}" data-dist="${dNum}">${name} ker.</div>`;
  }).join('');
}

safeAddListener('bp-district-chips', 'click', (e) => {
  const chip = e.target.closest('.bp-chip');
  if (!chip) return;
  const dNum = parseInt(chip.dataset.dist, 10);

  const bpLoc = (myProfile.locations || []).find(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
  if (!bpLoc) return;

  if (!bpLoc.districts) bpLoc.districts = [];
  const idx = bpLoc.districts.indexOf(dNum);
  if (idx > -1) {
    bpLoc.districts.splice(idx, 1);
  } else {
    bpLoc.districts.push(dNum);
  }

  renderBpDistrictChips();
});

safeAddListener('profile-locations-list', 'focusin', () => {
  if (!myGpsCoords) {
    requestGpsLocation();
  }
});

safeAddListener('profile-locations-list', 'input', (e) => {
  const input = e.target.closest('.profile-location-input');
  if (!input) return;
  const idx = parseInt(input.dataset.idx, 10);
  if (myProfile.locations[idx]) {
    myProfile.locations[idx].city = input.value.trim();
    const bpPicker = document.getElementById('bp-districts-picker');
    if (bpPicker) {
      const anyBp = myProfile.locations.some(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
      bpPicker.style.display = anyBp ? 'block' : 'none';
      if (anyBp) renderBpDistrictChips();
    }
  }
});

safeAddListener('profile-locations-list', 'click', (e) => {
  const btn = e.target.closest('.btn-del-location');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (idx > 0) {
    myProfile.locations.splice(idx, 1);
    renderProfileLocations();
  }
});

safeAddListener('btn-add-location', () => {
  if (!myProfile.locations) myProfile.locations = [];
  if (myProfile.locations.length >= 5) {
    return showToast("Legfeljebb 5 helyszínt adhatsz meg.");
  }
  myProfile.locations.push({ city: "", districts: [] });
  renderProfileLocations();
});

safeAddListener('btn-geo-detect-profile', () => requestGpsLocation());

// =========================================================================
// ADMINISZTRÁCIÓS MOTOR (AUDIT, JSON IMPORT, KÉTÁLLÁSÚ MENTÉS)
// =========================================================================

let adminAlbumCoverBase64 = '';

safeAddListener('btn-admin-audit-db', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  const reportBox = document.getElementById('admin-audit-report-box');
  if (!reportBox) return;

  reportBox.style.display = 'block';
  reportBox.innerHTML = '<span style="color:var(--amber);">🔍 Adatbázis átvizsgálása folyamatban...</span>';

  try {
    const snap = await db.collection("albums").get();
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const junkFound = [];
    const normalizedMap = new Map();
    const duplicatePairs = [];

    allDocs.forEach(doc => {
      if (SCRAPER_JUNK_IDS.has(doc.id) || /^(mind|kartya|matricaalbum|figura|kisauto)-\d+$/i.test(doc.id)) {
        junkFound.push(doc.id);
        return;
      }

      const normTitleKey = getNormalizedAlbumTitleKey(doc.title || doc.id);
      if (normTitleKey && normalizedMap.has(normTitleKey)) {
        duplicatePairs.push({ existing: normalizedMap.get(normTitleKey), duplicate: doc });
      } else if (normTitleKey) {
        normalizedMap.set(normTitleKey, doc);
      }
    });

    let html = `
      <div style="font-size:0.85rem; line-height:1.5;">
        <strong>Audit Eredmény:</strong> Összesen <strong>${allDocs.length} db</strong> album van a felhőben.<br>
        <span style="color:${junkFound.length > 0 ? 'var(--danger)' : 'var(--moss-soft)'};">
          ${junkFound.length > 0 ? `⚠️ <strong>${junkFound.length} db szemét menügomb</strong> található!` : '✓ Nincs menügomb szemét az adatbázisban.'}
        </span><br>
        <span style="color:${duplicatePairs.length > 0 ? 'var(--amber)' : 'var(--moss-soft)'};">
          ${duplicatePairs.length > 0 ? `⚠️ <strong>${duplicatePairs.length} lehetséges duplikáció</strong> észlelve!` : '✓ Nincs név szerinti duplikáció.'}
        </span>
      </div>
    `;

    if (junkFound.length > 0) {
      html += `
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(243,238,223,0.2);">
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">Törölhető menüelemek: ${junkFound.join(', ')}</div>
          <button class="btn btn-danger btn-sm" id="btn-purge-junk-albums" style="padding:4px 10px;">
            🗑️ ${junkFound.length} db szemét gomb azonnali törlése a Firestore-ból
          </button>
        </div>
      `;
    }

    if (duplicatePairs.length > 0) {
      html += `
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(243,238,223,0.2);">
          <strong style="font-size:0.8rem; color:var(--amber);">Észlelt duplikációk:</strong>
          ${duplicatePairs.map((pair) => `
            <div style="background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; margin-top:4px; font-size:0.75rem; display:flex; justify-content:space-between; align-items:center;">
              <div>
                1. <strong>${escapeHtml(pair.existing.title)}</strong> (${escapeHtml(pair.existing.id)})<br>
                2. <strong>${escapeHtml(pair.duplicate.title)}</strong> (${escapeHtml(pair.duplicate.id)})
              </div>
              <button class="btn btn-secondary btn-sm" data-action="delete-specific-duplicate" data-id="${escapeHtml(pair.duplicate.id)}" style="color:var(--danger); border-color:var(--danger); padding:2px 8px; font-size:0.72rem;">
                2. törlése
              </button>
            </div>
          `).join('')}
        </div>
      `;
    }

    reportBox.innerHTML = html;

    const purgeBtn = document.getElementById('btn-purge-junk-albums');
    if (purgeBtn) {
      purgeBtn.onclick = async () => {
        if (!confirm(`Biztosan törölni szeretnéd ezt a ${junkFound.length} db menüelemet a Firestore-ból?`)) return;
        purgeBtn.disabled = true;
        const batch = db.batch();
        junkFound.forEach(id => {
          batch.delete(db.collection("albums").doc(id));
          delete ALBUMS_REGISTRY[id];
        });
        await batch.commit();
        showToast(`${junkFound.length} db szemét sikeresen eltávolítva!`);
        renderHub();
        renderAdminAlbumsList();
        document.getElementById('btn-admin-audit-db')?.click();
      };
    }
  } catch (err) {
    reportBox.innerHTML = `<span style="color:var(--danger);">Audit hiba: ${err.message}</span>`;
  }
});

safeAddListener('admin-audit-report-box', 'click', async (e) => {
  const btn = e.target.closest('[data-action="delete-specific-duplicate"]');
  if (!btn) return;
  const albumId = btn.dataset.id;
  if (!confirm(`Biztosan törlöd a(z) ${albumId} duplikátumot?`)) return;
  try {
    await db.collection("albums").doc(albumId).delete();
    delete ALBUMS_REGISTRY[albumId];
    renderHub();
    renderAdminAlbumsList();
    showToast("Duplikátum törölve.");
    document.getElementById('btn-admin-audit-db')?.click();
  } catch (err) { showToast("Hiba: " + err.message); }
});

safeAddListener('btn-admin-import-json', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  const rawJson = document.getElementById('admin-album-json-import')?.value.trim();
  const statusEl = document.getElementById('admin-json-import-status');
  if (!rawJson) return showToast("Illeszd be a JSON adatokat a mezőbe!");

  let albumsList = [];
  try {
    albumsList = JSON.parse(rawJson);
    if (!Array.isArray(albumsList)) throw new Error("A JSON-nak egy tömbnek kell lennie!");
  } catch (err) {
    return showToast("Érvénytelen JSON formátum: " + err.message);
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = `Elemzés és szűrés...`;
  }

  const cleanedList = [];
  let skippedJunk = 0;
  let skippedExisting = 0;

  albumsList.forEach(alb => {
    const rawId = (alb.id || alb.title || '').toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (SCRAPER_JUNK_IDS.has(rawId) || /^(mind|kartya|matricaalbum|figura|kisauto)-\d+$/i.test(rawId)) {
      skippedJunk++;
      return;
    }

    if (rawId === 'lutra-album' && ALBUMS_REGISTRY['lidl-lutra-2026']) {
      skippedExisting++;
      return;
    }

    cleanedList.push({ ...alb, cleanId: rawId });
  });

  const chunkSize = 400;
  let savedCount = 0;

  try {
    for (let i = 0; i < cleanedList.length; i += chunkSize) {
      const chunk = cleanedList.slice(i, i + chunkSize);
      const batch = db.batch();

      chunk.forEach(alb => {
        const id = alb.cleanId;
        const totalItems = parseInt(alb.totalItems || alb.total_stickers || '100', 10);
        const year = parseInt(alb.year || '2026', 10);
        const type = alb.type || 'sticker';
        const typeLabel = alb.typeLabel || (type === 'card' ? 'Kártya' : type === 'figure' ? 'Figura / Kinder' : 'Matricaalbum');

        const docRef = db.collection("albums").doc(id);
        const payload = {
          id,
          title: alb.title || id,
          subtitle: alb.subtitle || '',
          publisher: alb.publisher || 'Egyéb',
          year,
          totalItems,
          type,
          typeLabel,
          coverUrl: alb.coverUrl || alb.image || `covers/${id}.webp`,
          featured: false,
          isRetro: alb.isRetro === true || year < 2018,
          hasFavorites: false,
          hasRadar: alb.hasRadar === true,
          radarType: alb.radarType || 'none',
          hasChapters: alb.hasChapters === true,
          customItems: alb.customItems || [],
          customNames: alb.customNames || [],
          customChaptersList: alb.customChaptersList || [],
          active: true,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        batch.set(docRef, payload, { merge: true });
        ALBUMS_REGISTRY[id] = payload;
        savedCount++;
      });

      await batch.commit();
      if (statusEl) statusEl.textContent = `Mentve: ${savedCount} / ${cleanedList.length} album...`;
    }

    showToast(`Siker! ${savedCount} tiszta album élesítve (${skippedJunk} szemét gomb kiszűrve).`);
    renderHub();
    renderAdminAlbumsList();
    if (document.getElementById('admin-album-json-import')) document.getElementById('admin-album-json-import').value = '';
  } catch (err) {
    showToast("Importálási hiba: " + err.message);
  } finally {
    if (statusEl) setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
  }
});

safeAddListener('btn-admin-seed-database', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Feltöltöd a boltokat és a Lidl Lutra 108 matricájának tájolását/fejezeteit a Firestore-ba?")) return;

  const btn = document.getElementById('btn-admin-seed-database');
  if (btn) { btn.disabled = true; btn.textContent = "Feltöltés..."; }

  try {
    const batch = db.batch();

    batch.set(db.collection("albums").doc("lidl-lutra-2026"), {
      id: "lidl-lutra-2026",
      title: "Lutra Album",
      subtitle: "Védett állatok a Föld körül",
      publisher: "Lidl / WWF",
      year: 2026,
      totalItems: 108,
      type: "sticker",
      typeLabel: "Matricaalbum",
      customChaptersList: FEJEZETEK,
      customNames: Object.values(STICKER_NAMES),
      stickerOrients: STICKER_ORIENTS,
      hasChapters: true,
      hasFavorites: false,
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (typeof STORE_DATABASES !== 'undefined') {
      Object.entries(STORE_DATABASES).forEach(([chainKey, storeList]) => {
        if (storeList && storeList.length > 0) {
          const storeRef = db.collection("stores").doc(chainKey);
          batch.set(storeRef, {
            chain: chainKey,
            stores: storeList,
            count: storeList.length,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });
    }

    await batch.commit();
    showToast("Lutra tájolások és boltok sikeresen mentve a Firestore-ba!");
  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Lutra adatok és Boltok feltöltése Firestore-ba"; }
  }
});

safeAddListener('btn-admin-migrate-locations', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Bekapcsolod az automatikus e-mail értesítőket mind a 809 felhasználónál?")) return;

  const btn = document.getElementById('btn-admin-migrate-locations');
  if (btn) { btn.disabled = true; btn.textContent = "Karbantartás..."; }

  try {
    const snap = await db.collection("public_profiles").get();
    const batchSize = 400;
    let count = 0;

    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const chunk = snap.docs.slice(i, i + batchSize);
      const batch = db.batch();

      chunk.forEach(doc => {
        batch.set(db.collection("public_profiles").doc(doc.id), {
          emailNotifications: true
        }, { merge: true });

        batch.set(db.collection("users").doc(doc.id), {
          emailNotifications: true
        }, { merge: true });

        count++;
      });

      await batch.commit();
    }
    showToast(`Sikeres karbantartás! ${count} felhasználónál aktiválva az e-mail értesítő.`);
  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Településtisztítás és e-mail bekapcsolása most"; }
  }
});

safeAddListener('btn-admin-process-universal', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  
  const file = document.getElementById('admin-ai-ocr-file')?.files[0];
  const rawText = document.getElementById('admin-raw-import-text')?.value.trim() || '';
  const statusEl = document.getElementById('admin-universal-status');

  if (!file && !rawText) {
    return showToast("Válassz ki egy fotót VAGY másolj be nyers szöveget!");
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = "Feldolgozás és adatok kinyerése folyamatban...";
  }

  let extractedText = rawText;

  if (file) {
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 1600;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
              else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
          };
          img.src = evt.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mode: 'table_ocr' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "A képfelismerő hibát adott.");

      extractedText = data.text || '';
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger);">AI Hiba: ${err.message}</span>`;
      return showToast("AI Hiba: " + err.message);
    }
  }

  const namesArray = expandCustomNamesText(extractedText);
  const totalCount = namesArray.length;

  if (document.getElementById('admin-album-custom-names')) {
    document.getElementById('admin-album-custom-names').value = extractedText;
  }
  if (totalCount > 0 && document.getElementById('admin-album-total')) {
    document.getElementById('admin-album-total').value = totalCount;
  }

  if (statusEl) {
    statusEl.innerHTML = `<span style="color:var(--moss-soft);">✓ Sikeres feldolgozás! ${totalCount} tétel átemelve a lenti űrlapba.</span>`;
  }
  showToast(`${totalCount} tétel sikeresen kitöltve az űrlapon!`);
  document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

safeAddListener('btn-admin-clear-universal', () => {
  if (document.getElementById('admin-ai-ocr-file')) document.getElementById('admin-ai-ocr-file').value = '';
  if (document.getElementById('admin-raw-import-text')) document.getElementById('admin-raw-import-text').value = '';
  if (document.getElementById('admin-universal-status')) document.getElementById('admin-universal-status').style.display = 'none';
  showToast("Beemelő mezők kiürítve.");
});

safeAddListener('admin-album-cover-input', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 500;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      adminAlbumCoverBase64 = canvas.toDataURL('image/jpeg', 0.8);
      const preview = document.getElementById('admin-album-cover-preview');
      const previewBox = document.getElementById('admin-album-cover-preview-box');
      if (preview && previewBox) {
        preview.src = adminAlbumCoverBase64;
        previewBox.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

safeAddListener('btn-admin-cancel-edit', () => {
  editingAlbumId = null;
  resetAdminAlbumForm();
});

function resetAdminAlbumForm() {
  const idInput = document.getElementById('admin-album-id');
  if (idInput) { idInput.value = ''; idInput.disabled = false; }
  document.getElementById('admin-album-title').value = '';
  document.getElementById('admin-album-publisher').value = '';
  document.getElementById('admin-album-year').value = '2026';
  document.getElementById('admin-album-total').value = '';
  document.getElementById('admin-album-subtitle').value = '';
  document.getElementById('admin-album-custom-items').value = '';
  document.getElementById('admin-album-custom-names').value = '';
  document.getElementById('admin-album-custom-chapters').value = '';
  document.getElementById('admin-album-featured').checked = false;
  document.getElementById('admin-album-is-retro').checked = false;
  document.getElementById('admin-album-has-chapters').checked = false;
  document.getElementById('admin-album-radar-type').value = 'none';
  document.getElementById('admin-album-cover-input').value = '';
  if (document.getElementById('admin-album-cover-preview-box')) {
    document.getElementById('admin-album-cover-preview-box').style.display = 'none';
  }
  adminAlbumCoverBase64 = '';

  const formTitle = document.getElementById('admin-album-form-title');
  const cancelBtn = document.getElementById('btn-admin-cancel-edit');
  if (formTitle) formTitle.textContent = "✏️ 4. Új gyűjtemény felvitele / Szerkesztő";
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// 🛡️ KÉTÁLLÁSÚ ALBUM MENTÉS (PISZKOZAT VAGY ÉLESÍTÉS + UNDEFINED TISZTÍTÓ!)
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

    showToast(publishActive ? "Gyűjtemény élesítve és közzétéve!" : "Gyűjtemény piszkozatként (inaktívan) mentve!");
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

let adminSelectedLetter = 'ALL';

function renderAdminAlbumsList() {
  const container = document.getElementById('admin-albums-list');
  const abcBar = document.getElementById('admin-albums-abc-bar');
  const countEl = document.getElementById('admin-albums-total-count');
  const query = (document.getElementById('admin-albums-search')?.value || '').toLowerCase().trim();

  if (!container) return;

  const allAlbums = Object.values(ALBUMS_REGISTRY).sort((a, b) => a.title.localeCompare(b.title, 'hu'));
  if (countEl) countEl.textContent = allAlbums.length;

  if (abcBar) {
    const availableLetters = new Set();
    allAlbums.forEach(a => {
      const firstChar = a.title.charAt(0).toUpperCase();
      availableLetters.add(firstChar);
    });

    const sortedLetters = [...availableLetters].sort((a, b) => a.localeCompare(b, 'hu'));
    abcBar.innerHTML = `
      <button class="admin-abc-btn ${adminSelectedLetter === 'ALL' ? 'active' : ''}" data-letter="ALL" style="width:auto; padding:0 8px;">Mind</button>
      ${sortedLetters.map(l => `
        <button class="admin-abc-btn ${adminSelectedLetter === l ? 'active' : ''}" data-letter="${l}">${l}</button>
      `).join('')}
    `;
  }

  let filtered = allAlbums.filter(a => {
    if (query) {
      const matchTitle = (a.title || '').toLowerCase().includes(query);
      const matchPub = (a.publisher || '').toLowerCase().includes(query);
      const matchId = (a.id || '').toLowerCase().includes(query);
      return matchTitle || matchPub || matchId;
    }
    if (adminSelectedLetter !== 'ALL') {
      return a.title.charAt(0).toUpperCase() === adminSelectedLetter;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Nincs találat a szűrésre.</p>';
    return;
  }

  const groups = {};
  filtered.forEach(a => {
    const letter = a.title.charAt(0).toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(a);
  });

  let html = '';
  Object.keys(groups).sort((a, b) => a.localeCompare(b, 'hu')).forEach(letter => {
    html += `
      <div class="admin-album-group-header">
        <span>${letter}</span>
        <span style="font-size:0.75rem; font-weight:normal; opacity:0.8;">${groups[letter].length} db</span>
      </div>
    `;

    groups[letter].forEach(a => {
      const isActive = (a.active !== false);
      html += `
        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${a.coverUrl || 'og-image.png'}" style="width:36px; height:36px; border-radius:4px; object-fit:contain; background:#F3EEDF; padding:2px;" alt="Borító">
            <div>
              <strong>${escapeHtml(a.title)}</strong> (${a.year}) — <span style="color:var(--sand); font-size:0.8rem;">${a.totalItems} db (${escapeHtml(a.typeLabel || a.type)})</span>
              ${!isActive ? '<span class="badge-trade-status badge-inactive" style="margin-left:6px;">Inaktív</span>' : ''}
              <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(a.id)} • Kiadó: ${escapeHtml(a.publisher)}</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" data-action="toggle-active-album" data-id="${escapeHtml(a.id)}">
              ${isActive ? 'Inaktiválás' : 'Aktiválás'}
            </button>
            <button class="btn btn-primary btn-sm" data-action="edit-album" data-id="${escapeHtml(a.id)}">Szerkesztés</button>
            <button class="btn btn-secondary btn-sm" data-action="toggle-feature-album" data-id="${escapeHtml(a.id)}">${a.featured ? 'Kiemelt levétel' : 'Kiemelés'}</button>
            <button class="btn btn-secondary btn-sm" data-action="delete-album" data-id="${escapeHtml(a.id)}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

safeAddListener('admin-albums-abc-bar', (e) => {
  const btn = e.target.closest('.admin-abc-btn');
  if (!btn) return;
  adminSelectedLetter = btn.dataset.letter;
  renderAdminAlbumsList();
});

safeAddListener('admin-albums-search', 'input', () => {
  adminSelectedLetter = 'ALL';
  renderAdminAlbumsList();
});

safeAddListener('admin-albums-list', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const albumId = btn.dataset.id;
  if (!albumId) return;

  if (btn.dataset.action === 'toggle-active-album') {
    const album = ALBUMS_REGISTRY[albumId];
    if (!album) return;
    const currentActive = (album.active !== false);
    const newActive = !currentActive;

    album.active = newActive;
    if (!newActive) album.featured = false;

    await db.collection("albums").doc(albumId).set({
      active: newActive,
      featured: album.featured,
      inactivatedAt: newActive ? null : firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    renderHub();
    renderAdminAlbumsList();
    showToast(newActive ? `${album.title} aktiválva!` : `${album.title} inaktiválva (csak olvasható)!`);
  } else if (btn.dataset.action === 'edit-album') {
    const album = ALBUMS_REGISTRY[albumId];
    if (!album) return;

    editingAlbumId = albumId;
    const idInput = document.getElementById('admin-album-id');
    idInput.value = album.id;
    idInput.disabled = false;

    document.getElementById('admin-album-title').value = album.title;
    document.getElementById('admin-album-publisher').value = album.publisher;
    document.getElementById('admin-album-year').value = album.year;
    document.getElementById('admin-album-total').value = album.totalItems;
    document.getElementById('admin-album-type').value = album.type;
    document.getElementById('admin-album-subtitle').value = album.subtitle || '';
    document.getElementById('admin-album-custom-items').value = album.customItemsRaw || (album.customItems ? album.customItems.join(', ') : '');
    document.getElementById('admin-album-custom-names').value = album.customNamesRaw || (album.customNames ? album.customNames.map((n, i) => `${i+1}: ${n}`).join('   ') : '');
    document.getElementById('admin-album-custom-chapters').value = album.customChaptersRaw || '';
    document.getElementById('admin-album-featured').checked = album.featured === true;
    document.getElementById('admin-album-is-retro').checked = album.isRetro === true || album.year < 2018;
    document.getElementById('admin-album-radar-type').value = album.radarType || (album.hasRadar ? 'lidl' : 'none');
    document.getElementById('admin-album-has-chapters').checked = album.hasChapters === true;

    if (album.coverUrl) {
      const preview = document.getElementById('admin-album-cover-preview');
      const previewBox = document.getElementById('admin-album-cover-preview-box');
      if (preview && previewBox) {
        preview.src = album.coverUrl;
        previewBox.style.display = 'block';
      }
    }

    const formTitle = document.getElementById('admin-album-form-title');
    const cancelBtn = document.getElementById('btn-admin-cancel-edit');
    if (formTitle) formTitle.textContent = `✏️ Gyűjtemény szerkesztése: ${album.title}`;
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (btn.dataset.action === 'toggle-feature-album') {
    const current = ALBUMS_REGISTRY[albumId]?.featured || false;
    ALBUMS_REGISTRY[albumId].featured = !current;
    await db.collection("albums").doc(albumId).set({ featured: !current }, { merge: true });
    renderHub();
    renderAdminAlbumsList();
    showToast("Kiemelés frissítve.");
  } else if (btn.dataset.action === 'delete-album') {
    if (albumId === 'lidl-lutra-2026') return showToast("A Lutra alapértelmezett album nem törölhető.");
    if (!confirm(`Biztosan törlöd a(z) ${albumId} gyűjteményt?`)) return;
    await db.collection("albums").doc(albumId).delete();
    delete ALBUMS_REGISTRY[albumId];
    renderHub();
    renderAdminAlbumsList();
    showToast("Gyűjtemény törölve.");
  }
});

function listenToSuggestions() {
  if (!db) return;
  if (suggestionsUnsubscribe) suggestionsUnsubscribe();

  suggestionsUnsubscribe = db.collection("album_suggestions")
    .where("status", "==", "pending")
    .onSnapshot(snap => {
      albumSuggestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const badge = document.getElementById('admin-suggestions-badge');
      if (badge) badge.textContent = albumSuggestions.length;
      renderAdminSuggestionsList();
    }, err => console.warn("Suggestions listener:", err));
}

function renderAdminSuggestionsList() {
  const container = document.getElementById('admin-suggested-albums-list');
  if (!container) return;

  if (albumSuggestions.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Nincs függőben lévő gyűjteményjavaslat.</span>';
    return;
  }

  container.innerHTML = albumSuggestions.map(s => `
    <div class="suggestion-item">
      <div>
        <strong style="color:var(--sand); font-size:0.95rem;">${escapeHtml(s.title)}</strong> (${s.year || 2026})
        <div style="font-size:0.75rem; color:var(--text-muted);">
          Kiadó: <strong>${escapeHtml(s.publisher)}</strong> • ${s.totalItems || '?'} tétel • Típus: ${escapeHtml(s.type)}
          <br>Beküldte: <em>${escapeHtml(s.submittedByName || 'Gyűjtő')}</em> ${s.note ? `• Megjegyzés: „${formatLinksWithAnchors(s.note)}”` : ''}
        </div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-primary btn-sm" data-action="approve-suggestion" data-id="${s.id}">Betöltés & Jóváhagyás</button>
        <button class="btn btn-secondary btn-sm" data-action="reject-suggestion" data-id="${s.id}" style="color:var(--danger); border-color:var(--danger);">Elutasítás</button>
      </div>
    </div>
  `).join('');
}

safeAddListener('admin-suggested-albums-list', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const sugId = btn.dataset.id;
  const sug = albumSuggestions.find(s => s.id === sugId);
  if (!sug) return;

  if (btn.dataset.action === 'approve-suggestion') {
    document.getElementById('admin-album-id').value = sug.title.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    document.getElementById('admin-album-title').value = sug.title;
    document.getElementById('admin-album-publisher').value = sug.publisher || '';
    document.getElementById('admin-album-year').value = sug.year || 2026;
    document.getElementById('admin-album-total').value = sug.totalItems || 100;
    document.getElementById('admin-album-type').value = sug.type || 'sticker';
    document.getElementById('admin-album-subtitle').value = sug.note || '';

    await db.collection("album_suggestions").doc(sugId).update({ status: "approved" });
    showToast("Javaslat betöltve az űrlapba!");
    document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (btn.dataset.action === 'reject-suggestion') {
    if (!confirm("Biztosan elutasítod ezt a javaslatot?")) return;
    await db.collection("album_suggestions").doc(sugId).update({ status: "rejected" });
    showToast("Javaslat elutasítva.");
  }
});

function listenToAlbums() {
  if (!db) return;
  if (albumsUnsubscribe) albumsUnsubscribe();

  albumsUnsubscribe = db.collection("albums").onSnapshot(snap => {
    snap.docs.forEach(doc => {
      const data = doc.data();
      ALBUMS_REGISTRY[doc.id] = {
        id: doc.id,
        title: data.title || doc.id,
        subtitle: data.subtitle || '',
        publisher: data.publisher || '',
        year: data.year || 2026,
        totalItems: data.totalItems || 100,
        type: data.type || 'sticker',
        typeLabel: data.typeLabel || (data.type === 'card' ? 'Kártya' : data.type === 'figure' ? 'Figura / Kinder' : 'Matricaalbum'),
        coverUrl: data.coverUrl || `covers/${doc.id}.webp`,
        featured: data.featured === true,
        isRetro: data.isRetro === true || data.year < 2018,
        hasFavorites: false,
        hasRadar: data.hasRadar === true,
        radarType: data.radarType || 'none',
        hasChapters: (data.type === 'sticker') && (data.hasChapters === true),
        customItems: data.customItems || [],
        customNames: data.customNames || [],
        customChaptersList: data.customChaptersList || [],
        active: data.active !== false
      };
    });

    localStorage.setItem('cached_albums_registry', JSON.stringify(ALBUMS_REGISTRY));
    renderHub();
    if (currentUser && currentUser.email === ADMIN_EMAIL) {
      renderAdminAlbumsList();
    }
  }, err => console.warn("Albums listener:", err));
}

function listenToAnnouncements() {
  if (!db) return;
  if (announcementsUnsubscribe) announcementsUnsubscribe();

  announcementsUnsubscribe = db.collection("announcements")
    .where("active", "==", true)
    .onSnapshot(snap => {
      activeAnnouncements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      checkAndDisplayAnnouncements();
      if (currentUser && currentUser.email === ADMIN_EMAIL) renderAdminAnnouncements();
    }, err => console.warn("Announcements listener:", err));
}

function checkAndDisplayAnnouncements() {
  if (activeAnnouncements.length === 0) return;
  const myCity = (myProfile.telepules || '').trim().toLowerCase();
  const relevant = activeAnnouncements.find(a => {
    if (a.expiryDate && a.expiryDate.toDate && a.expiryDate.toDate() < new Date()) return false;
    if (!a.targetCity || a.targetCity.trim() === '' || a.targetCity.toLowerCase() === 'mindenki') return true;
    return a.targetCity.toLowerCase() === myCity;
  });

  if (!relevant) return;
  if (relevant.format === 'banner' || relevant.format === 'both' || !relevant.format) {
    triggerTopNotification(relevant.title, () => showAnnouncementModal(relevant));
  }
}

function showAnnouncementModal(announcement) {
  const modal = document.getElementById('modal-announcement');
  if (!modal) return;
  const titleEl = document.getElementById('announcement-modal-title');
  const bodyEl = document.getElementById('announcement-modal-body');
  if (titleEl) titleEl.textContent = announcement.title;
  if (bodyEl) bodyEl.innerHTML = formatLinksWithAnchors(announcement.content);
  modal.classList.add('open');

  const closeFn = () => modal.classList.remove('open');
  const btnClose = document.getElementById('btn-close-announcement');
  const btnOk = document.getElementById('btn-close-announcement-ok');
  if (btnClose) btnClose.onclick = closeFn;
  if (btnOk) btnOk.onclick = closeFn;
}

safeAddListener('btn-admin-preview-msg', () => {
  const title = document.getElementById('admin-msg-title')?.value.trim() || 'Előnézeti Cím';
  const content = document.getElementById('admin-msg-content')?.value.trim() || 'Előnézeti üzenet szövege.';
  showAnnouncementModal({ id: 'preview', title, content });
});

safeAddListener('btn-admin-publish-msg', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod!");
  const title = document.getElementById('admin-msg-title')?.value.trim() || '';
  const content = document.getElementById('admin-msg-content')?.value.trim() || '';
  const link = document.getElementById('admin-msg-link')?.value.trim() || '';
  const expiry = document.getElementById('admin-msg-expiry')?.value || '';
  const type = document.getElementById('admin-msg-type')?.value || 'event';
  const format = document.getElementById('admin-msg-format')?.value || 'banner';
  const city = document.getElementById('admin-msg-city')?.value.trim() || '';

  if (!title || !content) return showToast("Add meg a címet és a szöveget!");

  try {
    let finalContent = content;
    if (link) finalContent += `\n\nLink: ${link}`;

    await db.collection("announcements").add({
      title, content: finalContent, link,
      expiryDate: expiry ? new Date(expiry) : null,
      type, format, targetCity: city, active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (document.getElementById('admin-msg-title')) document.getElementById('admin-msg-title').value = '';
    if (document.getElementById('admin-msg-content')) document.getElementById('admin-msg-content').value = '';
    showToast("Rendszerüzenet élesítve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

function renderAdminAnnouncements() {
  const container = document.getElementById('admin-active-announcements');
  if (!container) return;
  if (activeAnnouncements.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem;">Nincs aktív hír.</p>';
    return;
  }
  container.innerHTML = activeAnnouncements.map(a => `
    <div style="background:rgba(0,0,0,0.3); padding:10px; border-radius:var(--radius-sm); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong>${escapeHtml(a.title)}</strong> (${escapeHtml(a.format || 'banner')})
        <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(a.content.slice(0, 50))}...</div>
      </div>
      <button class="btn btn-secondary btn-sm" data-action="deactivate-announcement" data-id="${a.id}" style="color:var(--danger); border-color:var(--danger);">
        Leállítás
      </button>
    </div>
  `).join('');
}

safeAddListener('admin-active-announcements', (e) => {
  const btn = e.target.closest('[data-action="deactivate-announcement"]');
  if (!btn) return;
  (async () => {
    try {
      await db.collection("announcements").doc(btn.dataset.id).update({ active: false });
      showToast("Hír leállítva.");
    } catch (err) { showToast("Hiba: " + err.message); }
  })();
});

// =========================================================================
// LENULLÁZÁS, OKLEVÉL ÉS JEGYZET MENTÉS
// =========================================================================

safeAddListener('btn-open-reset', () => document.getElementById('modal-reset')?.classList.add('open'));
safeAddListener('btn-close-reset', () => document.getElementById('modal-reset')?.classList.remove('open'));
safeAddListener('btn-reset-van', () => {
  myProfile.van = []; myProfile.vanCounts = {}; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Duplák törölve.");
});
safeAddListener('btn-reset-kell', () => {
  myProfile.kell = []; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Hiányzók törölve.");
});
safeAddListener('btn-reset-foglalva', () => {
  myProfile.foglalva = []; myProfile.foglalvaCounts = {}; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Foglaltak törölve.");
});
safeAddListener('btn-reset-all', () => {
  myProfile.van = []; myProfile.vanCounts = {}; myProfile.kell = []; myProfile.foglalva = []; myProfile.foglalvaCounts = {}; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Összes adat törölve.");
});

function downloadCertificateImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#0D2E2C'); grad.addColorStop(1, '#081B1A');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1200, 800);
  ctx.strokeStyle = '#D89B4A'; ctx.lineWidth = 10; ctx.strokeRect(30, 30, 1140, 740);
  ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 2; ctx.strokeRect(45, 45, 1110, 710);
  ctx.textAlign = 'center'; ctx.fillStyle = '#D89B4A';
  ctx.font = 'bold 32px "Work Sans", sans-serif'; ctx.fillText('WWF MAGYARORSZÁG & LIDL 2026', 600, 120);
  ctx.font = 'bold 54px Georgia, serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('BOLYGÓVÉDŐ SZUPERHŐS OKLEVÉL', 600, 200);
  ctx.font = '24px "Work Sans", sans-serif'; ctx.fillStyle = '#E3D5B8'; ctx.fillText('Ezennel tanúsítjuk, hogy', 600, 290);
  ctx.font = 'bold 64px "Work Sans", sans-serif'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(myProfile.nev || 'Gyűjtő', 600, 390);
  ctx.strokeStyle = '#D89B4A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(350, 420); ctx.lineTo(850, 420); ctx.stroke();
  ctx.font = '28px "Work Sans", sans-serif'; ctx.fillStyle = '#E3D5B8';
  ctx.fillText('sikeresen összegyűjtötte a 2026-os Lidl Lutra album', 600, 480);
  ctx.fillText('mind a 108 állat- és természetvédelmi matricáját!', 600, 525);
  ctx.font = 'italic 22px "Work Sans", sans-serif'; ctx.fillStyle = '#9FB3A3';
  ctx.fillText(`Kelt: ${new Date().toLocaleDateString('hu-HU')} • Cserélj Okosan`, 600, 640);

  const link = document.createElement('a');
  link.download = `Lutra_Szuperhos_Oklevel_${(myProfile.nev || 'Gyujto').replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast("Oklevél kép letöltve.");
}

safeAddListener('btn-view-certificate', () => {
  const nameEl = document.getElementById('cert-user-name');
  const dateEl = document.getElementById('cert-date-label');
  if (nameEl) nameEl.textContent = myProfile.nev || 'Gyűjtő';
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('hu-HU');
  document.getElementById('modal-certificate')?.classList.add('open');
  if (window.confetti) confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
});

safeAddListener('btn-download-cert-img', downloadCertificateImage);
safeAddListener('btn-close-cert', () => document.getElementById('modal-certificate')?.classList.remove('open'));
safeAddListener('btn-cert-share-fb', () => {
  navigator.clipboard.writeText(`Betelt a 2026-os Lidl Lutra albumom! Mind a 108 matrica megvan! ${window.location.href}`);
  showToast("Szöveg másolva a vágólapra.");
});

safeAddListener('btn-save-note', () => {
  const noteVal = (document.getElementById('prof-private-note')?.value || '').trim().slice(0, 250);
  myProfile.privateNote = noteVal;
  localStorage.setItem(`private_note_${currentAlbumId}`, noteVal);
  if (currentAlbumId === 'lidl-lutra-2026') localStorage.setItem('lutra_private_note', noteVal);
  
  if (currentUser && db) {
    db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(currentAlbumId).set({
      privateNote: noteVal
    }, { merge: true }).catch(() => {});

    if (currentAlbumId === 'lidl-lutra-2026') {
      db.collection("users").doc(currentUser.uid).set({
        privateNote: noteVal
      }, { merge: true }).catch(() => {});
    }
  }
  showToast("Jegyzet sikeresen elmentve.");
});

const noteTextarea = document.getElementById('prof-private-note');
if (noteTextarea) {
  noteTextarea.addEventListener('input', (e) => {
    const countEl = document.getElementById('note-char-count');
    if (countEl) countEl.textContent = `${e.target.value.length}/250`;
  });
}

safeAddListener('btn-save-profile', () => {
  if (!currentUser) return showToast("Előbb lépj be a fiókodba!");
  const nev = document.getElementById('prof-nev')?.value.trim() || '';
  const em = document.getElementById('prof-email')?.value.trim() || '';
  const gdpr = document.getElementById('prof-gdpr')?.checked;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nev) return showToast("A megjelenő név megadása kötelező!");
  if (!em || !emailRegex.test(em)) return showToast("Kérlek adj meg egy érvényes e-mail címet!");
  if (!gdpr) return showToast("A cserékhez el kell fogadnod az adatkezelést!");

  const validLocs = (myProfile.locations || []).filter(l => l.city && l.city.trim().length > 0);
  if (validLocs.length === 0) {
    return showToast("Legalább egy település megadása kötelező a helyi cserékhez!");
  }

  const concatenatedCity = validLocs.map(l => {
    if (l.districts && l.districts.length > 0) {
      const romanDists = l.districts.sort((a, b) => a - b).map(d => ROMAN_NUMERALS[d] ? `${ROMAN_NUMERALS[d]}.` : `${d}.`).join(', ');
      return `${l.city} (${romanDists} ker.)`;
    }
    return l.city;
  }).join(', ');

  myProfile.telepules = concatenatedCity;
  myProfile.locations = validLocs;
  myProfile.geo = myGpsCoords;

  const f1 = parseInt(document.getElementById('prof-fav-1')?.value || '0', 10);
  const f2 = parseInt(document.getElementById('prof-fav-2')?.value || '0', 10);
  const f3 = parseInt(document.getElementById('prof-fav-3')?.value || '0', 10);
  myProfile.favorites = [f1 || 0, f2 || 0, f3 || 0].filter(n => n > 0);

  myProfile.nev = nev;
  myProfile.email = em;
  myProfile.isGiftOffering = document.getElementById('prof-gift')?.checked || false;
  myProfile.showEmailToUsers = document.getElementById('prof-show-email')?.checked || false;
  myProfile.emailNotifications = document.getElementById('prof-email-notif')?.checked !== false;
  myProfile.allowInspect = document.getElementById('prof-allow-inspect')?.checked !== false;
  myProfile.gdprAccepted = true;
  myProfile.isVacation = document.getElementById('prof-vacation-mode')?.checked || false;
  localStorage.setItem('cserelj_vacation_mode', JSON.stringify(myProfile.isVacation));

  (async () => {
    try {
      const batch = db.batch();
      const userRef = db.collection("users").doc(currentUser.uid);
      batch.set(userRef, {
        nev: myProfile.nev,
        telepules: myProfile.telepules,
        locations: myProfile.locations,
        geo: myProfile.geo,
        email: myProfile.email,
        favorites: myProfile.favorites,
        isGiftOffering: myProfile.isGiftOffering,
        showEmailToUsers: myProfile.showEmailToUsers,
        emailNotifications: myProfile.emailNotifications,
        allowInspect: myProfile.allowInspect,
        gdprAccepted: true,
        isVacation: myProfile.isVacation,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const publicRef = db.collection("public_profiles").doc(currentUser.uid);
      batch.set(publicRef, {
        nev: myProfile.nev,
        nickname: myProfile.nev,
        telepules: myProfile.telepules,
        city: myProfile.telepules,
        locations: myProfile.locations,
        geo: myProfile.geo,
        email: myProfile.showEmailToUsers ? myProfile.email : '',
        notifyEmail: myProfile.email,
        favorites: myProfile.favorites,
        isGiftOffering: myProfile.isGiftOffering,
        showEmailToUsers: myProfile.showEmailToUsers,
        emailNotifications: myProfile.emailNotifications,
        allowInspect: myProfile.allowInspect,
        gdprAccepted: true,
        isVacation: myProfile.isVacation,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();
      checkMandatoryProfile();
      showToast(myProfile.isVacation ? "Profil mentve: Szüneteltetés bekapcsolva!" : "Profil adatok elmentve.");
    } catch (err) {
      showToast("Mentési hiba: " + err.message);
    }
  })();
});

safeAddListener('btn-delete-account', () => {
  if (!currentUser) return showToast("Nem vagy bejelentkezve.");
  if (!confirm("Biztosan törölni szeretnéd a fiókodat és az összes adatodat?")) return;

  (async () => {
    try {
      const batch = db.batch();
      batch.delete(db.collection("users").doc(currentUser.uid));
      batch.delete(db.collection("public_profiles").doc(currentUser.uid));
      await batch.commit();
      localStorage.clear();
      location.reload();
    } catch (err) { showToast("Hiba: " + err.message); }
  })();
});

function checkDonablyReturningPrompt() {
  const visitCount = parseInt(localStorage.getItem('cserelj_visit_count') || '0', 10) + 1;
  localStorage.setItem('cserelj_visit_count', visitCount.toString());
  const lastPromptTime = parseInt(localStorage.getItem('cserelj_last_donably_prompt') || '0', 10);
  const alreadyDonated = localStorage.getItem('cserelj_already_donated') === 'true';
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (!alreadyDonated && visitCount >= 3 && (now - lastPromptTime > sevenDays)) {
    setTimeout(() => {
      document.getElementById('modal-donably-support')?.classList.add('open');
      localStorage.setItem('cserelj_last_donably_prompt', now.toString());
    }, 2500);
  }
}

safeAddListener('btn-close-donably-modal', () => document.getElementById('modal-donably-support')?.classList.remove('open'));
safeAddListener('btn-donably-later', () => document.getElementById('modal-donably-support')?.classList.remove('open'));
safeAddListener('btn-donably-donate-click', () => {
  localStorage.setItem('cserelj_already_donated', 'true');
  document.getElementById('modal-donably-support')?.classList.remove('open');
});

function checkSystemUpdateEmailBanner() {
  const banner = document.getElementById('system-update-email-banner');
  const isDismissed = localStorage.getItem('cserelj_email_update_dismissed') === 'true';
  if (banner && !isDismissed) {
    banner.style.display = 'flex';
  }
}

safeAddListener('btn-dismiss-email-banner', () => {
  const banner = document.getElementById('system-update-email-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('cserelj_email_update_dismissed', 'true');
});

// =========================================================================
// FIREBASE AUTH & FELHASZNÁLÓI SZINKRONIZÁCIÓ
// =========================================================================

safeAddListener('btn-open-auth', () => document.getElementById('modal-auth')?.classList.add('open'));
safeAddListener('btn-close-auth', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', () => switchView('profil'));

safeAddListener('btn-google-login', () => {
  if (!auth) return;
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .then(() => showToast("Sikeres belépés."))
    .catch(e => showToast(e.message));
});

safeAddListener('btn-email-login', () => {
  if (!auth) return;
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  if (!em || !pw) return showToast("Add meg az e-mailt és a jelszót!");
  auth.signInWithEmailAndPassword(em, pw)
    .then(() => showToast("Sikeres belépés."))
    .catch(() => showToast("Hibás belépési adatok."));
});

safeAddListener('btn-email-signup', () => {
  if (!auth) return;
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  if (pw.length < 6) return showToast("A jelszónak legalább 6 karakteresnek kell lennie.");
  auth.createUserWithEmailAndPassword(em, pw)
    .then(() => showToast("Sikeres regisztráció."))
    .catch(e => showToast(e.message));
});

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
        listenToIncomingTrades(user.uid);
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
        listenToAlbums();
        if (user.email === ADMIN_EMAIL) listenToSuggestions();
      } else {
        if (myDocUnsubscribe) myDocUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (incomingTradesUnsubscribe) incomingTradesUnsubscribe();
        if (suggestionsUnsubscribe) suggestionsUnsubscribe();
        if (adminTab) adminTab.style.display = 'none';
        if (adminTabM) adminTabM.style.display = 'none';
        myIncomingMessages = [];
        myOutgoingMessages = [];

        myProfile = {
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
          privateNote: '',
          favorites: [],
          van: [],
          vanCounts: {},
          kell: [],
          foglalva: [],
          foglalvaCounts: {},
          activeTrades: []
        };

        renderGrid();
        renderActiveTradesPanel();
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
        listenToAlbums();

        if (guestNotice) guestNotice.style.display = 'flex';
        if (authArea) authArea.innerHTML = `<button class="btn btn-sm btn-primary" id="btn-open-auth">Belépés / Fiók</button>`;
        document.getElementById('btn-open-auth')?.addEventListener('click', () => document.getElementById('modal-auth')?.classList.add('open'));
      }
      checkMandatoryProfile();
      checkUnsubscribeParam();
    });
  } catch (e) {
    console.warn("Firebase hiba:", e);
  }
}

function checkUnsubscribeParam() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'unsubscribe' || params.get('optout') === 'email') {
    myProfile.emailNotifications = false;
    const chk = document.getElementById('prof-email-notif');
    if (chk) chk.checked = false;
    if (currentUser && db) {
      db.collection("users").doc(currentUser.uid).set({ emailNotifications: false }, { merge: true });
      db.collection("public_profiles").doc(currentUser.uid).set({ emailNotifications: false }, { merge: true });
      showToast("Sikeresen leiratkoztál az e-mail értesítőkről.");
    }
  }
}

function checkMandatoryProfile() {
  const warning = document.getElementById('profile-warning');
  const isMissing = !myProfile.nev || !myProfile.nev.trim() || myProfile.nev === 'Vendég gyűjtő' ||
                    (!myProfile.telepules && (!myProfile.locations || myProfile.locations.length === 0)) ||
                    !myProfile.email || !myProfile.email.trim() || !myProfile.gdprAccepted;

  if (currentUser && isMissing && warning) {
    warning.style.display = 'block';
  } else if (warning) {
    warning.style.display = 'none';
  }
}

function listenToAllUsers() {
  if (!db) return;
  if (allUsersUnsubscribe) allUsersUnsubscribe();

  allUsersUnsubscribe = db.collection("public_profiles").onSnapshot(snapshot => {
    rawAllUsersDocs = snapshot.docs;
    allUsersData = [];

    snapshot.forEach(doc => {
      const parsedUser = extractUserData(doc.data(), doc.id, currentAlbumId);
      if (!parsedUser) return;
      if (parsedUser.van.length === 0 && parsedUser.kell.length === 0) return;
      allUsersData.push(parsedUser);
    });

    renderMatches();
    renderStatistics();
    renderProximityPartners();
    renderHub();
  }, err => console.warn("All users listener:", err));
}

function listenToMyProfile(uid) {
  if (!db) return;
  if (myDocUnsubscribe) myDocUnsubscribe();

  myDocUnsubscribe = db.collection("public_profiles").doc(uid).onSnapshot(async pubSnap => {
    if (Date.now() - lastLocalEditTimestamp < 1500) return;

    let pubData = pubSnap.exists ? pubSnap.data() : null;
    let userData = null;
    let subColData = null;

    try {
      const uSnap = await db.collection("users").doc(uid).get();
      if (uSnap.exists) userData = uSnap.data();
    } catch (err) {}

    try {
      const subSnap = await db.collection("public_profiles").doc(uid).collection("collections").doc(currentAlbumId).get();
      if (subSnap.exists) subColData = subSnap.data();
    } catch (err) {}

    const merged = { ...(userData || {}), ...(pubData || {}) };
    if (subColData) {
      if (!merged.collections) merged.collections = {};
      merged.collections[currentAlbumId] = subColData;
    }

    const parsed = extractUserData(merged, uid, currentAlbumId);

    if (parsed) {
      let loadedNote = userData?.privateNote;
      if (!loadedNote && merged.collections && merged.collections[currentAlbumId]) {
        loadedNote = merged.collections[currentAlbumId].privateNote;
      }
      if (!loadedNote) {
        loadedNote = localStorage.getItem(`private_note_${currentAlbumId}`) || '';
      }

      const remoteTime = (subColData?.localUpdatedAt || subColData?.updatedAt?.seconds * 1000 || pubData?.updatedAt?.seconds * 1000 || 0);
      const localTime = parseInt(localStorage.getItem(`lutra_updated_at_${currentAlbumId}`) || '0', 10);

      const hasRemoteData = (parsed.van.length > 0 || parsed.kell.length > 0);
      const isLocalEmpty = (myProfile.van.length === 0 && myProfile.kell.length === 0);

      if (hasRemoteData || remoteTime >= localTime || isLocalEmpty) {
        myProfile = {
          ...myProfile,
          nev: parsed.nev,
          telepules: parsed.telepules,
          locations: parsed.locations && parsed.locations.length > 0 ? parsed.locations : [{ city: parsed.telepules || '', districts: [] }],
          geo: parsed.geo || myGpsCoords,
          email: getFirstValidString(userData?.email, pubData?.email, myProfile.email),
          privateNote: (loadedNote || '').slice(0, 250),
          favorites: parsed.favorites || [],
          isGiftOffering: parsed.isGiftOffering,
          showEmailToUsers: parsed.showEmailToUsers,
          emailNotifications: parsed.emailNotifications !== false,
          allowInspect: parsed.allowInspect !== false,
          gdprAccepted: parsed.gdprAccepted !== false,
          isVacation: parsed.isVacation === true,
          trustScore: parsed.trustScore || 0,
          ratingsCount: parsed.ratingsCount || 0,
          recentReviews: parsed.recentReviews || [],
          van: parsed.van,
          kell: parsed.kell,
          foglalva: parsed.foglalva,
          vanCounts: parsed.vanCounts,
          foglalvaCounts: parsed.foglalvaCounts || {},
          lastActive: parsed.lastActive || Date.now()
        };

        localStorage.setItem(`lutra_updated_at_${currentAlbumId}`, remoteTime || Date.now());
        localStorage.setItem(`private_note_${currentAlbumId}`, myProfile.privateNote);
        if (currentAlbumId === 'lidl-lutra-2026') localStorage.setItem('lutra_private_note', myProfile.privateNote);

        localStorage.setItem(`lutra_van_${currentAlbumId}`, JSON.stringify(myProfile.van));
        localStorage.setItem(`lutra_van_counts_${currentAlbumId}`, JSON.stringify(myProfile.vanCounts || {}));
        localStorage.setItem(`lutra_kell_${currentAlbumId}`, JSON.stringify(myProfile.kell));
        localStorage.setItem(`lutra_foglalva_${currentAlbumId}`, JSON.stringify(myProfile.foglalva));
        localStorage.setItem(`lutra_foglalva_counts_${currentAlbumId}`, JSON.stringify(myProfile.foglalvaCounts || {}));

        renderGrid();
        renderActiveTradesPanel();
        if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();
      }

      const nI = document.getElementById('prof-nev'); if (nI) nI.value = myProfile.nev || '';
      const eI = document.getElementById('prof-email'); if (eI) eI.value = myProfile.email || '';
      const gI = document.getElementById('prof-gift'); if (gI) gI.checked = !!myProfile.isGiftOffering;
      const seI = document.getElementById('prof-show-email'); if (seI) seI.checked = !!myProfile.showEmailToUsers;
      const enI = document.getElementById('prof-email-notif'); if (enI) enI.checked = myProfile.emailNotifications !== false;
      const aiI = document.getElementById('prof-allow-inspect'); if (aiI) aiI.checked = myProfile.allowInspect !== false;
      const gdI = document.getElementById('prof-gdpr'); if (gdI) gdI.checked = myProfile.gdprAccepted !== false;
      const vacI = document.getElementById('prof-vacation-mode'); if (vacI) vacI.checked = !!myProfile.isVacation;

      const pNoteEl = document.getElementById('prof-private-note');
      if (pNoteEl) {
        pNoteEl.value = myProfile.privateNote;
        const countEl = document.getElementById('note-char-count');
        if (countEl) countEl.textContent = `${myProfile.privateNote.length}/250`;
      }

      initFavoriteSelects();
      renderProfileLocations();
      checkMandatoryProfile();
      refreshMatchesIfVisible();
      renderCompletionOdds();
    }
  });
}

// =========================================================================
// PWA TELEPÍTÉS, LIGHTBOX & RENDSZERINDÍTÁS (BOOT)
// =========================================================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'inline-flex';
});

safeAddListener('btn-pwa-install', () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(({ outcome }) => {
      if (outcome === 'accepted') {
        const btn = document.getElementById('btn-pwa-install');
        if (btn) btn.style.display = 'none';
      }
      deferredPrompt = null;
    });
  } else {
    showToast("iPhone-on: Kattints a Megosztás gombra, majd 'Főképernyőhöz adás'.");
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn("SW regisztráció:", err));
  });
}

document.addEventListener('click', (e) => {
  const img = e.target.closest('[data-action="open-lightbox"]');
  if (img) {
    const lightbox = document.getElementById('modal-image-lightbox');
    const lightboxImg = document.getElementById('lightbox-full-image');
    if (lightbox && lightboxImg) {
      lightboxImg.src = img.src;
      lightbox.classList.add('open');
    }
  }
});

document.getElementById('modal-image-lightbox')?.addEventListener('click', () => {
  document.getElementById('modal-image-lightbox')?.classList.remove('open');
});

// =========================================================================
// ALKALMAZÁS INDÍTÁSA
// =========================================================================
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderHub();
  renderGrid();
  renderActiveTradesPanel();
  initFavoriteSelects();
  initFirebase();
  listenToAlbums();
  checkDonablyReturningPrompt();
  checkSystemUpdateEmailBanner();
} catch (err) {
  console.error("Indítási hiba:", err);
}
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 ÉLES KIADÁS)
// 1 / 5. RÉSZ: ALAPARCHITEKTÚRA, ADATMODELL, JAVÍTOTT HUB & ALBUM REGISTRY
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
  } else if (targetAlbumId === 'lidl-lutra-2026') {
    rawVan = data.van || data.duplicates || data.duplak || [];
    rawKell = data.kell || data.missing || data.hianyzo || [];
    rawFoglalva = data.foglalva || data.reserved || [];
    vanCounts = data.vanCounts || {};
    foglalvaCounts = data.foglalvaCounts || {};
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
let outgoingTradesUnsubscribe = null;
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
    } else if (albumId === 'lidl-lutra-2026') {
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
              ${isRetro ? `<span class="album-type-badge badge-retro">Retro (${album.year})</span>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${album.year}</span>`}
              ${isInactive ? `<span class="badge-trade-status badge-inactive">Inaktív</span>` : ''}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.15rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 6px;">${escapeHtml(album.publisher || '')} • ${escapeHtml(album.subtitle || '')}</p>

          <div class="hub-card-stats-row">
            <span class="hub-stat-pill"><strong>${collectorsText}</strong> gyűjti</span>
            <span class="hub-stat-pill"><strong>${dupesText}</strong></span>
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

function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const isFigure = activeAlbum.type === 'figure';
  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const activeLocks = getActiveLockedCounts(currentAlbumId);

  for (let i = 1; i <= totalSize; i++) {
    const isVan = vanSet.has(i);
    const isKell = kellSet.has(i);

    if (currentFilter === 'van' && !isVan) continue;
    if (currentFilter === 'kell' && !isKell) continue;

    let cls = isVan ? 'van' : isKell ? 'kell' : '';
    if (isFigure) cls += ' cell-figure';

    let badgesHtml = '';
    const vQty = (isVan && myProfile.vanCounts && myProfile.vanCounts[i]) ? myProfile.vanCounts[i] : 1;
    const fQty = activeLocks[i] || 0;

    if (isVan && vQty > 1) badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    if (isVan && fQty > 0) badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;

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
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
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

  let totalInChapter = 0;
  let markedInChapter = 0;

  chapter.elemek.forEach(el => {
    const nums = el.type === 'combo' ? el.nums : [el.num];
    totalInChapter += nums.length;
    nums.forEach(n => {
      if (vanSet.has(n) || kellSet.has(n)) markedInChapter++;
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
          const isVan1 = vanSet.has(n1), isKell1 = kellSet.has(n1);
          const isVan2 = vanSet.has(n2), isKell2 = kellSet.has(n2);
          const q1 = isVan1 ? (myProfile.vanCounts[n1] || 1) : 1;
          const q2 = isVan2 ? (myProfile.vanCounts[n2] || 1) : 1;
          return `
            <div class="combo-wrapper">
              <div class="combo-title"><span>${escapeHtml(el.name)}</span></div>
              <div class="combo-halves">
                <div class="combo-half ${isVan1 ? 'van' : isKell1 ? 'kell' : ''}" data-num="${n1}">
                  ${(isVan1 && q1 > 1) ? `<span class="qty-badge">×${q1}</span>` : ''}
                  <span class="sticker-num">${escapeHtml(getItemLabel(n1))}</span>
                  <span class="sticker-tag">${isVan1 ? 'Dupla' : isKell1 ? 'Kell' : 'Bal fél'}</span>
                </div>
                <div class="combo-half ${isVan2 ? 'van' : isKell2 ? 'kell' : ''}" data-num="${n2}">
                  ${(isVan2 && q2 > 1) ? `<span class="qty-badge">×${q2}</span>` : ''}
                  <span class="sticker-num">${escapeHtml(getItemLabel(n2))}</span>
                  <span class="sticker-tag">${isVan2 ? 'Dupla' : isKell2 ? 'Kell' : 'Jobb fél'}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          const isVan = vanSet.has(el.num);
          const isKell = kellSet.has(el.num);
          const q = isVan ? (myProfile.vanCounts[el.num] || 1) : 1;
          let cls = isVan ? 'van' : isKell ? 'kell' : '';
          let orientClass = isLutra ? (el.orient === 'álló' ? 'orient-allo' : 'orient-fekvo') : 'orient-negyzet';

          return `
            <div class="slot ${orientClass} ${cls}" data-num="${el.num}">
              ${(isVan && q > 1) ? `<span class="qty-badge">×${q}</span>` : ''}
              <span class="sticker-num">${escapeHtml(getItemLabel(el.num))}</span>
              <span class="sticker-name">${escapeHtml(el.name)}</span>
              <span class="sticker-tag">${isVan ? 'Dupla' : isKell ? 'Hiányzik' : 'Üres'}</span>
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
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 ÉLES KIADÁS)
// 2 / 5. RÉSZ: 0 MS INTERAKCIÓK, UNDO, SZŰRŐK, PÁROSÍTÁSOK & CSERE-TERVEZŐ
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

  const albumSlots = document.querySelectorAll(`[data-num="${num}"]`);
  albumSlots.forEach(el => {
    if (el.classList.contains('slot') || el.classList.contains('combo-half')) {
      el.classList.remove('van', 'kell');
      if (state) el.classList.add(state);
      const tag = el.querySelector('.sticker-tag');
      if (tag) {
        tag.textContent = state === 'van' ? 'Dupla' : state === 'kell' ? 'Hiányzik' : 'Üres';
      }
    }
  });
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

// ROUTER & NÉZETVÁLTÓ MOTOR
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
    const mBadgeM = document.getElementById('meetup-badge-m');
    if (mBadge) mBadge.style.display = 'none';
    if (mBadgeM) mBadgeM.style.display = 'none';
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
    statusEl.innerHTML = '<span style="color:var(--amber);">Helyzet bemérése folyamatban...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myGpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myProfile.geo = myGpsCoords;
      localStorage.setItem('cserelj_gps_coords', JSON.stringify(myGpsCoords));
      if (statusEl) {
        statusEl.innerHTML = '<span style="color:var(--moss-soft);">Helyzet sikeresen bemérve! Távolsági szűrők aktívak.</span>';
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
      const isRecentlyActive = updatedAgo.includes('ma') || updatedAgo.includes('tegnap') || (parseInt(updatedAgo, 10) <= 5);

      return { ...u, give, get, score, isSameCity, isGift, distanceKm, updatedAgo, isRecentlyActive };
    })
    .filter(m => m.score > 0 || (m.isGift && m.get.length > 0));

  if (filterTargetCity) {
    matches = matches.filter(m => isLocalCityMatch(filterTargetCity, m.locations || m.telepules));
  } else {
    if (filterSameCity) matches = matches.filter(m => m.isSameCity);
    if (filterGiftOnly) matches = matches.filter(m => m.isGift);
  }

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
    const distText = m.distanceKm !== null ? `kb. ${m.distanceKm} km` : (m.isSameCity ? 'Helyi gyűjtő' : '');
    const timeText = m.updatedAgo ? `• ${m.updatedAgo}` : '';
    const trustBadge = m.ratingsCount > 0 
      ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${(m.trustScore / m.ratingsCount).toFixed(1)} (${m.ratingsCount})</span>`
      : (m.trustScore > 0 ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${m.trustScore}</span>` : '<span style="font-size:0.72rem; color:var(--text-muted);">Új gyűjtő</span>');

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
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 ÉLES KIADÁS)
// 3 / 5. RÉSZ: FOTÓS SZÁMSZKENNER, EGYEDI AJÁNLATOK & FACEBOOK POSZT ELEMZŐ
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

// BELSŐ ÜZENET KÜLDÉSE & KÉTOLDALÚ CSEREINDÍTÁS (AZONOS ZÁROLÁSSAL)
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

        // Azonnali zárolás a feladónál!
        effectiveGiveNums.forEach(n => {
          if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
        });

        saveMyState();
        renderActiveTradesPanel();
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
// FACEBOOK / CETLI ELEMZŐ BŐVÍTETT SZINONIMA PARSER
// =========================================================================

function parseFacebookPostText(rawText) {
  let otherHas = [];
  let otherNeeds = [];

  // Bővített szinonimakészlet a VAN és KELL ágak felismeréséhez
  const HAS_KW = /(?:^|\s|[,;])(?:van|dupl[aá]k?|cser[eé]k?|cserematric[aá]k?|adom|adok|cser[eé]lem|plusz|plussz|tudok adni|tudunk adni|tudjuk adni|k[íi]n[aá]l|felesleg)[:\s\-—–]*/i;
  const NEEDS_KW = /(?:^|\s|[,;])(?:kell|hi[aá]ny(?:z[oó]k?)?|hiányzik|k[eé]rem|keres(?:em|s[uü]k|n[eé]م)?|valakinek megvan|vinn[eé]k|sz[uü]ks[eé]gem van)[:\s\-—–]*/i;

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
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 ÉLES KIADÁS)
// 4 / 5. RÉSZ: RÁCS ALATTI CSERÉK, ZÁROLÁSOK, SZERKESZTHETŐ ELFOGADÁS & ARCHÍVUM
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

  // Archivált cserék szekció (teljesített és visszavont cserék)
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

// Szerkeszthető elfogadás modal kezelő
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

  // Zárolás aktiválása a felajánlott tételekre
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

  if (btn.dataset.action === 'open-edit-accept-modal') {
    openEditAcceptModal(idx);
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
// KÉTOLDALÚ BEJÖVŐ CSEREAJÁNLAT MODAL & FELUGRÓ ÉRTESÍTÉSEK
// =========================================================================

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

  if (getListEl) {
    getListEl.innerHTML = receivedItemsStr || '<em>(Ajándékozás)</em>';
  }

  if (giveListEl) {
    giveListEl.innerHTML = (data.receivingItems && data.receivingItems.length)
      ? data.receivingItems.map(n => getItemLabel(n, data.albumId)).join(', ')
      : '<em>(Ingyen felajánlás / Nem kér cserét)</em>';
  }

  if (msgBox) {
    msgBox.innerHTML = data.message ? `„${formatLinksWithAnchors(data.message)}”` : '<em>(A partner nem fűzött hozzá külön megjegyzést.)</em>';
  }

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
  showToast("Csere elfogadva! A tételek mindkettőtöknél zárolásra kerültek.");
});

safeAddListener('btn-reject-incoming-prompt', () => {
  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
  document.getElementById('modal-cancel-trade-reason')?.classList.add('open');
});

// =========================================================================
// CSERE LEMONDÁSI INDOKLÁS & AUTOMATA PONTOS (N-X) DUPLALEVONÁS
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
    // Áthelyezzük az archívumba státuszcserével
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

// =========================================================================
// CSERE LEZÁRÁSA & PONTOS (N-X) KÉSZLETLEVONÁS
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

  // Kapott tételek hozzáadása a gyűjteményhez
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

  // Átadott tételek pontos (n-x) levonása a duplákból és a zárolásokból
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
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.5 ÉLES KIADÁS)
// 5 / 5. RÉSZ: 4 KERESŐ, HŐTÉRKÉP, ADMINISZTRÁCIÓS MOTOR & BOOTSTRAP
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
// FIREBASE AUTH & FELHASZNÁLÓI SZINKRONIZÁCIÓ BOOTSTRAP
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
        if (outgoingTradesUnsubscribe) outgoingTradesUnsubscribe();
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
    });
  } catch (e) {
    console.warn("Firebase hiba:", e);
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
        vanCounts: parsed.vanCounts,
        lastActive: parsed.lastActive || Date.now()
      };

      renderGrid();
      renderActiveTradesPanel();
    }
  });
}

// PWA & BOOTSTRAP
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
	// --- ÚJ RÉSZ A BELÉPÉS ÉS SZERKESZTÉSI GOMBHOZ ---
  const openAuthBtn = e.target.closest('#btn-open-auth');
  if (openAuthBtn) {
    document.getElementById('modal-auth')?.classList.add('open');
    return;
  }

  const editAcceptBtn = e.target.closest('[data-action="open-edit-accept-modal"]');
  if (editAcceptBtn) {
    const idx = parseInt(editAcceptBtn.dataset.tradeIdx, 10);
    openEditAcceptModal(idx);
    return;
  }
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

// ALKALMAZÁS INDÍTÁSA
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
  console.error("Indítási hiba:", err);
}
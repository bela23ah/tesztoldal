// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (5. FÁZIS VÉGLEGES KIADÁS)
// 1. RÉSZ: BŐVÍTETT ADATBÁZIS, 0 MS-OS RÁCS & FELHŐS ADATMODELL
// =========================================================================

let ALBUMS_REGISTRY = {
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
    hasFavorites: true
  },
  "garfield-mentsuk-meg-a-bolygot-2026": {
    id: "garfield-mentsuk-meg-a-bolygot-2026",
    title: "Garfield - Mentsük meg a bolygót 2026",
    subtitle: "Spar matricagyűjtemény",
    publisher: "Spar",
    year: 2026,
    totalItems: 200,
    type: "sticker",
    typeLabel: "Matricaalbum",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F130c309d-cda4-435f-8112-51b236ec8880.jpg&w=3840&q=75",
    featured: true,
    hasRadar: true,
    radarType: "spar",
    hasChapters: false,
    hasFavorites: true
  },
  "panini-fifa-world-cup-2026": {
    id: "panini-fifa-world-cup-2026",
    title: "FIFA World Cup 2026",
    subtitle: "Hivatalos VB matricagyűjtemény",
    publisher: "Panini",
    year: 2026,
    totalItems: 1345,
    type: "sticker",
    typeLabel: "Matricaalbum",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F6e6fdbf7-9a10-4a50-8337-f54e867ba053.jpg&w=3840&q=75",
    featured: true,
    hasRadar: true,
    radarType: "retail_general",
    hasChapters: false,
    hasFavorites: false
  },
  "fifa-world-cup-2026-adrenalyn-xl": {
    id: "fifa-world-cup-2026-adrenalyn-xl",
    title: "FIFA World Cup 2026 – Adrenalyn XL",
    subtitle: "Hivatalos VB kártyagyűjtemény",
    publisher: "Panini",
    year: 2026,
    totalItems: 630,
    type: "card",
    typeLabel: "Kártya",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ffifa-world-cup-2026-adrenalyn-xl.webp&w=3840&q=75",
    featured: true,
    hasRadar: true,
    radarType: "retail_general",
    hasChapters: false,
    hasFavorites: false
  },
  "topps-match-attax-uefa-champions-league-2025-26": {
    id: "topps-match-attax-uefa-champions-league-2025-26",
    title: "Topps Match Attax UEFA Champions League 2025/26",
    subtitle: "Hivatalos BL kártyák",
    publisher: "Topps",
    year: 2025,
    totalItems: 743,
    type: "card",
    typeLabel: "Kártya",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F0e1d4a44-674c-4dbf-8165-d1848067514f.jpg&w=3840&q=75",
    featured: true,
    hasRadar: false,
    radarType: "none",
    hasChapters: false,
    hasFavorites: false
  },
  "toy-story-5": {
    id: "toy-story-5",
    title: "Toy Story 5",
    subtitle: "Hivatalos matricagyűjtemény",
    publisher: "Panini",
    year: 2026,
    totalItems: 192,
    type: "sticker",
    typeLabel: "Matricaalbum",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F10110c3c-f734-4083-a1a1-14762ecda0c5.jpg&w=3840&q=75",
    featured: true,
    hasRadar: false,
    radarType: "none",
    hasChapters: false,
    hasFavorites: true
  },
  "mancs-orjarat-2026": {
    id: "mancs-orjarat-2026",
    title: "Mancs őrjárat - Legizgalmasabb kalandok!",
    subtitle: "Panini matricakollekció",
    publisher: "Panini",
    year: 2026,
    totalItems: 184,
    type: "sticker",
    typeLabel: "Matricaalbum",
    coverUrl: "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F3a6ea592-5bb6-411f-88ef-d4bcd2f31823.jpg&w=3840&q=75",
    featured: false,
    hasRadar: false,
    radarType: "none",
    hasChapters: false,
    hasFavorites: true
  }
};

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";
let showAllHubAlbums = false;
let editingAlbumId = null;
let saveDebounceTimer = null;
let lastLocalEditTimestamp = 0; // 🛡️ Helyi szerkesztésvédelem Firestore visszaszinkron ellen

// GPS, TÁVOLSÁGI & KERESÉSI ÁLLAPOTOK
let myGpsCoords = safeJsonParse('cserelj_gps_coords', null);
let selectedSearchRadius = 'all';
let selectedCityFilter = '';
let selectedNameFilter = '';

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

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// VÁROSI KOORDINÁTA-TÁR
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

// DINAMIKUS BOLTHÁLÓZAT TÁROLÓ (Firestore-ból szinkronizálva)
let STORE_DATABASES = safeJsonParse('cserelj_stores_cache', {
  "lidl": [], "spar": [], "tesco": [], "penny": []
});

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const ROMAN_NUMERALS = [
  "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  "XXI", "XXII", "XXIII"
];

const KNOWN_CANONICAL_CITIES = {
  "erd": "Érd", "gyor": "Győr", "pecs": "Pécs", "szeged": "Szeged",
  "debrecen": "Debrecen", "miskolc": "Miskolc", "kecskemet": "Kecskemét",
  "szekesfehervar": "Székesfehérvár", "szombathely": "Szombathely",
  "nyiregyhaza": "Nyíregyháza", "szolnok": "Szolnok", "tatabanya": "Tatabánya",
  "kaposvar": "Kaposvár", "bekescsaba": "Békéscsaba", "veszprem": "Veszprém",
  "zalaegerszeg": "Zalaegerszeg", "eger": "Eger", "sopron": "Sopron",
  "nagykanizsa": "Nagykanizsa", "dunaujvaros": "Dunaújváros",
  "hodmezovasarhely": "Hódmezővásárhely", "salgotarjan": "Salgótarján",
  "szekszard": "Szekszárd", "baja": "Baja", "siofok": "Siófok",
  "gyula": "Gyula", "oroshaza": "Orosháza", "keszthely": "Keszthely",
  "nagykoros": "Nagykőrös", "cegled": "Cegléd", "kiskunfelegyhaza": "Kiskunfélegyháza",
  "lajosmizse": "Lajosmizse", "dabas": "Dabas", "albertirsa": "Albertirsa",
  "tiszakecske": "Tiszakécske", "kiskunmajsa": "Kiskunmajsa", "kiskoros": "Kiskőrös",
  "budaors": "Budaörs", "szentendre": "Szentendre", "dunakeszi": "Dunakeszi",
  "godollo": "Gödöllő", "szigetszentmiklos": "Szigetszentmiklós"
};

function normalizeText(text) {
  if (!text) return '';
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseBudapestDistricts(text) {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/kerület|kerulet|ker\.?|district/g, ' ');
  const districts = [];

  const romanMap = {
    xxiii: 23, xxii: 22, xxi: 21, xx: 20, xix: 19, xviii: 18, xvii: 17, xvi: 16,
    xv: 15, xiv: 14, xiii: 13, xii: 12, xi: 11, x: 10, ix: 9, viii: 8, vii: 7,
    vi: 6, v: 5, iv: 4, iii: 3, ii: 2, i: 1
  };

  const romanMatches = clean.match(/\b(xxiii|xxii|xxi|xx|xix|xviii|xvii|xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/g);
  if (romanMatches) {
    romanMatches.forEach(r => { if (romanMap[r]) districts.push(romanMap[r]); });
  }

  const arabMatches = clean.match(/\b([1-9]|1[0-9]|2[0-3])\b/g);
  if (arabMatches) {
    arabMatches.forEach(n => districts.push(parseInt(n, 10)));
  }

  return [...new Set(districts)].sort((a, b) => a - b);
}

function extractNormalizedLocations(locationInput) {
  if (!locationInput) return [];
  const results = [];
  const SPLIT_REGEX = /[\/,;\\\+\-–—]|\bés\b|\bill\.?\b|\bvalamint\b/i;

  let rawList = [];
  if (Array.isArray(locationInput)) {
    locationInput.forEach(loc => {
      if (typeof loc === 'string') {
        loc.split(SPLIT_REGEX).forEach(t => { if (t.trim()) rawList.push(t.trim()); });
      } else if (loc && loc.city) {
        if (loc.districts && loc.districts.length > 0) {
          loc.districts.forEach(d => rawList.push(`Budapest ${d}. kerület`));
        } else {
          loc.city.split(SPLIT_REGEX).forEach(t => { if (t.trim()) rawList.push(t.trim()); });
        }
      }
    });
  } else if (typeof locationInput === 'string') {
    rawList = locationInput.split(SPLIT_REGEX).map(t => t.trim()).filter(t => t.length > 0);
  }

  rawList.forEach(raw => {
    const norm = normalizeText(raw);
    if (!norm) return;

    const isBp = norm.includes('budapest') || norm.includes('bp') || norm.includes('pest') || norm.includes('fovaros') || /^[0-9ivx\.\s\-]+ker/.test(norm);
    
    if (isBp) {
      const districts = parseBudapestDistricts(raw);
      if (districts.length > 0) {
        districts.forEach(d => {
          results.push({
            canonicalKey: `budapest_${d}`,
            displayName: `Budapest ${ROMAN_NUMERALS[d]}. kerület`,
            cityGroup: "Budapest"
          });
        });
      } else {
        results.push({
          canonicalKey: `budapest`,
          displayName: `Budapest`,
          cityGroup: "Budapest"
        });
      }
    } else if (norm.includes('erd') || norm.includes('parkvaros') || norm.includes('erdliget')) {
      results.push({ canonicalKey: 'erd', displayName: 'Érd', cityGroup: 'Érd' });
    } else if (norm.includes('gyor') || norm.includes('menfocsanak') || norm.includes('gyorszentivan')) {
      results.push({ canonicalKey: 'gyor', displayName: 'Győr', cityGroup: 'Győr' });
    } else {
      const cleanKey = norm.replace(/[\s\.\-]+/g, '');
      const prettyName = KNOWN_CANONICAL_CITIES[cleanKey] || raw.charAt(0).toUpperCase() + raw.slice(1);
      results.push({
        canonicalKey: cleanKey,
        displayName: prettyName,
        cityGroup: prettyName
      });
    }
  });

  const uniqueMap = new Map();
  results.forEach(item => {
    if (!uniqueMap.has(item.canonicalKey)) {
      uniqueMap.set(item.canonicalKey, item);
    }
  });

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

function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    const raw = album.customItems[num - 1];
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return `#${num}`;
}

// KOMPAKT, 0 MS-OS LUTRA NÉVTÁR ÉS TÁJOLÁSOK (HELYKÍMÉLŐ FORMÁTUMBAN)
const LUTRA_STICKER_NAMES = [
  "", "WWF logó", "Kék bálna", "Jegesmedve", "Hópárduc", "Óriáspanda", "Kondorkeselyű", "Bogáncslepke", "Atlanti tokhal", "Vidra",
  "Vöröshasú unka", "Barna medve", "Eurázsiai hiúz", "Szürke farkas", "Kacsafarkú szender", "Törpekuvik", "Erdei elefánt", "Gepárd",
  "Fehérhátú keselyű", "Közönséges cserepesteknős", "Nyugati gorilla", "Szélesszájú orrszarvú", "Amerikai bölény", "Fehérfejű rétisas",
  "Kaliforniai disznódelfin", "Vörhenyes kolibri", "Királylazac", "Pompás királylepke", "Jaguár", "Kutyafejű boa", "Arany oroszlánmajom",
  "Nagy jácintara", "Sakáre-kajmán", "Amazonasi folyamidelfin", "Mongol szajga", "Tigris (Bal)", "Tigris (Jobb)", "Borneói orangután",
  "Mandzsu daru", "Komodói sárkány", "Aranyarcú gibbon", "Keleti szürke óriáskenguru", "Tasman vombat", "Koala", "Kakapó",
  "Kacsacsőrű emlős", "Barna kivi", "Leopárdfóka", "Weddell-fóka", "Császárpingvin", "Adélie-pingvin (Bal)", "Adélie-pingvin (Jobb)",
  "Galambhojsza", "Antarktiszi krill", "Hosszúszárnyú bálna", "Kardszárnyú delfin (Bal)", "Kardszárnyú delfin (Jobb)", "Óriáscápa",
  "Kúpos fóka", "Parti lile", "Barna delfin", "Dodó", "Vékonycsőrű póling", "Erszényesfarkas", "Tarpán", "Vándorgalamb", "Őstulok",
  "Elefántmadár", "Korallszirti patkány", "Jávai orrszarvú", "Mezei hörcsög", "Röviduszonyú makócápa", "Európai angolna", "Spix-ara",
  "Vastagfarkú oposszum", "Arab bejza", "Fehérfarkú gnú", "Európai bölény", "Nagy szikibagoly", "Vörös kánya", "Mallorcai béka",
  "Élőhelyek elvesztése", "Élelmiszeripar", "Szennyezés", "Túlzott kizsákmányolás (Bal)", "Túlzott kizsákmányolás (Jobb)", "Túlhalászás",
  "Műanyaghulladék", "Folyószabályozás", "Erőforrások", "Éghajlatváltozás", "Inváziós fajok", "Védett területek", "Élelmiszerrendszer",
  "Megújuló energia", "Természetalapú megoldások", "Közösségi bevonás", "WWF hazai programok", "WWF erdőprogram", "Vizesélőhelyek",
  "Klímaprogramok", "Környezeti nevelés", "Jelképes örökbefogadás", "Természetmegfigyelés", "Kihívások otthon", "Vadon élő állatok",
  "Biotermékek", "Vadvirágos rétek", "Planetary Health Diet"
];

function getItemFullName(num, albumId = currentAlbumId) {
  if (albumId === 'lidl-lutra-2026') {
    return LUTRA_STICKER_NAMES[num] ? `#${num} ${LUTRA_STICKER_NAMES[num]}` : `#${num}`;
  }
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customNames && album.customNames[num - 1]) {
    return `${getItemLabel(num, albumId)} ${album.customNames[num - 1]}`;
  }
  return getItemLabel(num, albumId);
}

function expandCustomItemsText(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const tokens = rawText.split(/[\n,;]+/).map(t => t.trim()).filter(t => t.length > 0);
  const result = [];

  tokens.forEach(token => {
    const rangeMatch = token.match(/^([A-Za-z0-9_\s]+?)\s*(\d+)[\s\-—–]+(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1].trim();
      const start = parseInt(rangeMatch[2], 10);
      const end = parseInt(rangeMatch[3], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let i = min; i <= max; i++) {
        result.push(`${prefix} ${i}`);
      }
    } else {
      result.push(token);
    }
  });
  return result;
}

function expandCustomNamesText(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const mapByIndex = {};
  let maxIndexFound = 0;
  let hasIndexedNames = false;

  const regexNamed = /(?:^|\s+|,\s*)(?:#?(\d+))[\s:\.\-—–]+([^#\n\r]+?)(?=(?:\s+#?\d+[\s:\.\-—–]+)|$|,)/g;
  let match;

  if (/^#?\d+[\s:\.\-—–]+/m.test(rawText.trim()) || /(?:^|\s+)#?\d+[\s:\.\-—–]+/.test(rawText)) {
    while ((match = regexNamed.exec(rawText)) !== null) {
      const idx = parseInt(match[1], 10);
      const name = match[2].trim().replace(/^[,\s]+|[,\s]+$/g, '');
      if (idx > 0 && name.length > 0) {
        mapByIndex[idx] = name;
        if (idx > maxIndexFound) maxIndexFound = idx;
        hasIndexedNames = true;
      }
    }
  }

  if (hasIndexedNames && maxIndexFound > 0) {
    const indexedResult = [];
    for (let i = 1; i <= maxIndexFound; i++) {
      indexedResult.push(mapByIndex[i] || '');
    }
    return indexedResult;
  }

  return rawText.split(/[\n,;]+/).map(t => t.trim()).filter(t => t.length > 0);
}

function parseChaptersText(rawText, customItems = []) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/[\r\n]+/);
  const chapters = [];

  lines.forEach((line, idx) => {
    line = line.trim();
    if (!line) return;

    const isCombo = line.toLowerCase().includes('[combo]');
    const cleanLine = line.replace(/\[combo\]/gi, '').trim();

    const rangeMatch = cleanLine.match(/(?:#?\s*)(\d+)[\s\-—–−]+(?:#?\s*)(\d+)/);
    if (!rangeMatch) return;

    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    const min = Math.min(start, end);
    const max = Math.max(start, end);

    let title = cleanLine
      .replace(/(?:#?\s*)(\d+)[\s\-—–−]+(?:#?\s*)(\d+)/g, '')
      .replace(/^[\s:\.\-—–]+|[\s:\.\-—–]+$/g, '')
      .trim();

    if (!title) title = `${idx + 1}. fejezet`;

    const elements = [];
    if (isCombo && max - min === 1) {
      elements.push({
        type: "combo",
        nums: [min, max],
        name: title,
        orient: "panoráma"
      });
    } else {
      for (let n = min; n <= max; n++) {
        const customName = customItems && customItems[n - 1] ? customItems[n - 1] : `#${n}`;
        elements.push({
          type: "single",
          num: n,
          name: customName,
          orient: "négyzet"
        });
      }
    }

    if (elements.length > 0) {
      chapters.push({
        id: `chap_${idx + 1}`,
        cim: title,
        elemek: elements
      });
    }
  });

  return chapters;
}

// LUTRA 108 MATRICA DINAMIKUS TÁJOLÁSGENERÁTOR (FEKETE MEDVÉK, PANORÁMÁK, ÁLLÓK)
function getLutraChapters() {
  const alloStickers = new Set([1, 37, 38, 49, 52, 61, 62, 102, 103, 108]);
  const combos = { 35: 36, 50: 51, 55: 56, 84: 85 };

  const rawChapterRanges = [
    { cim: "1. oldal — Bevezető", range: [1, 1] },
    { cim: "2–3. oldal — Élettel teli bolygó", range: [2, 9] },
    { cim: "4–5. oldal — Európa", range: [10, 15] },
    { cim: "6–7. oldal — Afrika", range: [16, 21] },
    { cim: "8–9. oldal — Észak-Amerika", range: [22, 27] },
    { cim: "10–11. oldal — Dél-Amerika", range: [28, 33] },
    { cim: "12–13. oldal — Ázsia", range: [34, 40] },
    { cim: "14–15. oldal — Ausztrália és Óceánia", range: [41, 46] },
    { cim: "16–17. oldal — Antarktisz", range: [47, 53] },
    { cim: "18–19. oldal — Tengerek és óceánok", range: [54, 60] },
    { cim: "20–21. oldal — Kihalt állatok", range: [61, 68] },
    { cim: "22–23. oldal — Veszélyeztetett fajok", range: [69, 74] },
    { cim: "24–25. oldal — Megmentett állatok", range: [75, 80] },
    { cim: "26–27. oldal — Mi fenyegeti a természetet?", range: [81, 91] },
    { cim: "28–29. oldal — Bolygóbarát megoldások", range: [92, 96] },
    { cim: "30–31. oldal — WWF Magyarország", range: [97, 102] },
    { cim: "32. oldal — Legyél bolygóvédő szuperhős!", range: [103, 105] },
    { cim: "33. oldal — Zöldebb jövő a Lidlnél", range: [106, 108] }
  ];

  return rawChapterRanges.map((ch, idx) => {
    const elemek = [];
    let num = ch.range[0];
    while (num <= ch.range[1]) {
      if (combos[num]) {
        const next = combos[num];
        elemek.push({
          type: "combo",
          nums: [num, next],
          name: LUTRA_STICKER_NAMES[num].replace(' (Bal)', ''),
          orient: "panoráma"
        });
        num += 2;
      } else {
        elemek.push({
          type: "single",
          num: num,
          name: LUTRA_STICKER_NAMES[num] || `#${num}`,
          orient: alloStickers.has(num) ? "álló" : "fekvő"
        });
        num += 1;
      }
    }
    return { id: `lutra_ch_${idx + 1}`, cim: ch.cim, elemek };
  });
}

function getActiveChapters() {
  const activeAlbum = getActiveAlbum();
  if (currentAlbumId === 'lidl-lutra-2026') return getLutraChapters();
  if (activeAlbum.type === 'sticker' && activeAlbum.customChaptersList && activeAlbum.customChaptersList.length > 0) {
    return activeAlbum.customChaptersList;
  }
  return [];
}

function safeAddListener(id, eventOrHandler, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof eventOrHandler === 'function') {
    el.addEventListener('click', eventOrHandler);
  } else if (typeof eventOrHandler === 'string' && typeof handler === 'function') {
    el.addEventListener(eventOrHandler, handler);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureArray(val) {
  if (!val) return [];
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 2000;
  if (Array.isArray(val)) {
    return val
      .map(item => parseInt(String(item).replace(/[^\d]/g, ''), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'string') {
    return val.split(/[\s,;]+/)
      .map(token => parseInt(String(token).replace(/[^\d]/g, ''), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'object') {
    return Object.keys(val)
      .map(token => parseInt(String(token).replace(/[^\d]/g, ''), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  return [];
}

function safeJsonParse(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    if (!item) return fallback;
    return JSON.parse(item);
  } catch (e) {
    return fallback;
  }
}

function getFirstValidString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return '';
}

// 🔒 KIZÁRÓLAG AZ AKTÍV FOLYAMATBAN LÉVŐ CSERÉKBŐL SZÁMOLT LAKAT-SZÁMLÁLÓ
function getActiveLockedCounts(albumId = currentAlbumId) {
  const counts = {};
  (myProfile.activeTrades || []).forEach(t => {
    if (t.status === 'pending' && (t.albumId || 'lidl-lutra-2026') === albumId) {
      (t.givingItems || []).forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
      });
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
  } else if (targetAlbumId === 'lidl-lutra-2026') {
    rawVan = data.van || data.duplicates || data.duplak || [];
    rawKell = data.kell || data.missing || data.hianyzo || [];
    rawFoglalva = data.foglalva || data.reserved || [];
    vanCounts = data.vanCounts || {};
    foglalvaCounts = data.foglalvaCounts || {};
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
  const trustScore = parseFloat(data.trustScore || '0');
  const ratingsCount = parseInt(data.ratingsCount || '0', 10);
  const recentReviews = Array.isArray(data.recentReviews) ? data.recentReviews : [];

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
    trustScore,
    ratingsCount,
    recentReviews
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
  trustScore: 0,
  ratingsCount: 0,
  privateNote: '',
  favorites: [9, 4, 35],
  van: [],
  vanCounts: {},
  kell: [],
  foglalva: [],
  foglalvaCounts: {},
  activeTrades: []
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
let storesUnsubscribe = null;
let db = null;
let auth = null;

let activeContactTarget = {
  uid: '',
  nev: '',
  telepules: '',
  email: '',
  showEmail: false,
  subject: ''
};

function initFavoriteSelects() {
  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const favContainer = document.getElementById('prof-favorites-container');

  if (favContainer) {
    favContainer.style.display = (activeAlbum.hasFavorites !== false) ? 'block' : 'none';
  }

  const titleEl = document.getElementById('prof-favorites-title');
  if (titleEl) {
    titleEl.innerHTML = currentAlbumId === 'lidl-lutra-2026'
      ? `Top 3 Kedvenc Állatod / Matricád <strong style="color:var(--amber);">*</strong>`
      : `Top 3 Kedvenc Tételed (${escapeHtml(activeAlbum.title)}) <strong style="color:var(--amber);">*</strong>`;
  }

  ['prof-fav-1', 'prof-fav-2', 'prof-fav-3'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    sel.innerHTML = '<option value="">-- Válassz egyet --</option>';
    for (let i = 1; i <= totalSize; i++) {
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
      checkMandatoryProfile();
    };
  });
}

function updateHubSocialProofMetrics() {
  const collectorsEl = document.getElementById('sp-collectors-count');
  const trackedEl = document.getElementById('sp-tracked-items-count');
  const duplicatesEl = document.getElementById('sp-duplicates-count');
  const tradesEl = document.getElementById('sp-completed-trades-count');

  if (!collectorsEl) return;

  const totalCollectors = Math.max(733, allUsersData.length);
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
  if (tradesEl) tradesEl.textContent = `${Math.max(240, Math.round(totalCollectors * 0.35))}+`;
}

function renderHub() {
  const container = document.getElementById('hub-albums-grid');
  const toggleBtn = document.getElementById('btn-toggle-all-hub-albums');
  const countSpan = document.getElementById('hub-total-albums-count');
  const searchInput = document.getElementById('hub-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();

  if (!container) return;

  updateHubSocialProofMetrics();

  const allFilteredList = Object.values(ALBUMS_REGISTRY).filter(album => {
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
      const myCount = ensureArray(safeJsonParse(`lutra_van_${album.id}`, [])).length;
      return myCount > 0;
    }
    return true;
  });

  if (countSpan) countSpan.textContent = allFilteredList.length;

  let displayList = allFilteredList;
  if (currentHubFilter === 'all' && !showAllHubAlbums && !query) {
    displayList = allFilteredList.slice(0, 6);
  }

  if (toggleBtn) {
    if (currentHubFilter !== 'all' || allFilteredList.length <= 6 || query) {
      toggleBtn.style.display = 'none';
    } else {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.innerHTML = showAllHubAlbums 
        ? '▲ Csak a kiemeltek mutatása (6 db)' 
        : `Összes gyűjtemény listázása (${allFilteredList.length} db) ▼`;
    }
  }

  container.innerHTML = displayList.map(album => {
    const isFeatured = album.featured === true || album.id === 'lidl-lutra-2026';
    const isRetro = album.year < 2018 || album.isRetro === true;
    const albumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : []));
    const collectedCount = albumVan.length;
    const pct = Math.min(100, Math.round((collectedCount / album.totalItems) * 100));
    const cover = album.coverUrl || 'og-image.png';

    return `
      <div class="album-hub-card ${isFeatured ? 'featured-card' : ''}" data-album-id="${escapeHtml(album.id)}">
        <div>
          <img src="${cover}" class="hub-card-thumb" alt="${escapeHtml(album.title)}" loading="lazy">
          <div class="album-hub-header">
            <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
              <span class="album-type-badge">${escapeHtml(album.typeLabel)}</span>
              ${isRetro ? `<span class="album-type-badge badge-retro">🕹️ Retro (${album.year})</span>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${album.year}</span>`}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.15rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 10px;">${escapeHtml(album.publisher)} • ${escapeHtml(album.subtitle || '')}</p>
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

safeAddListener('hub-search-input', 'input', () => renderHub());

safeAddListener('btn-toggle-all-hub-albums', () => {
  showAllHubAlbums = !showAllHubAlbums;
  renderHub();
});

safeAddListener('hub-albums-grid', (e) => {
  const btn = e.target.closest('[data-action="select-album"]');
  const card = e.target.closest('.album-hub-card');
  const albumId = btn?.dataset.albumId || card?.dataset.albumId;
  if (!albumId) return;

  selectAlbum(albumId);
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

  if (chain === 'retail_general') {
    inputEl.placeholder = "Írd be a várost és az üzletet (pl. Nyugati Relay vagy Árkád Müller)...";
  } else if (STORE_DATABASES[chain] && STORE_DATABASES[chain].length > 0) {
    const chainName = chain === 'lidl' ? 'Lidl' : (activeAlbum.publisher || chain);
    inputEl.placeholder = `Válassz a(z) ${chainName} áruházak listájából vagy írd be a várost...`;
    STORE_DATABASES[chain].forEach(store => {
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
  const activeAlbum = getActiveAlbum();

  const albumBar = document.getElementById('active-album-bar');
  const titleEl = document.getElementById('active-album-title');
  const thumbEl = document.getElementById('active-album-thumb');
  const noteTitleEl = document.getElementById('prof-note-album-title');
  const statAlbumName = document.getElementById('stats-active-album-name');
  const sizeSpan = document.getElementById('count-total-size');

  if (albumBar) albumBar.style.display = 'flex';
  if (titleEl) titleEl.textContent = `${activeAlbum.title} (${activeAlbum.year})`;
  if (thumbEl) thumbEl.src = activeAlbum.coverUrl || 'og-image.png';
  if (noteTitleEl) noteTitleEl.textContent = activeAlbum.title;
  if (statAlbumName) statAlbumName.textContent = activeAlbum.title;
  if (sizeSpan) sizeSpan.textContent = activeAlbum.totalItems;

  const primaryNav = document.getElementById('main-primary-nav');
  const mobileNav = document.getElementById('mobile-subnav-bar');
  if (primaryNav) primaryNav.style.display = 'grid';
  if (mobileNav) mobileNav.style.display = 'block';

  updateRadarStoreDatalist();

  const albumModeToggle = document.querySelector('.view-mode-toggle');
  if (albumModeToggle) {
    albumModeToggle.style.display = (activeAlbum.type === 'sticker' && activeAlbum.hasChapters) ? 'flex' : 'none';
  }

  const certPromoCard = document.getElementById('cert-promo-card');
  if (certPromoCard) {
    certPromoCard.style.display = albumId === 'lidl-lutra-2026' ? 'block' : 'none';
  }

  const gridEl = document.getElementById('matrica-grid');
  if (gridEl) {
    gridEl.classList.toggle('matrica-grid-figures', activeAlbum.type === 'figure');
  }

  loadAlbumState(albumId);
  initFavoriteSelects();
  switchView('matricaim');
  showToast(`Aktív gyűjtemény: ${activeAlbum.title}`);
}

safeAddListener('btn-switch-album', () => {
  const albumBar = document.getElementById('active-album-bar');
  const primaryNav = document.getElementById('main-primary-nav');
  const mobileNav = document.getElementById('mobile-subnav-bar');

  if (albumBar) albumBar.style.display = 'none';
  if (primaryNav) primaryNav.style.display = 'none';
  if (mobileNav) mobileNav.style.display = 'none';

  switchView('hub');
});

function loadAlbumState(albumId) {
  myProfile.van = ensureArray(safeJsonParse(`lutra_van_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : [])).sort((a, b) => a - b);
  myProfile.vanCounts = safeJsonParse(`lutra_van_counts_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van_counts', {}) : {});
  myProfile.kell = ensureArray(safeJsonParse(`lutra_kell_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_kell', []) : [])).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(safeJsonParse(`lutra_foglalva_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_foglalva', []) : [])).sort((a, b) => a - b);
  myProfile.foglalvaCounts = safeJsonParse(`lutra_foglalva_counts_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_foglalva_counts', {}) : {});
  myProfile.activeTrades = safeJsonParse(`lutra_active_trades_${albumId}`, []);
  
  let savedNote = localStorage.getItem(`private_note_${albumId}`);
  if (!savedNote && albumId === 'lidl-lutra-2026') {
    savedNote = localStorage.getItem('lutra_private_note') || '';
  }
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

document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedFilter = btn.dataset.hubFilter;
    
    if (btn.classList.contains('active') && clickedFilter !== 'all') {
      document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
      document.querySelector('.filter-btn[data-hub-filter="all"]')?.classList.add('active');
      currentHubFilter = 'all';
    } else {
      document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHubFilter = clickedFilter;
    }
    
    renderHub();
  });
});

// =========================================================================
// RÁCS RENDERELÉS: SZABAD DUPLA + 🔒 DINAMIKUS LAKAT (CSAK VALÓDI CSERÉNÉL!)
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

  // Dinamikusan csak az aktív cserékből olvasunk lakatot!
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

    if (isVan && vQty > 1) {
      badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    }
    if (isVan && fQty > 0) {
      badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    } else if (isFog) {
      const manQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[i]) ? myProfile.foglalvaCounts[i] : 1;
      if (manQty > 1) {
        badgesHtml += `<span class="qty-badge foglalva">×${manQty}</span>`;
      }
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
          
          let orientClass = isLutra 
            ? (el.orient === 'álló' ? 'orient-allo' : 'orient-fekvo')
            : 'orient-negyzet';

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

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');

// =========================================================================
// ⚡ 0 MS-OS 4-ÁLLAPOTÚ CIKLUS (BERAGADÁS ÉS VILLÓDZÁSMENTES)
// =========================================================================
function toggleStickerState(num) {
  hideQtyPopover();

  const isVan = myProfile.van.includes(num);
  const isKell = myProfile.kell.includes(num);
  const isFog = myProfile.foglalva.includes(num);

  let newState = '';

  // 1. Alapból ➔ DUPLA (🟢 Zöld)
  if (!isVan && !isKell && !isFog) {
    myProfile.van.push(num);
    myProfile.vanCounts[num] = 1;
    newState = 'van';
  }
  // 2. Duplából ➔ HIÁNYZIK (🟤 Barna)
  else if (isVan) {
    const idx = myProfile.van.indexOf(num);
    if (idx > -1) myProfile.van.splice(idx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num);
    newState = 'kell';
  }
  // 3. Hiányzóból ➔ FOGLALT (🔵 Kék)
  else if (isKell) {
    const idx = myProfile.kell.indexOf(num);
    if (idx > -1) myProfile.kell.splice(idx, 1);
    myProfile.foglalva.push(num);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[num] = 1;
    newState = 'foglalva';
  }
  // 4. Foglaltból ➔ ALAP / ÜRES (Megvan az albumban)
  else if (isFog) {
    const idx = myProfile.foglalva.indexOf(num);
    if (idx > -1) myProfile.foglalva.splice(idx, 1);
    if (myProfile.foglalvaCounts) delete myProfile.foglalvaCounts[num];
    newState = '';
  }

  updateSingleCellDOM(num, newState);
  updateBadgeCounts();
  saveMyStateFast();
}

function updateSingleCellDOM(num, state) {
  const cell = document.querySelector(`.matrica-cell[data-num="${num}"]`);
  if (cell) {
    cell.classList.remove('van', 'kell', 'foglalva');
    if (state) cell.classList.add(state);
    
    const badges = cell.querySelectorAll('.qty-badge');
    badges.forEach(b => b.remove());

    let badgesHtml = '';
    const vQty = (state === 'van' && myProfile.vanCounts?.[num]) ? myProfile.vanCounts[num] : 0;
    const activeLocks = getActiveLockedCounts(currentAlbumId);
    const fQty = activeLocks[num] || 0;

    if (vQty > 1) {
      badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    }
    if (fQty > 0 && state === 'van') {
      badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    } else if (state === 'foglalva') {
      const manQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[num]) ? myProfile.foglalvaCounts[num] : 1;
      if (manQty > 1) {
        badgesHtml += `<span class="qty-badge foglalva">×${manQty}</span>`;
      }
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
  let currentQty = 1;
  if (myProfile.van.includes(num)) currentQty = myProfile.vanCounts[num] || 1;
  if (myProfile.foglalva.includes(num)) currentQty = myProfile.foglalvaCounts?.[num] || 1;

  document.querySelectorAll('.qty-pop-btn').forEach(btn => {
    const q = parseInt(btn.dataset.qty, 10);
    btn.classList.toggle('active', q === currentQty);
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

// =========================================================================
// ÉRINTÉS ÉS KATTINTÁSKEZELŐ (JOBB KLIKK / HOSSZÚ NYOMÁS = POPOVER)
// =========================================================================
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
    if (moveX > 10 || moveY > 10) {
      clearTimeout(longPressTimer);
    }
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
    [`collections.${albumId}`]: {
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      foglalva: myProfile.foglalva,
      foglalvaCounts: myProfile.foglalvaCounts || {},
      updatedAt: Date.now()
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
  lastLocalEditTimestamp = Date.now();

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
    renderCompletionOdds();
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
    
    if (myProfile.van.includes(activePopoverNum)) {
      myProfile.vanCounts[activePopoverNum] = qty;
    } else if (myProfile.foglalva.includes(activePopoverNum)) {
      if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
      myProfile.foglalvaCounts[activePopoverNum] = qty;
    } else {
      myProfile.van.push(activePopoverNum);
      myProfile.vanCounts[activePopoverNum] = qty;
    }

    saveMyState();
    hideQtyPopover();
    showToast(`${getItemLabel(activePopoverNum)}: ${qty} db`);
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
// 2. RÉSZ: ROUTER, 4 BLOKKOS KERESŐ, MESSENGER CSEVEGŐSZÁLAK (THREADED CHAT),
// EGYÉNI FELAJÁNLÁS MEZŐ & VALÓS IDEJŰ PIPÁK (✓ / ✓✓)
// =========================================================================

// AUTOMATIKUS LINKFELISMERŐ
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
    renderStatistics();
    renderCompletionOdds();
    initOrUpdateLeafletMap();
  }
  if (viewName === 'radar') {
    renderRadarReports();
    const rBadge = document.getElementById('radar-badge');
    if (rBadge) rBadge.style.display = 'none';
  }
  if (viewName === 'meetups') {
    renderMeetups();
    const mBadge = document.getElementById('meetup-badge');
    const mBadgeM = document.getElementById('meetup-badge-m');
    if (mBadge) mBadge.style.display = 'none';
    if (mBadgeM) mBadgeM.style.display = 'none';
    updateCserebereBadge();
  }
  if (viewName === 'uzeneteim') {
    renderThreadedChat();
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
    renderAdminAnnouncements();
    renderAdminAlbumsList();
    renderAdminSuggestionsList();
  }
  if (viewName === 'profil') {
    initFavoriteSelects();
    renderProfileLocations();
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

// GPS ÉS TÁVOLSÁG MEGHATÁROZÁSA
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

safeAddListener('btn-match-all', 'click', function() { setActiveMatchFilter(this, 'all'); });
safeAddListener('btn-match-city', 'click', function() {
  if (!myProfile.telepules && (!myProfile.locations || myProfile.locations.length === 0)) {
    return showToast("Előbb add meg a településed a Profil fülön!");
  }
  setActiveMatchFilter(this, 'city');
});
safeAddListener('btn-match-gift', 'click', function() { setActiveMatchFilter(this, 'gift'); });
safeAddListener('btn-match-loop', 'click', function() { setActiveMatchFilter(this, 'loop'); });

function refreshMatchesIfVisible() {
  const v = document.getElementById('view-cserek');
  if (v && v.classList.contains('active')) renderMatches();
}

function setActiveMatchFilter(btn, filterType) {
  document.querySelectorAll('#view-cserek .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  matchFilter = filterType;
  renderMatches();
}

safeAddListener('btn-refresh-matches', () => {
  renderMatches();
  showToast("Párosítások frissítve.");
});

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
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .map(u => {
      const uVanSet = new Set(ensureArray(u.van));
      const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
      
      const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
      const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      const score = Math.min(give.length, get.length);

      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const isGift = u.isGiftOffering === true;
      const distanceKm = getMinDistanceToUser(myCoords, u);

      return { ...u, give, get, score, isSameCity, isGift, distanceKm };
    })
    .filter(m => m.score > 0 || (m.isGift && m.get.length > 0));

  if (matchFilter === 'city') matches = matches.filter(m => m.isSameCity);
  if (matchFilter === 'gift') matches = matches.filter(m => m.isGift);

  matches.sort((a, b) => {
    if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    return b.score - a.score;
  });

  if (matches.length === 0) {
    list.innerHTML = '<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner ehhez a gyűjteményhez.</p>';
    return;
  }

  list.innerHTML = matches.map((m) => {
    const isCheckedInPlan = selectedTradePlanUids.has(m.id);
    const distBadge = m.distanceKm !== null ? `<span style="font-size:0.75rem; color:var(--amber); font-weight:700;">📍 kb. ${m.distanceKm} km</span>` : '';
    const trustBadge = m.ratingsCount > 0 
      ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${(m.trustScore / m.ratingsCount).toFixed(1)} (${m.ratingsCount})</span>`
      : (m.trustScore > 0 ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${m.trustScore}</span>` : '');

    return `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''} ${trustBadge}
          </h3>
          ${distBadge}
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
            Kapcsolatfelvétel
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
        ${conflicts.map(c => {
          const currentWinnerUid = tradePlanManualOverrides[c.num] || [...c.demandList].sort((a, b) => {
            if (b.totalGivesToMe !== a.totalGivesToMe) return b.totalGivesToMe - a.totalGivesToMe;
            return 0;
          })[0].user.id;
          const label = getItemFullName(c.num, currentAlbumId);

          return `
            <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div><strong>${escapeHtml(label)}</strong> (Készlet: ${c.myQty} db)</div>
              <div style="display:flex; gap:8px;">
                ${c.demandList.map(d => `
                  <label class="radio-label" style="margin:0; font-size:0.75rem; color:${d.user.id === currentWinnerUid ? 'var(--amber)' : 'var(--text-muted)'};">
                    <input type="radio" name="conflict-sticker-${c.num}" value="${d.user.id}" ${d.user.id === currentWinnerUid ? 'checked' : ''} data-action="override-conflict" data-num="${c.num}">
                    ${escapeHtml(d.user.nev)} (+${d.totalGivesToMe} db)
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
            Üzenet küldése ${escapeHtml(u.nev)}-nek
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
      openLoopContactModal(loop.userB, loop.userC.nev, loop.giveToB, 'B');
    } else {
      openLoopContactModal(loop.userC, loop.userB.nev, loop.giveCtoMe, 'C');
    }
  }
});

// =========================================================================
// KIIKSZELŐS KAPCSOLATFELVÉTEL (EGYÉNI FELAJÁNLÁS RUBRIKÁVAL!)
// =========================================================================

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();

function setupContactModal(targetUser, subject, rawGiveNums = [], rawGetNums = [], isGift = false) {
  activeContactTarget = {
    uid: targetUser.id || targetUser.uid || '',
    nev: targetUser.nev || 'Gyűjtőpartner',
    telepules: targetUser.telepules || '',
    email: targetUser.email || '',
    showEmail: targetUser.showEmailToUsers === true,
    isGift: isGift,
    subject: subject
  };

  activeContactGiveNums = ensureArray(rawGiveNums);
  activeContactGetNums = ensureArray(rawGetNums);
  excludedGiveNums.clear();
  excludedGetNums.clear();

  // Reseteljük az egyéni felajánlás mezőt
  const customOfferInput = document.getElementById('contact-custom-offer-input');
  if (customOfferInput) customOfferInput.value = '';

  const titleEl = document.getElementById('contact-modal-title');
  if (titleEl) titleEl.textContent = `Üzenet küldése: ${escapeHtml(activeContactTarget.nev)}`;

  renderContactChips();
  updateContactModalText();
  document.getElementById('modal-contact')?.classList.add('open');
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

// Figyeljük az Egyéni Felajánlás mező gépelését is!
document.getElementById('contact-custom-offer-input')?.addEventListener('input', () => {
  updateContactModalText();
});

function updateContactModalText() {
  const inputEl = document.getElementById('contact-msg-input');
  if (!inputEl) return;

  const activeAlbum = getActiveAlbum();
  const effectiveGiveList = activeContactGiveNums.filter(n => !excludedGiveNums.has(n)).map(n => getItemLabel(n, currentAlbumId));
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const customOffer = document.getElementById('contact-custom-offer-input')?.value.trim() || '';

  // Ha van beírt egyéni felajánlás (pl. csoki, megegyezünk), az megjelenik az adandók között!
  let giveText = '';
  if (effectiveGiveList.length > 0) {
    giveText = effectiveGiveList.join(', ');
    if (customOffer) giveText += ` (+ ${customOffer})`;
  } else {
    giveText = customOffer ? customOffer : '(egyeztetés alatt)';
  }

  let msg = '';
  if (activeContactTarget.isGift && !effectiveGiveList.length && !customOffer) {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan oldalon láttam a felajánlásodat, hogy a dupláidat szívesen odaadod ajándékba a(z) ${activeAlbum.title} gyűjteményből.\nSzeretném elkérni az alábbi tételt/tételeket:\n${effectiveGet || 'egyeztetés alatt'}\n\nHogyan tudnánk lebonyolítani az átadást/postázást?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  } else {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan platformon találtam meg a gyűjteményedet a(z) ${activeAlbum.title} albumban:\n\nÉn tudom adni neked: ${giveText}\nTe tudod adni nekem: ${effectiveGet || '(egyeztetés alatt)'}\n\nMegfelelne a csere postán vagy személyesen?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  }

  inputEl.value = msg;
}

function openContactModal(targetUser, giveArray, getArray, isGift) {
  if (!checkSenderProfileReady()) return;
  const activeAlbum = getActiveAlbum();
  const subject = `${activeAlbum.title} csere megkeresés`;

  const giveNums = ensureArray(giveArray);
  const getNums = ensureArray(getArray);

  setupContactModal(targetUser, subject, giveNums, getNums, isGift);
}

function openLoopContactModal(targetUser, thirdPersonName, stickersArray, role) {
  if (!checkSenderProfileReady()) return;
  const activeAlbum = getActiveAlbum();
  const subject = `${activeAlbum.title} 3 fős körcsere egyeztetés`;
  const giveNums = ensureArray(stickersArray);
  setupContactModal(targetUser, subject, giveNums, [], false);
}

function openDirectContactModal(targetUser, numsArray, isGift) {
  if (!checkSenderProfileReady()) return;
  const activeAlbum = getActiveAlbum();
  const subject = `${activeAlbum.title} tétel érdeklődés`;
  const getNums = ensureArray(numsArray);
  setupContactModal(targetUser, subject, [], getNums, isGift);
}

// BELSŐ ÜZENET KÜLDÉSE (MESSENGER-SZÁLHOZ KÖTVE & PIPÁVAL)
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
          subject: activeContactTarget.subject,
          message: messageText,
          text: messageText,
          read: false,
          readAt: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // Csere rögzítése a rács alá & Duplák lefoglalása
      if (autoCreateTrade && (effectiveGiveNums.length > 0 || effectiveGetNums.length > 0)) {
        if (!myProfile.activeTrades) myProfile.activeTrades = [];
        
        myProfile.activeTrades.unshift({
          partnerUid: activeContactTarget.uid,
          partnerName: activeContactTarget.nev,
          partnerCity: activeContactTarget.telepules || 'Partner',
          albumId: currentAlbumId,
          givingItems: effectiveGiveNums,
          receivingItems: effectiveGetNums,
          createdAt: Date.now(),
          status: 'pending'
        });

        effectiveGiveNums.forEach(n => {
          if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
          if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
          myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
        });

        saveMyState();
        renderActiveTradesPanel();
        renderGrid();
      }

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
      } catch (e) {}

      showToast("Üzeneted elküldve (✓ Kézbesítve)! A csere rögzítve a rácsod alatt.");
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
// RÁCS ALATTI FOLYAMATBAN LÉVŐ CSERÉK & ARCHÍVUM
// =========================================================================

let activeTradeClosingData = null;

function renderActiveTradesPanel() {
  const panel = document.getElementById('active-trades-panel');
  const list = document.getElementById('active-trades-list');
  const countSpan = document.getElementById('active-trades-count');

  if (!panel || !list) return;

  const allTrades = myProfile.activeTrades || [];
  const pendingTrades = allTrades.filter(t => t.status !== 'completed');
  const completedTrades = allTrades.filter(t => t.status === 'completed');

  if (countSpan) countSpan.textContent = pendingTrades.length;

  if (pendingTrades.length === 0 && completedTrades.length === 0) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  panel.style.display = 'block';

  let html = '';

  // 1. Folyamatban lévő cserék kártyái
  if (pendingTrades.length > 0) {
    html += pendingTrades.map((t) => {
      const originalIdx = allTrades.indexOf(t);
      return `
        <div class="trade-manage-card" data-trade-idx="${originalIdx}">
          <div class="trade-manage-header">
            <div>
              <strong style="color:#FFF; font-size:0.95rem;">${escapeHtml(t.partnerName || 'Cserepartner')}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${escapeHtml(t.partnerCity || 'Partner')})</span>
            </div>
            <span class="badge-trade-status badge-status-reserved">🔒 Zárolva / Úton</span>
          </div>

          <div style="font-size:0.8rem; line-height:1.5; margin:6px 0; background:rgba(0,0,0,0.2); padding:8px; border-radius:var(--radius-sm);">
            <p style="margin:2px 0;"><strong>Te adod (Lefoglalva):</strong> ${t.givingItems && t.givingItems.length ? t.givingItems.map(n => getItemLabel(n)).join(', ') : '<em>(Nincs lefoglalt tétel)</em>'}</p>
            <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle várod:</strong> ${t.receivingItems && t.receivingItems.length ? t.receivingItems.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándék felajánlás)</em>'}</p>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; flex-wrap:wrap; gap:6px;">
            <button class="btn btn-contact-green btn-sm" data-action="complete-trade" data-trade-idx="${originalIdx}">
              ✓ Megérkezett / Csere lezárása
            </button>
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

  // 2. Összecsukható Archívum a már lezárt cseréknek
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

  if (btn.dataset.action === 'complete-trade') {
    activeTradeClosingData = { trade, tradeIdx: idx };
    const titleEl = document.getElementById('rate-modal-title');
    if (titleEl) titleEl.textContent = `Csere lezárása: ${trade.partnerName}`;
    document.getElementById('modal-rate-trade')?.classList.add('open');
  } else if (btn.dataset.action === 'cancel-trade') {
    if (!confirm("Biztosan feloldod a lefoglalt tételeket és visszavonod a cserét?")) return;
    
    myProfile.activeTrades.splice(idx, 1);
    saveMyState();
    renderActiveTradesPanel();
    renderGrid();
    showToast("Csere megállapodás visszavonva, a tételek újra szabadok.");
  }
});

let selectedStarRating = 5;

document.querySelectorAll('#trade-star-rating-box .star-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedStarRating = parseInt(btn.dataset.rating, 10);
    document.querySelectorAll('#trade-star-rating-box .star-btn').forEach(b => {
      const r = parseInt(b.dataset.rating, 10);
      b.classList.toggle('active', r <= selectedStarRating);
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

  // 2. Lefoglalt tételek levonása
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
    } catch (e) {}
  }

  if (document.getElementById('rate-modal-comment')) document.getElementById('rate-modal-comment').value = '';
  document.getElementById('modal-rate-trade')?.classList.remove('open');
  activeTradeClosingData = null;
  renderActiveTradesPanel();
  renderGrid();
  showToast("Csere sikeresen lezárva és archiválva!");
});

// =========================================================================
// 4 BLOKKOS KERESŐRENDSZER (EGYSÉGESEN [ CSEREINDÍTÁS ] GOMBOKKAL)
// =========================================================================

// 1. TÉTELKERESÉS
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
    .filter(u => u.id !== (currentUser ? currentUser.uid : ''))
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
    <p class="view-intro" style="color:var(--sand);"><strong>${escapeHtml(titleText)}</strong> — ${matches.length} gyűjtőnél:</p>
    ${matches.map(u => `
      <div class="card">
        <div class="card-header-row">
          <h3 style="cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">
            ${escapeHtml(u.nev || 'Névtelen')} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''}
          </h3>
          ${u.isGiftOffering ? '<span class="badge-gift">Ingyen adja</span>' : ''}
        </div>
        <p><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => getItemLabel(n)).join(', ')}</p>
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

// 2. TELEPÜLÉSSZŰRŐ ([ Csereindítás ] GOMBBAL)
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
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .filter(u => isLocalCityMatch(u.locations || u.telepules, query));

  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (boxEl) boxEl.style.display = 'block';

  if (statusEl) {
    statusEl.innerHTML = `Találatok: <strong>${escapeHtml(query)}</strong> (${matchedUsers.length} gyűjtő):`;
  }

  if (listEl) {
    if (matchedUsers.length === 0) {
      listEl.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Nincs regisztrált gyűjtő ezen a településen.</p>`;
    } else {
      listEl.innerHTML = matchedUsers.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules)})
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

// 3. TÁVOLSÁGI CSEREPARTNEREK (GPS - [ Csereindítás ] GOMBBAL)
let proximityDisplayLimit = 25;

function renderProximityPartners() {
  const container = document.getElementById('proximity-partners-list');
  if (!container) return;

  const myCoords = myGpsCoords || getUserCoordinates(myProfile);
  const myId = currentUser ? currentUser.uid : 'me';

  let list = allUsersData
    .filter(u => u.id !== myId)
    .map(u => {
      const distanceKm = getMinDistanceToUser(myCoords, u);
      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const totalDupes = ensureArray(u.van).length;
      return { ...u, distanceKm, isSameCity, totalDupes };
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
      const distText = u.distanceKm !== null ? `📍 kb. ${u.distanceKm} km-re tőled` : (u.isSameCity ? '📍 Helyi gyűjtő' : '📍 Nincs GPS adat');
      const trustText = u.ratingsCount > 0 
        ? `⭐ ${(u.trustScore / u.ratingsCount).toFixed(1)} (${u.ratingsCount})` 
        : (u.trustScore > 0 ? `⭐ ${u.trustScore}` : '');

      return `
        <div style="background:rgba(0,0,0,0.3); padding:10px 12px; border-radius:var(--radius-sm); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="color:#FFF; font-size:0.95rem; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">
              ${escapeHtml(u.nev)} ${trustText ? `<span style="color:var(--gift-gold); font-size:0.75rem;">${trustText}</span>` : ''}
            </strong>
            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">${escapeHtml(u.telepules || '')}</span>
            <div style="font-size:0.75rem; color:var(--amber); font-weight:600; margin-top:2px;">
              ${distText} • ${u.totalDupes} db cserélhető duplája van
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
        <button class="btn btn-secondary btn-sm" id="btn-load-more-proximity" style="width:100%; padding:8px;">
          + További 25 gyűjtő mutatása (${list.length - proximityDisplayLimit} maradt)
        </button>
      </div>
    ` : ''}
  `;
}

safeAddListener('proximity-partners-list', 'click', (e) => {
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

  const loadMoreBtn = e.target.closest('#btn-load-more-proximity');
  if (loadMoreBtn) {
    proximityDisplayLimit += 25;
    renderProximityPartners();
  }
});

// 4. BLOKK: PARTNER KERESÉSE NÉV / BECENÉV SZERINT ([ Csereindítás ] GOMBBAL)
safeAddListener('btn-search-by-name', () => {
  const inputEl = document.getElementById('search-by-name-input');
  const statusEl = document.getElementById('name-search-status');
  const clearBtn = document.getElementById('btn-clear-name-search');
  const boxEl = document.getElementById('name-search-results-box');
  const listEl = document.getElementById('name-search-partners-list');
  const query = (inputEl?.value || '').trim();

  if (!query) return showToast("Írj be egy nevet vagy becenevet!");

  selectedNameFilter = query;
  const queryNorm = normalizeText(query);

  const matchedUsers = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .filter(u => normalizeText(u.nev || '').includes(queryNorm));

  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (boxEl) boxEl.style.display = 'block';

  if (statusEl) {
    statusEl.innerHTML = `Találatok a(z) „<strong>${escapeHtml(query)}</strong>” névre (${matchedUsers.length} gyűjtő):`;
  }

  if (listEl) {
    if (matchedUsers.length === 0) {
      listEl.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Nem található gyűjtő ezzel a névvel.</p>`;
    } else {
      listEl.innerHTML = matchedUsers.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || 'Nincs város')})
            <div style="font-size:0.75rem; color:var(--sand);">${ensureArray(u.van).length} db dupla • ${ensureArray(u.kell).length} db hiányzó</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-contact-green btn-sm" data-action="contact-name-match" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
          </div>
        </div>
      `).join('');
    }
  }
});

document.getElementById('search-by-name-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('btn-search-by-name')?.click();
  }
});

safeAddListener('btn-clear-name-search', () => {
  const inputEl = document.getElementById('search-by-name-input');
  const boxEl = document.getElementById('name-search-results-box');
  const clearBtn = document.getElementById('btn-clear-name-search');

  selectedNameFilter = '';
  if (inputEl) inputEl.value = '';
  if (boxEl) boxEl.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';

  showToast("Névkeresés törölve.");
});

safeAddListener('name-search-partners-list', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const uid = btn.dataset.uid;
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return;

  if (btn.dataset.action === 'contact-name-match') {
    openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
  } else if (btn.dataset.action === 'inspect-user') {
    openUserProfileModal(uid);
  }
});

// =========================================================================
// 5. FÁZIS: MESSENGER-STÍLUSÚ CSEVEGŐSZÁLAK (THREADED CHAT) MOTOR
// =========================================================================

let activeChatThreadKey = null;

function getThreadKey(msg) {
  if (msg.threadId) return msg.threadId;
  const otherUid = msg.fromUid === (currentUser ? currentUser.uid : '') ? msg.toUid : msg.fromUid;
  return [currentUser ? currentUser.uid : '', otherUid].sort().join('_') + '_' + (msg.albumId || 'lidl-lutra-2026');
}

function renderThreadedChat() {
  const threadsListEl = document.getElementById('chat-threads-list');
  const countSpan = document.getElementById('threads-total-count');
  if (!threadsListEl) return;

  if (!currentUser) {
    threadsListEl.innerHTML = `
      <div style="text-align:center; padding:20px; font-size:0.85rem; color:var(--text-muted);">
        A beszélgetéseid megtekintéséhez lépj be a fiókodba!
      </div>`;
    return;
  }

  // Összefésüljük a beérkező és elküldött üzeneteket időrendben
  const allMessages = [...myIncomingMessages, ...myOutgoingMessages].sort((a, b) => {
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });

  // Csoportosítás beszélgetési szálakra (Thread-ekre)
  const threadMap = {};
  allMessages.forEach(msg => {
    const key = getThreadKey(msg);
    if (!threadMap[key]) {
      const isMe = msg.fromUid === currentUser.uid;
      const partnerUid = isMe ? msg.toUid : msg.fromUid;
      const partnerName = isMe ? msg.toName : msg.fromName;
      const partnerCity = isMe ? '' : (msg.fromCity || '');

      threadMap[key] = {
        threadKey: key,
        partnerUid,
        partnerName: partnerName || 'Gyűjtőtárs',
        partnerCity,
        albumId: msg.albumId || 'lidl-lutra-2026',
        messages: [],
        lastMessage: null,
        unreadCount: 0
      };
    }

    threadMap[key].messages.push(msg);
    threadMap[key].lastMessage = msg;
    if (msg.toUid === currentUser.uid && msg.read !== true) {
      threadMap[key].unreadCount++;
    }
  });

  const threadList = Object.values(threadMap).sort((a, b) => {
    return (b.lastMessage?.createdAt?.seconds || 0) - (a.lastMessage?.createdAt?.seconds || 0);
  });

  if (countSpan) countSpan.textContent = threadList.length;

  if (threadList.length === 0) {
    threadsListEl.innerHTML = `
      <div style="text-align:center; padding:20px; font-size:0.8rem; color:var(--text-muted);">
        Még nincs aktív beszélgetésed. Indíts egy cserét a Párosításoknál!
      </div>`;
    return;
  }

  // Szállista kirajzolása
  threadsListEl.innerHTML = threadList.map(t => {
    const isAct = activeChatThreadKey === t.threadKey;
    const timeStr = t.lastMessage?.createdAt?.toDate ? t.lastMessage.createdAt.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';
    const lastIsMe = t.lastMessage?.fromUid === currentUser.uid;
    const pipa = lastIsMe ? (t.lastMessage?.read === true ? '<span class="msg-status-pipa msg-read-double">✓✓</span>' : '<span class="msg-status-pipa msg-delivered">✓</span>') : '';
    const snippet = (t.lastMessage?.message || t.lastMessage?.text || '').slice(0, 32);

    return `
      <div class="chat-thread-item ${isAct ? 'active' : ''} ${t.unreadCount > 0 ? 'has-unread' : ''}" data-thread-key="${escapeHtml(t.threadKey)}" data-partner-uid="${escapeHtml(t.partnerUid)}">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:2px;">
          <strong style="font-size:0.88rem; color:#FFF;">${escapeHtml(t.partnerName)}</strong>
          <span style="font-size:0.7rem; color:var(--text-muted);">${timeStr}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">
            ${lastIsMe ? 'Te: ' : ''}${escapeHtml(snippet)}...
          </span>
          <div style="display:flex; align-items:center; gap:4px;">
            ${pipa}
            ${t.unreadCount > 0 ? `<span class="nav-badge">${t.unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Ha van aktív szál, újrarajzoljuk a buborékjait is
  if (activeChatThreadKey && threadMap[activeChatThreadKey]) {
    openChatThread(threadMap[activeChatThreadKey]);
  }
}

safeAddListener('chat-threads-list', (e) => {
  const item = e.target.closest('.chat-thread-item');
  if (!item) return;
  const key = item.dataset.threadKey;
  activeChatThreadKey = key;

  document.querySelectorAll('.chat-thread-item').forEach(el => el.classList.remove('active'));
  item.classList.add('active');

  const allMessages = [...myIncomingMessages, ...myOutgoingMessages];
  const threadMsgs = allMessages.filter(m => getThreadKey(m) === key).sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));

  if (threadMsgs.length > 0) {
    const first = threadMsgs[0];
    const isMe = first.fromUid === currentUser.uid;
    openChatThread({
      threadKey: key,
      partnerUid: isMe ? first.toUid : first.fromUid,
      partnerName: isMe ? first.toName : first.fromName,
      partnerCity: isMe ? '' : (first.fromCity || ''),
      albumId: first.albumId || 'lidl-lutra-2026',
      messages: threadMsgs
    });
  }
});

function openChatThread(threadObj) {
  const headerEl = document.getElementById('chat-thread-header');
  const nameEl = document.getElementById('chat-thread-partner-name');
  const cityEl = document.getElementById('chat-thread-partner-city');
  const albumTagEl = document.getElementById('chat-thread-album-tag');
  const bodyEl = document.getElementById('chat-thread-messages-body');
  const replyBarEl = document.getElementById('chat-reply-bar');

  if (!headerEl || !bodyEl || !replyBarEl) return;

  headerEl.style.display = 'flex';
  replyBarEl.style.display = 'flex';

  if (nameEl) nameEl.textContent = threadObj.partnerName;
  if (cityEl) cityEl.textContent = threadObj.partnerCity ? `(${threadObj.partnerCity})` : '';
  if (albumTagEl) albumTagEl.textContent = `📦 ${getAlbumDisplayTitle(threadObj.albumId)}`;

  // Automatikus olvasottá jelölés a hozzánk érkezett üzenetekre
  if (currentUser && db) {
    threadObj.messages.forEach(msg => {
      if (msg.toUid === currentUser.uid && msg.read !== true) {
        db.collection("messages").doc(msg.id).update({
          read: true,
          readAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    });
  }

  // Időrendi csevegőbuborékok kirajzolása
  bodyEl.innerHTML = threadObj.messages.map(m => {
    const isMe = m.fromUid === currentUser.uid;
    const timeStr = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';
    
    let pipaHtml = '';
    if (isMe) {
      if (m.read === true) {
        pipaHtml = `<span class="msg-status-pipa msg-read-double" title="Elolvasva">✓✓</span>`;
      } else {
        pipaHtml = `<span class="msg-status-pipa msg-delivered" title="Kézbesítve">✓</span>`;
      }
    }

    return `
      <div class="chat-bubble ${isMe ? 'outgoing' : 'incoming'}">
        <div>${formatLinksWithAnchors(m.message || m.text || '')}</div>
        <div class="chat-bubble-meta">
          <span>${timeStr}</span>
          ${pipaHtml}
        </div>
      </div>
    `;
  }).join('');

  // Automatikusan a beszélgetés aljára görgetünk
  bodyEl.scrollTop = bodyEl.scrollHeight;
}

safeAddListener('btn-close-active-thread', () => {
  activeChatThreadKey = null;
  document.getElementById('chat-thread-header').style.display = 'none';
  document.getElementById('chat-reply-bar').style.display = 'none';
  document.getElementById('chat-thread-messages-body').innerHTML = `
    <div style="text-align:center; padding:30px; color:var(--text-muted); font-size:0.85rem;">
      Válassz ki egy beszélgetést a bal oldali listából a megnyitáshoz!
    </div>`;
  document.querySelectorAll('.chat-thread-item').forEach(el => el.classList.remove('active'));
});

// GYORSVÁLASZ KÜLDÉSE AZ AKTÍV CSEVEGŐBEN (ENTERRE VAGY KATTINTÁSRA)
async function sendChatReply() {
  const inputEl = document.getElementById('chat-reply-input');
  const text = inputEl?.value.trim();
  if (!text || !activeChatThreadKey || !currentUser || !db) return;

  const parts = activeChatThreadKey.split('_');
  const otherUid = parts[0] === currentUser.uid ? parts[1] : parts[0];
  const albumId = parts.slice(2).join('_') || currentAlbumId;

  const partnerUser = allUsersData.find(u => u.id === otherUid);
  const partnerName = partnerUser?.nev || document.getElementById('chat-thread-partner-name')?.textContent || 'Partner';

  inputEl.value = '';

  try {
    await db.collection("messages").add({
      fromUid: currentUser.uid,
      fromName: myProfile.nev,
      fromCity: myProfile.telepules || '',
      toUid: otherUid,
      toName: partnerName,
      albumId: albumId,
      threadId: activeChatThreadKey,
      subject: `Válasz: ${getAlbumDisplayTitle(albumId)}`,
      message: text,
      text: text,
      read: false,
      readAt: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    try {
      const idToken = await currentUser.getIdToken();
      await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          toEmail: partnerUser?.email || '',
          toUid: otherUid,
          toName: partnerName,
          fromUid: currentUser.uid,
          fromName: myProfile.nev,
          subject: `Új üzenet: ${myProfile.nev}`,
          message: text
        })
      });
    } catch (e) {}
  } catch (err) {
    showToast("Hiba az üzenet küldésekor: " + err.message);
  }
}

safeAddListener('btn-send-chat-reply', sendChatReply);
document.getElementById('chat-reply-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendChatReply();
  }
});

// =========================================================================
// BOLTI KÉSZLETRADAR & TALÁLKOZÓK
// =========================================================================

safeAddListener('radar-photo-input', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 600;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      radarAttachedBase64 = canvas.toDataURL('image/jpeg', 0.65);
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

safeAddListener('btn-submit-radar', async () => {
  if (!currentUser) return showToast("Bejelentéshez lépj be!");
  const rawStore = document.getElementById('radar-input-store')?.value.trim() || '';
  const note = document.getElementById('radar-input-note')?.value.trim() || '';
  const statusEl = document.querySelector('input[name="radar-status"]:checked');
  const status = statusEl ? statusEl.value === 'van' : true;

  if (!rawStore) return showToast("Kérlek válaszd ki vagy írd be a boltot!");

  let city = '';
  let storeName = rawStore;
  if (rawStore.includes('–')) {
    const parts = rawStore.split('–');
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

    radarAttachedBase64 = '';
    if (document.getElementById('radar-input-store')) document.getElementById('radar-input-store').value = '';
    if (document.getElementById('radar-input-note')) document.getElementById('radar-input-note').value = '';
    if (document.getElementById('radar-photo-preview-box')) document.getElementById('radar-photo-preview-box').style.display = 'none';

    showToast("Köszönjük! A bolti készletjelentésed mentve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

safeAddListener('btn-refresh-radar', () => {
  renderRadarReports();
  showToast("Radar lista frissítve.");
});

function renderRadarReports() {
  const container = document.getElementById('radar-reports-list');
  if (!container) return;

  const filterQuery = (document.getElementById('radar-filter-input')?.value || '').toLowerCase().trim();

  const filtered = radarReports
    .filter(r => (r.albumId || 'lidl-lutra-2026') === currentAlbumId)
    .filter(r => {
      if (!filterQuery) return true;
      return (r.city || '').toLowerCase().includes(filterQuery) || (r.fullStoreName || '').toLowerCase().includes(filterQuery);
    });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="view-intro">Nincs készletjelentés ehhez az albumhoz.</p>';
    return;
  }

  container.innerHTML = filtered.map(r => {
    const timeStr = r.reportedAt?.toDate ? r.reportedAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';
    return `
      <div class="radar-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div><strong>${escapeHtml(r.fullStoreName || r.storeName)}</strong></div>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">${r.status ? 'Kapható' : 'Elfogyott'}</span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${formatLinksWithAnchors(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" data-action="open-lightbox">` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">${escapeHtml(r.reporterName || 'Gyűjtő')} • ${timeStr}</div>
      </div>
    `;
  }).join('');
}

// TALÁLKOZÓK
safeAddListener('btn-submit-meetup', async () => {
  if (!currentUser) return showToast("Találkozó meghirdetéséhez lépj be!");
  const city = document.getElementById('meetup-input-city')?.value.trim() || '';
  const time = document.getElementById('meetup-input-time')?.value.trim() || '';
  const place = document.getElementById('meetup-input-place')?.value.trim() || '';
  const desc = document.getElementById('meetup-input-desc')?.value.trim() || '';

  if (!city || !time || !place) return showToast("Töltsd ki a várost, időpontot és helyszínt!");

  try {
    await db.collection("meetups").add({
      albumId: currentAlbumId,
      city, time, place, description: desc,
      likes: [],
      postedAt: firebase.firestore.FieldValue.serverTimestamp(),
      organizerName: myProfile.nev || 'Gyűjtő',
      userId: currentUser.uid
    });

    if (document.getElementById('meetup-input-city')) document.getElementById('meetup-input-city').value = '';
    if (document.getElementById('meetup-input-time')) document.getElementById('meetup-input-time').value = '';
    if (document.getElementById('meetup-input-place')) document.getElementById('meetup-input-place').value = '';
    if (document.getElementById('meetup-input-desc')) document.getElementById('meetup-input-desc').value = '';

    showToast("Találkozó sikeresen közzétéve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

safeAddListener('btn-refresh-meetups', () => {
  renderMeetups();
  showToast("Találkozók frissítve.");
});

function renderMeetups() {
  const container = document.getElementById('meetups-list');
  if (!container) return;

  if (meetupEvents.length === 0) {
    container.innerHTML = '<p class="view-intro">Jelenleg nincs meghirdetett közös találkozó.</p>';
    return;
  }

  container.innerHTML = meetupEvents.map(m => {
    return `
      <div class="meetup-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div><h3 style="margin:0; font-size:1.05rem;">${escapeHtml(m.city)} — ${escapeHtml(m.place)}</h3></div>
          <span class="meetup-time-badge">${escapeHtml(m.time)}</span>
        </div>
        ${m.description ? `<p style="font-size:0.86rem; margin:6px 0; color:var(--text-primary); white-space:pre-wrap;">${formatLinksWithAnchors(m.description)}</p>` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">Szervező: <strong>${escapeHtml(m.organizerName || 'Gyűjtő')}</strong></div>
      </div>
    `;
  }).join('');
}

function listenToRadarReports() {
  if (!db) return;
  if (radarUnsubscribe) radarUnsubscribe();
  radarUnsubscribe = db.collection("album_reports").orderBy("reportedAt", "desc").limit(35).onSnapshot(snap => {
    radarReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRadarReports();
  }, () => {});
}

function listenToMeetups() {
  if (!db) return;
  if (meetupsUnsubscribe) meetupsUnsubscribe();
  meetupsUnsubscribe = db.collection("meetups").orderBy("postedAt", "desc").limit(30).onSnapshot(snap => {
    meetupEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMeetups();
  }, () => {});
}
// =========================================================================
// 3. RÉSZ: LEAFLET VEKTORTÉRKÉP, JAVÍTOTT JSON IMPORTŐR,
// INTELLIGENS AI BEEMELŐ, FELHŐS SZINKRON & RENDSZERINDÍTÁS
// =========================================================================

// =========================================================================
// 5. FÁZIS: LEAFLET.JS INTERAKTÍV VEKTORTÉRKÉP MOTOR
// =========================================================================

let leafletMap = null;
let leafletMarkersGroup = null;

function initOrUpdateLeafletMap() {
  const container = document.getElementById('leaflet-map-container');
  if (!container || typeof L === 'undefined') return;

  // 1. Térkép inicializálása (Magyarország középponttal)
  if (!leafletMap) {
    leafletMap = L.map('leaflet-map-container', {
      center: [47.1625, 19.5033],
      zoom: 7,
      minZoom: 6,
      maxZoom: 13,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // Subdued / Dark-friendly OpenStreetMap csempék
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(leafletMap);

    leafletMarkersGroup = L.layerGroup().addTo(leafletMap);
  }

  // Időzített újraszámolás, ha a fül rejtve volt
  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 250);

  if (!leafletMarkersGroup) return;
  leafletMarkersGroup.clearLayers();

  // 2. Városonkénti statisztikák kiszámítása az aktív felhasználókból
  const cityAggregates = {};
  allUsersData.forEach(u => {
    const locs = extractNormalizedLocations(u.locations && u.locations.length > 0 ? u.locations : u.telepules);
    const dupeCount = ensureArray(u.van).length;

    locs.forEach(loc => {
      if (!cityAggregates[loc.canonicalKey]) {
        cityAggregates[loc.canonicalKey] = {
          name: loc.displayName,
          canonicalKey: loc.canonicalKey,
          users: 0,
          duplicates: 0
        };
      }
      cityAggregates[loc.canonicalKey].users += 1;
      cityAggregates[loc.canonicalKey].duplicates += dupeCount;
    });
  });

  // 3. Gombostűk (Interaktív CircleMarkerek) elhelyezése
  Object.values(cityAggregates).forEach(c => {
    const coords = CITY_COORDINATES[c.canonicalKey] || CITY_COORDINATES[normalizeText(c.name)];
    if (!coords) return;

    const isHot = c.users >= 3 || c.duplicates >= 30;
    const isWarm = c.users >= 2 || c.duplicates >= 10;
    const pinColor = isHot ? '#E85A4F' : (isWarm ? '#D89B4A' : '#6B8A5A');
    const radius = Math.min(22, Math.max(9, 7 + c.users * 2.5));

    const marker = L.circleMarker([coords.lat, coords.lng], {
      radius: radius,
      fillColor: pinColor,
      color: '#FFFFFF',
      weight: 1.5,
      opacity: 0.9,
      fillOpacity: 0.85
    });

    // Kattintható felugró ablak
    marker.bindPopup(`
      <div style="text-align:center; min-width:140px;">
        <strong style="color:var(--amber); font-size:1rem; display:block; margin-bottom:2px;">${escapeHtml(c.name)}</strong>
        <span style="font-size:0.8rem; color:#FFF; display:block;">👥 <strong>${c.users}</strong> gyűjtő</span>
        <span style="font-size:0.75rem; color:var(--sand); display:block; margin-bottom:8px;">🔄 <strong>${c.duplicates}</strong> cserélhető dupla</span>
        <button class="btn btn-primary btn-sm" style="width:100%; font-size:0.75rem; padding:4px 8px;" onclick="filterMatchesByCityName('${escapeHtml(c.name)}')">
          Helyi gyűjtők mutatása
        </button>
      </div>
    `);

    leafletMarkersGroup.addLayer(marker);
  });
}

// =========================================================================
// JAVÍTOTT, HIBATŰRŐ TÖMEGES JSON ALBUM IMPORTŐR
// =========================================================================
safeAddListener('btn-admin-import-json', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  
  let rawJson = document.getElementById('admin-album-json-import')?.value.trim();
  if (!rawJson) return showToast("Illessz be egy érvényes JSON szöveget!");

  // Hibatűrő tisztítás (idézőjelek és záróvesszők javítása)
  rawJson = rawJson
    .replace(/[“”]/g, '"')
    .replace(/,\s*([\]}])/g, '$1');

  try {
    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (parseErr) {
      throw new Error("Érvénytelen JSON formátum: ellenőrizd az idézőjeleket és a kapcsos zárójeleket!");
    }

    const albumsToImport = Array.isArray(parsed) ? parsed : [parsed];
    const junkIds = new Set([
      'uj-gyujtemeny', 'gyujtemenyek', 'uj-gyujtemeny-hozzaadasa', 'mind-84',
      'matricaalbum-55', 'kartya-20', 'figura-7', 'kisauto-2', 'album-megnyitasa',
      'gyujtes-inditasa', 'gyujtemeny-bekuldese'
    ]);

    // Kiszűrjük a scraper által elkapott weboldal gombokat!
    const validAlbums = albumsToImport.filter(a => a && a.id && a.title && !junkIds.has(a.id));

    if (validAlbums.length === 0) {
      return showToast("A megadott JSON nem tartalmaz érvényes albumokat.");
    }

    const batch = db.batch();
    validAlbums.forEach(album => {
      // Megtisztítjuk az objektumot az undefined mezőktől
      const cleanDoc = {
        id: album.id,
        title: album.title || album.id,
        subtitle: album.subtitle || '',
        publisher: album.publisher || 'Egyéb',
        year: parseInt(album.year || '2026', 10),
        totalItems: parseInt(album.totalItems || '100', 10),
        type: album.type || 'sticker',
        typeLabel: album.typeLabel || (album.type === 'card' ? 'Kártya' : album.type === 'figure' ? 'Figura / Kinder' : 'Matricaalbum'),
        coverUrl: album.coverUrl || 'covers/' + album.id + '.webp',
        featured: album.featured === true,
        isRetro: album.isRetro === true || (parseInt(album.year || '2026', 10) < 2018),
        hasFavorites: album.hasFavorites !== false,
        hasRadar: album.hasRadar === true,
        radarType: album.radarType || 'none',
        hasChapters: album.hasChapters === true,
        active: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      const docRef = db.collection("albums").doc(album.id);
      batch.set(docRef, cleanDoc, { merge: true });

      // Azonnal frissítjük a helyi memóriát is!
      ALBUMS_REGISTRY[album.id] = cleanDoc;
    });

    await batch.commit();

    document.getElementById('admin-album-json-import').value = '';
    renderHub();
    renderAdminAlbumsList();
    showToast(`Sikeres importálás! ${validAlbums.length} db album azonnal élesítve a felhőben!`);
  } catch (err) {
    showToast("Import hiba: " + err.message);
  }
});

// =========================================================================
// VALÓBAN OKOS INTELLIGENS BEEMELŐ (AI OCR & NYERS SZÖVEG / CSV PARSER)
// =========================================================================

// Univerzális szövegfeldolgozó: kiemeli a sorszámozott neveket bármilyen formátumból
function parseSmartStickerList(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split(/[\r\n]+/);
  const itemsMap = {};
  let maxFoundIndex = 0;

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    // Keresünk mintákat: "1: Vidra", "1. Vidra", "1 - Vidra", "#1 Vidra", "1, Vidra", "1\tVidra"
    const match = line.match(/^(?:#?\s*)(\d+)[\s:\.\-—–,\t]+(.+)$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const name = match[2].trim().replace(/^[:\.\-—–,\t\s]+|[:\.\-—–,\t\s]+$/g, '');
      if (idx > 0 && name) {
        itemsMap[idx] = name;
        if (idx > maxFoundIndex) maxFoundIndex = idx;
      }
    }
  });

  if (maxFoundIndex > 0) {
    const list = [];
    for (let i = 1; i <= maxFoundIndex; i++) {
      list.push(itemsMap[i] || `Tétel ${i}`);
    }
    return list;
  }

  // Ha nem volt soronkénti sorszám, felbontjuk vesszők mentén
  return text.split(/[\n,;]+/).map(t => t.trim()).filter(t => t.length > 0);
}

safeAddListener('btn-admin-process-universal', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  
  const file = document.getElementById('admin-ai-ocr-file')?.files[0];
  const rawText = document.getElementById('admin-raw-import-text')?.value.trim() || '';
  const statusEl = document.getElementById('admin-universal-status');

  if (!file && !rawText) {
    return showToast("Válassz ki egy képet VAGY másolj be nyers szöveget!");
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = "Intelligens elemzés folyamatban...";
  }

  let textToParse = rawText;

  // Ha kép érkezett: elküldjük a Workernek (CORS hiba nélkül)
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
      if (!res.ok) throw new Error(data.error || "A képfelismerő nem adott eredményt.");
      textToParse = data.text || (data.numbers ? data.numbers.map((n, i) => `${n}: Tétel ${n}`).join('\n') : '');
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger);">AI Hiba: ${err.message}</span>`;
      return showToast("AI Hiba: " + err.message);
    }
  }

  // Okos kinyerés a szövegből
  const parsedNames = parseSmartStickerList(textToParse);
  const totalItems = parsedNames.length;

  if (totalItems === 0) {
    if (statusEl) statusEl.innerHTML = "<span style='color:var(--danger);'>Nem sikerült sorszámozott tételeket azonosítani.</span>";
    return showToast("Nem sikerült tételeket kiolvasni.");
  }

  // Automatikusan kitöltjük a 4. Gyűjteményszerkesztő űrlap összes mezőjét!
  if (document.getElementById('admin-album-total')) {
    document.getElementById('admin-album-total').value = totalItems;
  }

  if (document.getElementById('admin-album-custom-names')) {
    document.getElementById('admin-album-custom-names').value = parsedNames.map((name, i) => `${i + 1}: ${name}`).join('\n');
  }

  // Megpróbáljuk azonosítani az évet a szövegből (pl. 2026, 2025)
  const yearMatch = textToParse.match(/\b(201\d|202\d)\b/);
  if (yearMatch && document.getElementById('admin-album-year')) {
    document.getElementById('admin-album-year').value = yearMatch[1];
  }

  // Megpróbáljuk kitalálni a kiadót
  const lower = textToParse.toLowerCase();
  let pub = 'Panini';
  if (lower.includes('spar')) pub = 'Spar';
  else if (lower.includes('topps')) pub = 'Topps';
  else if (lower.includes('lidl')) pub = 'Lidl';
  else if (lower.includes('kinder')) pub = 'Kinder';

  if (document.getElementById('admin-album-publisher')) {
    document.getElementById('admin-album-publisher').value = pub;
  }

  if (statusEl) {
    statusEl.innerHTML = `<span style="color:var(--moss-soft);">✓ Sikeres elemzés! <strong>${totalItems} db tétel</strong> automatikusan beemelve a lenti űrlapba.</span>`;
  }
  showToast(`Sikeres elemzés! ${totalItems} db tétel kitöltve a szerkesztőben.`);

  // Odagörgetünk az űrlaphoz
  document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

safeAddListener('btn-admin-clear-universal', () => {
  if (document.getElementById('admin-ai-ocr-file')) document.getElementById('admin-ai-ocr-file').value = '';
  if (document.getElementById('admin-raw-import-text')) document.getElementById('admin-raw-import-text').value = '';
  if (document.getElementById('admin-universal-status')) document.getElementById('admin-universal-status').style.display = 'none';
  showToast("Beemelő mezők kiürítve.");
});

// =========================================================================
// ADATBÁZIS INICIALIZÁLÁS (221 BOLT ÉS LUTRA TÁJOLÁS FELHŐBE KÖLTÖZTETÉSE)
// =========================================================================

// A hiánytalan 221 Lidl bolt lista – ezzel töltjük fel a felhőt
const INITIAL_LIDL_STORES = [
  "Agárd – Akácfa utca 2.", "Ajka – Hársfa utca 1/A", "Aszód – Pesti út 14-16.", "Baja – Bajcsy-Zsilinszky utca 9.",
  "Balassagyarmat – Kóvári út 8", "Balatonfűzfő – Vízmű utca 1.", "Balatonlelle – Rákóczi F. út 307.", "Balmazújváros – Böszörményi u. 1.",
  "Barcs – Erkel F. utca 2.", "Bátonyterenye – Berekgát köz 2.", "Békés – Kossuth L. u. 31.", "Békéscsaba – Corvin u. 29-33.",
  "Békéscsaba – Szarvasi út 15-17.", "Berettyóújfalu – Kossuth u. 98.", "Biatorbágy – Budaörsi út 4.", "Bicske – Szent László utca 55.",
  "Bonyhád – Deák Ferenc utca 10/A", "Budakeszi – Kert utca 27-29.", "Budaörs – Károly király út 145.", "Budapest – Ady Endre út 54-60.",
  "Budapest – Alsómalom u. 8-10.", "Budapest – Arany János utca 27-29.", "Budapest – Bajcsy-Zsilinszky út 61.", "Budapest – Bartók Béla út 47.",
  "Budapest – Báthory u. 6.", "Budapest – Bécsi út 325-337.", "Budapest – Béke utca 2-4.", "Budapest – Budaörsi út 121.",
  "Budapest – Ciklámen u. 3.", "Budapest – Csalogány u. 43", "Budapest – Cziffra Gy. u. 115.", "Budapest – Erdőkerülő utca 36.",
  "Budapest – Fehérvári út 211.", "Budapest – Ferenciek tere 2.", "Budapest – Görgey Artúr u. 14-20", "Budapest – Gubacsi út 34.",
  "Budapest – Haraszti út 34.", "Budapest – Huszti út 20", "Budapest – János u. 196", "Budapest – Leonardo da Vinci u. 23.",
  "Budapest – Lobogó u. 12", "Budapest – Madách utca 72.", "Budapest – Maglódi út 17", "Budapest – Margó Tivadar u. 83.",
  "Budapest – Máriaremetei út 1.", "Budapest – Megyeri út 53", "Budapest – Mogyoródi út 23-29", "Budapest – Nagy Lajos Király útja 121-123",
  "Budapest – Nagykőrösi út 35-38.", "Budapest – Nagytétényi út 216-218.", "Budapest – Pesti út 237/H", "Budapest – Rákóczi út 48-50.",
  "Budapest – Régi Fóti u. 1", "Budapest – Sibrik Miklós út 30/b.", "Budapest – Szalay utca 14.", "Budapest – Szentendrei út 251-253",
  "Budapest – Teleki tér 1.", "Budapest – Újszász u. 47/B", "Budapest – Üllői út 112.", "Budapest – Üllői út 379-381.",
  "Budapest – VI. Király u. 112.", "Budapest – Victor Hugo u. 11-15.", "Budapest – VIII. Hungária körút 26.", "Budapest – XIII. Váci út 201",
  "Budapest – XVII. Pesti út 2.", "Cegléd – Törteli út 2.", "Csongrád – Fő u. 59.", "Csorna – Soproni út 66/C.", "Csurgó – Széchenyi tér 12-14.",
  "Dabas – Bartók Béla út 63.", "Debrecen – Balmazújvárosi út 7.", "Debrecen – Derék u. 31.", "Debrecen – Faraktár utca 58.",
  "Debrecen – Mikepércsi út 168.", "Debrecen – Széchenyi u. 59", "Dombóvár – Kórház utca 55.", "Dorog – Bányász körönd 1732/98",
  "Dunaharaszti – Némedi út 102/A", "Dunakeszi – Berek u. 2.", "Dunaújváros – Magyar út 11.", "Dunaújváros – Velinszky utca 1.",
  "Eger – II. Rákóczi Ferenc u. 141.", "Eger – Mátyás király út 144.", "Enying – Rákóczi Ferenc utca 5.", "Érd – Balatoni út 73-75.",
  "Érd – Diósdi u. 2-4", "Esztergom – Bánomi út 10.", "Esztergom – Dobogókői út 39.", "Fonyód – Ady Endre utca 57-59.",
  "Fót – Keleti Márton u. 7.", "Gödöllő – Ottó Ferenc utca 2-4.", "Gyomaendrőd – Fő út 81/2.", "Gyöngyös – Budai Nagy Antal tér 10.",
  "Győr – Jereváni utca 42.", "Győr – Kossuth Lajos utca 123.", "Győr – Mécs László utca 1/A", "Győr – Szeszgyár utca 6.",
  "Győr – Tihanyi Árpád út 9.", "Gyula – Szent István u. 69/1.", "Hajdúböszörmény – Bánság tér 10.", "Hajdúhadház – Dr. Földi János u. 55.",
  "Hajdúnánás – Dorogi u. 108.", "Hajdúsámson – Kiscsere utca 3.", "Hajdúszoboszló – Dózsa György út 62.", "Hatvan – Radnóti tér 19.",
  "Heves – Kolozsvári út 2/A", "Hódmezővásárhely – Hódtó u. 2.", "Jászberény – Nagykátai út 7/a.", "Kalocsa – Pataji út 31.",
  "Kaposvár – Bereczk S. utca 2.", "Kaposvár – Előd Vezér utca 3.", "Kaposvár – Füredi út 97.", "Kapuvár – Győri u. 60.",
  "Kazincbarcika – Mátyás király út 34/A", "Kecskemét – Izsáki út 2.", "Kecskemét – Nyíri út 38/E", "Kecskemét – Szolnoki út 18.",
  "Keszthely – Sopron utca 43.", "Keszthely – Tapolcai út 45/a", "Kiskőrös – Kossuth utca 13.", "Kiskunfélegyháza – Majsai út 5.",
  "Kiskunhalas – Széchenyi út 1-3.", "Kistarcsa – Szabadság útja 60", "Kisújszállás – Deák Ferenc u. 10.", "Kisvárda – Attila út 2/A",
  "Komárom – Mártírok útja 80.", "Komló – Tröszt utca 1.", "Körmend – Dr. Remetei Filep utca 2.", "Kőszeg – Cáki út 2.",
  "Kunszentmárton – Kossuth Lajos u. 23", "Makó – Szegedi u. 63.", "Marcali – Rákóczi Ferenc utca 50.", "Martfű – Földvári út 1.",
  "Mezőkovácsháza – Árpád u. 135.", "Mezőkövesd – Dohány út 2/A", "Mezőtúr – Földvári út 21.", "Miskolc – Csermőkei út 207.",
  "Miskolc – József Attila u. 74.", "Miskolc – Kiss Ernő u. 13/b.", "Miskolc – Pesti út 5.", "Mohács – Pécsi út 41.",
  "Monor – Gém utca 1.", "Mór – Akai utca 8.", "Mosonmagyaróvár – Királyhidai utca 49.", "Nagyatád – Árpád utca 49.",
  "Nagykáta – Dózsa György út 16.", "Nagykanizsa – Balatoni utca 41.", "Nagykőrös – Kecskeméti út 73.", "Nyíregyháza – Debreceni u. 106/c.",
  "Nyíregyháza – Pazonyi út 37/a.", "Orosháza – Hóvirág u. 1-5.", "Oroszlány – Környei u. 2.", "Ózd – Sárli út 2.",
  "Paks – Tolnai út 70.", "Pápa – Jókai Mór utca 57.", "Pécs – Lahti utca 45.", "Pécs – Lázár Vilmos utca 10.",
  "Pécs – Málomi út 3.", "Pécs – Puskin tér 22.", "Pécs – Siklósi út 52/A", "Pilisvörösvár – Budai út 18.",
  "Pomáz – József Attila u. 32.", "Püspökladány – Rákóczi utca 16-20.", "Ráckeve – Lacházi út 26", "Salgótarján – Csokonai út 23.",
  "Sárbogárd – Ady E. utca 232-236.", "Sárvár – Rákóczi utca 12.", "Sátoraljaújhely – Esze Tamás u. 92.", "Siklós – Szent István tér 2.",
  "Siófok – Zamárdi utca 1-2.", "Solt – Kossuth Lajos utca 2-8.", "Soltvadkert – Kossuth Lajos u. 110.", "Solymár – Terstyánszky Ödön u. 89.",
  "Sopron – Bánfalvi út 12.", "Sopron – Lófuttató utca 4.", "Sümeg – Fehérkő utca 1/1.", "Szada – Dózsa György út 1/B",
  "Szarvas – Csabai út 1/4.", "Szeged – Makkosházi krt. 21.", "Szeged – Szabadkai út 1/c.", "Szeged – Vásárhelyi Pál út 7.",
  "Szeghalom – Széchenyi u. 45-49.", "Székesfehérvár – Balatoni út 21.", "Székesfehérvár – Farkasvermi köz 1.", "Székesfehérvár – Mártírok útja 11.",
  "Székesfehérvár – Pozsonyi út 4.", "Szekszárd – Arany János utca 4.", "Szekszárd – Béri Balogh Ádám utca 94/B", "Szentendre – Dózsa Gy. út 20",
  "Szentes – Ipartelepi út 2-6.", "Szerencs – Csalogány út 58.", "Szigethalom – Mű út 7.", "Szigetszentmiklós – Csepeli út 16/a.",
  "Szigetvár – Almás patak utca 5.", "Szolnok – Délibáb u. 6.", "Szolnok – Széchenyi krt. 4/b.", "Szolnok – Tószegi út 5.",
  "Szombathely – Kenyérvíz utca 2.", "Szombathely – Verseny utca 30.", "Szombathely – Zanati út 42", "Tamási – Deák Ferenc utca 10/A",
  "Tapolca – Veszprémi út 1.", "Tata – Piac tér 8.", "Tatabánya – Győri út 31.", "Tatabánya – Szent Borbála út 31.",
  "Tiszafüred – Húszöles út 25.", "Tiszaújváros – Lévay u. 118.", "Törökszentmiklós – Kossuth Lajos u. 102-108.", "Újfehértó – Debreceni út 14-24.",
  "Üröm – Dózsa György út 63.", "Vác – Balassagyarmati út 9-15.", "Vác – Bolgár u. 1.", "Vác – Naszály utca 20.",
  "Várpalota – Hét vezér utca 3.", "Vecsés – Fő u. 244", "Veresegyház – Budapesti út 1.", "Veresegyház – Szadai út 7.",
  "Veszprém – Cholnoky utca 29/1.", "Veszprém – Észak-keleti útgyűrű 2.", "Zalaegerszeg – Átkötő utca 3.", "Zalaegerszeg – Platán sor 6/A"
];

safeAddListener('btn-admin-seed-database', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Feltöltöd az összes albumot, a 221 Lidl boltot és a tájolásokat a felhőbe?")) return;

  const btn = document.getElementById('btn-admin-seed-database');
  if (btn) { btn.disabled = true; btn.textContent = "Feltöltés..."; }

  try {
    const batch = db.batch();

    // 1. Alapértelmezett albumok feltöltése
    Object.values(ALBUMS_REGISTRY).forEach(album => {
      const docRef = db.collection("albums").doc(album.id);
      const dataToSave = { ...album, active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      
      // A Lutra könyvlapozó tájolásait közvetlenül az album dokumentumába mentjük
      if (album.id === 'lidl-lutra-2026') {
        dataToSave.customChaptersList = getLutraChapters();
      }
      batch.set(docRef, dataToSave, { merge: true });
    });

    // 2. Bolthálózatok mentése a felhőbe
    const lidlRef = db.collection("stores").doc("lidl");
    batch.set(lidlRef, {
      chain: "lidl",
      stores: INITIAL_LIDL_STORES,
      count: INITIAL_LIDL_STORES.length,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await batch.commit();

    STORE_DATABASES["lidl"] = INITIAL_LIDL_STORES;
    localStorage.setItem('cserelj_stores_cache', JSON.stringify(STORE_DATABASES));
    updateRadarStoreDatalist();

    showToast("Sikeres felhőbe költöztetés! Az albumok és a 221 bolt a Firestore-ban vannak.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Adatbázis inicializálása Firestore-ba most"; }
  }
});

// Dinamikus bolthálózat figyelő a Firestore-ból
function listenToStores() {
  if (!db) return;
  if (storesUnsubscribe) storesUnsubscribe();
  storesUnsubscribe = db.collection("stores").onSnapshot(snap => {
    snap.docs.forEach(doc => {
      const d = doc.data();
      if (d && Array.isArray(d.stores)) {
        STORE_DATABASES[doc.id] = d.stores;
      }
    });
    localStorage.setItem('cserelj_stores_cache', JSON.stringify(STORE_DATABASES));
    updateRadarStoreDatalist();
  }, () => {});
}

// =========================================================================
// RENDSZERINDÍTÁS ÉS BIZTONSÁGOS BELÉPÉS
// =========================================================================

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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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
// VÉGLEGES INDÍTÁS (5. FÁZIS BOOT SEQUENCE)
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
  listenToStores();
  checkDonablyReturningPrompt();
  checkSystemUpdateEmailBanner();
} catch (err) {
  console.error("Indítási hiba:", err);
}

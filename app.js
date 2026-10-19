// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.1 STABIL KIADÁS)
// 1 / 4. RÉSZ: KATALÓGUS, NORMALIZÁLÓK, 0 MS RÁCS, LAKATVÉDELEM & UNDO
// =========================================================================

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// --- ALBUM REGISZTER KOMPAKT SEGÉDFÜGGVÉNNYEL ---
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
  "topps-flagship-premier-league-2026-27": createAlbumEntry("topps-flagship-premier-league-2026-27", "Topps Premier League 2026/27", "Angol bajnokság kártyák", "Topps", 2026, 734, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ftopps-premier-league-202627-flagship-edition.webp&w=3840&q=75", { hasFavorites: false }),
  "fifa-365-2026-adrenalyn-xl": createAlbumEntry("fifa-365-2026-adrenalyn-xl", "FIFA 365 2026 – Adrenalyn XL", "Panini focikártyák", "Panini", 2025, 452, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fbcb13313-afad-4ac7-ae1c-5906c7ea5358.webp&w=3840&q=75", { hasFavorites: false }),
  "garfield-magyarorszag": createAlbumEntry("garfield-magyarorszag", "Garfield - Magyarország", "Spar matricagyűjtemény", "Spar", 2026, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F07287733-3f12-45b3-9cee-a56ec03a111c.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-allati-rekordok-2": createAlbumEntry("garfield-allati-rekordok-2", "Garfield - Állati rekordok 2", "Spar matricagyűjtemény", "Spar", 2025, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fcc29ba2f-339e-404e-8587-0d86be878648.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-rejtelymania": createAlbumEntry("garfield-rejtelymania", "Garfield - Rejtélymánia", "Spar Retro matricák", "Spar", 2017, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F95348744-3d51-4303-9205-4eca8ff48655.jpg&w=3840&q=75", { isRetro: true, hasRadar: true, radarType: "spar" }),
  "allati-rekordok": createAlbumEntry("allati-rekordok", "Állati rekordok", "Spar Retro matricák", "Spar", 2016, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F7eb6eef5-5f6f-4144-9a82-db387ace1bd2.jpg&w=3840&q=75", { isRetro: true, hasRadar: true, radarType: "spar" }),
  "szigetmania": createAlbumEntry("szigetmania", "Szigetmánia", "Spar Retro matricák", "Spar", 2014, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F0e64fd31-5ea7-410c-ad6a-712d827d6a67.jpg&w=3840&q=75", { isRetro: true, hasRadar: true, radarType: "spar" }),
  "garfield-oceanmania": createAlbumEntry("garfield-oceanmania", "Garfield - Óceánmánia", "Spar Retro matricák", "Spar", 2013, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fb9b544e9-fea3-4ad4-952b-2bd7b55fb863.jpg&w=3840&q=75", { isRetro: true, hasRadar: true, radarType: "spar" }),
  "garfield-dzsungel-mania": createAlbumEntry("garfield-dzsungel-mania", "Garfield - Dzsungelmánia", "Spar Retro matricák", "Spar", 2011, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F660fbb5a-24fe-4987-9f86-b07c73e46d8a.jpg&w=3840&q=75", { isRetro: true, hasRadar: true, radarType: "spar" }),
  "super-mario-it-s-a-me-mario": createAlbumEntry("super-mario-it-s-a-me-mario", "Super Mario - It's-a me!", "Nintendo matricák", "Panini", 2026, 180, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F571f40ae-b90d-4bdd-85ea-6bca1cea22b1.jpg&w=3840&q=75"),
  "lego-ninjago-dragons-rising": createAlbumEntry("lego-ninjago-dragons-rising", "Lego Ninjago - Dragons Rising", "Lego matricák", "Egyéb", 2025, 212, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fce4d3f5d-3b8d-4210-9bb5-70d5bb3fdd99.webp&w=3840&q=75"),
  "one-piece-kinder": createAlbumEntry("one-piece-kinder", "One Piece Kinder Joy", "Anime figurák", "Kinder", 2026, 25, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fdc648487-9950-4179-a2f8-4a96cf8a7283.webp&w=3840&q=75"),
  "minecraft-kinder-joy": createAlbumEntry("minecraft-kinder-joy", "Minecraft Kinder Joy", "Játék figurák", "Kinder", 2026, 28, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fe6ed94a7-8dd0-4a50-90de-8b92a592c06d.webp&w=3840&q=75")
};

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";
let showAllHubAlbums = false;
let editingAlbumId = null;
let saveDebounceTimer = null;
let lastLocalEditTimestamp = 0;
let lastUndoState = null;
let undoToastTimer = null;

// GPS & TÁVOLSÁGI ÁLLAPOTOK
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

// 221 LIDL BOLT ÉS ÁRUHÁZAK (A 4. RÉSZBEN GOMBNYOMÁSRA INICIALIZÁLÓDIK A FELHŐBE)
const STORE_DATABASES = {
  "lidl": [
    "Agárd – Akácfa utca 2.", "Ajka – Hársfa utca 1/A", "Aszód – Pesti út 14-16.", "Baja – Bajcsy-Zsilinszky utca 9.",
    "Balassagyarmat – Kóvári út 8", "Balatonfűzfő – Vízmű utca 1.", "Balatonlelle – Rákóczi F. út 307.", "Békéscsaba – Corvin u. 29-33.",
    "Békéscsaba – Szarvasi út 15-17.", "Budapest – Ady Endre út 54-60.", "Budapest – Bajcsy-Zsilinszky út 61.", "Budapest – Bartók Béla út 47.",
    "Budapest – Bécsi út 325-337.", "Budapest – Fehérvári út 211.", "Budapest – Ferenciek tere 2.", "Budapest – Görgey Artúr u. 14-20",
    "Budapest – Gubacsi út 34.", "Budapest – Mogyoródi út 23-29", "Budapest – Nagykőrösi út 35-38.", "Budapest – Pesti út 237/H",
    "Budapest – Rákóczi út 48-50.", "Budapest – Szentendrei út 251-253", "Budapest – Teleki tér 1.", "Budapest – Váci út 201",
    "Cegléd – Törteli út 2.", "Debrecen – Derék u. 31.", "Debrecen – Faraktár utca 58.", "Dunakeszi – Berek u. 2.",
    "Dunaújváros – Magyar út 11.", "Eger – Mátyás király út 144.", "Érd – Balatoni út 73-75.", "Esztergom – Dobogókői út 39.",
    "Gödöllő – Ottó Ferenc utca 2-4.", "Győr – Szeszgyár utca 6.", "Győr – Tihanyi Árpád út 9.", "Hódmezővásárhely – Hódtó u. 2.",
    "Kaposvár – Füredi út 97.", "Kecskemét – Izsáki út 2.", "Kecskemét – Nyíri út 38/E", "Miskolc – Kiss Ernő u. 13/b.",
    "Nagykőrös – Kecskeméti út 73.", "Nyíregyháza – Debreceni u. 106/c.", "Pécs – Siklósi út 52/A", "Siófok – Zamárdi utca 1-2.",
    "Sopron – Bánfalvi út 12.", "Szeged – Makkosházi krt. 21.", "Székesfehérvár – Balatoni út 21.", "Szolnok – Széchenyi krt. 4/b.",
    "Szombathely – Zanati út 42", "Tatabánya – Győri út 31.", "Vác – Bolgár u. 1.", "Veszprém – Észak-keleti útgyűrű 2.", "Zalaegerszeg – Platán sor 6/A"
  ],
  "spar": [
    "Budapest – Allee Interspar", "Budapest – Árkád Interspar", "Budapest – Westend Spar", "Budapest – Mammut Spar",
    "Debrecen – Fórum Spar", "Győr – Interspar", "Szeged – Árkád Spar", "Pécs – Árkád Interspar", "Kecskemét – Malom Spar"
  ],
  "tesco": ["Budapest – Váci út Tesco Extra", "Budapest – Fogarasi út Tesco", "Budaörs – Tesco Hipermarket", "Győr – Tesco", "Szeged – Tesco"],
  "penny": ["Budapest – Kerepesi út Penny", "Debrecen – Sámsoni út Penny", "Szeged – Makkosházi Penny", "Pécs – Zsolnay Penny"]
};

// TELEPÜLÉS KOORDINÁTÁK
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
  "szekesfehervar": { lat: 47.1860, lng: 18.4221, x: 44.0, y: 45.0 },
  "pecs": { lat: 46.0727, lng: 18.2323, x: 41.0, y: 83.0 },
  "kecskemet": { lat: 46.9069, lng: 19.6913, x: 61.0, y: 59.0 },
  "nagykörös": { lat: 47.0322, lng: 19.7828, x: 62.5, y: 56.0 },
  "nagykoros": { lat: 47.0322, lng: 19.7828, x: 62.5, y: 56.0 },
  "cegled": { lat: 47.1742, lng: 19.7997, x: 63.0, y: 52.0 },
  "kiskunfelegyhaza": { lat: 46.7119, lng: 19.8456, x: 62.0, y: 65.0 },
  "lajosmizse": { lat: 47.0256, lng: 19.5583, x: 59.0, y: 56.0 },
  "dabas": { lat: 47.1878, lng: 19.3139, x: 56.0, y: 51.0 },
  "albertirsa": { lat: 47.2417, lng: 19.6167, x: 60.0, y: 49.0 },
  "szeged": { lat: 46.2530, lng: 20.1414, x: 66.0, y: 81.0 },
  "debrecen": { lat: 47.5316, lng: 21.6273, x: 88.0, y: 40.0 },
  "miskolc": { lat: 48.1035, lng: 20.7784, x: 77.0, y: 23.0 },
  "erd": { lat: 47.3789, lng: 18.9192, x: 51.0, y: 43.0 },
  "budaors": { lat: 47.4625, lng: 18.9536, x: 51.2, y: 40.5 }
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

// BIZTONSÁGOS TÖMB- ÉS JSON-KEZELŐK
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

// 🔒 KIZÁRÓLAG AZ AKTÍV FOLYAMATBAN LÉVŐ CSERÉKBŐL SZÁMOLT LAKAT-SZÁMLÁLÓ
function getActiveLockedCounts(albumId = currentAlbumId) {
  const counts = {};
  (myProfile.activeTrades || []).forEach(t => {
    if (t.status === 'pending' && (t.albumId || 'lidl-lutra-2026') === albumId) {
      (t.givingItems || []).forEach(num => { counts[num] = (counts[num] || 0) + 1; });
    }
  });
  return counts;
}

// PROFIL ALAPÁLLAPOT
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

// FEJEZETEK ÉS TÉTELELNEVEZÉSEK
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
  { id: "azsia", cim: "12–13. oldal — Ázsia", elemek: [
    { type: "single", num: 34, name: "Mongol szajga", orient: "fekvő" }, { type: "combo", nums: [35, 36], name: "Tigris (2 részes)", orient: "panoráma" },
    { type: "single", num: 37, name: "Borneói orangután", orient: "álló" }, { type: "single", num: 38, name: "Mandzsu daru", orient: "álló" }
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

// SOCIAL PROOF MUTATÓK (809+ GYŰJTŐ)
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

// 0 MS-OS OPTIMISTIC UI KATTINTÁSI MOTOR LAKATVÉDELEMMEL ÉS UNDO TOASTTAL
function toggleStickerState(num) {
  hideQtyPopover();

  // 1. ZÁROLT DUPLÁK VÉDELME: Ha van aktív lakat a tételen, nem engedjük véletlenül elállítani!
  const activeLocks = getActiveLockedCounts(currentAlbumId);
  if (activeLocks[num] && activeLocks[num] > 0 && myProfile.van.includes(num)) {
    showToast(`🔒 A ${getItemLabel(num)} tétel zárolva van egy aktív csere miatt!`);
    return;
  }

  // Előző állapot mentése a visszavonáshoz (Undo)
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

// DARABSZÁM POPOVER JAVÍTOTT MŰKÖDÉSE (NINCS TÖBBÉ DUPLÁN SZÁMOLÁS!)
document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    const num = activePopoverNum;

    // BUGFIX: Ha duplát állítunk, kötelezően kivesszük a Hiányzó és Foglalt listából!
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
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.1 STABIL KIADÁS)
// 2 / 4. RÉSZ: 4 KERESŐBLOKK, CSERETERVEZŐ, EGYEDI AJÁNLAT & KAPCSOLATFELVÉTEL
// =========================================================================

// --- 1. BLOKK: TÉTELKERESŐ (SZÁM VAGY NÉV ALAPJÁN) ---
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
  if (container) { container.style.display = 'none'; container.innerHTML = ''; }
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

// --- 2. BLOKK: TELEPÜLÉSKERESŐ (CSEREINDÍTÁS GOMBBAL) ---
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

// --- 3. BLOKK: KÖZELI GPS-KERESŐ (CSEREINDÍTÁS GOMBBAL) ---
let proximityDisplayLimit = 25;

function getUserCoordinates(userObj) {
  if (userObj.geo && typeof userObj.geo.lat === 'number') return userObj.geo;
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
  if (userObj.geo && typeof userObj.geo.lat === 'number') coords.push(userObj.geo);
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
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--moss-soft);">✓ Helyzet rögzítve! Távolsági szűrők aktívak.</span>';
      showToast("GPS koordináták rögzítve!");
      renderMatches();
      renderProximityPartners();
      if (callback) callback(true);
    },
    (err) => {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger);">Nem sikerült lekérni a GPS pozíciót.</span>';
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

// --- 4. BLOKK: PARTNER NÉVALAPÚ KERESŐ (CSEREINDÍTÁS GOMBBAL) ---
safeAddListener('btn-search-partner', () => {
  const query = (document.getElementById('search-partner-input')?.value || '').trim().toLowerCase();
  const boxEl = document.getElementById('partner-search-results-box');
  const statusEl = document.getElementById('partner-search-status');
  const listEl = document.getElementById('partner-search-list');
  const clearBtn = document.getElementById('btn-clear-partner-search');

  if (!query) return showToast("Írd be a gyűjtő nevét a kereséshez!");

  const myId = currentUser ? currentUser.uid : 'me';
  const matchedUsers = allUsersData.filter(u => 
    u.id !== myId && (u.nev || '').toLowerCase().includes(query)
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

// KERESŐ LISTÁK KATTINTÁSAINAK ESEMÉNYKEZELÉSE
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'contact-proximity' || action === 'contact-search' || action === 'contact-match') {
    const uid = btn.dataset.uid;
    const targetUser = allUsersData.find(u => u.id === uid);
    if (!targetUser) return;
    const foundNums = btn.dataset.found ? ensureArray(btn.dataset.found) : [];
    openContactModal(targetUser, [], foundNums.length ? foundNums : targetUser.van, targetUser.isGiftOffering);
  } else if (action === 'inspect-user') {
    openUserProfileModal(btn.dataset.uid);
  }
});

// =========================================================================
// KAPCSOLATFELVÉTELI RENDSZER (KIIKSZELŐ CHIPEK + EGYEDI AJÁNLAT RUBRIKA)
// =========================================================================

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();
let activeContactTarget = { uid: '', nev: '', telepules: '', email: '', showEmail: false, isGift: false, subject: '' };

function openContactModal(targetUser, giveArray = [], getArray = [], isGift = false) {
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
    subject: subject
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
      return `<span class="contact-item-chip ${isExcluded ? 'excluded' : ''}" data-action="toggle-give-chip" data-num="${n}">${escapeHtml(getItemLabel(n, currentAlbumId))}<span class="chip-del">✕</span></span>`;
    }).join('');
  }

  if (getBox) {
    getBox.innerHTML = activeContactGetNums.map(n => {
      const isExcluded = excludedGetNums.has(n);
      return `<span class="contact-item-chip ${isExcluded ? 'excluded' : ''}" data-action="toggle-get-chip" data-num="${n}" style="border-color:var(--moss-soft);">${escapeHtml(getItemLabel(n, currentAlbumId))}<span class="chip-del">✕</span></span>`;
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

// ÉLŐBEN FRISSÜLŐ LEVÉLSZÖVEG (AZ EGYEDI AJÁNLAT BEÉPÍTÉSÉVEL)
function updateContactModalText() {
  const inputEl = document.getElementById('contact-msg-input');
  if (!inputEl) return;

  const activeAlbum = getActiveAlbum();
  const effectiveGive = activeContactGiveNums.filter(n => !excludedGiveNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const customOfferText = (document.getElementById('contact-custom-offer')?.value || '').trim();

  // Ha beírtak egyedi felajánlást, azt fűzzük be az "Én tudom adni neked:" részbe!
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

safeAddListener('contact-custom-offer', 'input', updateContactModalText);
safeAddListener('btn-close-contact', () => document.getElementById('modal-contact')?.classList.remove('open'));
safeAddListener('btn-copy-msg', () => {
  const val = document.getElementById('contact-msg-input')?.value || '';
  navigator.clipboard.writeText(val);
  showToast("Üzenet kimásolva a vágólapra!");
});

function checkSenderProfileReady() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!currentUser) {
    showToast("Előbb lépj be a fiókodba a kapcsolatfelvételhez!");
    document.getElementById('modal-auth')?.classList.add('open');
    return false;
  }
  if (!myProfile.email || !emailRegex.test(myProfile.email) || !myProfile.nev || !myProfile.gdprAccepted) {
    showToast("Kérlek előbb töltsd ki a profilodat a Profil fülön!");
    switchView('profil');
    return false;
  }
  return true;
}
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.1 STABIL KIADÁS)
// 3 / 4. RÉSZ: PÁROSÍTÁSOK, KÖRCSERÉK, CSEREMENEDZSMENT, MESSENGER PIPÁK & RADAR
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
            <button class="btn btn-primary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-b" data-loop-idx="${loopIdx}">Üzenet: ${escapeHtml(l.userB.nev)}</button>
            <button class="btn btn-secondary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-c" data-loop-idx="${loopIdx}">Üzenet: ${escapeHtml(l.userC.nev)}</button>
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
            <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(m.id)}">Kapcsolatfelvétel</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">Adatlap</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateTradePlannerBar();
}

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
    if (action === 'contact-loop-b') openLoopContactModal(loop.userB, loop.userC.nev, loop.giveToB, 'B');
    else openLoopContactModal(loop.userC, loop.userB.nev, loop.giveCtoMe, 'C');
  }
});

function openLoopContactModal(targetUser, thirdPersonName, stickersArray, role) {
  if (!checkSenderProfileReady()) return;
  const activeAlbum = getActiveAlbum();
  const subject = `${activeAlbum.title} 3 fős körcsere egyeztetés`;
  openContactModal(targetUser, ensureArray(stickersArray), [], false);
}

// CSERE-TERVEZŐ
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

safeAddListener('btn-open-trade-planner', () => { renderTradePlannerModal(); document.getElementById('modal-trade-planner')?.classList.add('open'); });
safeAddListener('btn-top-open-planner', () => { renderTradePlannerModal(); document.getElementById('modal-trade-planner')?.classList.add('open'); });
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
        const sortedCandidate = [...demandList].sort((a, b) => b.totalGivesToMe - a.totalGivesToMe || (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0))[0];
        assignedUid = sortedCandidate.user.id;
      }
      if (allocation[assignedUid]) allocation[assignedUid].push(num);
    } else {
      demandList.forEach(d => { if (allocation[d.user.id]) allocation[d.user.id].push(num); });
    }
  });

  if (conflicts.length === 0) {
    conflictBox.innerHTML = `<div class="notice-banner" style="background:rgba(107,138,90,0.15); border-color:var(--moss-soft);"><strong>Nincs ütközés:</strong> Mind a ${selectedUsers.length} partnernek jut az általuk kért összes dupládból!</div>`;
  } else {
    conflictBox.innerHTML = `
      <div class="card" style="border:1.5px solid var(--danger); background:rgba(232,90,79,0.12);">
        <h4 style="margin:0 0 6px; color:#FFC0BA;">Ütköző tételek (${conflicts.length} db)</h4>
        ${conflicts.map(c => `
          <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
            <div><strong>${escapeHtml(getItemFullName(c.num))}</strong> (Készlet: ${c.myQty} db)</div>
            <div style="display:flex; gap:8px;">
              ${c.demandList.map(d => `
                <label class="radio-label" style="margin:0; font-size:0.75rem;">
                  <input type="radio" name="conflict-sticker-${c.num}" value="${d.user.id}" ${(tradePlanManualOverrides[c.num] || c.demandList[0].user.id) === d.user.id ? 'checked' : ''} data-action="override-conflict" data-num="${c.num}">
                  ${escapeHtml(d.user.nev)} (+${d.totalGivesToMe} db)
                </label>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  let totalNewGained = new Set();
  let totalGivenCount = 0;

  breakdownBox.innerHTML = selectedUsers.map(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const givesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
    givesToMe.forEach(n => totalNewGained.add(n));
    const allocated = (allocation[u.id] || []).sort((a, b) => a - b);
    totalGivenCount += allocated.length;

    return `
      <div class="card" style="margin-bottom:8px; padding:12px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
          <h4 style="margin:0;">${escapeHtml(u.nev)}</h4>
          <span style="font-size:0.75rem; color:var(--amber); font-weight:700;">+${givesToMe.length} tétel tőle</span>
        </div>
        <div style="font-size:0.8rem; line-height:1.5;">
          <p style="margin:2px 0;"><strong>Neki adod:</strong> ${allocated.length ? allocated.map(n => getItemLabel(n)).join(', ') : '<em>(Nem jut dupla)</em>'}</p>
          <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle kapod:</strong> ${givesToMe.map(n => getItemLabel(n)).join(', ')}</p>
        </div>
      </div>
    `;
  }).join('');

  summaryBox.innerHTML = `
    <div style="font-size:0.85rem; color:var(--amber); font-weight:700;">Szimuláció végeredménye (${selectedUsers.length} csere):</div>
    <div style="font-size:1.15rem; font-weight:800; color:#FFF;">+${totalNewGained.size} új tétel az albumodba • -${totalGivenCount} elcserélt dupla</div>
  `;
}

safeAddListener('trade-plan-conflicts-section', 'change', (e) => {
  const radio = e.target.closest('[data-action="override-conflict"]');
  if (!radio) return;
  tradePlanManualOverrides[parseInt(radio.dataset.num, 10)] = radio.value;
  renderTradePlannerModal();
});

// =========================================================================
// RÁCS ALATTI FOLYAMATBAN LÉVŐ CSERÉK & ÉRTÉKELŐ MODAL
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

  if (pendingTrades.length > 0) {
    html += pendingTrades.map((t) => {
      const originalIdx = allTrades.indexOf(t);
      return `
        <div class="trade-manage-card" data-trade-idx="${originalIdx}">
          <div class="trade-manage-header">
            <div>
              <strong style="color:#FFF;">${escapeHtml(t.partnerName || 'Cserepartner')}</strong>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">(${escapeHtml(t.partnerCity || 'Partner')})</span>
            </div>
            <span class="badge-trade-status badge-status-reserved">🔒 Zárolva / Úton</span>
          </div>
          <div style="font-size:0.8rem; margin:6px 0; background:rgba(0,0,0,0.2); padding:8px; border-radius:var(--radius-sm);">
            <p style="margin:2px 0;"><strong>Te adod (Lefoglalva):</strong> ${t.givingItems?.length ? t.givingItems.map(n => getItemLabel(n)).join(', ') : '<em>(Nincs lefoglalt tétel)</em>'}</p>
            <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle várod:</strong> ${t.receivingItems?.length ? t.receivingItems.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándék)</em>'}</p>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
            <button class="btn btn-contact-green btn-sm" data-action="complete-trade" data-trade-idx="${originalIdx}">✓ Megérkezett / Csere lezárása</button>
            <button class="btn btn-secondary btn-sm" data-action="cancel-trade" data-trade-idx="${originalIdx}" style="color:var(--danger); border-color:var(--danger);">✕ Megállapodás visszavonása</button>
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
        <summary style="font-size:0.8rem; color:var(--amber); cursor:pointer; font-weight:700;">▶ Korábbi sikeres cseréid (${completedTrades.length} db lezárva)</summary>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${completedTrades.map(t => `
            <div style="background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:var(--radius-sm); font-size:0.76rem; display:flex; justify-content:space-between;">
              <div><strong>${escapeHtml(t.partnerName)}</strong> (${escapeHtml(t.partnerCity || '')}): Átadva: ${t.givingItems?.map(n => getItemLabel(n)).join(', ') || '-'} ➔ Kapva: ${t.receivingItems?.map(n => getItemLabel(n)).join(', ') || '-'}</div>
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
    
    // Zárolt duplák lakatjának feloldása
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

    myProfile.activeTrades.splice(idx, 1);
    saveMyState();
    renderActiveTradesPanel();
    renderGrid();
    showToast("Csere visszavonva, a tételek újra szabadok.");
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
  const commentText = document.getElementById('rate-modal-comment')?.value.trim() || '';

  // 1. Kapott tételek beemelése
  if (trade.receivingItems) {
    trade.receivingItems.forEach(n => {
      const kIdx = myProfile.kell.indexOf(n);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
      if (!myProfile.van.includes(n)) { myProfile.van.push(n); myProfile.vanCounts[n] = 1; }
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
        fromUid: currentUser.uid, fromName: myProfile.nev || 'Gyűjtőtárs',
        stars: selectedStarRating, comment: commentText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("public_profiles").doc(trade.partnerUid).update({
        trustScore: firebase.firestore.FieldValue.increment(selectedStarRating),
        ratingsCount: firebase.firestore.FieldValue.increment(1)
      });
    } catch (e) { console.warn("Értékelés mentési hiba:", e); }
  }

  if (document.getElementById('rate-modal-comment')) document.getElementById('rate-modal-comment').value = '';
  document.getElementById('modal-rate-trade')?.classList.remove('open');
  activeTradeClosingData = null;
  renderActiveTradesPanel();
  renderGrid();
  showToast("Csere sikeresen lezárva és archiválva!");
});

// =========================================================================
// BELSŐ ÜZENETKÜLDÉS & MESSENGER-PIPÁK (THREADED CHAT ALAPOK)
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
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
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
      } catch (e) { console.warn("Tranzakciós e-mail értesítés hiba:", e); }

      showToast("Üzeneted elküldve (✓ Kézbesítve)! A csere rögzítve a rács alatt.");
      document.getElementById('modal-contact')?.classList.remove('open');
    } catch (err) {
      showToast("Küldési hiba: " + err.message);
    } finally {
      if (loader) loader.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
    }
  })();
});

// MESSENGER-PIPÁS POSTAFIÓK MEGJELENÍTŐ
let activeInboxTab = 'inbox';
let msgAlbumFilter = 'all';

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

safeAddListener('btn-refresh-inbox', () => { renderMessages(); showToast("Üzenetek frissítve."); });

function updateMsgAlbumFilterOptions() {
  const sel = document.getElementById('msg-album-filter-select');
  if (!sel) return;
  const usedAlbumIds = new Set();
  [...myIncomingMessages, ...myOutgoingMessages].forEach(m => { if (m.albumId) usedAlbumIds.add(m.albumId); });

  const currentVal = sel.value;
  sel.innerHTML = '<option value="all">📦 Minden gyűjtemény üzenetei</option>';
  usedAlbumIds.forEach(id => {
    const albTitle = getAlbumDisplayTitle(id);
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = `📦 ${albTitle}`;
    sel.appendChild(opt);
  });
  if (currentVal && [...usedAlbumIds, 'all'].includes(currentVal)) sel.value = currentVal;
}

safeAddListener('msg-album-filter-select', 'change', (e) => {
  msgAlbumFilter = e.target.value;
  renderMessages();
});

function renderMessages() {
  const container = document.getElementById('messages-inbox-list');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:24px;"><h3>Belépés szükséges</h3><p style="font-size:0.85rem; color:var(--text-muted); margin:6px 0 14px;">Az üzeneteid megtekintéséhez kérlek lépj be a fiókodba.</p><button class="btn btn-primary" onclick="document.getElementById('modal-auth')?.classList.add('open')">Belépés / Fiók</button></div>`;
    return;
  }

  updateMsgAlbumFilterOptions();

  // AUTOMATIKUS OLVASOTTSÁG: Beérkező üzenetek megnyitásakor azonnal ✓✓-ra vált a feladónál!
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
  if (msgAlbumFilter !== 'all') list = list.filter(m => (m.albumId || 'lidl-lutra-2026') === msgAlbumFilter);

  if (list.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:24px;"><h3 style="margin:0 0 4px;">Nincs ${activeInboxTab === 'inbox' ? 'beérkező' : 'elküldött'} üzeneted</h3></div>`;
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
      if (msg.read === true) pipaHtml = `<span class="msg-status-pipa msg-read-double" title="Megnyitva / Elolvasva">✓✓</span>`;
      else pipaHtml = `<span class="msg-status-pipa msg-delivered" title="Kézbesítve a partner postafiókjába">✓</span>`;
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
          ${isIncoming ? `<button class="btn btn-sm btn-primary" data-action="reply-message" data-sender-uid="${escapeHtml(msg.fromUid)}" data-sender-name="${escapeHtml(msg.fromName)}">Válasz ${escapeHtml(msg.fromName)}-nek</button>` : '<div></div>'}
          <button class="btn btn-secondary btn-sm" data-action="delete-message" data-msg-id="${escapeHtml(msg.id)}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>
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
    openContactModal({ id: btn.dataset.senderUid, nev: btn.dataset.senderName }, [], [], false);
  } else if (btn.dataset.action === 'delete-message') {
    if (!confirm("Biztosan törölni szeretnéd ezt az üzenetet?")) return;
    const isIncoming = activeInboxTab === 'inbox';
    db.collection("messages").doc(btn.dataset.msgId).update({
      [isIncoming ? "deletedByRecipient" : "deletedBySender"]: true
    }).then(() => showToast("Üzenet eltávolítva."));
  }
});

// GYŰJTŐI ADATLAP MODAL
async function openUserProfileModal(uid) {
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return showToast("Gyűjtő adatai nem találhatók.");

  const modal = document.getElementById('modal-user-profile');
  if (!modal) return;

  const nameEl = document.getElementById('user-profile-modal-name');
  const cityEl = document.getElementById('user-profile-modal-city');
  const ratingBadge = document.getElementById('user-profile-rating-badge');

  if (nameEl) nameEl.textContent = `Gyűjtő: ${targetUser.nev || 'Névtelen'}`;
  if (cityEl) cityEl.textContent = targetUser.telepules ? `Település: ${targetUser.telepules}` : 'Nincs megadva település';

  const rCount = targetUser.ratingsCount || 0;
  const tScore = targetUser.trustScore || 0;
  const avg = rCount > 0 ? (tScore / rCount).toFixed(1) : (tScore > 0 ? tScore : '5.0');
  if (ratingBadge) ratingBadge.innerHTML = rCount > 0 ? `⭐ ${avg} / 5 (${rCount} értékelés)` : (tScore > 0 ? `⭐ ${tScore} pont` : `⭐ Új gyűjtő`);

  const reviewsDetails = document.getElementById('user-profile-reviews-details');
  const reviewsCountEl = document.getElementById('user-profile-reviews-count');
  const reviewsListEl = document.getElementById('user-profile-reviews-list');

  if (reviewsDetails && reviewsCountEl && reviewsListEl) {
    try {
      const snap = await db.collection("public_profiles").doc(uid).collection("reviews").orderBy("createdAt", "desc").limit(10).get();
      if (!snap.empty) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = snap.docs.length;
        reviewsListEl.innerHTML = snap.docs.map(doc => {
          const r = doc.data();
          return `<div class="review-bubble"><strong>${escapeHtml(r.fromName || 'Partner')}:</strong> ⭐ ${r.stars || 5}/5<div style="color:var(--sand); font-style:italic;">„${escapeHtml(r.comment || 'Minden rendben zajlott!')}”</div></div>`;
        }).join('');
      } else { reviewsDetails.style.display = 'none'; }
    } catch (e) { reviewsDetails.style.display = 'none'; }
  }

  const contactBtn = document.getElementById('btn-user-profile-contact');
  if (contactBtn) {
    contactBtn.onclick = () => { modal.classList.remove('open'); openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering); };
  }

  const mBox = document.getElementById('user-profile-missing-tags');
  const vBox = document.getElementById('user-profile-van-tags');
  if (mBox) {
    mBox.innerHTML = targetUser.allowInspect === false ? '<em style="color:var(--text-muted);">Rejtett hiányzólista</em>' :
      (targetUser.kell?.length ? targetUser.kell.map(n => `<span style="display:inline-block; margin:2px 4px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:999px;">${getItemLabel(n, currentAlbumId)}</span>`).join('') : '<span style="color:var(--amber);">Minden megvan!</span>');
  }
  if (vBox) {
    vBox.innerHTML = targetUser.van?.length ? targetUser.van.map(n => `<span style="display:inline-block; margin:2px 4px; background:rgba(216,155,74,0.2); padding:2px 8px; border-radius:999px;">${getItemLabel(n, currentAlbumId)}</span>`).join('') : '<em>Nincs duplája</em>';
  }

  modal.classList.add('open');
}

safeAddListener('btn-close-user-profile', () => document.getElementById('modal-user-profile')?.classList.remove('open'));
safeAddListener('btn-close-user-profile-2', () => document.getElementById('modal-user-profile')?.classList.remove('open'));

// =========================================================================
// KÉSZLETRADAR & TALÁLKOZÓK
// =========================================================================

let radarAttachedBase64 = '';
safeAddListener('radar-photo-input', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800; // Optimalizált méret: sosem lépi túl a Firestore 1MB-os limitjét!
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      radarAttachedBase64 = canvas.toDataURL('image/jpeg', 0.55);
      const preview = document.getElementById('radar-photo-preview');
      const previewBox = document.getElementById('radar-photo-preview-box');
      if (preview && previewBox) { preview.src = radarAttachedBase64; previewBox.style.display = 'block'; }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

safeAddListener('btn-submit-radar', async () => {
  if (!currentUser) return showToast("Bejelentéshez lépj be a fiókodba!");
  const rawStore = document.getElementById('radar-input-store')?.value.trim() || '';
  const note = document.getElementById('radar-input-note')?.value.trim() || '';
  const status = document.querySelector('input[name="radar-status"]:checked')?.value === 'van';
  if (!rawStore) return showToast("Kérlek válaszd ki a boltot!");

  try {
    await db.collection("album_reports").add({
      albumId: currentAlbumId,
      fullStoreName: rawStore,
      note, status, photoBase64: radarAttachedBase64 || '',
      likes: [], reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reporterName: myProfile.nev || 'Gyűjtő', userId: currentUser.uid
    });
    radarAttachedBase64 = '';
    if (document.getElementById('radar-input-store')) document.getElementById('radar-input-store').value = '';
    if (document.getElementById('radar-input-note')) document.getElementById('radar-input-note').value = '';
    if (document.getElementById('radar-photo-preview-box')) document.getElementById('radar-photo-preview-box').style.display = 'none';
    showToast("Köszönjük! A bolti jelentésed rögzítve.");
  } catch (err) { showToast("Hiba: " + err.message); }
});

function renderRadarReports() {
  const container = document.getElementById('radar-reports-list');
  if (!container) return;
  const filterQuery = (document.getElementById('radar-filter-input')?.value || '').toLowerCase().trim();

  const filtered = radarReports
    .filter(r => (r.albumId || 'lidl-lutra-2026') === currentAlbumId)
    .filter(r => !filterQuery || (r.fullStoreName || '').toLowerCase().includes(filterQuery));

  if (filtered.length === 0) {
    container.innerHTML = '<p class="view-intro">Nincs készletjelentés ehhez az albumhoz.</p>';
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="radar-card">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <strong>${escapeHtml(r.fullStoreName)}</strong>
        <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">${r.status ? 'Kapható' : 'Elfogyott'}</span>
      </div>
      ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${formatLinksWithAnchors(r.note)}”</p>` : ''}
      ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" data-action="open-lightbox">` : ''}
    </div>
  `).join('');
}

safeAddListener('radar-filter-input', 'input', () => renderRadarReports());
safeAddListener('btn-refresh-radar', () => { renderRadarReports(); showToast("Radar frissítve."); });
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.1 STABIL KIADÁS)
// 4 / 4. RÉSZ: CHUNKED JSON IMPORTŐR, ADMIN MOTOR, STATISZTIKA & FIREBASE BOOT
// =========================================================================

// --- NÉZETVÁLTÓ ÉS MENÜVEZÉRLŐ ---
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
  if (viewName === 'statisztika') { renderStatistics(); renderCompletionOdds(); renderHeatmap(); }
  if (viewName === 'radar') renderRadarReports();
  if (viewName === 'meetups') renderMeetups();
  if (viewName === 'uzeneteim') renderMessages();
  if (viewName === 'matricaim') { renderGrid(); renderActiveTradesPanel(); }
  if (viewName === 'admin') { renderAdminAlbumsList(); renderAdminSuggestionsList(); renderAdminAnnouncements(); }
  if (viewName === 'profil') { renderProfileLocations(); initFavoriteSelects(); }
}

document.querySelectorAll('.primary-tab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.view) switchView(t.dataset.view);
    else switchCategory(t.dataset.cat);
  });
});
document.querySelectorAll('.sub-tab').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));
document.querySelectorAll('.dropdown-link').forEach(t => t.addEventListener('click', () => switchView(t.dataset.view)));

// HUB (KEZDŐLAP) RENDERELŐ
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
      const mTitle = (album.title || '').toLowerCase().includes(query);
      const mPub = (album.publisher || '').toLowerCase().includes(query);
      if (!mTitle && !mPub) return false;
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

  if (countSpan) countSpan.textContent = allFilteredList.length;

  let displayList = allFilteredList;
  if (currentHubFilter === 'all' && !showAllHubAlbums && !query) {
    displayList = allFilteredList.slice(0, 6);
  }

  if (toggleBtn) {
    if (currentHubFilter !== 'all' || allFilteredList.length <= 6 || query) toggleBtn.style.display = 'none';
    else {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.innerHTML = showAllHubAlbums ? '▲ Csak a kiemeltek mutatása (6 db)' : `Összes gyűjtemény listázása (${allFilteredList.length} db) ▼`;
    }
  }

  container.innerHTML = displayList.map(album => {
    const isFeatured = album.featured === true || album.id === 'lidl-lutra-2026';
    const isRetro = album.year < 2018 || album.isRetro === true;
    const albumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : []));
    const collectedCount = albumVan.length;
    const pct = Math.min(100, Math.round((collectedCount / album.totalItems) * 100));

    return `
      <div class="album-hub-card ${isFeatured ? 'featured-card' : ''}" data-album-id="${escapeHtml(album.id)}">
        <div>
          <img src="${album.coverUrl || 'og-image.png'}" class="hub-card-thumb" alt="${escapeHtml(album.title)}" loading="lazy">
          <div class="album-hub-header">
            <div style="display:flex; gap:4px; align-items:center;">
              <span class="album-type-badge">${escapeHtml(album.typeLabel)}</span>
              ${isRetro ? `<span class="album-type-badge badge-retro">🕹️ Retro (${album.year})</span>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${album.year}</span>`}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.15rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 10px;">${escapeHtml(album.publisher)}</p>
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--sand);">
            <span>Gyűjtve: <strong>${collectedCount} / ${album.totalItems} db</strong></span>
            <strong>${pct}%</strong>
          </div>
          <div class="album-hub-progress-track"><div class="album-hub-progress-bar" style="width:${pct}%;"></div></div>
          <div style="margin-top:12px;">
            <button class="btn btn-primary btn-sm" style="width:100%;" data-action="select-album" data-album-id="${escapeHtml(album.id)}">Megnyitás & Gyűjtés ➔</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('hub-search-input', 'input', renderHub);
safeAddListener('btn-toggle-all-hub-albums', () => { showAllHubAlbums = !showAllHubAlbums; renderHub(); });

safeAddListener('hub-albums-grid', (e) => {
  const card = e.target.closest('[data-album-id]');
  if (card) selectAlbum(card.dataset.albumId);
});

function selectAlbum(albumId) {
  if (!ALBUMS_REGISTRY[albumId]) return;
  currentAlbumId = albumId;
  localStorage.setItem('lutra_active_album', albumId);
  const activeAlbum = getActiveAlbum();

  document.getElementById('active-album-bar').style.display = 'flex';
  document.getElementById('active-album-title').textContent = `${activeAlbum.title} (${activeAlbum.year})`;
  document.getElementById('active-album-thumb').src = activeAlbum.coverUrl || 'og-image.png';
  document.getElementById('count-total-size').textContent = activeAlbum.totalItems;

  document.getElementById('main-primary-nav').style.display = 'grid';
  document.getElementById('mobile-subnav-bar').style.display = 'block';

  loadAlbumState(albumId);
  initFavoriteSelects();
  switchView('matricaim');
  showToast(`Aktív: ${activeAlbum.title}`);
}

safeAddListener('btn-switch-album', () => {
  document.getElementById('active-album-bar').style.display = 'none';
  document.getElementById('main-primary-nav').style.display = 'none';
  document.getElementById('mobile-subnav-bar').style.display = 'none';
  switchView('hub');
});

function loadAlbumState(albumId) {
  myProfile.van = ensureArray(safeJsonParse(`lutra_van_${albumId}`, [])).sort((a, b) => a - b);
  myProfile.vanCounts = safeJsonParse(`lutra_van_counts_${albumId}`, {});
  myProfile.kell = ensureArray(safeJsonParse(`lutra_kell_${albumId}`, [])).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(safeJsonParse(`lutra_foglalva_${albumId}`, [])).sort((a, b) => a - b);
  myProfile.foglalvaCounts = safeJsonParse(`lutra_foglalva_counts_${albumId}`, {});
  myProfile.activeTrades = safeJsonParse(`lutra_active_trades_${albumId}`, []);
  myProfile.privateNote = localStorage.getItem(`private_note_${albumId}`) || '';

  const noteInput = document.getElementById('prof-private-note');
  if (noteInput) noteInput.value = myProfile.privateNote;

  renderGrid();
  renderActiveTradesPanel();
  renderMatches();
}

function saveMyStateFast() {
  const albumId = currentAlbumId;
  lastLocalEditTimestamp = Date.now();

  localStorage.setItem(`lutra_van_${albumId}`, JSON.stringify(myProfile.van));
  localStorage.setItem(`lutra_van_counts_${albumId}`, JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem(`lutra_kell_${albumId}`, JSON.stringify(myProfile.kell));
  localStorage.setItem(`lutra_foglalva_${albumId}`, JSON.stringify(myProfile.foglalva));
  localStorage.setItem(`lutra_foglalva_counts_${albumId}`, JSON.stringify(myProfile.foglalvaCounts || {}));
  localStorage.setItem(`lutra_active_trades_${albumId}`, JSON.stringify(myProfile.activeTrades || []));

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    syncLutraDualSave(albumId);
  }, 450);
}

function saveMyState() {
  saveMyStateFast();
  renderGrid();
  renderHub();
}

function syncLutraDualSave(albumId) {
  if (!currentUser || !db) return;
  const isLutra = (albumId === 'lidl-lutra-2026');

  db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(albumId).set({
    albumId, van: myProfile.van, vanCounts: myProfile.vanCounts || {},
    kell: myProfile.kell, foglalva: myProfile.foglalva, foglalvaCounts: myProfile.foglalvaCounts || {},
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  const publicPayload = {
    [`collections.${albumId}`]: {
      van: myProfile.van, vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell, foglalva: myProfile.foglalva, foglalvaCounts: myProfile.foglalvaCounts || {},
      updatedAt: Date.now()
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (isLutra) {
    publicPayload.van = myProfile.van; publicPayload.vanCounts = myProfile.vanCounts || {};
    publicPayload.kell = myProfile.kell; publicPayload.foglalva = myProfile.foglalva;
  }

  db.collection("public_profiles").doc(currentUser.uid).set(publicPayload, { merge: true }).catch(err => {
    showToast("Mentési hiba történt a felhőbe.");
  });
}

// =========================================================================
// ADMINISZTRÁCIÓS MŰVELETEK (MŰKÖDŐ CHUNKED IMPORTŐR & MIGRÁCIÓ)
// =========================================================================

// 1. TÖMEGES JSON ALBUM IMPORTŐR (85+ ALBUM FELTÖLTÉSE 500-AS BATCHEKBEN)
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

  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = `Feldolgozás: 0 / ${albumsList.length} album...`; }

  // 400-as darabokban (chunk) mentünk a Firestore 500-as limitje miatt
  const chunkSize = 400;
  let savedCount = 0;

  try {
    for (let i = 0; i < albumsList.length; i += chunkSize) {
      const chunk = albumsList.slice(i, i + chunkSize);
      const batch = db.batch();

      chunk.forEach(alb => {
        const id = (alb.id || alb.title).toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
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
          featured: alb.featured === true,
          isRetro: alb.isRetro === true || year < 2018,
          hasFavorites: alb.hasFavorites !== false,
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
      if (statusEl) statusEl.textContent = `Mentve: ${savedCount} / ${albumsList.length} album...`;
    }

    showToast(`Siker! ${savedCount} album azonnal élesítve a Firestore-ban.`);
    renderHub();
    renderAdminAlbumsList();
    if (document.getElementById('admin-album-json-import')) document.getElementById('admin-album-json-import').value = '';
  } catch (err) {
    showToast("Importálási hiba: " + err.message);
  } finally {
    if (statusEl) setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
  }
});

// 2. ADATBÁZIS INICIALIZÁLÁSA (BOLTOK & ALAPALBUMOK FELTÖLTÉSE)
safeAddListener('btn-admin-seed-database', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Feltöltöd a 21 alpalbumot és a boltlistákat a Firestore-ba?")) return;

  try {
    const batch = db.batch();
    Object.values(ALBUMS_REGISTRY).forEach(alb => {
      batch.set(db.collection("albums").doc(alb.id), { ...alb, active: true }, { merge: true });
    });
    Object.entries(STORE_DATABASES).forEach(([chain, stores]) => {
      batch.set(db.collection("stores").doc(chain), { chain, stores, count: stores.length }, { merge: true });
    });
    await batch.commit();
    showToast("Alapadatok sikeresen inicializálva a felhőbe!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

// 3. TELEPÜLÉSTISZTÍTÁS & TÖMEGES E-MAIL BEKAPCSOLÁS (MIND A 809 GYŰJTŐNÉL)
safeAddListener('btn-admin-migrate-locations', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Bekapcsolod az automatikus e-mail értesítőket mind a 809 felhasználónál?")) return;

  try {
    const snap = await db.collection("public_profiles").get();
    const batchSize = 400;
    let count = 0;

    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const chunk = snap.docs.slice(i, i + batchSize);
      const batch = db.batch();

      chunk.forEach(doc => {
        batch.set(db.collection("public_profiles").doc(doc.id), {
          emailNotifications: true // ✉️ Tömeges értesítő bekapcsolva!
        }, { merge: true });

        batch.set(db.collection("users").doc(doc.id), {
          emailNotifications: true
        }, { merge: true });

        count++;
      });
      await batch.commit();
    }
    showToast(`Siker! ${count} felhasználónál aktiválva az e-mail értesítő.`);
  } catch (err) { showToast("Hiba: " + err.message); }
});

// 4. UNIVERZÁLIS INTELLIGENS BEEMELŐ (AI OCR & NYERS SZÖVEG)
safeAddListener('btn-admin-process-universal', async () => {
  const file = document.getElementById('admin-ai-ocr-file')?.files[0];
  const rawText = document.getElementById('admin-raw-import-text')?.value.trim() || '';
  const statusEl = document.getElementById('admin-universal-status');
  if (!file && !rawText) return showToast("Tölts fel egy fotót VAGY másolj be szöveget!");

  if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = "Elemzés folyamatban..."; }
  let extracted = rawText;

  if (file) {
    try {
      const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.min(img.width, 1400);
            canvas.height = Math.round((img.height * canvas.width) / img.width);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });

      const res = await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mode: 'table_ocr' })
      });
      const data = await res.json();
      extracted = data.text || '';
    } catch (e) {
      if (statusEl) statusEl.textContent = "AI hiba: " + e.message;
      return;
    }
  }

  // Regexes feldolgozás
  const tokens = extracted.split(/[\n\r]+/).map(t => t.trim()).filter(t => t.length > 0);
  if (document.getElementById('admin-album-custom-names')) document.getElementById('admin-album-custom-names').value = extracted;
  if (document.getElementById('admin-album-total')) document.getElementById('admin-album-total').value = tokens.length || 100;

  if (statusEl) statusEl.textContent = `✓ ${tokens.length} tétel átemelve a lenti űrlapba!`;
  document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth' });
});

// ABC ALBUM LISTA AZ ADMINBAN
let adminSelectedLetter = 'ALL';
function renderAdminAlbumsList() {
  const container = document.getElementById('admin-albums-list');
  const abcBar = document.getElementById('admin-albums-abc-bar');
  const countEl = document.getElementById('admin-albums-total-count');
  if (!container) return;

  const albums = Object.values(ALBUMS_REGISTRY).sort((a, b) => a.title.localeCompare(b.title, 'hu'));
  if (countEl) countEl.textContent = albums.length;

  if (abcBar) {
    const letters = [...new Set(albums.map(a => a.title.charAt(0).toUpperCase()))].sort((a, b) => a.localeCompare(b, 'hu'));
    abcBar.innerHTML = `<button class="admin-abc-btn ${adminSelectedLetter === 'ALL' ? 'active' : ''}" data-letter="ALL">Mind</button>` +
      letters.map(l => `<button class="admin-abc-btn ${adminSelectedLetter === l ? 'active' : ''}" data-letter="${l}">${l}</button>`).join('');
  }

  let filtered = albums;
  if (adminSelectedLetter !== 'ALL') filtered = filtered.filter(a => a.title.charAt(0).toUpperCase() === adminSelectedLetter);

  container.innerHTML = filtered.map(a => `
    <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
      <div><strong>${escapeHtml(a.title)}</strong> (${a.year}) — <span style="color:var(--sand);">${a.totalItems} db</span></div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-secondary btn-sm" data-action="delete-album" data-id="${a.id}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>
      </div>
    </div>
  `).join('');
}

safeAddListener('admin-albums-abc-bar', (e) => {
  const btn = e.target.closest('.admin-abc-btn');
  if (btn) { adminSelectedLetter = btn.dataset.letter; renderAdminAlbumsList(); }
});

safeAddListener('admin-albums-list', (e) => {
  const btn = e.target.closest('[data-action="delete-album"]');
  if (!btn) return;
  const id = btn.dataset.id;
  if (id === 'lidl-lutra-2026') return showToast("Az alapértelmezett album nem törölhető!");
  if (!confirm(`Biztosan törlöd a(z) ${id} albumot?`)) return;
  db.collection("albums").doc(id).delete().then(() => {
    delete ALBUMS_REGISTRY[id];
    renderAdminAlbumsList();
    renderHub();
    showToast("Album törölve.");
  });
});

// =========================================================================
// STATISZTIKA, HŐTÉRKÉP & ESÉLYEK
// =========================================================================

function renderStatistics() {
  const totalSize = getActiveAlbumSize();
  const poolEl = document.getElementById('stats-total-pool-count');
  const userCountEl = document.getElementById('stats-users-count');

  let totalDupes = 0;
  allUsersData.forEach(u => {
    ensureArray(u.van).forEach(n => {
      totalDupes += (u.vanCounts?.[n] || 1);
    });
  });

  if (poolEl) poolEl.textContent = `${totalDupes.toLocaleString('hu-HU')} db`;
  if (userCountEl) userCountEl.textContent = `${Math.max(809, allUsersData.length)} fő`;
}

function renderCompletionOdds() {
  const pctEl = document.getElementById('completion-odds-pct');
  const barEl = document.getElementById('completion-odds-bar');
  const textEl = document.getElementById('completion-odds-text');
  if (!pctEl || !barEl || !textEl) return;

  const myMissing = ensureArray(myProfile.kell);
  if (myMissing.length === 0) {
    pctEl.textContent = '100%';
    barEl.style.width = '100%';
    textEl.innerHTML = '<span style="color:var(--amber);">Minden tételed megvan!</span>';
    return;
  }

  const pool = new Set();
  allUsersData.forEach(u => {
    if (u.id !== (currentUser ? currentUser.uid : 'me')) {
      ensureArray(u.van).forEach(n => pool.add(n));
    }
  });

  const available = myMissing.filter(n => pool.has(n));
  const pct = Math.round((available.length / myMissing.length) * 100);

  pctEl.textContent = `${pct}%`;
  barEl.style.width = `${pct}%`;
  textEl.innerHTML = `A hiányzóidból <strong>${available.length} / ${myMissing.length} db</strong> azonnal beszerezhető a közösségtől!`;
}

function renderHeatmap() {
  const overlay = document.getElementById('heatmap-overlay-pins');
  const list = document.getElementById('heatmap-city-list');
  if (!overlay || !list) return;

  const cityCounts = {};
  allUsersData.forEach(u => {
    const cities = extractNormalizedLocations(u.locations || u.telepules);
    cities.forEach(c => {
      cityCounts[c.canonicalKey] = (cityCounts[c.canonicalKey] || 0) + 1;
    });
  });

  overlay.innerHTML = '';
  Object.entries(cityCounts).forEach(([k, count]) => {
    const coords = CITY_COORDINATES[k];
    if (coords) {
      const pin = document.createElement('div');
      pin.className = 'heat-pin fire';
      pin.style.left = `${coords.x}%`;
      pin.style.top = `${coords.y}%`;
      pin.style.width = '24px'; pin.style.height = '24px';
      pin.textContent = count;
      overlay.appendChild(pin);
    }
  });

  list.innerHTML = Object.entries(cityCounts).sort((a,b)=>b[1]-a[1]).slice(0, 8).map(([k, count], i) => `
    <div class="stats-ranking-item">
      <span><strong>#${i+1} ${KNOWN_CANONICAL_CITIES[k] || k}</strong></span>
      <span style="color:var(--amber);">${count} gyűjtő</span>
    </div>
  `).join('');
}

// PROFIL TELEPÜLÉSEK
function renderProfileLocations() {
  const container = document.getElementById('profile-locations-list');
  if (!container) return;
  if (!myProfile.locations || myProfile.locations.length === 0) myProfile.locations = [{ city: myProfile.telepules || '', districts: [] }];

  container.innerHTML = myProfile.locations.map((loc, idx) => `
    <div class="location-row">
      <input type="text" class="input-field profile-location-input" list="hungarian-cities-list" data-idx="${idx}" value="${escapeHtml(loc.city)}" placeholder="Település">
      ${idx > 0 ? `<button class="btn btn-secondary btn-sm" onclick="myProfile.locations.splice(${idx},1); renderProfileLocations();">✕</button>` : ''}
    </div>
  `).join('');
}

safeAddListener('btn-add-location', () => {
  if (myProfile.locations.length < 5) { myProfile.locations.push({ city: '', districts: [] }); renderProfileLocations(); }
});

safeAddListener('profile-locations-list', 'input', (e) => {
  const input = e.target.closest('.profile-location-input');
  if (!input) return;
  const idx = parseInt(input.dataset.idx, 10);
  if (myProfile.locations[idx]) myProfile.locations[idx].city = input.value.trim();
});

safeAddListener('btn-save-profile', () => {
  if (!currentUser) return showToast("Lépj be a profil mentéséhez!");
  const nev = document.getElementById('prof-nev')?.value.trim();
  const email = document.getElementById('prof-email')?.value.trim();
  if (!nev || !email) return showToast("A név és az e-mail kötelező!");

  myProfile.nev = nev;
  myProfile.email = email;
  myProfile.telepules = myProfile.locations[0]?.city || '';

  const batch = db.batch();
  batch.set(db.collection("public_profiles").doc(currentUser.uid), {
    nev: myProfile.nev, email: myProfile.email, telepules: myProfile.telepules,
    locations: myProfile.locations, emailNotifications: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(db.collection("users").doc(currentUser.uid), {
    nev: myProfile.nev, email: myProfile.email, telepules: myProfile.telepules,
    locations: myProfile.locations, emailNotifications: true
  }, { merge: true });

  batch.commit().then(() => showToast("Profil adatok elmentve!"));
});

function initFavoriteSelects() {
  const total = getActiveAlbumSize();
  ['prof-fav-1', 'prof-fav-2', 'prof-fav-3'].forEach((id, i) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Válassz --</option>';
    for (let n = 1; n <= Math.min(total, 120); n++) {
      const opt = document.createElement('option');
      opt.value = n; opt.textContent = getItemFullName(n);
      sel.appendChild(opt);
    }
  });
}

// =========================================================================
// FIREBASE INICIALIZÁLÁS & BIZTONSÁGOS FIÓKVÁLTÁS
// =========================================================================

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
      clearTimeout(saveDebounceTimer);
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
          document.getElementById('btn-logout')?.addEventListener('click', () => {
            clearTimeout(saveDebounceTimer);
            auth.signOut();
          });
        }
        document.getElementById('modal-auth')?.classList.remove('open');
        listenToMyProfile(user.uid);
        listenToMyMessages(user.uid);
      } else {
        // TISZTA KIJELENTKEZÉS: Memória törlése, hogy ne írja felül az admint!
        myProfile = { nev: "Vendég gyűjtő", telepules: "", locations: [{ city: "", districts: [] }], van: [], kell: [], foglalva: [], activeTrades: [] };
        if (adminTab) adminTab.style.display = 'none';
        if (adminTabM) adminTabM.style.display = 'none';
        if (authArea) authArea.innerHTML = `<button class="btn btn-sm btn-primary" id="btn-open-auth">Belépés / Fiók</button>`;
        document.getElementById('btn-open-auth')?.addEventListener('click', () => document.getElementById('modal-auth')?.classList.add('open'));
      }
      listenToAllUsers();
      listenToAlbums();
      listenToRadarReports();
    });
  } catch (e) { console.warn("Firebase hiba:", e); }
}

// 🛡️ DINAMIKUS FELHŐS ALBUMFIGYELŐ: Mind a 85+ album közvetlenül a Firestore-ból frissül!
function listenToAlbums() {
  if (!db) return;
  db.collection("albums").where("active", "==", true).onSnapshot(snap => {
    snap.docs.forEach(doc => {
      const d = doc.data();
      ALBUMS_REGISTRY[doc.id] = createAlbumEntry(doc.id, d.title, d.subtitle, d.publisher, d.year, d.totalItems, d.type, d.coverUrl, d);
    });
    renderHub();
    if (currentUser?.email === ADMIN_EMAIL) renderAdminAlbumsList();
  }, err => console.warn("Albums listener:", err));
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
          id: doc.id,
          nev: d.nev || 'Gyűjtő',
          telepules: d.telepules || '',
          locations: d.locations || [],
          van: ensureArray(col.van),
          vanCounts: col.vanCounts || {},
          kell: ensureArray(col.kell),
          foglalva: ensureArray(col.foglalva),
          isGiftOffering: d.isGiftOffering === true,
          ratingsCount: d.ratingsCount || 0,
          trustScore: d.trustScore || 0
        });
      }
    });
    renderMatches();
    renderStatistics();
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
    const unread = myIncomingMessages.filter(m => !m.read).length;
    const badge = document.getElementById('unread-msg-badge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-block' : 'none'; }
    renderMessages();
  });
  db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => !m.deletedBySender);
    renderMessages();
  });
}

function listenToRadarReports() {
  if (!db) return;
  db.collection("album_reports").orderBy("reportedAt", "desc").limit(30).onSnapshot(snap => {
    radarReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRadarReports();
  });
}

// INDÍTÁS
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  initFirebase();
  renderHub();
  renderGrid();
} catch (e) { console.error("Indítási hiba:", e); }

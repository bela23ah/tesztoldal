// =========================================================================
// Cserélj Okosan - app.js (v4.0 - 1. FÁZIS: Hub & Data Isolation)
// =========================================================================

const ALBUMS_REGISTRY = {
  "lidl-lutra-2026": {
    id: "lidl-lutra-2026",
    title: "Lutra Album",
    subtitle: "Védett állatok a Föld körül",
    publisher: "Lidl / WWF",
    year: 2026,
    totalItems: 108,
    type: "sticker",
    typeLabel: "Matricaalbum",
    coverUrl: "og-image.png",
    featured: true,
    radarType: "lidl",
    hasRadar: true,
    hasChapters: true
  },
  "panini-fifa-365": {
    id: "panini-fifa-365",
    title: "FIFA 365 – Adrenalyn XL",
    subtitle: "Hivatalos kártyagyűjtemény",
    publisher: "Panini",
    year: 2026,
    totalItems: 378,
    type: "card",
    typeLabel: "Kártya",
    coverUrl: "",
    featured: false,
    radarType: "retail_general",
    hasRadar: true,
    hasChapters: false
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
    coverUrl: "",
    featured: false,
    radarType: "retail_general",
    hasRadar: false,
    hasChapters: false
  },
  "stranger-things-cards": {
    id: "stranger-things-cards",
    title: "Stranger Things",
    subtitle: "This is our story kártyák",
    publisher: "Panini / Netflix",
    year: 2025,
    totalItems: 190,
    type: "card",
    typeLabel: "Kártya",
    coverUrl: "",
    featured: false,
    radarType: "retail_general",
    hasRadar: false,
    hasChapters: false
  }
};

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";
let hubSearchQuery = "";

function getActiveAlbum() {
  return ALBUMS_REGISTRY[currentAlbumId] || ALBUMS_REGISTRY["lidl-lutra-2026"];
}

function getActiveAlbumSize() {
  return getActiveAlbum().totalItems;
}

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// Tétel nevének és azonosítójának lekérdezése
function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    return album.customItems[num - 1];
  }
  return `#${num}`;
}

function getItemFullName(num, albumId = currentAlbumId) {
  if (albumId === 'lidl-lutra-2026' && STICKER_NAMES[num]) {
    return `#${num} ${STICKER_NAMES[num]}`;
  }
  return getItemLabel(num, albumId);
}

// Golyóálló eseménykezelő
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
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 1000;
  if (Array.isArray(val)) {
    return val.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'string') {
    return val.split(/[\s,;]+/)
      .map(Number)
      .filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'object') {
    return Object.keys(val)
      .map(Number)
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

// 1. FÁZIS: ADATBÁZIS ELSZIGETELÉS (Kizárólag az aktív album adatait olvassa be!)
function extractUserDataForActiveAlbum(data, docId, albumId = currentAlbumId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);

  // Ha van külön almappa-adat az adott albumhoz, azt használjuk
  let rawVan = [];
  let rawKell = [];
  let rawFoglalva = [];
  let vanCounts = {};
  let foglalvaCounts = {};

  if (data.albums && data.albums[albumId]) {
    const albumData = data.albums[albumId];
    rawVan = albumData.van || [];
    rawKell = albumData.kell || [];
    rawFoglalva = albumData.foglalva || [];
    vanCounts = albumData.vanCounts || {};
    foglalvaCounts = albumData.foglalvaCounts || {};
  } else if (albumId === 'lidl-lutra-2026') {
    // Visszamenőleges kompatibilitás a Lutra fődokumentummal
    rawVan = data.van || data.duplicates || [];
    rawKell = data.kell || data.missing || [];
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

  return {
    id: docId,
    nev,
    telepules,
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
    gdprAccepted
  };
}

let myProfile = {
  nev: "Vendég gyűjtő",
  telepules: "",
  email: "",
  isGiftOffering: false,
  showEmailToUsers: false,
  emailNotifications: true,
  allowInspect: true,
  gdprAccepted: false,
  privateNote: '',
  favorites: [9, 4, 35],
  van: [],
  vanCounts: {},
  kell: [],
  foglalva: [],
  foglalvaCounts: {}
};

let allUsersData = [];
let myIncomingMessages = [];
let myOutgoingMessages = [];
let radarReports = [];
let meetupEvents = [];
let activeAnnouncements = [];
let selectedTradePlanUids = new Set();
let tradePlanManualOverrides = {};
let previousIncomingCount = null;
let previousRadarCount = null;
let radarAttachedBase64 = '';
let meetupAttachedBase64 = '';
let showAllHeatmapCities = false;

let activeInboxTab = 'inbox';
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

// Városkoordináták
const CITY_COORDINATES = {
  "budapest": { x: 52.5, y: 39.0 },
  "gyor": { x: 26.0, y: 27.0 },
  "sopron": { x: 10.5, y: 30.0 },
  "szombathely": { x: 13.0, y: 44.0 },
  "zalaegerszeg": { x: 20.0, y: 56.0 },
  "veszprem": { x: 35.0, y: 46.0 },
  "szekesfehervar": { x: 44.0, y: 45.0 },
  "pecs": { x: 41.0, y: 83.0 },
  "kaposvar": { x: 32.0, y: 73.0 },
  "szekszard": { x: 50.0, y: 73.0 },
  "kecskemet": { x: 61.0, y: 59.0 },
  "szeged": { x: 66.0, y: 81.0 },
  "bekescsaba": { x: 84.0, y: 69.0 },
  "szolnok": { x: 69.0, y: 51.0 },
  "debrecen": { x: 88.0, y: 40.0 },
  "nyiregyhaza": { x: 90.0, y: 26.0 },
  "miskolc": { x: 77.0, y: 23.0 },
  "eger": { x: 71.0, y: 31.0 },
  "salgotarjan": { x: 62.0, y: 21.0 },
  "tatabanya": { x: 42.0, y: 32.0 },
  "erd": { x: 51.0, y: 43.0 },
  "dunaujvaros": { x: 53.0, y: 53.0 },
  "baja": { x: 54.0, y: 80.0 },
  "hodmezovasarhely": { x: 71.0, y: 75.0 },
  "oroshaza": { x: 78.0, y: 73.0 },
  "gyula": { x: 89.0, y: 68.0 },
  "siofok": { x: 42.0, y: 50.0 },
  "keszthely": { x: 27.0, y: 58.0 },
  "nagykanizsa": { x: 21.0, y: 70.0 }
};

const FEJEZETEK = [
  { id: "bevezeto", cim: "1. oldal — Bevezető", elemek: [ { type: "single", num: 1, name: "WWF Magyarország logó", orient: "álló" } ] },
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
      { type: "single", num: 18, name: "Fehérhátú keselyű", orient: "fekvő" }, { type: "single", num: 19, name: "Közönséges cserepesteknős", orient: "fekvő" },
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
      { type: "single", num: 34, name: "Mongol szajga", orient: "fekvő" }, { type: "combo", nums: [35, 36], name: "Tigris (2 részes kép)", orient: "panoráma" },
      { type: "single", num: 37, name: "Borneói orangután", orient: "álló" }, { type: "single", num: 38, name: "Mandzsu daru", orient: "álló" },
      { type: "single", num: 39, name: "Komodói sárkány", orient: "fekvő" }, { type: "single", num: 40, name: "Aranyarcú gibbon", orient: "fekvő" }
  ]},
  { id: "ausztralia", cim: "14–15. oldal — Ausztrália és Óceánia", elemek: [
      { type: "single", num: 41, name: "Keleti szürke óriáskenguru", orient: "fekvő" }, { type: "single", num: 42, name: "Tasman vombat", orient: "fekvő" },
      { type: "single", num: 43, name: "Koala", orient: "fekvő" }, { type: "single", num: 44, name: "Kakapó", orient: "fekvő" },
      { type: "single", num: 45, name: "Kacsacsőrű emlős", orient: "fekvő" }, { type: "single", num: 46, name: "Barna kivi", orient: "fekvő" }
  ]},
  { id: "antarktisz", cim: "16–17. oldal — Antarktisz", elemek: [
      { type: "single", num: 47, name: "Leopárdfóka", orient: "fekvő" }, { type: "single", num: 48, name: "Weddell-fóka", orient: "fekvő" },
      { type: "single", num: 49, name: "Császárpingvin", orient: "álló" }, { type: "combo", nums: [50, 51], name: "Adélie-pingvin (2 részes)", orient: "panoráma" },
      { type: "single", num: 52, name: "Galambhojsza", orient: "álló" }, { type: "single", num: 53, name: "Antarktiszi krill", orient: "fekvő" }
  ]},
  { id: "tengerek", cim: "18–19. oldal — Tengerek és óceánok", elemek: [
      { type: "single", num: 54, name: "Hosszúszárnyú bálna", orient: "fekvő" }, { type: "combo", nums: [55, 56], name: "Kardszárnyú delfin (2 részes)", orient: "panoráma" },
      { type: "single", num: 57, name: "Óriáscápa", orient: "fekvő" }, { type: "single", num: 58, name: "Kúpos fóka", orient: "fekvő" },
      { type: "single", num: 59, name: "Parti lile", orient: "fekvő" }, { type: "single", num: 60, name: "Barna delfin", orient: "fekvő" }
  ]},
  { id: "kihalt_allatok", cim: "20–21. oldal — Kihalt állatok", elemek: [
      { type: "single", num: 61, name: "Dodó", orient: "álló" }, { type: "single", num: 62, name: "Vékonycsőrű póling", orient: "álló" },
      { type: "single", num: 63, name: "Erszényesfarkas", orient: "fekvő" }, { type: "single", num: 64, name: "Tarpán", orient: "fekvő" },
      { type: "single", num: 65, name: "Vándorgalamb", orient: "fekvő" }, { type: "single", num: 66, name: "Őstulok", orient: "fekvő" },
      { type: "single", num: 67, name: "Elefántmadár", orient: "fekvő" }, { type: "single", num: 68, name: "Korallszirti patkány", orient: "fekvő" }
  ]},
  { id: "veszelyeztetett", cim: "22–23. oldal — Veszélyeztetett fajok", elemek: [
      { type: "single", num: 69, name: "Jávai orrszarvú", orient: "fekvő" }, { type: "single", num: 70, name: "Mezei hörcsög", orient: "fekvő" },
      { type: "single", num: 71, name: "Röviduszonyú makócápa", orient: "fekvő" }, { type: "single", num: 72, name: "Európai angolna", orient: "fekvő" },
      { type: "single", num: 73, name: "Spix-ara", orient: "fekvő" }, { type: "single", num: 74, name: "Vastagfarkú oposszum", orient: "fekvő" }
  ]},
  { id: "megmentett", cim: "24–25. oldal — Megmentett állatok", elemek: [
      { type: "single", num: 75, name: "Arab bejza", orient: "fekvő" }, { type: "single", num: 76, name: "Fehérfarkú gnú", orient: "fekvő" },
      { type: "single", num: 77, name: "Európai bölény", orient: "fekvő" }, { type: "single", num: 78, name: "Nagy szikibagoly", orient: "fekvő" },
      { type: "single", num: 79, name: "Vörös kánya", orient: "fekvő" }, { type: "single", num: 80, name: "Mallorcai béka", orient: "fekvő" }
  ]},
  { id: "fenyegetes", cim: "26–27. oldal — Mi fenyegeti a természetet?", elemek: [
      { type: "single", num: 81, name: "Élőhelyek elvesztése", orient: "fekvő" }, { type: "single", num: 82, name: "Élelmiszeripar", orient: "fekvő" },
      { type: "single", num: 83, name: "Szennyezés", orient: "fekvő" }, { type: "combo", nums: [84, 85], name: "Túlzott kizsákmányolás (2 részes)", orient: "panoráma" },
      { type: "single", num: 86, name: "Túlhalászás", orient: "fekvő" }, { type: "single", num: 87, name: "Műanyaghulladék", orient: "fekvő" },
      { type: "single", num: 88, name: "Folyószabályozás", orient: "fekvő" }, { type: "single", num: 89, name: "Erőforrások", orient: "fekvő" },
      { type: "single", num: 90, name: "Éghajlatváltozás", orient: "fekvő" }, { type: "single", num: 91, name: "Inváziós fajok", orient: "fekvő" }
  ]},
  { id: "megoldasok", cim: "28–29. oldal — Bolygóbarát megoldások", elemek: [
      { type: "single", num: 92, name: "Védett területek", orient: "fekvő" }, { type: "single", num: 93, name: "Élelmiszerrendszer", orient: "fekvő" },
      { type: "single", num: 94, name: "Megújuló energia", orient: "fekvő" }, { type: "single", num: 95, name: "Természetalapú megoldások", orient: "fekvő" },
      { type: "single", num: 96, name: "Közösségi bevonás", orient: "fekvő" }
  ]},
  { id: "wwf", cim: "30–31. oldal — WWF Magyarország", elemek: [
      { type: "single", num: 97, name: "WWF hazai programok", orient: "fekvő" }, { type: "single", num: 98, name: "WWF erdőprogram", orient: "fekvő" },
      { type: "single", num: 99, name: "Vizesélőhelyek", orient: "fekvő" }, { type: "single", num: 100, name: "Klímaprogramok", orient: "fekvő" },
      { type: "single", num: 101, name: "Környezeti nevelés", orient: "fekvő" }, { type: "single", num: 102, name: "Jelképes örökbefogadás", orient: "álló" }
  ]},
  { id: "szuperhos", cim: "32. oldal — Legyél bolygóvédő szuperhős!", elemek: [
      { type: "single", num: 103, name: "Természetmegfigyelés", orient: "álló" }, { type: "single", num: 104, name: "Kihívások otthon", orient: "fekvő" },
      { type: "single", num: 105, name: "Vadon élő állatok", orient: "fekvő" }
  ]},
  { id: "lidl_zold", cim: "33. oldal — Zöldebb jövő a Lidlnél", elemek: [
      { type: "single", num: 106, name: "Biotermékek", orient: "fekvő" }, { type: "single", num: 107, name: "Vadvirágos rétek", orient: "fekvő" },
      { type: "single", num: 108, name: "Planetary Health Diet", orient: "álló" }
  ] }
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

function initFavoriteSelects() {
  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();

  const titleEl = document.getElementById('prof-favorites-title');
  if (titleEl) {
    titleEl.textContent = (currentAlbumId === 'lidl-lutra-2026') 
      ? 'Top 3 Kedvenc Állatod / Matricád' 
      : `Top 3 Kedvenc Tételed (${activeAlbum.title})`;
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
    if (currentFav && currentFav <= totalSize) {
      sel.value = currentFav;
    }

    sel.onchange = () => {
      const val = parseInt(sel.value, 10);
      if (!myProfile.favorites) myProfile.favorites = [];
      myProfile.favorites[idx] = isNaN(val) ? 0 : val;
      localStorage.setItem(`lutra_favorites_${currentAlbumId}`, JSON.stringify(myProfile.favorites));
      if (currentAlbumId === 'lidl-lutra-2026') {
        localStorage.setItem('lutra_favorites', JSON.stringify(myProfile.favorites));
      }
      checkMandatoryProfile();
    };
  });
}

// 1. FÁZIS: GYŰJTEMÉNYEK KATALÓGUS RENDERELŐJE (HUB)
function renderHub() {
  const container = document.getElementById('hub-albums-grid');
  if (!container) return;

  const albumsList = Object.values(ALBUMS_REGISTRY).filter(album => {
    if (hubSearchQuery) {
      const queryNorm = hubSearchQuery.toLowerCase();
      const matchTitle = (album.title || '').toLowerCase().includes(queryNorm);
      const matchPub = (album.publisher || '').toLowerCase().includes(queryNorm);
      const matchYear = (album.year || '').toString().includes(queryNorm);
      if (!matchTitle && !matchPub && !matchYear) return false;
    }

    if (currentHubFilter === 'sticker') return album.type === 'sticker';
    if (currentHubFilter === 'card') return album.type === 'card';
    if (currentHubFilter === 'my') {
      const myCount = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? myProfile.van : [])).length;
      return myCount > 0 || album.id === currentAlbumId;
    }
    return true;
  });

  // Kiemelt album előre sorolása
  albumsList.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));

  container.innerHTML = albumsList.map(album => {
    const isCurrent = album.id === currentAlbumId;
    const albumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? myProfile.van : []));
    const collectedCount = albumVan.length;
    const pct = Math.min(100, Math.round((collectedCount / album.totalItems) * 100));

    return `
      <div class="album-hub-card ${album.featured ? 'card-featured' : ''}" data-album-id="${escapeHtml(album.id)}">
        <div class="album-hub-cover-wrap">
          ${album.coverUrl 
            ? `<img src="${album.coverUrl}" class="album-hub-cover-img" alt="${escapeHtml(album.title)}">` 
            : `<div class="album-hub-cover-placeholder"><strong>${escapeHtml(album.title)}</strong><br><small style="color:var(--amber);">${escapeHtml(album.publisher)}</small></div>`
          }
        </div>

        <div>
          <div class="album-hub-header">
            <div>
              <span class="album-type-badge">${escapeHtml(album.typeLabel)}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">${album.year}</span>
              ${album.featured ? '<span class="badge-local" style="margin-left:6px;">Kiemelt</span>' : ''}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.1rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 10px;">${escapeHtml(album.publisher)} • ${escapeHtml(album.subtitle || '')}</p>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--sand);">
            <span>Gyűjtve nálad: <strong>${collectedCount} / ${album.totalItems} db</strong></span>
            <strong>${pct}%</strong>
          </div>
          <div class="album-hub-progress-track">
            <div class="album-hub-progress-bar" style="width:${pct}%;"></div>
          </div>
          <div style="margin-top:10px;">
            <button class="btn ${isCurrent ? 'btn-primary' : 'btn-secondary'} btn-sm" style="width:100%; font-size:0.82rem; padding:7px;" data-action="select-album" data-album-id="${escapeHtml(album.id)}">
              ${isCurrent ? 'Megnyitás (Aktív Gyűjtemény)' : 'Átváltás erre a gyűjteményre'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('hub-albums-grid', (e) => {
  const btn = e.target.closest('[data-action="select-album"]');
  const card = e.target.closest('.album-hub-card');
  const albumId = btn?.dataset.albumId || card?.dataset.albumId;
  if (!albumId) return;

  selectAlbum(albumId);
});

// 1. FÁZIS: ÁLLAPOTVEZÉRLŐ ALBUM-KIVÁLASZTÁS
function selectAlbum(albumId) {
  if (!ALBUMS_REGISTRY[albumId]) return;
  currentAlbumId = albumId;
  localStorage.setItem('lutra_active_album', albumId);

  const activeAlbum = getActiveAlbum();

  // 1. Fejléc Aktív Gyűjtemény Doboz beállítása és megjelenítése
  const albumBar = document.getElementById('active-album-bar');
  const titleEl = document.getElementById('active-album-title');
  const thumbEl = document.getElementById('active-album-thumb');
  const typeTag = document.getElementById('active-album-type-tag');

  if (albumBar) albumBar.style.display = 'flex';
  if (titleEl) titleEl.textContent = `${activeAlbum.title} (${activeAlbum.year})`;
  if (typeTag) typeTag.textContent = `${activeAlbum.publisher} • ${activeAlbum.typeLabel}`;
  if (thumbEl) thumbEl.src = activeAlbum.coverUrl || 'og-image.png';

  // 2. Főnavigáció és alnavigáció feloldása
  const primaryNav = document.getElementById('main-primary-nav');
  const mobileSubnav = document.getElementById('mobile-subnav-bar');
  if (primaryNav) primaryNav.style.display = 'grid';
  if (mobileSubnav) mobileSubnav.style.display = 'block';

  // 3. Bolti radar fül kapcsolása és elnevezése
  const radarNav = document.getElementById('nav-item-radar');
  const radarLabel = document.getElementById('nav-radar-label');
  if (radarNav) radarNav.style.display = activeAlbum.hasRadar ? 'block' : 'none';
  if (radarLabel) radarLabel.textContent = (albumId === 'lidl-lutra-2026') ? 'Bolti Radar' : 'Készletradar';

  // 4. Könyv nézet gomb elrejtése/megjelenítése
  const albumModeToggle = document.getElementById('view-mode-toggle-box');
  if (albumModeToggle) {
    albumModeToggle.style.display = activeAlbum.hasChapters ? 'flex' : 'none';
  }

  // 5. Oklevél doboz elrejtése/megjelenítése
  const certBox = document.getElementById('prof-cert-box');
  if (certBox) {
    certBox.style.display = (albumId === 'lidl-lutra-2026') ? 'block' : 'none';
  }

  // 6. Címke módosítása
  const collectionTitle = document.getElementById('view-collection-title');
  if (collectionTitle) collectionTitle.textContent = `${activeAlbum.title} (${activeAlbum.typeLabel})`;

  loadAlbumState(albumId);
  switchView('matricaim');
  showToast(`Aktív gyűjtemény: ${activeAlbum.title}`);
}

// 1. FÁZIS: VISSZALÉPÉS A FŐOLDALRA (GYŰJTEMÉNYVÁLTÓBA)
safeAddListener('btn-switch-album', () => {
  const albumBar = document.getElementById('active-album-bar');
  const primaryNav = document.getElementById('main-primary-nav');
  const mobileSubnav = document.getElementById('mobile-subnav-bar');

  // Menük és aktív sáv elrejtése a Kezdőlapon
  if (albumBar) albumBar.style.display = 'none';
  if (primaryNav) primaryNav.style.display = 'none';
  if (mobileSubnav) mobileSubnav.style.display = 'none';

  switchView('hub');
});

function loadAlbumState(albumId) {
  myProfile.van = ensureArray(safeJsonParse(`lutra_van_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : [])).sort((a, b) => a - b);
  myProfile.vanCounts = safeJsonParse(`lutra_van_counts_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van_counts', {}) : {});
  myProfile.kell = ensureArray(safeJsonParse(`lutra_kell_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_kell', []) : [])).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(safeJsonParse(`lutra_foglalva_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_foglalva', []) : [])).sort((a, b) => a - b);
  myProfile.foglalvaCounts = safeJsonParse(`lutra_foglalva_counts_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_foglalva_counts', {}) : {});

  // Album-specifikus privát jegyzet betöltése
  const noteKey = `lutra_private_note_${albumId}`;
  myProfile.privateNote = localStorage.getItem(noteKey) || (albumId === 'lidl-lutra-2026' ? localStorage.getItem('lutra_private_note') || '' : '');
  const noteTextarea = document.getElementById('prof-private-note');
  const noteCharCount = document.getElementById('note-char-count');
  const noteTitle = document.getElementById('prof-note-title');
  if (noteTextarea) noteTextarea.value = myProfile.privateNote;
  if (noteCharCount) noteCharCount.textContent = `${myProfile.privateNote.length}/200`;
  if (noteTitle) noteTitle.textContent = `Privát Jegyzet (${getActiveAlbum().title})`;

  initFavoriteSelects();
  renderGrid();
  renderHub();
  renderMatches();
}

safeAddListener('hub-search-input', 'input', (e) => {
  hubSearchQuery = e.target.value.trim();
  renderHub();
});

document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentHubFilter = btn.dataset.hubFilter;
    renderHub();
  });
});

function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  const totalSize = getActiveAlbumSize();
  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));

  for (let i = 1; i <= totalSize; i++) {
    const isVan = vanSet.has(i);
    const isKell = kellSet.has(i);
    const isFoglalva = foglalvaSet.has(i);

    if (currentFilter === 'van' && !isVan) continue;
    if (currentFilter === 'kell' && !isKell) continue;
    if (currentFilter === 'foglalva' && !isFoglalva) continue;

    let cls = isVan ? 'van' : isKell ? 'kell' : isFoglalva ? 'foglalva' : '';
    let qty = 1;
    let badgeCls = 'qty-badge';
    if (isVan && myProfile.vanCounts && myProfile.vanCounts[i]) qty = myProfile.vanCounts[i];
    if (isFoglalva && myProfile.foglalvaCounts && myProfile.foglalvaCounts[i]) {
      qty = myProfile.foglalvaCounts[i];
      badgeCls = 'qty-badge foglalva';
    }

    const qtyBadge = ((isVan || isFoglalva) && qty > 1) ? `<span class="${badgeCls}">×${qty}</span>` : '';
    const itemLabel = getItemLabel(i);
    const itemFullTitle = getItemFullName(i);

    html += `<div class="matrica-cell ${cls}" data-num="${i}" title="${escapeHtml(itemFullTitle)}">
      ${escapeHtml(itemLabel.replace('#', ''))}
      ${qtyBadge}
    </div>`;
  }
  grid.innerHTML = html;

  const cVan = document.getElementById('count-van');
  const cKell = document.getElementById('count-kell');
  const cFoglalva = document.getElementById('count-foglalva');
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
  if (cFoglalva) cFoglalva.textContent = myProfile.foglalva.length;
}

function getActiveChapters() {
  const activeAlbum = getActiveAlbum();
  if (currentAlbumId === 'lidl-lutra-2026') return FEJEZETEK;
  if (activeAlbum.customChaptersList && activeAlbum.customChaptersList.length > 0) {
    return activeAlbum.customChaptersList;
  }
  return [];
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
  initAlbumSelect();
  const container = document.getElementById('album-chapter-content');
  if (!container) return;

  const chapters = getActiveChapters();
  if (chapters.length === 0) {
    container.innerHTML = '<p class="view-intro">Ehhez a gyűjteményhez nincs beállítva lapozható könyv nézet.</p>';
    return;
  }

  const chapter = chapters[currentChapterIndex] || chapters[0];
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
          let tag = isVan ? 'Dupla' : isKell ? 'Hiányzik' : isFog ? 'Foglalt' : 'Üres';
          let orientClass = el.orient === 'álló' ? 'orient-allo' : 'orient-fekvo';
          return `
            <div class="slot ${orientClass} ${cls}" data-num="${el.num}">
              ${((isVan || isFog) && q > 1) ? `<span class="qty-badge ${isFog ? 'foglalva' : ''}">×${q}</span>` : ''}
              <span class="sticker-num">${escapeHtml(getItemLabel(el.num))}</span>
              <span class="sticker-name">${escapeHtml(el.name)}</span>
              <span class="sticker-tag">${tag}</span>
            </div>
          `;
        }
      }).join('')}
    </div>
  `;
}

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');
let lastToggleTimestamp = 0;
let lastToggledStickerNum = null;

function toggleStickerState(num) {
  const now = Date.now();
  if (num === lastToggledStickerNum && now - lastToggleTimestamp < 220) return;
  lastToggleTimestamp = now;
  lastToggledStickerNum = num;

  hideQtyPopover();
  const vanIdx = myProfile.van.indexOf(num);
  const kellIdx = myProfile.kell.indexOf(num);
  const fogIdx = myProfile.foglalva.indexOf(num);

  if (vanIdx > -1) {
    myProfile.van.splice(vanIdx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num);
  } else if (kellIdx > -1) {
    myProfile.kell.splice(kellIdx, 1);
    myProfile.foglalva.push(num);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[num] = 1;
  } else if (fogIdx > -1) {
    myProfile.foglalva.splice(fogIdx, 1);
    if (myProfile.foglalvaCounts) delete myProfile.foglalvaCounts[num];
  } else {
    myProfile.van.push(num);
    myProfile.vanCounts[num] = 1;
  }
  saveMyState();
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

function attachStickerInteraction(container) {
  if (!container) return;
  let longPressTimer = null;
  let isLongPress = false;
  let touchMoved = false;

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
    isLongPress = false;
    touchMoved = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      if (!touchMoved) {
        isLongPress = true;
        showQtyPopover(parseInt(target.dataset.num, 10), target);
      }
    }, 450);
  }, { passive: true });

  container.addEventListener('touchmove', () => {
    touchMoved = true;
    clearTimeout(longPressTimer);
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    clearTimeout(longPressTimer);
    if (isLongPress) {
      e.preventDefault();
      isLongPress = false;
    }
  });

  container.addEventListener('click', (e) => {
    if (isLongPress || touchMoved) {
      isLongPress = false;
      touchMoved = false;
      return;
    }
    const target = e.target.closest('[data-num]');
    if (target) {
      toggleStickerState(parseInt(target.dataset.num, 10));
    }
  });
}

// 1. FÁZIS: MENTÉS ÉS FELHŐS SZINKRONIZÁCIÓ (ALBUM-SPECIFIKUS)
function saveMyState() {
  const albumId = currentAlbumId;
  const now = Date.now();

  myProfile.van = ensureArray(myProfile.van).sort((a, b) => a - b);
  myProfile.kell = ensureArray(myProfile.kell).filter(n => !myProfile.van.includes(n)).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(myProfile.foglalva).filter(n => !myProfile.van.includes(n) && !myProfile.kell.includes(n)).sort((a, b) => a - b);

  localStorage.setItem(`lutra_van_${albumId}`, JSON.stringify(myProfile.van));
  localStorage.setItem(`lutra_van_counts_${albumId}`, JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem(`lutra_kell_${albumId}`, JSON.stringify(myProfile.kell));
  localStorage.setItem(`lutra_foglalva_${albumId}`, JSON.stringify(myProfile.foglalva));
  localStorage.setItem(`lutra_foglalva_counts_${albumId}`, JSON.stringify(myProfile.foglalvaCounts || {}));
  localStorage.setItem(`lutra_updated_at_${albumId}`, now.toString());

  if (albumId === 'lidl-lutra-2026') {
    localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
    localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
    localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
    localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
    localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
    localStorage.setItem('lutra_updated_at', now.toString());
  }
  
  renderGrid();
  renderHub();
  refreshMatchesIfVisible();
  renderCompletionOdds();

  if (currentUser && db) {
    const payload = {
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      foglalva: myProfile.foglalva,
      foglalvaCounts: myProfile.foglalvaCounts || {},
      localUpdatedAt: now,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Mentés az album-specifikus objektumba
    db.collection("public_profiles").doc(currentUser.uid).set({
      albums: {
        [albumId]: payload
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});

    if (albumId === 'lidl-lutra-2026') {
      db.collection("public_profiles").doc(currentUser.uid).set(payload, { merge: true }).catch(() => {});
    }
  }
}

// Privát Jegyzet mentése
function savePrivateNote() {
  const albumId = currentAlbumId;
  const noteTextarea = document.getElementById('prof-private-note');
  const note = (noteTextarea?.value || '').slice(0, 200);

  myProfile.privateNote = note;
  localStorage.setItem(`lutra_private_note_${albumId}`, note);
  if (albumId === 'lidl-lutra-2026') {
    localStorage.setItem('lutra_private_note', note);
  }

  if (currentUser && db) {
    db.collection("users").doc(currentUser.uid).set({
      notes: {
        [albumId]: note
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
  }

  showToast("Gyűjteményi jegyzet elmentve.");
}

safeAddListener('btn-save-note', savePrivateNote);

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

// Tömeges bevitel
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
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 1000;
  tokens.forEach(t => {
    t = t.trim();
    if (!t) return;
    const multMatch = t.match(/^(\d+)[*xX](\d+)$/);
    if (multMatch) {
      const num = parseInt(multMatch[1], 10);
      const qty = parseInt(multMatch[2], 10);
      if (num >= 1 && num <= maxLimit && qty > 0) parsed[num] = (parsed[num] || 0) + qty;
    } else {
      const num = parseInt(t, 10);
      if (num >= 1 && num <= maxLimit) parsed[num] = (parsed[num] || 0) + 1;
    }
  });
  return parsed;
}

safeAddListener('btn-apply-batch-van', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat.");
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
  if (!raw) return showToast("Írj be számokat.");
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
  if (!raw) return showToast("Írj be számokat.");
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
    return q > 1 ? `${getItemLabel(n)} (${q}db)` : `${getItemLabel(n)}`;
  }).join(', ') : 'Nincs duplám';
  const kellText = kellSorted.length ? kellSorted.map(n => `${getItemLabel(n)}`).join(', ') : 'Minden tétel megvan!';
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

document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderGrid();
  });
});

// =========================================================================
// NAVIGÁCIÓS ROUTER
// =========================================================================
function switchCategory(catName) {
  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === catName));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavProfil = document.getElementById('subnav-profil');

  if (subnavMatricaim) subnavMatricaim.style.display = catName === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = catName === 'cserebere' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = catName === 'profil' ? 'flex' : 'none';

  if (catName === 'hub') switchView('hub');
  else if (catName === 'radar') switchView('radar');
  else if (catName === 'matricaim') switchView('matricaim');
  else if (catName === 'cserebere') switchView('uzeneteim');
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
  else if (viewName === 'radar') parentCat = 'radar';
  else if (viewName === 'uzeneteim' || viewName === 'meetups') parentCat = 'cserebere';
  else if (viewName === 'profil' || viewName === 'statisztika' || viewName === 'admin') parentCat = 'profil';

  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === parentCat));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavProfil = document.getElementById('subnav-profil');
  if (subnavMatricaim) subnavMatricaim.style.display = parentCat === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = parentCat === 'cserebere' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = parentCat === 'profil' ? 'flex' : 'none';

  if (viewName === 'hub') renderHub();
  if (viewName === 'cserek') renderMatches();
  if (viewName === 'statisztika') {
    renderStatistics();
    renderCompletionOdds();
    renderHeatmap();
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
    renderMessages();
    const badge = document.getElementById('unread-msg-badge');
    const badgeM = document.getElementById('unread-msg-badge-m');
    if (badge) badge.classList.add('read');
    if (badgeM) badgeM.classList.add('read');
    updateCserebereBadge();
  }
  if (viewName === 'matricaim') {
    renderGrid();
    renderAlbumChapter();
  }
  if (viewName === 'admin') {
    renderAdminAnnouncements();
    renderAdminAlbumsList();
  }
  if (viewName === 'profil') initFavoriteSelects();
}

document.querySelectorAll('.primary-tab').forEach(t => {
  t.addEventListener('click', () => switchCategory(t.dataset.cat));
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
  const meetupBadge = document.getElementById('meetup-badge');

  const hasUnread = unreadMsgBadge && unreadMsgBadge.style.display !== 'none' && !unreadMsgBadge.classList.contains('read');
  const hasMeetup = meetupBadge && meetupBadge.style.display !== 'none';

  if (hasUnread || hasMeetup) {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
}

// 1. FÁZIS: PÁROSÍTÁSOK (KIZÁRÓLAG AZ AKTÍV GYŰJTEMÉNYRE!)
function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const myCity = (myProfile.telepules || '').trim().toLowerCase();

  let matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .map(u => {
      const uVanSet = new Set(ensureArray(u.van));
      const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
      
      const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
      const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      
      const score = Math.min(give.length, get.length);
      const isSameCity = myCity && (u.telepules || '').trim().toLowerCase() === myCity;
      const isGift = u.isGiftOffering === true;
      return { ...u, give, get, score, isSameCity, isGift };
    })
    .filter(m => m.score > 0 || (m.isGift && m.get.length > 0));

  if (matchFilter === 'city') matches = matches.filter(m => m.isSameCity);
  if (matchFilter === 'gift') matches = matches.filter(m => m.isGift);

  matches.sort((a, b) => {
    if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
    return b.score - a.score;
  });

  if (matches.length === 0) {
    list.innerHTML = `<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner a(z) <strong>${escapeHtml(getActiveAlbum().title)}</strong> gyűjteményben.</p>`;
    return;
  }

  list.innerHTML = matches.map((m) => {
    const isCheckedInPlan = selectedTradePlanUids.has(m.id);
    return `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''}
          </h3>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
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
}

safeAddListener('btn-match-all', 'click', function() { setActiveMatchFilter(this, 'all'); });
safeAddListener('btn-match-city', 'click', function() {
  if (!myProfile.telepules) return showToast("Előbb add meg a településed a Profil fülön.");
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
  showToast("Cserepartnerek frissítve.");
});

// 1. FÁZIS: FELHASZNÁLÓK VALÓS IDEJŰ FIGYELŐJE
function listenToAllUsers() {
  if (!db) return;
  if (allUsersUnsubscribe) allUsersUnsubscribe();

  allUsersUnsubscribe = db.collection("public_profiles").onSnapshot(snapshot => {
    allUsersData = [];
    snapshot.forEach(doc => {
      const parsedUser = extractUserDataForActiveAlbum(doc.data(), doc.id, currentAlbumId);
      if (!parsedUser) return;
      allUsersData.push(parsedUser);
    });

    renderMatches();
    renderStatistics();
  }, err => console.warn("All users listener:", err));
}

function listenToMyProfile(uid) {
  if (!db) return;
  if (myDocUnsubscribe) myDocUnsubscribe();

  myDocUnsubscribe = db.collection("public_profiles").doc(uid).onSnapshot(async pubSnap => {
    let pubData = pubSnap.exists ? pubSnap.data() : null;
    let userData = null;

    try {
      const uSnap = await db.collection("users").doc(uid).get();
      if (uSnap.exists) userData = uSnap.data();
    } catch (err) {}

    const merged = { ...(userData || {}), ...(pubData || {}) };
    const parsed = extractUserDataForActiveAlbum(merged, uid, currentAlbumId);

    if (parsed) {
      const albumId = currentAlbumId;
      const localVan = ensureArray(safeJsonParse(`lutra_van_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : []));
      const localKell = ensureArray(safeJsonParse(`lutra_kell_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_kell', []) : []));

      myProfile = {
        ...myProfile,
        nev: parsed.nev || myProfile.nev,
        telepules: parsed.telepules || myProfile.telepules,
        email: getFirstValidString(userData?.email, pubData?.email, myProfile.email),
        favorites: parsed.favorites && parsed.favorites.length >= 3 ? parsed.favorites : [9, 4, 35],
        isGiftOffering: parsed.isGiftOffering,
        showEmailToUsers: parsed.showEmailToUsers,
        emailNotifications: parsed.emailNotifications !== false,
        allowInspect: parsed.allowInspect,
        gdprAccepted: parsed.gdprAccepted,
        van: (localVan.length > 0) ? localVan : parsed.van,
        kell: (localKell.length > 0) ? localKell : parsed.kell,
        foglalva: parsed.foglalva,
        vanCounts: parsed.vanCounts,
        foglalvaCounts: parsed.foglalvaCounts || {}
      };

      renderGrid();
      renderAlbumChapter();
      renderHub();

      const nI = document.getElementById('prof-nev'); if (nI && myProfile.nev) nI.value = myProfile.nev;
      const tI = document.getElementById('prof-telepules'); if (tI && myProfile.telepules) tI.value = myProfile.telepules;
      const eI = document.getElementById('prof-email'); if (eI && myProfile.email) eI.value = myProfile.email;
      const gI = document.getElementById('prof-gift'); if (gI) gI.checked = !!myProfile.isGiftOffering;
      const seI = document.getElementById('prof-show-email'); if (seI) seI.checked = !!myProfile.showEmailToUsers;
      const enI = document.getElementById('prof-email-notif'); if (enI) enI.checked = myProfile.emailNotifications !== false;
      const aiI = document.getElementById('prof-allow-inspect'); if (aiI) aiI.checked = myProfile.allowInspect !== false;
      const gdI = document.getElementById('prof-gdpr'); if (gdI) gdI.checked = !!myProfile.gdprAccepted;

      initFavoriteSelects();
      checkMandatoryProfile();
      refreshMatchesIfVisible();
      renderCompletionOdds();
    }
  });
}

function listenToAlbums() {
  if (!db) return;
  if (albumsUnsubscribe) albumsUnsubscribe();

  albumsUnsubscribe = db.collection("albums").where("active", "==", true).onSnapshot(snap => {
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
        typeLabel: data.typeLabel || (data.type === 'card' ? 'Kártya' : 'Matricaalbum'),
        coverUrl: data.coverUrl || '',
        featured: data.featured === true,
        radarType: data.radarType || 'none',
        hasRadar: data.hasRadar === true || (data.radarType && data.radarType !== 'none'),
        hasChapters: data.hasChapters === true,
        customItems: data.customItems || [],
        customChaptersList: data.customChaptersList || []
      };
    });

    renderHub();
  }, err => console.warn("Albums listener hiba:", err));
}

// 1. FÁZIS: EGYSZERŰ ÉS GOLYÓÁLLÓ INDÍTÓ BLOKK
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function checkMandatoryProfile() {
  const warning = document.getElementById('profile-warning');
  const isMissing = !myProfile.nev || !myProfile.nev.trim() || myProfile.nev === 'Vendég gyűjtő' ||
                    !myProfile.telepules || !myProfile.telepules.trim() ||
                    !myProfile.email || !myProfile.email.trim() || !myProfile.gdprAccepted;

  if (currentUser && isMissing && warning) {
    warning.style.display = 'block';
  } else if (warning) {
    warning.style.display = 'none';
  }
}

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

      if (user) {
        if (guestNotice) guestNotice.style.display = 'none';
        if (authArea) {
          authArea.innerHTML = `
            <div class="user-badge"><span>${escapeHtml(user.displayName || user.email.split('@')[0])}</span></div>
            <button class="btn btn-secondary btn-sm" id="btn-logout" style="padding:4px 10px; font-size:0.75rem;">Kilépés</button>
          `;
          document.getElementById('btn-logout')?.addEventListener('click', () => auth.signOut());
        }

        listenToMyProfile(user.uid);
        listenToAllUsers();
      } else {
        if (myDocUnsubscribe) myDocUnsubscribe();
        listenToAllUsers();

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

safeAddListener('btn-open-auth', () => document.getElementById('modal-auth')?.classList.add('open'));
safeAddListener('btn-close-auth', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', () => switchView('profil'));

safeAddListener('btn-google-login', () => {
  if (!auth) return;
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => showToast(e.message));
});

// Indítás
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderHub();
  renderGrid();
  initFavoriteSelects();
  initFirebase();
  listenToAlbums();
} catch (err) {
  console.error("Indítási hiba:", err);
}
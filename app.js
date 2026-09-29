// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.0 - 1. RÉSZ: ALAPOK & HUB)
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
    coverUrl: "og-image.png",
    featured: false,
    hasRadar: false,
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
    coverUrl: "og-image.png",
    featured: false,
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
    coverUrl: "og-image.png",
    featured: false,
    hasRadar: false,
    hasChapters: false
  }
};

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";

function getActiveAlbum() {
  return ALBUMS_REGISTRY[currentAlbumId] || ALBUMS_REGISTRY["lidl-lutra-2026"];
}

function getActiveAlbumSize() {
  return getActiveAlbum().totalItems;
}

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

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

// Multi-Album adatszeparáció és beolvasás
function extractUserData(data, docId, targetAlbumId = currentAlbumId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);

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
  privateNote: localStorage.getItem(`private_note_${currentAlbumId}`) || '',
  favorites: ensureArray(safeJsonParse('lutra_favorites', [9, 4, 35])),
  van: ensureArray(safeJsonParse(`lutra_van_${currentAlbumId}`, [])).sort((a, b) => a - b),
  vanCounts: safeJsonParse(`lutra_van_counts_${currentAlbumId}`, {}),
  kell: ensureArray(safeJsonParse(`lutra_kell_${currentAlbumId}`, [])).sort((a, b) => a - b),
  foglalva: ensureArray(safeJsonParse(`lutra_foglalva_${currentAlbumId}`, [])).sort((a, b) => a - b),
  foglalvaCounts: safeJsonParse(`lutra_foglalva_counts_${currentAlbumId}`, {})
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
let currentChapterIndex = 1;
let currentUser = null;
let deferredPrompt = null;

let myDocUnsubscribe = null;
let allUsersUnsubscribe = null;
let messagesUnsubscribe = null;
let radarUnsubscribe = null;
let meetupsUnsubscribe = null;
let announcementsUnsubscribe = null;
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

const CITY_COORDINATES = {
  "budapest": { x: 52.5, y: 39.0 }, "győr": { x: 26.0, y: 27.0 }, "gyor": { x: 26.0, y: 27.0 },
  "sopron": { x: 10.5, y: 30.0 }, "szombathely": { x: 13.0, y: 44.0 }, "zalaegerszeg": { x: 20.0, y: 56.0 },
  "veszprém": { x: 35.0, y: 46.0 }, "veszprem": { x: 35.0, y: 46.0 }, "székesfehérvár": { x: 44.0, y: 45.0 },
  "szekesfehervar": { x: 44.0, y: 45.0 }, "pécs": { x: 41.0, y: 83.0 }, "pecs": { x: 41.0, y: 83.0 },
  "kaposvár": { x: 32.0, y: 73.0 }, "kaposvar": { x: 32.0, y: 73.0 }, "szekszárd": { x: 50.0, y: 73.0 },
  "szekszard": { x: 50.0, y: 73.0 }, "kecskemét": { x: 61.0, y: 59.0 }, "kecskemet": { x: 61.0, y: 59.0 },
  "szeged": { x: 66.0, y: 81.0 }, "békéscsaba": { x: 84.0, y: 69.0 }, "bekescsaba": { x: 84.0, y: 69.0 },
  "szolnok": { x: 69.0, y: 51.0 }, "debrecen": { x: 88.0, y: 40.0 }, "nyíregyháza": { x: 90.0, y: 26.0 },
  "nyiregyhaza": { x: 90.0, y: 26.0 }, "miskolc": { x: 77.0, y: 23.0 }, "eger": { x: 71.0, y: 31.0 },
  "salgótarján": { x: 62.0, y: 21.0 }, "salgotarjan": { x: 62.0, y: 21.0 }, "tatabánya": { x: 42.0, y: 32.0 },
  "tatabanya": { x: 42.0, y: 32.0 }, "érd": { x: 51.0, y: 43.0 }, "erd": { x: 51.0, y: 43.0 },
  "dunaújváros": { x: 53.0, y: 53.0 }, "dunaujvaros": { x: 53.0, y: 53.0 }, "baja": { x: 54.0, y: 80.0 },
  "hódmezővásárhely": { x: 71.0, y: 75.0 }, "hodmezovasarhely": { x: 71.0, y: 75.0 }, "orosháza": { x: 78.0, y: 73.0 },
  "oroshaza": { x: 78.0, y: 73.0 }, "gyula": { x: 89.0, y: 68.0 }, "siófok": { x: 42.0, y: 50.0 },
  "siofok": { x: 42.0, y: 50.0 }, "keszthely": { x: 27.0, y: 58.0 }, "nagykanizsa": { x: 21.0, y: 70.0 }
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
    titleEl.innerHTML = currentAlbumId === 'lidl-lutra-2026'
      ? `Top 3 Kedvenc Állatod / Matricád <strong style="color:var(--amber);">* (Kötelező)</strong>`
      : `Top 3 Kedvenc Tételed (${escapeHtml(activeAlbum.title)}) <strong style="color:var(--amber);">* (Kötelező)</strong>`;
  }

  ['prof-fav-1', 'prof-fav-2', 'prof-fav-3'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    sel.innerHTML = '<option value="">-- Válassz egyet --</option>';
    for (let i = 1; i <= totalSize; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      const itemName = currentAlbumId === 'lidl-lutra-2026' ? (STICKER_NAMES[i] || '') : `Tétel #${i}`;
      opt.textContent = `#${i} ${itemName}`;
      sel.appendChild(opt);
    }
    const currentFav = myProfile.favorites ? myProfile.favorites[idx] : null;
    if (currentFav && currentFav <= totalSize) sel.value = currentFav;

    sel.onchange = () => {
      const val = parseInt(sel.value, 10);
      if (!myProfile.favorites) myProfile.favorites = [];
      myProfile.favorites[idx] = isNaN(val) ? 0 : val;
      localStorage.setItem(`lutra_favorites_${currentAlbumId}`, JSON.stringify(myProfile.favorites));
      if (currentAlbumId === 'lidl-lutra-2026') localStorage.setItem('lutra_favorites', JSON.stringify(myProfile.favorites));
      checkMandatoryProfile();
    };
  });
}

function renderHub() {
  const container = document.getElementById('hub-albums-grid');
  if (!container) return;

  const albumsList = Object.values(ALBUMS_REGISTRY).filter(album => {
    if (currentHubFilter === 'sticker') return album.type === 'sticker';
    if (currentHubFilter === 'card') return album.type === 'card';
    if (currentHubFilter === 'my') {
      const myCount = ensureArray(safeJsonParse(`lutra_van_${album.id}`, [])).length;
      return myCount > 0;
    }
    return true;
  });

  container.innerHTML = albumsList.map(album => {
    const isFeatured = album.featured === true || album.id === 'lidl-lutra-2026';
    const albumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : []));
    const collectedCount = albumVan.length;
    const pct = Math.min(100, Math.round((collectedCount / album.totalItems) * 100));
    const cover = album.coverUrl || 'og-image.png';

    return `
      <div class="album-hub-card ${isFeatured ? 'featured-card' : ''}" data-album-id="${escapeHtml(album.id)}">
        <div>
          <img src="${cover}" class="hub-card-thumb" alt="${escapeHtml(album.title)}">
          <div class="album-hub-header">
            <div>
              <span class="album-type-badge">${escapeHtml(album.typeLabel)}</span>
              <span style="font-size:0.75rem; color:var(--text-muted); margin-left:6px;">${album.year}</span>
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
              Megnyitás & Matricázás ➔
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

  const radarNav = document.getElementById('nav-item-radar');
  const radarTitle = document.getElementById('nav-radar-title');
  const radarHeaderTitle = document.getElementById('radar-view-header-title');
  if (radarNav) {
    radarNav.style.display = activeAlbum.hasRadar ? 'block' : 'none';
    const label = albumId === 'lidl-lutra-2026' ? 'Albumradar' : 'Készletjelentő';
    if (radarTitle) radarTitle.textContent = label;
    if (radarHeaderTitle) radarHeaderTitle.textContent = `Közösségi ${label}`;
  }

  const albumModeToggle = document.querySelector('.view-mode-toggle');
  if (albumModeToggle) {
    albumModeToggle.style.display = activeAlbum.hasChapters ? 'flex' : 'none';
  }

  const certPromoCard = document.getElementById('cert-promo-card');
  if (certPromoCard) {
    certPromoCard.style.display = albumId === 'lidl-lutra-2026' ? 'block' : 'none';
  }

  const diffSec = document.getElementById('stat-sec-diff');
  const diffJump = document.getElementById('btn-jump-diff');
  if (diffSec) diffSec.style.display = activeAlbum.hasChapters ? 'block' : 'none';
  if (diffJump) diffJump.style.display = activeAlbum.hasChapters ? 'inline-block' : 'none';

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
  myProfile.privateNote = localStorage.getItem(`private_note_${albumId}`) || (albumId === 'lidl-lutra-2026' ? (localStorage.getItem('lutra_private_note') || '') : '');

  const noteInput = document.getElementById('prof-private-note');
  if (noteInput) {
    noteInput.value = myProfile.privateNote;
    const countEl = document.getElementById('note-char-count');
    if (countEl) countEl.textContent = `${myProfile.privateNote.length}/200`;
  }

  renderGrid();
  if (getActiveAlbum().hasChapters) renderAlbumChapter();
  renderMatches();
}

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
    const animalName = (currentAlbumId === 'lidl-lutra-2026') ? (STICKER_NAMES[i] || `Matrica #${i}`) : `Tétel #${i}`;

    html += `<div class="matrica-cell ${cls}" data-num="${i}" title="${i}. ${escapeHtml(animalName)}">
      ${i}
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

function initAlbumSelect() {
  const sel = document.getElementById('album-chapter-select');
  if (!sel || sel.options.length > 0) return;
  sel.innerHTML = '';
  FEJEZETEK.forEach((f, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = f.cim;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', (e) => {
    currentChapterIndex = parseInt(e.target.value, 10);
    renderAlbumChapter();
  });
}

function renderAlbumChapter() {
  if (!getActiveAlbum().hasChapters) return;
  initAlbumSelect();
  const container = document.getElementById('album-chapter-content');
  if (!container) return;

  const chapter = FEJEZETEK[currentChapterIndex];
  if (!chapter) return;
  const sel = document.getElementById('album-chapter-select');
  if (sel) sel.value = currentChapterIndex;

  const btnPrev = document.getElementById('btn-album-prev');
  const btnNext = document.getElementById('btn-album-next');
  if (btnPrev) btnPrev.disabled = currentChapterIndex === 0;
  if (btnNext) btnNext.disabled = currentChapterIndex === FEJEZETEK.length - 1;

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
                  <span class="sticker-num">#${n1}</span>
                  <span class="sticker-tag">${isVan1 ? 'Dupla' : isKell1 ? 'Kell' : isFog1 ? 'Foglalt' : 'Bal fél'}</span>
                </div>
                <div class="combo-half ${isVan2 ? 'van' : isKell2 ? 'kell' : isFog2 ? 'foglalva' : ''}" data-num="${n2}">
                  ${((isVan2 || isFog2) && q2 > 1) ? `<span class="qty-badge ${isFog2 ? 'foglalva' : ''}">×${q2}</span>` : ''}
                  <span class="sticker-num">#${n2}</span>
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
              <span class="sticker-num">#${el.num}</span>
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
    myProfile.kell.splice(kIdx, 1);
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

  container.addEventListener('touchend', () => {
    clearTimeout(longPressTimer);
    if (isLongPress) isLongPress = false;
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

function saveMyState() {
  const albumId = currentAlbumId;
  myProfile.van = ensureArray(myProfile.van).sort((a, b) => a - b);
  myProfile.kell = ensureArray(myProfile.kell).filter(n => !myProfile.van.includes(n)).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(myProfile.foglalva).filter(n => !myProfile.van.includes(n) && !myProfile.kell.includes(n)).sort((a, b) => a - b);

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
  
  renderGrid();
  renderHub();
  refreshMatchesIfVisible();
  renderCompletionOdds();

  if (currentUser && db) {
    // 1. Al-kollekciós mentés
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

    // 2. Beágyazott kollekciós mező frissítése a fődokumentumban (az azonnali párosításhoz)
    const updatePayload = {
      [`collections.${albumId}`]: {
        van: myProfile.van,
        vanCounts: myProfile.vanCounts || {},
        kell: myProfile.kell,
        foglalva: myProfile.foglalva,
        foglalvaCounts: myProfile.foglalvaCounts || {},
        updatedAt: Date.now()
      }
    };

    if (albumId === 'lidl-lutra-2026') {
      updatePayload.van = myProfile.van;
      updatePayload.vanCounts = myProfile.vanCounts || {};
      updatePayload.kell = myProfile.kell;
      updatePayload.foglalva = myProfile.foglalva;
      updatePayload.foglalvaCounts = myProfile.foglalvaCounts || {};
    }

    db.collection("public_profiles").doc(currentUser.uid).update(updatePayload).catch(() => {});
  }
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
    showToast(`${activePopoverNum}. tétel: ${qty} db`);
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
    return q > 1 ? `#${n} (${q}db)` : `#${n}`;
  }).join(', ') : 'Nincs duplám';
  const kellText = kellSorted.length ? kellSorted.map(n => `#${n}`).join(', ') : 'Minden megvan!';
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
  if (currentChapterIndex < FEJEZETEK.length - 1) { currentChapterIndex++; renderAlbumChapter(); }
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
// Cserélj Okosan - app.js (v4.0 - 2. RÉSZ: ROUTER, PÁROSÍTÁSOK & RADAR)
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
    if (getActiveAlbum().hasChapters) renderAlbumChapter();
  }
  if (viewName === 'admin') renderAdminAnnouncements();
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

  badge.style.display = (hasUnread || hasMeetup) ? 'inline-block' : 'none';
}

safeAddListener('btn-match-all', 'click', function() { setActiveMatchFilter(this, 'all'); });
safeAddListener('btn-match-city', 'click', function() {
  if (!myProfile.telepules) return showToast("Előbb add meg a településed a Profil fülön!");
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
  const myCity = (myProfile.telepules || '').trim().toLowerCase();
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

      const isLocalLoop = (userB.telepules || '').trim().toLowerCase() === myCity && (userC.telepules || '').trim().toLowerCase() === myCity;
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
  const myCity = (myProfile.telepules || '').trim().toLowerCase();

  if (matchFilter === 'loop') {
    const loops = computeLoopMatches();
    if (loops.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align:center; padding:20px;">
          <h3 style="margin:0 0 6px;">Nincs elérhető 3 fős körcsere</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
            Ahogy több gyűjtő rögzíti a dupláit ehhez az albumhoz, a rendszer automatikusan felajánlja a 3 fős kombinációkat!
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
            <p style="margin:0;">1. <strong>Te adsz neki:</strong> ${escapeHtml(l.userB.nev)} (${escapeHtml(l.userB.telepules || '')}) ➔ ${l.giveToB.map(n => `#${n}`).join(', ')}</p>
            <p style="margin:0;">2. <strong>Ő ad tovább:</strong> ${escapeHtml(l.userB.nev)} ad ${escapeHtml(l.userC.nev)}-nek ➔ ${l.giveBtoC.map(n => `#${n}`).join(', ')}</p>
            <p style="margin:0; color:var(--moss-soft);">3. <strong>Te kapsz tőle:</strong> ${escapeHtml(l.userC.nev)} (${escapeHtml(l.userC.telepules || '')}) ➔ ${l.giveCtoMe.map(n => `#${n}`).join(', ')}</p>
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
    list.innerHTML = '<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner ehhez a gyűjteményhez.</p>';
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
      <p style="margin:4px 0;"><strong>Te adnád neki:</strong> ${m.give.length ? m.give.map(n => `#${n}`).join(', ') : '<em>(Ajándékba kapod)</em>'}</p>
      <p style="margin:4px 0;"><strong>Ő adná neked:</strong> ${m.get.map(n => {
        const qty = (m.vanCounts && m.vanCounts[n] > 1) ? ` (${m.vanCounts[n]} db)` : '';
        return `#${n}${qty}`;
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
  const myCity = (myProfile.telepules || '').trim().toLowerCase();

  const stickerDemandMap = {};
  selectedUsers.forEach(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
    
    const totalGivesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).length;
    const isSameCity = myCity && (u.telepules || '').trim().toLowerCase() === myCity;

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
          Ezeket a tételeket többen is kérik, mint amennyi duplád van:
        </p>
        ${conflicts.map(c => {
          const currentWinnerUid = tradePlanManualOverrides[c.num] || [...c.demandList].sort((a, b) => {
            if (b.totalGivesToMe !== a.totalGivesToMe) return b.totalGivesToMe - a.totalGivesToMe;
            if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
            return 0;
          })[0].user.id;

          const stickerTitle = (currentAlbumId === 'lidl-lutra-2026') ? (STICKER_NAMES[c.num] || '') : '';

          return `
            <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div>
                <strong>#${c.num} ${escapeHtml(stickerTitle)}</strong> (Készlet: ${c.myQty} db)
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
          <p style="margin:2px 0;"><strong>Neki adod a terv szerint (${allocatedToHim.length} db):</strong> ${allocatedToHim.length ? allocatedToHim.map(n => `#${n}`).join(', ') : '<em>(Nem jut neki dupla)</em>'}</p>
          <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle kapod (${givesToMe.length} db):</strong> ${givesToMe.map(n => `#${n}`).join(', ')}</p>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-planned-partner" data-uid="${escapeHtml(u.id)}" data-give="${allocatedToHim.map(n => `#${n}`).join(', ')}" data-get="${givesToMe.map(n => `#${n}`).join(', ')}">
            Személyre szabott üzenet küldése ${escapeHtml(u.nev)}-nek
          </button>
        </div>
      </div>
    `;
  }).join('');

  const formattedGainedList = [...totalNewStickersGained].sort((a, b) => a - b).map(n => {
    const qty = gainedStickerCounts[n] || 1;
    if (qty > 1) {
      return `<strong style="white-space: nowrap; color: var(--amber); background: rgba(216,155,74,0.18); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(216,155,74,0.4);">#${n} (${qty} db)</strong>`;
    }
    return `<span style="white-space: nowrap;">#${n}</span>`;
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

  const giveText = btn.dataset.give || 'egyeztetés alatt';
  const getText = btn.dataset.get || '';

  document.getElementById('modal-trade-planner')?.classList.remove('open');
  openContactModal(targetUser, giveText, getText, targetUser.isGiftOffering);
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
    openContactModal(targetUser, give.map(n => `#${n}`).join(', '), get.map(n => `#${n}`).join(', '), targetUser.isGiftOffering);
  } else if (action === 'inspect-user') {
    openUserProfileModal(btn.dataset.uid);
  } else if (action === 'contact-loop-b' || action === 'contact-loop-c') {
    const loopIdx = parseInt(btn.dataset.loopIdx, 10);
    const loops = computeLoopMatches();
    const loop = loops[loopIdx];
    if (!loop) return;
    if (action === 'contact-loop-b') {
      openLoopContactModal(loop.userB, loop.userC.nev, loop.giveToB.map(n => `#${n}`).join(', '), 'B');
    } else {
      openLoopContactModal(loop.userC, loop.userB.nev, loop.giveCtoMe.map(n => `#${n}`).join(', '), 'C');
    }
  }
});

function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

safeAddListener('btn-search', () => {
  const raw = document.getElementById('search-input')?.value.trim() || '';
  if (!raw) return showToast("Írj be egy keresőszót!");
  const queryNorm = normalizeText(raw);
  const matchedNums = [];
  const totalSize = getActiveAlbumSize();

  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
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
      if (currentAlbumId === 'lidl-lutra-2026') {
        Object.entries(STICKER_NAMES).forEach(([numStr, name]) => {
          if (normalizeText(name).includes(queryNorm)) matchedNums.push(parseInt(numStr, 10));
        });
      }
    }
  }

  if (matchedNums.length === 0) return showToast("Nincs találat.");
  renderSearchResults(matchedNums.sort((a, b) => a - b), `Keresés: „${raw}”`);
});

safeAddListener('btn-search-all-missing', () => {
  if (myProfile.kell.length === 0) return showToast("Nincs bejelölt hiányzó tételed.");
  renderSearchResults(myProfile.kell, `Összes hiányzód (${myProfile.kell.length} db)`);
});

function renderSearchResults(targetNums, titleText) {
  const container = document.getElementById('search-results');
  if (!container) return;
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
        <p><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => `#${n}`).join(', ')}</p>
        <button class="btn btn-contact-green" data-action="contact-search" data-uid="${escapeHtml(u.id)}" data-found="${u.found.map(n => `#${n}`).join(', ')}">
          Érdekelnek a tételek
        </button>
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
// Cserélj Okosan - app.js (v4.0 - 3. RÉSZ: RADAR, PROFIL & FIREBASE MOTOR)
// =========================================================================

// RADAR ÉS TALÁLKOZÓK
safeAddListener('radar-photo-input', 'change', (e) => {
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

    return `
      <div class="radar-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div><strong>${escapeHtml(storeLabel)}</strong></div>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">${r.status ? 'Kapható' : 'Elfogyott'}</span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${escapeHtml(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>${escapeHtml(r.reporterName || 'Gyűjtő')} • ${timeStr}</span>
          ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-radar" data-id="${r.id}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('radar-filter-input', 'input', () => renderRadarReports());

safeAddListener('radar-reports-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action="delete-radar"]');
  if (!btn) return;
  if (!confirm("Biztosan törölni szeretnéd ezt a jelentést?")) return;
  try {
    await db.collection("album_reports").doc(btn.dataset.id).delete();
    showToast("Jelentés törölve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
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

// TALÁLKOZÓK
safeAddListener('meetup-photo-input', 'change', (e) => {
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
      meetupAttachedBase64 = canvas.toDataURL('image/jpeg', 0.65);
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

function renderMeetups() {
  const container = document.getElementById('meetups-list');
  if (!container) return;

  if (meetupEvents.length === 0) {
    container.innerHTML = '<p class="view-intro">Jelenleg nincs meghirdetett közös találkozó. Hozz létre egyet!</p>';
    return;
  }

  container.innerHTML = meetupEvents.map(m => {
    const isOwnerOrAdmin = currentUser && (m.userId === currentUser.uid || currentUser.email === ADMIN_EMAIL);

    return `
      <div class="meetup-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div><h3 style="margin:0; font-size:1.05rem;">${escapeHtml(m.city)} — ${escapeHtml(m.place)}</h3></div>
          <span class="meetup-time-badge">${escapeHtml(m.time)}</span>
        </div>
        ${m.description ? `<p style="font-size:0.86rem; margin:6px 0; color:var(--text-primary); white-space:pre-wrap;">${escapeHtml(m.description)}</p>` : ''}
        ${m.photoBase64 ? `<img src="${m.photoBase64}" class="radar-attached-img" alt="Plakát" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>Szervező: <strong>${escapeHtml(m.organizerName || 'Gyűjtő')}</strong></span>
          ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-meetup" data-id="${m.id}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('meetups-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action="delete-meetup"]');
  if (!btn) return;
  if (!confirm("Biztosan törölni szeretnéd ezt a találkozót?")) return;
  try {
    await db.collection("meetups").doc(btn.dataset.id).delete();
    showToast("Találkozó törölve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
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

      updateCserebereBadge();
      renderMeetups();
    }, err => console.warn("Meetups listener:", err));
}

// STATISZTIKA & HŐTÉRKÉP
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
      name: currentAlbumId === 'lidl-lutra-2026' ? (STICKER_NAMES[num] || `Matrica #${num}`) : `Tétel #${num}`
    }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score);

  const container = document.getElementById('stats-favorites-ranking');
  if (!container) return;

  if (rankedFavs.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Még senki sem jelölt meg kedvencet a profiljában ehhez az albumhoz.</span>';
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
  if (!getActiveAlbum().hasChapters) return;
  const chapterMissing = {};
  const chapterDupes = {};

  FEJEZETEK.slice(1).forEach(f => {
    chapterMissing[f.id] = 0;
    chapterDupes[f.id] = 0;
  });

  allUsersData.forEach(u => {
    const kSet = new Set(ensureArray(u.kell));
    const vSet = new Set(ensureArray(u.van));

    FEJEZETEK.slice(1).forEach(f => {
      f.elemek.forEach(el => {
        const nums = el.type === 'combo' ? el.nums : [el.num];
        nums.forEach(n => {
          if (kSet.has(n)) chapterMissing[f.id] += 1;
          if (vSet.has(n)) chapterDupes[f.id] += (u.vanCounts?.[n] || 1);
        });
		
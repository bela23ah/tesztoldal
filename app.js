// =========================================================================
// Lutra Album Cserebere (Lidl 2026) - app.js (v4.1 Teljes Változat)
// =========================================================================

const ALBUM_SIZE = 108;
const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

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
  if (Array.isArray(val)) {
    return val.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= ALBUM_SIZE);
  }
  if (typeof val === 'string') {
    return val.split(/[\s,;]+/)
      .map(Number)
      .filter(n => !isNaN(n) && n >= 1 && n <= ALBUM_SIZE);
  }
  if (typeof val === 'object') {
    return Object.keys(val)
      .map(Number)
      .filter(n => !isNaN(n) && n >= 1 && n <= ALBUM_SIZE);
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

function extractUserData(data, docId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);

  const rawVan = data.van || data.duplicates || data.duplak || [];
  const van = ensureArray(rawVan).sort((a, b) => a - b);

  const rawKell = data.kell || data.missing || data.hianyzo || [];
  const kell = ensureArray(rawKell).sort((a, b) => a - b);

  const rawFoglalva = data.foglalva || data.reserved || [];
  const foglalva = ensureArray(rawFoglalva).sort((a, b) => a - b);

  const favorites = ensureArray(data.favorites || []);
  const vanCounts = (data.vanCounts && typeof data.vanCounts === 'object') ? data.vanCounts : {};
  const foglalvaCounts = (data.foglalvaCounts && typeof data.foglalvaCounts === 'object') ? data.foglalvaCounts : {};
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
  privateNote: localStorage.getItem('lutra_private_note') || '',
  favorites: ensureArray(safeJsonParse('lutra_favorites', [9, 4, 35])),
  van: ensureArray(safeJsonParse('lutra_van', [])).sort((a, b) => a - b),
  vanCounts: safeJsonParse('lutra_van_counts', {}),
  kell: ensureArray(safeJsonParse('lutra_kell', [])).sort((a, b) => a - b),
  foglalva: ensureArray(safeJsonParse('lutra_foglalva', [])).sort((a, b) => a - b),
  foglalvaCounts: safeJsonParse('lutra_foglalva_counts', {})
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
  "budapest": { x: 52.5, y: 39.0 },
  "győr": { x: 26.0, y: 27.0 },
  "gyor": { x: 26.0, y: 27.0 },
  "sopron": { x: 10.5, y: 30.0 },
  "szombathely": { x: 13.0, y: 44.0 },
  "zalaegerszeg": { x: 20.0, y: 56.0 },
  "veszprém": { x: 35.0, y: 46.0 },
  "veszprem": { x: 35.0, y: 46.0 },
  "székesfehérvár": { x: 44.0, y: 45.0 },
  "szekesfehervar": { x: 44.0, y: 45.0 },
  "pécs": { x: 41.0, y: 83.0 },
  "pecs": { x: 41.0, y: 83.0 },
  "kaposvár": { x: 32.0, y: 73.0 },
  "kaposvar": { x: 32.0, y: 73.0 },
  "szekszárd": { x: 50.0, y: 73.0 },
  "szekszard": { x: 50.0, y: 73.0 },
  "kecskemét": { x: 61.0, y: 59.0 },
  "kecskemet": { x: 61.0, y: 59.0 },
  "szeged": { x: 66.0, y: 81.0 },
  "békéscsaba": { x: 84.0, y: 69.0 },
  "bekescsaba": { x: 84.0, y: 69.0 },
  "szolnok": { x: 69.0, y: 51.0 },
  "debrecen": { x: 88.0, y: 40.0 },
  "nyíregyháza": { x: 90.0, y: 26.0 },
  "nyiregyhaza": { x: 90.0, y: 26.0 },
  "miskolc": { x: 77.0, y: 23.0 },
  "eger": { x: 71.0, y: 31.0 },
  "salgótarján": { x: 62.0, y: 21.0 },
  "salgotarjan": { x: 62.0, y: 21.0 },
  "tatabánya": { x: 42.0, y: 32.0 },
  "tatabanya": { x: 42.0, y: 32.0 },
  "érd": { x: 51.0, y: 43.0 },
  "erd": { x: 51.0, y: 43.0 },
  "dunaújváros": { x: 53.0, y: 53.0 },
  "dunaujvaros": { x: 53.0, y: 53.0 },
  "baja": { x: 54.0, y: 80.0 },
  "hódmezővásárhely": { x: 71.0, y: 75.0 },
  "hodmezovasarhely": { x: 71.0, y: 75.0 },
  "orosháza": { x: 78.0, y: 73.0 },
  "oroshaza": { x: 78.0, y: 73.0 },
  "gyula": { x: 89.0, y: 68.0 },
  "siófok": { x: 42.0, y: 50.0 },
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
  ['prof-fav-1', 'prof-fav-2', 'prof-fav-3'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    if (!sel || sel.options.length > 0) return;
    
    sel.innerHTML = '<option value="">-- Válassz állatot --</option>';
    for (let i = 1; i <= ALBUM_SIZE; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `#${i} ${STICKER_NAMES[i] || ''}`;
      sel.appendChild(opt);
    }
    const currentFav = myProfile.favorites ? myProfile.favorites[idx] : null;
    if (currentFav) sel.value = currentFav;

    sel.addEventListener('change', () => {
      const val = parseInt(sel.value, 10);
      if (!myProfile.favorites) myProfile.favorites = [];
      myProfile.favorites[idx] = isNaN(val) ? 0 : val;
      localStorage.setItem('lutra_favorites', JSON.stringify(myProfile.favorites));
      checkMandatoryProfile();
    });
  });
}

function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));

  for (let i = 1; i <= ALBUM_SIZE; i++) {
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
    const animalName = STICKER_NAMES[i] || `Matrica #${i}`;

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
  if (num === lastToggledStickerNum && now - lastToggleTimestamp < 220) {
    return;
  }
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

function saveMyState() {
  myProfile.van = ensureArray(myProfile.van).sort((a, b) => a - b);
  myProfile.kell = ensureArray(myProfile.kell).filter(n => !myProfile.van.includes(n)).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(myProfile.foglalva).filter(n => !myProfile.van.includes(n) && !myProfile.kell.includes(n)).sort((a, b) => a - b);
  myProfile.favorites = ensureArray(myProfile.favorites || []);

  localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
  localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
  localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
  localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
  localStorage.setItem('lutra_favorites', JSON.stringify(myProfile.favorites));
  
  renderGrid();
  renderAlbumChapter();
  refreshMatchesIfVisible();
  renderCompletionOdds();

  if (currentUser && myProfile.gdprAccepted === true && db) {
    db.collection("public_profiles").doc(currentUser.uid).set({
      nev: myProfile.nev,
      nickname: myProfile.nev,
      telepules: myProfile.telepules,
      city: myProfile.telepules,
      isGiftOffering: !!myProfile.isGiftOffering,
      showEmailToUsers: !!myProfile.showEmailToUsers,
      emailNotifications: myProfile.emailNotifications !== false,
      allowInspect: myProfile.allowInspect !== false,
      gdprAccepted: true,
      favorites: myProfile.favorites,
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      foglalva: myProfile.foglalva,
      foglalvaCounts: myProfile.foglalvaCounts || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
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
    showToast(`${activePopoverNum}. matrica: ${qty} db`);
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
  tokens.forEach(t => {
    t = t.trim();
    if (!t) return;
    const multMatch = t.match(/^(\d+)[*xX](\d+)$/);
    if (multMatch) {
      const num = parseInt(multMatch[1], 10);
      const qty = parseInt(multMatch[2], 10);
      if (num >= 1 && num <= ALBUM_SIZE && qty > 0) parsed[num] = (parsed[num] || 0) + qty;
    } else {
      const num = parseInt(t, 10);
      if (num >= 1 && num <= ALBUM_SIZE) parsed[num] = (parsed[num] || 0) + 1;
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
  showToast(`${count} db matrica mentve a Duplákhoz.`);
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
  showToast(`${count} db matrica mentve a Hiányzókhoz.`);
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
  showToast(`${count} db matrica mentve a Foglalthoz.`);
});

safeAddListener('btn-copy-fb-post', () => {
  const vanSorted = [...myProfile.van].sort((a, b) => a - b);
  const kellSorted = [...myProfile.kell].sort((a, b) => a - b);
  const vanText = vanSorted.length ? vanSorted.map(n => {
    const q = myProfile.vanCounts[n] || 1;
    return q > 1 ? `#${n} (${q}db)` : `#${n}`;
  }).join(', ') : 'Nincs duplám';
  const kellText = kellSorted.length ? kellSorted.map(n => `#${n}`).join(', ') : 'Minden matrica megvan!';
  const userCity = myProfile.telepules ? ` (${myProfile.telepules})` : '';

  const fbPost = `Lidl Lutra 2026 matricacsere!\nGyűjtő: ${myProfile.nev}${userCity}\n\nDUPLÁK (${vanSorted.length} féle):\n${vanText}\n\nHIÁNYZIK (${kellSorted.length} db):\n${kellText}\n\nCseréljünk itt: ${window.location.href}`;
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

  if (catName === 'radar') {
    switchView('radar');
  } else if (catName === 'matricaim') {
    switchView('matricaim');
  } else if (catName === 'cserebere') {
    switchView('uzeneteim');
  } else if (catName === 'profil') {
    switchView('profil');
  }
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');

  document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  document.querySelectorAll('.dropdown-link').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));

  let parentCat = 'matricaim';
  if (viewName === 'radar') parentCat = 'radar';
  else if (viewName === 'uzeneteim' || viewName === 'meetups') parentCat = 'cserebere';
  else if (viewName === 'profil' || viewName === 'statisztika' || viewName === 'admin') parentCat = 'profil';

  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === parentCat));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavProfil = document.getElementById('subnav-profil');
  if (subnavMatricaim) subnavMatricaim.style.display = parentCat === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = parentCat === 'cserebere' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = parentCat === 'profil' ? 'flex' : 'none';

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

  if (hasUnread || hasMeetup) {
    badge.style.display = 'inline-block';
  } else {
    badge.style.display = 'none';
  }
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
  showToast("Adatok frissítve.");
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
    list.innerHTML = '<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner.</p>';
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

// CSERE-TERVEZŐ JELÖLŐNÉGYZETEK ÉS LEBEGŐ SÁV
safeAddListener('matches-list', 'change', (e) => {
  const check = e.target.closest('.trade-plan-check');
  if (!check) return;
  const uid = check.dataset.uid;
  if (check.checked) {
    selectedTradePlanUids.add(uid);
  } else {
    selectedTradePlanUids.delete(uid);
  }
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

safeAddListener('btn-close-trade-planner', () => {
  document.getElementById('modal-trade-planner')?.classList.remove('open');
});
safeAddListener('btn-close-trade-planner-2', () => {
  document.getElementById('modal-trade-planner')?.classList.remove('open');
});

// INTELLIGENS CSERE-TERVEZŐ & ÜTKÖZÉSVIZSGÁLÓ SZIMULÁTOR ALGORITMUS
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
        <strong>Nincs matricaütközés:</strong> Mind a ${selectedUsers.length} partnernek jut az általuk kért összes dupládból!
      </div>
    `;
  } else {
    conflictBox.innerHTML = `
      <div class="card" style="border:1.5px solid var(--danger); background:rgba(232,90,79,0.12);">
        <h4 style="margin:0 0 6px; color:#FFC0BA; font-size:0.95rem;">Ütköző matricák (${conflicts.length} db)</h4>
        <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 10px;">
          Ezeket a matricákat többen is kérik, mint amennyi duplád van. A rendszer a legtöbb matricát adó, illetve helyi partnert javasolja:
        </p>
        ${conflicts.map(c => {
          const currentWinnerUid = tradePlanManualOverrides[c.num] || [...c.demandList].sort((a, b) => {
            if (b.totalGivesToMe !== a.totalGivesToMe) return b.totalGivesToMe - a.totalGivesToMe;
            if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
            return 0;
          })[0].user.id;

          return `
            <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div>
                <strong>#${c.num} ${escapeHtml(STICKER_NAMES[c.num] || '')}</strong> (Készlet: ${c.myQty} db)
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
          <span style="font-size:0.75rem; color:var(--amber); font-weight:700;">+${givesToMe.length} új matrica tőle</span>
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
      +${totalNewStickersGained.size} új matrica az albumodba • -${totalStickersGivenCount} elcserélt dupla
    </div>
    <p style="font-size:0.78rem; color:var(--sand); margin:6px 0 0; line-height:1.6;">
      Megszerzett matricák: ${formattedGainedList}
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

  const rangeMatch = raw.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const s = parseInt(rangeMatch[1], 10), e = parseInt(rangeMatch[2], 10);
    for (let i = Math.min(s, e); i <= Math.max(s, e); i++) {
      if (i >= 1 && i <= ALBUM_SIZE) matchedNums.push(i);
    }
  } else {
    const numTokens = raw.split(/[\s,;]+/).filter(t => /^\d+$/.test(t));
    if (numTokens.length > 0) {
      numTokens.forEach(n => {
        const num = parseInt(n, 10);
        if (num >= 1 && num <= ALBUM_SIZE) matchedNums.push(num);
      });
    } else {
      Object.entries(STICKER_NAMES).forEach(([numStr, name]) => {
        if (normalizeText(name).includes(queryNorm)) matchedNums.push(parseInt(numStr, 10));
      });
    }
  }

  if (matchedNums.length === 0) return showToast("Nincs találat.");
  renderSearchResults(matchedNums.sort((a, b) => a - b), `Keresés: „${raw}”`);
});

safeAddListener('btn-search-all-missing', () => {
  if (myProfile.kell.length === 0) return showToast("Nincs bejelölt hiányzó matricád.");
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
        <p><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => `#${n} (${escapeHtml(STICKER_NAMES[n] || '')})`).join(', ')}</p>
        <button class="btn btn-contact-green" data-action="contact-search" data-uid="${escapeHtml(u.id)}" data-found="${u.found.map(n => `#${n}`).join(', ')}">
          Érdekelnek a matricák
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
// ALBUMRADAR & FOTÓCSATOLÁS (10 PERCES KORLÁTTAL)
// =========================================================================
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

  if (!rawStore) return showToast("Kérlek válaszd ki a Lidl áruházat a listából!");

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

  const filtered = radarReports.filter(r => {
    if (!filterQuery) return true;
    const matchCity = (r.city || '').toLowerCase().includes(filterQuery);
    const matchStore = (r.storeName || '').toLowerCase().includes(filterQuery);
    const matchFull = (r.fullStoreName || '').toLowerCase().includes(filterQuery);
    return matchCity || matchStore || matchFull;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="view-intro">Nincs a szűrésnek megfelelő készletjelentés.</p>';
    return;
  }

  container.innerHTML = filtered.map(r => {
    const timeStr = r.reportedAt?.toDate ? r.reportedAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';
    const isOwnerOrAdmin = currentUser && (r.userId === currentUser.uid || currentUser.email === ADMIN_EMAIL);
    const storeLabel = r.fullStoreName ? r.fullStoreName : `${r.city} – ${r.storeName}`;

    return `
      <div class="radar-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div>
            <strong>${escapeHtml(storeLabel)}</strong>
          </div>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">
            ${r.status ? '🟢 Kapható' : '🔴 Elfogyott'}
          </span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${escapeHtml(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>${escapeHtml(r.reporterName || 'Gyűjtő')} • 🕒 ${timeStr}</span>
          ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-radar" data-id="${r.id}" style="color:var(--danger); border-color:var(--danger);">🗑️ Törlés</button>` : ''}
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

      const rBadge = document.getElementById('radar-badge');
      if (rBadge && radarReports.length > 0) {
        rBadge.textContent = radarReports.length;
        rBadge.style.display = 'inline-block';
      }

      if (!isInitial && newCount > previousRadarCount && radarReports.length > 0) {
        const latest = radarReports[0];
        triggerTopNotification(`Új bolti készletjelentés: ${latest.city} (${latest.status ? '🟢 Kapható' : '🔴 Elfogyott'})`, () => switchView('radar'));
      }
      previousRadarCount = newCount;

      renderRadarReports();
    }, err => console.warn("Albumradar listener:", err));
}

// =========================================================================
// OFFLINE TALÁLKOZÓK & CSERENAPOK MODUL
// =========================================================================
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
      const preview = document.getElementById('meetup-photo-preview');
      const previewBox = document.getElementById('meetup-photo-preview-box');
      if (preview && previewBox) {
        preview.src = meetupAttachedBase64;
        previewBox.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

safeAddListener('btn-submit-meetup', async () => {
  if (!currentUser) return showToast("Találkozó meghirdetéséhez lépj be a fiókodba!");

  const lastMeetupTime = parseInt(localStorage.getItem('lutra_last_meetup_post') || '0', 10);
  const now = Date.now();
  if (now - lastMeetupTime < 10 * 60 * 1000) {
    const remMin = Math.ceil((10 * 60 * 1000 - (now - lastMeetupTime)) / 60000);
    return showToast(`Kérlek várj még ${remMin} percet az újabb találkozó kiírása előtt!`);
  }

  const city = document.getElementById('meetup-input-city')?.value.trim() || '';
  const time = document.getElementById('meetup-input-time')?.value.trim() || '';
  const place = document.getElementById('meetup-input-place')?.value.trim() || '';
  const desc = document.getElementById('meetup-input-desc')?.value.trim() || '';

  if (!city || !time || !place) return showToast("Kérlek töltsd ki a várost, időpontot és helyszínt!");

  try {
    await db.collection("meetups").add({
      city,
      time,
      place,
      description: desc,
      photoBase64: meetupAttachedBase64 || '',
      postedAt: firebase.firestore.FieldValue.serverTimestamp(),
      organizerName: myProfile.nev || 'Gyűjtő',
      userId: currentUser.uid
    });

    localStorage.setItem('lutra_last_meetup_post', now.toString());
    meetupAttachedBase64 = '';
    if (document.getElementById('meetup-input-city')) document.getElementById('meetup-input-city').value = '';
    if (document.getElementById('meetup-input-time')) document.getElementById('meetup-input-time').value = '';
    if (document.getElementById('meetup-input-place')) document.getElementById('meetup-input-place').value = '';
    if (document.getElementById('meetup-input-desc')) document.getElementById('meetup-input-desc').value = '';
    if (document.getElementById('meetup-photo-input')) document.getElementById('meetup-photo-input').value = '';
    if (document.getElementById('meetup-photo-preview-box')) document.getElementById('meetup-photo-preview-box').style.display = 'none';

    showToast("🎉 Találkozó sikeresen közzétéve!");
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
          <div>
            <h3 style="margin:0; font-size:1.05rem;">📍 ${escapeHtml(m.city)} — ${escapeHtml(m.place)}</h3>
          </div>
          <span class="meetup-time-badge">🕒 ${escapeHtml(m.time)}</span>
        </div>
        ${m.description ? `<p style="font-size:0.86rem; margin:6px 0; color:var(--text-primary); white-space:pre-wrap;">${escapeHtml(m.description)}</p>` : ''}
        ${m.photoBase64 ? `<img src="${m.photoBase64}" class="radar-attached-img" alt="Plakát" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>Szervező: <strong>${escapeHtml(m.organizerName || 'Gyűjtő')}</strong></span>
          ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-meetup" data-id="${m.id}" style="color:var(--danger); border-color:var(--danger);">🗑️ Törlés</button>` : ''}
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

// =========================================================================
// STATISZTIKA, KEDVENCEK, HALMOZÓDÁS, MÉRETEK & GYORSUGRÓ
// =========================================================================
function renderFavoritesRanking() {
  const favScores = {};
  for (let i = 1; i <= ALBUM_SIZE; i++) favScores[i] = 0;

  allUsersData.forEach(u => {
    const favs = ensureArray(u.favorites || []);
    if (favs[0]) favScores[favs[0]] = (favScores[favs[0]] || 0) + 3;
    if (favs[1]) favScores[favs[1]] = (favScores[favs[1]] || 0) + 2;
    if (favs[2]) favScores[favs[2]] = (favScores[favs[2]] || 0) + 1;
  });

  const rankedFavs = Object.entries(favScores)
    .map(([num, score]) => ({ num: parseInt(num, 10), score, name: STICKER_NAMES[num] || `Matrica #${num}` }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score);

  const container = document.getElementById('stats-favorites-ranking');
  if (!container) return;

  if (rankedFavs.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Még senki sem jelölt meg kedvenc állatot a profiljában.</span>';
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

  if (totalUsers === 0) return;

  allUsersData.forEach(u => {
    const missingCount = ensureArray(u.kell).length;
    const haveCount = ALBUM_SIZE - missingCount;
    const pct = Math.round((haveCount / ALBUM_SIZE) * 100);

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
      });
    });
  });

  const rankedChapters = FEJEZETEK.slice(1).map(f => {
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
    if (u.id === (currentUser ? currentUser.uid : 'me')) return;
    ensureArray(u.van).forEach(n => availablePool.add(n));
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

  const stickerHolderCount = {};
  const stickerTotalQty = {};
  for (let i = 1; i <= ALBUM_SIZE; i++) {
    stickerHolderCount[i] = 0;
    stickerTotalQty[i] = 0;
  }

  allUsersData.forEach(u => {
    const rawCity = (u.telepules || '').trim();
    if (!rawCity) return;
    const cityKey = normalizeText(rawCity);
    if (!cityStats[cityKey]) {
      cityStats[cityKey] = { name: rawCity, users: 0, duplicates: 0, missing: 0 };
    }
    cityStats[cityKey].users += 1;
    const userMissing = ensureArray(u.kell);
    cityStats[cityKey].missing += userMissing.length;
    totalMissingCount += userMissing.length;
    
    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      cityStats[cityKey].duplicates += q;
      totalPoolCount += q;

      stickerHolderCount[n] = (stickerHolderCount[n] || 0) + 1;
      stickerTotalQty[n] = (stickerTotalQty[n] || 0) + q;
    });
  });

  const poolEl = document.getElementById('stats-total-pool-count');
  if (poolEl) poolEl.textContent = `${totalPoolCount.toLocaleString('hu-HU')} db`;

  const avgDupesEl = document.getElementById('stats-avg-dupes');
  const avgProgressEl = document.getElementById('stats-avg-progress');
  const hoardingEl = document.getElementById('stats-hoarding-sticker');

  if (avgDupesEl && allUsersData.length > 0) {
    avgDupesEl.textContent = `${Math.round(totalPoolCount / allUsersData.length)} db/fő`;
  }
  if (avgProgressEl && allUsersData.length > 0) {
    const avgMissing = totalMissingCount / allUsersData.length;
    const avgProg = Math.max(0, Math.min(100, Math.round(((ALBUM_SIZE - avgMissing) / ALBUM_SIZE) * 100)));
    avgProgressEl.textContent = `${avgProg}%`;
  }

  let maxHoardAvg = 0;
  let maxHoardNum = null;
  for (let i = 1; i <= ALBUM_SIZE; i++) {
    if (stickerHolderCount[i] >= 2) {
      const avg = stickerTotalQty[i] / stickerHolderCount[i];
      if (avg > maxHoardAvg) {
        maxHoardAvg = avg;
        maxHoardNum = i;
      }
    }
  }

  if (hoardingEl) {
    if (maxHoardNum) {
      hoardingEl.textContent = `#${maxHoardNum} (${maxHoardAvg.toFixed(1)} db/fő)`;
      hoardingEl.title = `#${maxHoardNum} ${STICKER_NAMES[maxHoardNum] || ''}: Összesen ${stickerTotalQty[maxHoardNum]} db ${stickerHolderCount[maxHoardNum]} gyűjtőnél`;
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
    highwayTextEl.innerHTML = `Több mint <strong>${margitRatio}× olyan hosszú</strong>, mint a Margit híd (607 m), ez a sor élére állítva <strong>${eiffelRatio}× magasabb</strong>, mint az Eiffel-torony!`;
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
    let heatCls = 'cool';
    let label = 'Éledezve';
    let pinSize = 18;

    if (c.users >= 3 && score >= 75) {
      heatCls = 'fire';
      label = 'Izzik a csere';
      pinSize = 32;
    } else if ((c.users >= 2 && score >= 35) || (c.users === 1 && c.duplicates >= 25)) {
      heatCls = 'warm';
      label = 'Pörög';
      pinSize = 24;
    } else {
      heatCls = 'cool';
      label = 'Éledezve';
      pinSize = 18;
    }

    return { score, heatCls, label, pinSize };
  };

  const sortedCities = Object.values(cityStats).sort((a, b) => {
    const dataA = getCityHeatData(a);
    const dataB = getCityHeatData(b);
    return dataB.score - dataA.score;
  });

  const pinsOverlay = document.getElementById('heatmap-overlay-pins');
  if (pinsOverlay) {
    pinsOverlay.innerHTML = '';
    sortedCities.forEach(c => {
      const norm = normalizeText(c.name);
      const coords = CITY_COORDINATES[norm];
      if (coords) {
        const { score, heatCls, pinSize } = getCityHeatData(c);

        const pin = document.createElement('div');
        pin.className = `heat-pin ${heatCls}`;
        pin.style.left = `${coords.x}%`;
        pin.style.top = `${coords.y}%`;
        pin.style.width = `${pinSize}px`;
        pin.style.height = `${pinSize}px`;
        pin.title = `${c.name}: ${c.users} gyűjtő, ${c.duplicates} dupla matrica (Csereláz pont: ${score})`;
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
        <div class="stats-ranking-item" onclick="filterMatchesByCityName('${escapeHtml(c.name)}')">
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

safeAddListener('btn-toggle-all-cities', () => {
  showAllHeatmapCities = !showAllHeatmapCities;
  const btn = document.getElementById('btn-toggle-all-cities');
  if (btn) btn.textContent = showAllHeatmapCities ? '▲ Csak a legaktívabb városok mutatása' : 'Összes aktív város mutatása';
  renderHeatmap();
});

// GYORSUGRÓ GOMBOK ÉS EGÉRGÖRGŐ KEZELŐ
document.querySelectorAll('.btn-stat-jump').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

const quicknavBar = document.getElementById('stats-quicknav-bar');
const quicknavArrowRight = document.getElementById('stats-quicknav-arrow');
const quicknavArrowLeft = document.getElementById('stats-quicknav-arrow-left');

if (quicknavBar) {
  const updateQuicknavArrows = () => {
    const maxScroll = quicknavBar.scrollWidth - quicknavBar.clientWidth;
    const currentScroll = quicknavBar.scrollLeft;

    if (quicknavArrowLeft) {
      quicknavArrowLeft.style.opacity = currentScroll > 15 ? '1' : '0';
      quicknavArrowLeft.style.pointerEvents = currentScroll > 15 ? 'auto' : 'none';
    }

    if (quicknavArrowRight) {
      quicknavArrowRight.style.opacity = currentScroll >= maxScroll - 15 ? '0' : '1';
      quicknavArrowRight.style.pointerEvents = currentScroll >= maxScroll - 15 ? 'none' : 'auto';
    }
  };

  quicknavBar.addEventListener('scroll', updateQuicknavArrows);

  quicknavBar.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      quicknavBar.scrollLeft += e.deltaY;
    }
  });

  let autoScrollInterval = null;
  quicknavBar.addEventListener('mousemove', (e) => {
    const rect = quicknavBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    clearInterval(autoScrollInterval);
    if (x < 60) {
      autoScrollInterval = setInterval(() => { quicknavBar.scrollLeft -= 6; }, 16);
    } else if (x > width - 60) {
      autoScrollInterval = setInterval(() => { quicknavBar.scrollLeft += 6; }, 16);
    }
  });

  quicknavBar.addEventListener('mouseleave', () => {
    clearInterval(autoScrollInterval);
  });

  if (quicknavArrowRight) {
    quicknavArrowRight.onclick = () => quicknavBar.scrollBy({ left: 160, behavior: 'smooth' });
  }
  if (quicknavArrowLeft) {
    quicknavArrowLeft.onclick = () => quicknavBar.scrollBy({ left: -160, behavior: 'smooth' });
  }

  setTimeout(updateQuicknavArrows, 300);
}

function filterMatchesByCityName(cityName) {
  myProfile.telepules = cityName;
  switchView('cserek');
  const cityBtn = document.getElementById('btn-match-city');
  if (cityBtn) setActiveMatchFilter(cityBtn, 'city');
  showToast(`Szűrés: ${cityName}`);
}

function renderStatistics() {
  const demandCount = {};
  const supplyCount = {};
  for (let i = 1; i <= ALBUM_SIZE; i++) { demandCount[i] = 0; supplyCount[i] = 0; }

  allUsersData.forEach(u => {
    ensureArray(u.kell).forEach(n => { if (demandCount[n] !== undefined) demandCount[n]++; });
    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      if (supplyCount[n] !== undefined) supplyCount[n] += q;
    });
  });

  const rarest = [];
  for (let i = 1; i <= ALBUM_SIZE; i++) {
    rarest.push({ num: i, name: STICKER_NAMES[i], demand: demandCount[i], supply: supplyCount[i], score: demandCount[i] - supplyCount[i] });
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
  const uCount = document.getElementById('stats-users-count');
  if (uCount) uCount.textContent = allUsersData.length;

  renderFavoritesRanking();
  renderCompletionDistribution();
  renderChapterDifficulty();
  renderCompletionOdds();
  renderHeatmap();
}

safeAddListener('btn-refresh-stats', () => {
  renderStatistics();
  showToast("Statisztika és hőtérkép frissítve.");
});

// =========================================================================
// FOTÓBEOLVASÓ (AI VISION PROXY)
// =========================================================================
let scannerRecognizedNums = [];

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
      body: JSON.stringify({ base64Data })
    });

    let data;
    try { data = await res.json(); } catch (parseErr) { throw new Error("A képfelismerő szerver hibát adott."); }
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
      #${num}
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
  if (num >= 1 && num <= ALBUM_SIZE) {
    scannerRecognizedNums.push(num);
    scannerRecognizedNums.sort((a, b) => a - b);
    renderScannerTags();
    if (input) input.value = '';
  } else {
    showToast("Adj meg egy számot 1 és 108 között!");
  }
});

safeAddListener('btn-scanner-save-van', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető szám.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + 1;
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica mentve a Duplákhoz.`);
});

safeAddListener('btn-scanner-save-kell', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető szám.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.kell.includes(num)) myProfile.kell.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica mentve a Hiányzókhoz.`);
});

safeAddListener('btn-scanner-save-foglalva', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető szám.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.foglalva.includes(num)) myProfile.foglalva.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica mentve a Foglalthoz.`);
});

safeAddListener('btn-scanner-copy-list', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs másolható szám.");
  const formattedText = scannerRecognizedNums.map(n => `#${n}`).join(', ');
  navigator.clipboard.writeText(formattedText);
  showToast("Számsor kimásolva a vágólapra!");
});

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

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

function setupContactModal(targetUser, msg, subject) {
  activeContactTarget = {
    uid: targetUser.id || targetUser.uid || '',
    nev: targetUser.nev || 'Gyűjtőpartner',
    telepules: targetUser.telepules || '',
    email: targetUser.email || '',
    showEmail: targetUser.showEmailToUsers === true,
    subject: subject
  };

  const titleEl = document.getElementById('contact-modal-title');
  const inputEl = document.getElementById('contact-msg-input');
  if (titleEl) titleEl.textContent = `Üzenet küldése: ${escapeHtml(activeContactTarget.nev)}`;
  if (inputEl) inputEl.value = msg;

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

  document.getElementById('modal-contact')?.classList.add('open');
}

function openContactModal(targetUser, give, get, isGift) {
  if (!checkSenderProfileReady()) return;
  const subject = "Lutra 2026 matricacsere megkeresés";
  const msg = isGift && !give ?
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 csereoldalon láttam a felajánlásodat, hogy a dupláidat szívesen odaadod ajándékba.\nSzeretném elkérni az alábbi matricá(ka)t:\n${get}\n\nHogyan tudnánk lebonyolítani az átadást/postázást?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})` :
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 platformon találtam meg a gyűjteményedet:\n\nÉn tudom adni neked: ${give}\nTe tudod adni nekem: ${get}\n\nMegfelelne a csere postán vagy személyesen?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;

  setupContactModal(targetUser, msg, subject);
}

function openLoopContactModal(targetUser, thirdPersonName, stickersText, role) {
  if (!checkSenderProfileReady()) return;
  const subject = "Lutra 2026 3 fős körcsere egyeztetés";
  const msg = role === 'B' ?
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 oldalon egy 3 fős körcsere lehetőséget találtam:\n1. Én adom neked: ${stickersText}\n2. Te adsz ${thirdPersonName}-nek matricát\n3. ${thirdPersonName} pedig ad nekem.\n\nMit szólsz, összehozzuk a körcserét?\n\nÜdvözlettel,\n${myProfile.nev}` :
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 oldalon egy 3 fős körcsere lehetőséget találtam, amiben te tudnád nekem adni: ${stickersText}, cserébe ${thirdPersonName} adna neked matricát.\n\nÉrdekelne a körcsere?\n\nÜdvözlettel,\n${myProfile.nev}`;

  setupContactModal(targetUser, msg, subject);
}

function openDirectContactModal(targetUser, numsStr, isGift) {
  if (!checkSenderProfileReady()) return;
  const subject = "Lutra 2026 matrica érdeklődés";
  const msg = isGift ?
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 platformon láttam, hogy ajándékba felajánlod a dupláidat. Szeretném elkérni az alábbi matricá(ka)t: ${numsStr}.\n\nHogyan tudnánk lebonyolítani?\n\nÜdvözlettel,\n${myProfile.nev}` :
    `Szia ${targetUser.nev}!\n\nA Lutra platformon láttam, hogy nálad megvannak az alábbi matricák: ${numsStr}.\n\nSzeretnék érdeklődni, hogy tudnánk-e cserélni rájuk.\n\nÜdvözlettel,\n${myProfile.nev}`;

  setupContactModal(targetUser, msg, subject);
}

safeAddListener('btn-send-message', () => {
  const messageText = document.getElementById('contact-msg-input')?.value.trim() || '';
  if (!messageText) return showToast("Kérlek írj be egy üzenetet!");

  const loader = document.getElementById('contact-send-loader');
  const sendBtn = document.getElementById('btn-send-message');
  if (loader) loader.style.display = 'block';
  if (sendBtn) sendBtn.disabled = true;

  (async () => {
    try {
      if (db && currentUser) {
        await db.collection("messages").add({
          fromUid: currentUser.uid,
          fromName: myProfile.nev,
          fromCity: myProfile.telepules || '',
          toUid: activeContactTarget.uid,
          toName: activeContactTarget.nev,
          subject: activeContactTarget.subject,
          message: messageText,
          text: messageText,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
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
      } catch (e) {
        console.warn("Értesítési e-mail figyelmeztetés:", e);
      }

      showToast("Üzeneted sikeresen elküldve a partnernek!");
      document.getElementById('modal-contact')?.classList.remove('open');
    } catch (err) {
      showToast("Küldési hiba: " + err.message);
    } finally {
      if (loader) loader.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
    }
  })();
});

safeAddListener('btn-close-contact', () => {
  document.getElementById('modal-contact')?.classList.remove('open');
});

safeAddListener('btn-copy-msg', () => {
  const val = document.getElementById('contact-msg-input')?.value || '';
  navigator.clipboard.writeText(val);
  showToast("Üzenet kimásolva a vágólapra!");
});

safeAddListener('btn-copy-partner-email', () => {
  const email = document.getElementById('contact-partner-email')?.textContent || '';
  if (!email) return showToast("Nincs másolható e-mail cím.");
  navigator.clipboard.writeText(email);
  showToast("Partner e-mail címe kimásolva a vágólapra.");
});

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

  const list = activeInboxTab === 'inbox' ? myIncomingMessages : myOutgoingMessages;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="card" style="text-align:center; padding:24px;">
        <h3 style="margin:0 0 4px;">Nincs ${activeInboxTab === 'inbox' ? 'beérkező' : 'elküldött'} üzeneted</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">
          ${activeInboxTab === 'inbox' ? 'Amikor egy másik gyűjtő ajánlatot küld neked, az itt fog megjelenni.' : 'Még nem küldtél csereajánlatot senkinek.'}
        </p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(msg => {
    const isIncoming = activeInboxTab === 'inbox';
    const partnerName = isIncoming ? msg.fromName : msg.toName;
    const partnerCity = isIncoming ? (msg.fromCity ? `(${msg.fromCity})` : '') : '';
    const dateStr = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';

    return `
      <div class="message-card ${isIncoming ? 'incoming' : 'outgoing'}">
        <div class="message-header">
          <div>
            <strong>${isIncoming ? 'Feladó:' : 'Címzett:'} ${escapeHtml(partnerName)} ${escapeHtml(partnerCity)}</strong>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
        </div>
        <div class="message-body">${escapeHtml(msg.message || msg.text || '')}</div>
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
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'reply-message') {
    const targetUser = { id: btn.dataset.senderUid, nev: btn.dataset.senderName };
    setupContactModal(targetUser, `Szia ${targetUser.nev}!\n\nKöszönöm a megkeresést. `, `Válasz: Lutra csere`);
  } else if (btn.dataset.action === 'delete-message') {
    if (!confirm("Biztosan törölni szeretnéd ezt az üzenetet a saját listádból?")) return;
    (async () => {
      try {
        const msgId = btn.dataset.msgId;
        const isIncoming = activeInboxTab === 'inbox';
        
        await db.collection("messages").doc(msgId).update({
          [isIncoming ? "deletedByRecipient" : "deletedBySender"]: true
        });
        
        showToast("Üzenet eltávolítva a listádból.");
      } catch (err) {
        showToast("Hiba: " + err.message);
      }
    })();
  }
});

// =========================================================================
// GYŰJTŐ ADATLAP MODAL (KEDVENCEK MEGJELENÍTÉSÉVEL)
// =========================================================================
function openUserProfileModal(uid) {
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return showToast("Gyűjtő adatai nem találhatók.");

  const modal = document.getElementById('modal-user-profile');
  if (!modal) return;

  const nameEl = document.getElementById('user-profile-modal-name');
  const cityEl = document.getElementById('user-profile-modal-city');
  if (nameEl) nameEl.textContent = `Gyűjtő: ${targetUser.nev || 'Névtelen'}`;
  if (cityEl) cityEl.textContent = targetUser.telepules ? `Település: ${targetUser.telepules}` : 'Nincs megadva település';

  const favBox = document.getElementById('user-profile-favorites-box');
  const favText = document.getElementById('user-profile-favorites-text');
  const favs = ensureArray(targetUser.favorites || []);

  if (favBox && favText) {
    if (favs.length > 0) {
      const medals = ['1.', '2.', '3.'];
      favText.innerHTML = favs.map((n, i) => `${medals[i]} #${n} ${escapeHtml(STICKER_NAMES[n] || '')}`).join(' • ');
      favBox.style.display = 'block';
    } else {
      favBox.style.display = 'none';
    }
  }

  const mBox = document.getElementById('user-profile-missing-tags');
  const vBox = document.getElementById('user-profile-van-tags');

  if (mBox) {
    if (targetUser.allowInspect === false) {
      mBox.innerHTML = '<em style="color:var(--text-muted);">A gyűjtő elrejtette a hiányzóinak listáját.</em>';
    } else if (!targetUser.kell || targetUser.kell.length === 0) {
      mBox.innerHTML = '<span style="color:var(--amber);">Minden matrica megvan neki!</span>';
    } else {
      mBox.innerHTML = targetUser.kell
        .sort((a, b) => a - b)
        .map(n => `<span style="display:inline-block; margin:2px 4px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:999px; border:1px solid rgba(243,238,223,0.2);">#${n} ${escapeHtml(STICKER_NAMES[n] || '')}</span>`)
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
          return `<span style="display:inline-block; margin:2px 4px; background:rgba(216,155,74,0.2); color:var(--sand); padding:2px 8px; border-radius:999px; border:1px solid var(--amber);">#${n}${q} ${escapeHtml(STICKER_NAMES[n] || '')}</span>`;
        })
        .join('');
    }
  }

  modal.classList.add('open');
}

safeAddListener('btn-close-user-profile', () => {
  document.getElementById('modal-user-profile')?.classList.remove('open');
});

safeAddListener('btn-close-user-profile-2', () => {
  document.getElementById('modal-user-profile')?.classList.remove('open');
});

document.getElementById('modal-user-profile')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-user-profile') {
    e.target.classList.remove('open');
  }
});

function triggerTopNotification(iconOrText, textOrActionFn, actionFn) {
  const banner = document.getElementById('top-notification-banner');
  const iconEl = document.getElementById('top-banner-icon');
  const textEl = document.getElementById('top-banner-text');
  const actionBtn = document.getElementById('btn-top-banner-action');
  const closeBtn = document.getElementById('btn-top-banner-close');

  if (!banner || !textEl) return;

  let icon = '';
  let text = '';
  let fn = null;

  if (typeof textOrActionFn === 'function') {
    text = iconOrText || '';
    fn = textOrActionFn;
  } else {
    icon = iconOrText || '';
    text = textOrActionFn || '';
    fn = actionFn;
  }

  if (iconEl) {
    iconEl.textContent = icon;
    iconEl.style.display = icon ? 'inline' : 'none';
  }
  textEl.textContent = text;
  banner.style.display = 'flex';

  if (actionBtn) {
    actionBtn.onclick = () => {
      banner.style.display = 'none';
      if (fn) fn();
    };
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
    if (badge) {
      if (myIncomingMessages.length > 0) {
        badge.textContent = myIncomingMessages.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    if (badgeM) {
      if (myIncomingMessages.length > 0) {
        badgeM.textContent = myIncomingMessages.length;
        badgeM.style.display = 'inline-block';
      } else {
        badgeM.style.display = 'none';
      }
    }
    updateCserebereBadge();
    renderMessages();
  };

  const unsubIn = db.collection("messages").where("toUid", "==", uid).onSnapshot(snap => {
    const isInitial = (previousIncomingCount === null);
    const newCount = snap.docs.length;

    if (!isInitial && newCount > previousIncomingCount) {
      if ("vibrate" in navigator) {
        navigator.vibrate([180, 90, 180]);
      }
      triggerTopNotification("Új belső üzeneted érkezett egy cserepartnertől!", () => switchView('uzeneteim'));
      showToast("Új üzeneted érkezett!");
    }
    previousIncomingCount = newCount;

    myIncomingMessages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.deletedByRecipient !== true);
    refresh();
  }, err => console.error("messages listener:", err));

  const unsubOut = db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(m => m.deletedBySender !== true);
    refresh();
  }, err => console.error("messages listener:", err));

  messagesUnsubscribe = () => { unsubIn(); unsubOut(); };
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

  if (relevant.format === 'popup' || relevant.format === 'both') {
    const dismissedKey = `dismissed_announcement_${relevant.id}`;
    if (!localStorage.getItem(dismissedKey)) {
      showAnnouncementModal(relevant);
    }
  }
}

function showAnnouncementModal(announcement) {
  const modal = document.getElementById('modal-announcement');
  if (!modal) return;
  const titleEl = document.getElementById('announcement-modal-title');
  const bodyEl = document.getElementById('announcement-modal-body');

  if (titleEl) titleEl.textContent = announcement.title;
  if (bodyEl) bodyEl.textContent = announcement.content;

  modal.classList.add('open');

  const closeFn = () => {
    const dontShow = document.getElementById('announcement-dont-show');
    if (dontShow && dontShow.checked) {
      localStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true');
    }
    modal.classList.remove('open');
  };

  const btnClose = document.getElementById('btn-close-announcement');
  const btnOk = document.getElementById('btn-close-announcement-ok');
  if (btnClose) btnClose.onclick = closeFn;
  if (btnOk) btnOk.onclick = closeFn;
}

safeAddListener('btn-admin-preview-msg', () => {
  const title = document.getElementById('admin-msg-title')?.value.trim() || 'Előnézeti Cím';
  const content = document.getElementById('admin-msg-content')?.value.trim() || 'Ez egy előnézeti üzenet szövege.';
  const link = document.getElementById('admin-msg-link')?.value.trim();
  const type = document.getElementById('admin-msg-type')?.value || 'event';

  let fullContent = content;
  if (link) fullContent += `\n\nLink: ${link}`;

  showAnnouncementModal({
    id: 'preview',
    title,
    content: fullContent,
    type
  });
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

  if (!title || !content) return showToast("Add meg az üzenet címét és szövegét!");

  try {
    let finalContent = content;
    if (link) finalContent += `\n\nLink: ${link}`;

    await db.collection("announcements").add({
      title,
      content: finalContent,
      link,
      expiryDate: expiry ? new Date(expiry) : null,
      type,
      format,
      targetCity: city,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (document.getElementById('admin-msg-title')) document.getElementById('admin-msg-title').value = '';
    if (document.getElementById('admin-msg-content')) document.getElementById('admin-msg-content').value = '';
    if (document.getElementById('admin-msg-link')) document.getElementById('admin-msg-link').value = '';
    if (document.getElementById('admin-msg-expiry')) document.getElementById('admin-msg-expiry').value = '';
    showToast("Rendszerüzenet sikeresen élesítve.");
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
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
  })();
});

safeAddListener('btn-open-reset', () => document.getElementById('modal-reset')?.classList.add('open'));
safeAddListener('btn-close-reset', () => document.getElementById('modal-reset')?.classList.remove('open'));
safeAddListener('btn-reset-van', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Duplák törölve.");
});
safeAddListener('btn-reset-kell', () => {
  myProfile.kell = [];
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Hiányzók törölve.");
});
safeAddListener('btn-reset-foglalva', () => {
  myProfile.foglalva = [];
  myProfile.foglalvaCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Foglaltak törölve.");
});
safeAddListener('btn-reset-all', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  myProfile.kell = [];
  myProfile.foglalva = [];
  myProfile.foglalvaCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Összes adat törölve.");
});

function downloadCertificateImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#0D2E2C');
  grad.addColorStop(1, '#081B1A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 800);

  ctx.strokeStyle = '#D89B4A';
  ctx.lineWidth = 10;
  ctx.strokeRect(30, 30, 1140, 740);

  ctx.strokeStyle = '#FFD166';
  ctx.lineWidth = 2;
  ctx.strokeRect(45, 45, 1110, 710);

  ctx.textAlign = 'center';
  
  ctx.fillStyle = '#D89B4A';
  ctx.font = 'bold 32px "Work Sans", sans-serif';
  ctx.fillText('WWF MAGYARORSZÁG & LIDL 2026', 600, 120);

  ctx.font = 'bold 54px Georgia, serif';
  ctx.fillStyle = '#FFD166';
  ctx.fillText('BOLYGÓVÉDŐ SZUPERHŐS OKLEVÉL', 600, 200);

  ctx.font = '24px "Work Sans", sans-serif';
  ctx.fillStyle = '#E3D5B8';
  ctx.fillText('Ezennel tanúsítjuk, hogy', 600, 290);

  ctx.font = 'bold 64px "Work Sans", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(myProfile.nev || 'Gyűjtő', 600, 390);

  ctx.strokeStyle = '#D89B4A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(350, 420);
  ctx.lineTo(850, 420);
  ctx.stroke();

  ctx.font = '28px "Work Sans", sans-serif';
  ctx.fillStyle = '#E3D5B8';
  ctx.fillText('sikeresen összegyűjtötte a 2026-os Lidl Lutra album', 600, 480);
  ctx.fillText('mind a 108 állat- és természetvédelmi matricáját!', 600, 525);

  ctx.font = 'italic 22px "Work Sans", sans-serif';
  ctx.fillStyle = '#9FB3A3';
  ctx.fillText(`Kelt: ${new Date().toLocaleDateString('hu-HU')} • Lutra Csereplatform`, 600, 640);

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
safeAddListener('btn-close-cert-2', () => document.getElementById('modal-certificate')?.classList.remove('open'));
safeAddListener('btn-cert-share-fb', () => {
  navigator.clipboard.writeText(`Betelt a 2026-os Lidl Lutra albumom! Mind a 108 matrica megvan! ${window.location.href}`);
  showToast("Szöveg másolva a vágólapra.");
});

safeAddListener('btn-open-auth', () => document.getElementById('modal-auth')?.classList.add('open'));
safeAddListener('btn-close-auth', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', () => switchView('profil'));

// 200 KARAKTERES PRIVÁT JEGYZETTÖMB
const noteTextarea = document.getElementById('prof-private-note');
if (noteTextarea) {
  noteTextarea.value = myProfile.privateNote;
  const countEl = document.getElementById('note-char-count');
  if (countEl) countEl.textContent = `${myProfile.privateNote.length}/200`;
  noteTextarea.addEventListener('input', (e) => {
    myProfile.privateNote = e.target.value.slice(0, 200);
    if (countEl) countEl.textContent = `${myProfile.privateNote.length}/200`;
    localStorage.setItem('lutra_private_note', myProfile.privateNote);
  });
}

safeAddListener('btn-save-profile', () => {
  if (!currentUser) return showToast("Előbb lépj be a fiókodba!");
  const nev = document.getElementById('prof-nev')?.value.trim() || '';
  const tel = document.getElementById('prof-telepules')?.value.trim() || '';
  const em = document.getElementById('prof-email')?.value.trim() || '';
  const gdpr = document.getElementById('prof-gdpr')?.checked;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nev) return showToast("A megjelenő név megadása kötelező!");
  if (!tel) return showToast("A település megadása kötelező a helyi cserékhez!");
  if (!em || !emailRegex.test(em)) return showToast("Kérlek adj meg egy érvényes e-mail címet!");
  if (!gdpr) return showToast("A cserékhez el kell fogadnod az adatkezelést!");

  const f1 = parseInt(document.getElementById('prof-fav-1')?.value || '0', 10);
  const f2 = parseInt(document.getElementById('prof-fav-2')?.value || '0', 10);
  const f3 = parseInt(document.getElementById('prof-fav-3')?.value || '0', 10);

  if (!f1 || !f2 || !f3 || f1 < 1 || f2 < 1 || f3 < 1) {
    return showToast("Kérlek válaszd ki mind a 3 kedvenc állatodat!");
  }

  myProfile.favorites = [f1, f2, f3];
  myProfile.nev = nev;
  myProfile.telepules = tel;
  myProfile.email = em;
  myProfile.isGiftOffering = document.getElementById('prof-gift')?.checked || false;
  myProfile.showEmailToUsers = document.getElementById('prof-show-email')?.checked || false;
  myProfile.emailNotifications = document.getElementById('prof-email-notif')?.checked !== false;
  myProfile.allowInspect = document.getElementById('prof-allow-inspect')?.checked || false;
  myProfile.gdprAccepted = true;

  (async () => {
    try {
      const batch = db.batch();

      const userRef = db.collection("users").doc(currentUser.uid);
      batch.set(userRef, {
        nev: myProfile.nev,
        telepules: myProfile.telepules,
        email: myProfile.email,
        privateNote: myProfile.privateNote,
        favorites: myProfile.favorites,
        isGiftOffering: myProfile.isGiftOffering,
        showEmailToUsers: myProfile.showEmailToUsers,
        emailNotifications: myProfile.emailNotifications,
        allowInspect: myProfile.allowInspect,
        gdprAccepted: true,
        van: myProfile.van,
        vanCounts: myProfile.vanCounts,
        kell: myProfile.kell,
        foglalva: myProfile.foglalva,
        foglalvaCounts: myProfile.foglalvaCounts || {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const publicRef = db.collection("public_profiles").doc(currentUser.uid);
      batch.set(publicRef, {
        nev: myProfile.nev,
        nickname: myProfile.nev,
        telepules: myProfile.telepules,
        city: myProfile.telepules,
        email: myProfile.showEmailToUsers ? myProfile.email : '',
        notifyEmail: myProfile.email,
        favorites: myProfile.favorites,
        isGiftOffering: myProfile.isGiftOffering,
        showEmailToUsers: myProfile.showEmailToUsers,
        emailNotifications: myProfile.emailNotifications,
        allowInspect: myProfile.allowInspect,
        gdprAccepted: true,
        van: myProfile.van,
        vanCounts: myProfile.vanCounts,
        kell: myProfile.kell,
        foglalva: myProfile.foglalva,
        foglalvaCounts: myProfile.foglalvaCounts || {},
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();

      checkMandatoryProfile();
      showToast("Profil adatok & Kedvencek elmentve.");
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
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
  })();
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
      currentUser = user;
      const authArea = document.getElementById('auth-area');
      const guestNotice = document.getElementById('guest-notice');
      const adminTab = document.getElementById('tab-admin');
      const adminTabM = document.getElementById('tab-admin-m');

      if (user) {
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
        listenToMyProfile(user.uid);
        listenToMyMessages(user.uid);
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
      } else {
        if (myDocUnsubscribe) myDocUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (adminTab) adminTab.style.display = 'none';
        if (adminTabM) adminTabM.style.display = 'none';
        myIncomingMessages = [];
        myOutgoingMessages = [];

        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();

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
      showToast("Sikeresen leiratkoztál az e-mail értesítőkről. A profilodban bármikor visszakapcsolhatod.");
    }
  }
}

function checkMandatoryProfile() {
  const warning = document.getElementById('profile-warning');
  const favs = ensureArray(myProfile.favorites || []);
  const isFavoritesMissing = favs.length < 3 || favs.some(n => !n || n < 1);

  const isMissing = !myProfile.nev || !myProfile.nev.trim() || myProfile.nev === 'Vendég gyűjtő' ||
                    !myProfile.telepules || !myProfile.telepules.trim() ||
                    !myProfile.email || !myProfile.email.trim() || !myProfile.gdprAccepted || isFavoritesMissing;

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
    allUsersData = [];
    snapshot.forEach(doc => {
      const parsedUser = extractUserData(doc.data(), doc.id);
      if (!parsedUser) return;
      if (parsedUser.van.length === 0 && parsedUser.kell.length === 0) return;
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
    const parsed = extractUserData(merged, uid);

    if (parsed) {
      myProfile = {
        ...myProfile,
        nev: parsed.nev,
        telepules: parsed.telepules,
        email: getFirstValidString(userData?.email, pubData?.email, myProfile.email),
        privateNote: userData?.privateNote || localStorage.getItem('lutra_private_note') || '',
        favorites: parsed.favorites || ensureArray(safeJsonParse('lutra_favorites', [9, 4, 35])),
        isGiftOffering: parsed.isGiftOffering,
        showEmailToUsers: parsed.showEmailToUsers,
        emailNotifications: parsed.emailNotifications !== false,
        allowInspect: parsed.allowInspect,
        gdprAccepted: parsed.gdprAccepted,
        van: parsed.van,
        kell: parsed.kell,
        foglalva: parsed.foglalva,
        vanCounts: parsed.vanCounts,
        foglalvaCounts: parsed.foglalvaCounts || {}
      };

      localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
      localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
      localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
      localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
      localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
      localStorage.setItem('lutra_favorites', JSON.stringify(myProfile.favorites));

      renderGrid();
      renderAlbumChapter();

      const nI = document.getElementById('prof-nev'); if (nI) nI.value = myProfile.nev || '';
      const tI = document.getElementById('prof-telepules'); if (tI) tI.value = myProfile.telepules || '';
      const eI = document.getElementById('prof-email'); if (eI) eI.value = myProfile.email || '';
      const gI = document.getElementById('prof-gift'); if (gI) gI.checked = !!myProfile.isGiftOffering;
      const seI = document.getElementById('prof-show-email'); if (seI) seI.checked = !!myProfile.showEmailToUsers;
      const enI = document.getElementById('prof-email-notif'); if (enI) enI.checked = myProfile.emailNotifications !== false;
      const aiI = document.getElementById('prof-allow-inspect'); if (aiI) aiI.checked = myProfile.allowInspect !== false;
      const gdI = document.getElementById('prof-gdpr'); if (gdI) gdI.checked = !!myProfile.gdprAccepted;

      initFavoriteSelects();
      if (myProfile.favorites) {
        if (document.getElementById('prof-fav-1')) document.getElementById('prof-fav-1').value = myProfile.favorites[0] || '';
        if (document.getElementById('prof-fav-2')) document.getElementById('prof-fav-2').value = myProfile.favorites[1] || '';
        if (document.getElementById('prof-fav-3')) document.getElementById('prof-fav-3').value = myProfile.favorites[2] || '';
      }

      const pNoteEl = document.getElementById('prof-private-note');
      if (pNoteEl) {
        pNoteEl.value = myProfile.privateNote;
        const countEl = document.getElementById('note-char-count');
        if (countEl) countEl.textContent = `${myProfile.privateNote.length}/200`;
      }

      checkMandatoryProfile();
      refreshMatchesIfVisible();
      renderCompletionOdds();
    }
  });
}

safeAddListener('btn-google-login', () => {
  if (!auth) return;
  (async () => {
    try {
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      showToast("Sikeres belépés.");
    } catch (e) { showToast(e.message); }
  })();
});

safeAddListener('btn-email-login', () => {
  if (!auth) return;
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  (async () => {
    try {
      await auth.signInWithEmailAndPassword(em, pw);
      showToast("Sikeres belépés.");
    } catch (e) { showToast("Hibás belépési adatok."); }
  })();
});

safeAddListener('btn-email-signup', () => {
  if (!auth) return;
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  if (pw.length < 6) return showToast("A jelszónak legalább 6 karakteresnek kell lennie.");
  (async () => {
    try {
      await auth.createUserWithEmailAndPassword(em, pw);
      showToast("Sikeres regisztráció.");
    } catch (e) { showToast(e.message); }
  })();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'inline-flex';
});

safeAddListener('btn-pwa-install', () => {
  if (deferredPrompt) {
    (async () => {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        const btn = document.getElementById('btn-pwa-install');
        if (btn) btn.style.display = 'none';
      }
      deferredPrompt = null;
    })();
  } else {
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      showToast("iPhone-on: Kattints a Megosztás (négyzetből felfelé nyíl) gombra, majd válaszd a 'Főképernyőhöz adás' lehetőséget.");
    } else {
      showToast("PC-n: Kattints a böngésző címsorának jobb szélén lévő telepítés ikonra.");
    }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn("SW regisztráció:", err));
  });
}

// Globális képnagyító (Lightbox) kezelő
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

// Lightbox bezárása kattintásra
document.getElementById('modal-image-lightbox')?.addEventListener('click', () => {
  document.getElementById('modal-image-lightbox')?.classList.remove('open');
});

// Biztonsági inicializálás
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderGrid();
  renderAlbumChapter();
  initFavoriteSelects();
  initFirebase();
} catch (err) {
  console.error("Indítási hiba:", err);
}
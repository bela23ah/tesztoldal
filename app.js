// =========================================================================
// Lutra Album Cserebere (Lidl 2026) - app.js (v2.3 Teljes Kód - 1. RÉSZ)
// =========================================================================

const ALBUM_SIZE = 108;
const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// Biztonsági eseménykezelő segédfüggvény (Crash-Proof DOM handling)
function safeAddListener(id, event, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, handler);
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
  const email = getFirstValidString(data.email, data.mail);

  const rawVan = data.van || data.duplicates || data.duplak || [];
  const van = ensureArray(rawVan);

  const rawKell = data.kell || data.missing || data.hianyzo || [];
  const kell = ensureArray(rawKell);

  const rawFoglalva = data.foglalva || data.reserved || [];
  const foglalva = ensureArray(rawFoglalva);

  const vanCounts = (data.vanCounts && typeof data.vanCounts === 'object') ? data.vanCounts : {};
  const foglalvaCounts = (data.foglalvaCounts && typeof data.foglalvaCounts === 'object') ? data.foglalvaCounts : {};
  const isGiftOffering = data.isGiftOffering === true || data.isGift === true;
  const showEmailToUsers = data.showEmailToUsers === true;
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
    vanCounts,
    foglalvaCounts,
    isGiftOffering,
    showEmailToUsers,
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
  allowInspect: true,
  gdprAccepted: false,
  privateNote: localStorage.getItem('lutra_private_note') || '',
  van: ensureArray(safeJsonParse('lutra_van', [])),
  vanCounts: safeJsonParse('lutra_van_counts', {}),
  kell: ensureArray(safeJsonParse('lutra_kell', [])),
  foglalva: ensureArray(safeJsonParse('lutra_foglalva', [])),
  foglalvaCounts: safeJsonParse('lutra_foglalva_counts', {})
};

let allUsersData = [];
let myIncomingMessages = [];
let myOutgoingMessages = [];
let radarReports = [];
let meetupEvents = [];
let activeAnnouncements = [];
let previousIncomingCount = null;
let previousRadarCount = null;
let radarAttachedBase64 = '';
let meetupAttachedBase64 = '';

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

// Város koordináták a hőtérképhez
const CITY_COORDINATES = {
  "budapest": { x: 49, y: 40 },
  "győr": { x: 26, y: 32 },
  "gyor": { x: 26, y: 32 },
  "sopron": { x: 14, y: 32 },
  "szombathely": { x: 15, y: 52 },
  "zalaegerszeg": { x: 20, y: 65 },
  "veszprém": { x: 35, y: 48 },
  "veszprem": { x: 35, y: 48 },
  "székesfehérvár": { x: 41, y: 46 },
  "szekesfehervar": { x: 41, y: 46 },
  "pécs": { x: 36, y: 82 },
  "pecs": { x: 36, y: 82 },
  "kaposvár": { x: 30, y: 72 },
  "kaposvar": { x: 30, y: 72 },
  "szekszárd": { x: 44, y: 72 },
  "szekszard": { x: 44, y: 72 },
  "kecskemét": { x: 55, y: 58 },
  "kecskemet": { x: 55, y: 58 },
  "szeged": { x: 64, y: 80 },
  "békéscsaba": { x: 80, y: 68 },
  "bekescsaba": { x: 80, y: 68 },
  "szolnok": { x: 62, y: 48 },
  "debrecen": { x: 83, y: 35 },
  "nyíregyháza": { x: 86, y: 22 },
  "nyiregyhaza": { x: 86, y: 22 },
  "miskolc": { x: 70, y: 20 },
  "eger": { x: 64, y: 28 },
  "salgótarján": { x: 54, y: 20 },
  "salgotarjan": { x: 54, y: 20 },
  "tatabánya": { x: 38, y: 34 },
  "tatabanya": { x: 38, y: 34 },
  "érd": { x: 47, y: 43 },
  "erd": { x: 47, y: 43 }
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
let lastToggleTime = 0;
let lastToggleNum = 0;

function toggleStickerState(num) {
  const now = Date.now();
  if (lastToggleNum === num && (now - lastToggleTime) < 300) return;
  lastToggleTime = now;
  lastToggleNum = num;

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
    longPressTimer = setTimeout(() => {
      isLongPress = true;
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }, 450);
  }, { passive: true });

  container.addEventListener('touchend', () => clearTimeout(longPressTimer));
  container.addEventListener('touchmove', () => clearTimeout(longPressTimer));

  container.addEventListener('click', (e) => {
    if (isLongPress) {
      isLongPress = false;
      return;
    }
    const target = e.target.closest('[data-num]');
    if (target) {
      toggleStickerState(parseInt(target.dataset.num, 10));
    }
  });
}

function saveMyState() {
  myProfile.van = ensureArray(myProfile.van);
  myProfile.kell = ensureArray(myProfile.kell).filter(n => !myProfile.van.includes(n));
  myProfile.foglalva = ensureArray(myProfile.foglalva).filter(n => !myProfile.van.includes(n) && !myProfile.kell.includes(n));

  localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
  localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
  localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
  localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
  
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
      allowInspect: myProfile.allowInspect !== false,
      gdprAccepted: true,
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

safeAddListener('btn-toggle-batch', 'click', () => {
  const box = document.getElementById('batch-input-box');
  if (box) box.style.display = box.style.display === 'block' ? 'none' : 'block';
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

safeAddListener('btn-apply-batch-van', 'click', () => {
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

safeAddListener('btn-apply-batch-kell', 'click', () => {
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

safeAddListener('btn-apply-batch-foglalva', 'click', () => {
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

safeAddListener('btn-copy-fb-post', 'click', () => {
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

safeAddListener('btn-mode-grid', 'click', () => {
  document.getElementById('btn-mode-grid')?.classList.add('active');
  document.getElementById('btn-mode-album')?.classList.remove('active');
  if (document.getElementById('grid-view-container')) document.getElementById('grid-view-container').style.display = 'block';
  if (document.getElementById('album-view-container')) document.getElementById('album-view-container').style.display = 'none';
  renderGrid();
});

safeAddListener('btn-mode-album', 'click', () => {
  document.getElementById('btn-mode-album')?.classList.add('active');
  document.getElementById('btn-mode-grid')?.classList.remove('active');
  if (document.getElementById('grid-view-container')) document.getElementById('grid-view-container').style.display = 'none';
  if (document.getElementById('album-view-container')) document.getElementById('album-view-container').style.display = 'block';
  renderAlbumChapter();
});

safeAddListener('btn-album-prev', 'click', () => {
  if (currentChapterIndex > 0) { currentChapterIndex--; renderAlbumChapter(); }
});

safeAddListener('btn-album-next', 'click', () => {
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

function switchTab(viewName) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetTab = document.querySelector(`.tab[data-view="${viewName}"]`);
  if (targetTab) targetTab.classList.add('active');
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');

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
    if (mBadge) mBadge.style.display = 'none';
  }
  if (viewName === 'uzeneteim') {
    renderMessages();
    const badge = document.getElementById('unread-msg-badge');
    if (badge) badge.classList.add('read');
  }
  if (viewName === 'matricaim') {
    renderGrid();
    renderAlbumChapter();
  }
  if (viewName === 'admin') renderAdminAnnouncements();
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.view));
});

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

safeAddListener('btn-refresh-matches', 'click', () => {
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

    const giveToB = [...myVanSet].filter(n => bKellSet.has(n) && !bVanSet.has(n));
    if (giveToB.length === 0) continue;

    for (let j = 0; j < otherUsers.length; j++) {
      if (i === j) continue;
      const userC = otherUsers[j];
      const cVanSet = new Set(ensureArray(userC.van));
      const cKellSet = new Set(ensureArray(userC.kell).filter(n => !cVanSet.has(n)));

      const giveBtoC = [...bVanSet].filter(n => cKellSet.has(n) && !cVanSet.has(n));
      if (giveBtoC.length === 0) continue;

      const giveCtoMe = [...cVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n));
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
        <span>🔄 <strong>Körcsere javaslat:</strong> Te adsz B-nek, B ad C-nek, C pedig ad Neked!</span>
      </div>
      ${loops.slice(0, 10).map((l, loopIdx) => `
        <div class="card ${l.isLocalLoop ? 'card-local' : ''}">
          <div class="card-header-row">
            <h3 style="margin:0;">Körcsere: Te ➔ ${escapeHtml(l.userB.nev || 'B')} ➔ ${escapeHtml(l.userC.nev || 'C')} ➔ Te</h3>
            ${l.isLocalLoop ? '<span class="badge-local">📍 Helyi csere</span>' : ''}
          </div>
          <div style="font-size:0.85rem; margin:8px 0; background:rgba(0,0,0,0.25); padding:8px; border-radius:var(--radius-sm); line-height:1.6;">
            <p style="margin:0;">1️⃣ <strong>Te adsz neki:</strong> ${escapeHtml(l.userB.nev)} (${escapeHtml(l.userB.telepules || '')}) ➔ ${l.giveToB.map(n => `#${n}`).join(', ')}</p>
            <p style="margin:0;">2️⃣ <strong>Ő ad tovább:</strong> ${escapeHtml(l.userB.nev)} ad ${escapeHtml(l.userC.nev)}-nek ➔ ${l.giveBtoC.map(n => `#${n}`).join(', ')}</p>
            <p style="margin:0; color:var(--moss-soft);">3️⃣ <strong>Te kapsz tőle:</strong> ${escapeHtml(l.userC.nev)} (${escapeHtml(l.userC.telepules || '')}) ➔ ${l.giveCtoMe.map(n => `#${n}`).join(', ')}</p>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn" style="flex:1; font-size:0.8rem;" data-action="contact-loop-b" data-loop-idx="${loopIdx}">
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
      const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n));
      const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n));
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

  list.innerHTML = matches.map((m) => `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''} 🔍
          </h3>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${m.isSameCity ? '<span class="badge-local">📍 Helyi csere</span>' : ''}
          ${m.isGift ? '<span class="badge-gift">🎁 Ingyen felajánló</span>' : ''}
          <span class="badge-ratio">${m.give.length} db ⇄ ${m.get.length} db</span>
        </div>
      </div>
      <p style="margin:4px 0;"><strong>Te adnád neki:</strong> ${m.give.length ? m.give.map(n => `#${n}`).join(', ') : '<em>(Ajándékba kapod)</em>'}</p>
      <p style="margin:4px 0;"><strong>Ő adná neked:</strong> ${m.get.map(n => {
        const qty = (m.vanCounts && m.vanCounts[n] > 1) ? ` (${m.vanCounts[n]} db)` : '';
        return `#${n}${qty}`;
      }).join(', ')}</p>
      <div style="display:flex; gap:8px; margin-top:8px;">
        <button class="btn" data-action="contact-match" data-uid="${escapeHtml(m.id)}" style="flex:1;">
          Kapcsolatfelvétel
        </button>
        <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
          Adatlap
        </button>
      </div>
    </div>
  `).join('');
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
    const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n));
    const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n));
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

safeAddListener('btn-search', 'click', () => {
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
  renderSearchResults(matchedNums, `Keresés: „${raw}”`);
});

safeAddListener('btn-search-all-missing', 'click', () => {
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
      const found = ensureArray(u.van).filter(n => targetSet.has(n));
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
            ${escapeHtml(u.nev || 'Névtelen')} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''} 🔍
          </h3>
          ${u.isGiftOffering ? '<span class="badge-gift">🎁 Ingyen adja</span>' : ''}
        </div>
        <p><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => `#${n} (${escapeHtml(STICKER_NAMES[n] || '')})`).join(', ')}</p>
        <button class="btn" data-action="contact-search" data-uid="${escapeHtml(u.id)}" data-found="${u.found.map(n => `#${n}`).join(', ')}">
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
// 8. ALBUMRADAR & FOTÓCSATOLÁS (10 PERCES KORLÁTTAL)
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

safeAddListener('btn-submit-radar', 'click', async () => {
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

safeAddListener('btn-refresh-radar', 'click', () => {
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
            <strong>📍 ${escapeHtml(storeLabel)}</strong>
          </div>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">
            ${r.status ? '🟢 Kapható' : '🔴 Elfogyott'}
          </span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${escapeHtml(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" onclick="window.open(this.src)">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>👤 ${escapeHtml(r.reporterName || 'Gyűjtő')} • 🕒 ${timeStr}</span>
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
        triggerTopNotification('🛒', `Új bolti készletjelentés: ${latest.city} (${latest.status ? '🟢 Kapható' : '🔴 Elfogyott'})`, () => switchTab('radar'));
      }
      previousRadarCount = newCount;

      renderRadarReports();
    }, err => console.warn("Albumradar listener:", err));
}

// =========================================================================
// 9. OFFLINE TALÁLKOZÓK & CSERENAPOK MODUL
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

safeAddListener('btn-submit-meetup', 'click', async () => {
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

safeAddListener('btn-refresh-meetups', 'click', () => {
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
        ${m.photoBase64 ? `<img src="${m.photoBase64}" class="radar-attached-img" alt="Plakát" onclick="window.open(this.src)">` : ''}
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
      if (mBadge && meetupEvents.length > 0) {
        mBadge.textContent = meetupEvents.length;
        mBadge.style.display = 'inline-block';
      }

      renderMeetups();
    }, err => console.warn("Meetups listener:", err));
}

// =========================================================================
// 10. STATISZTIKA, BEFEJEZÉSI ESÉLY & VÁROSI HŐTÉRKÉP
// =========================================================================
function renderCompletionOdds() {
  const oddsCard = document.getElementById('completion-odds-card');
  const oddsPct = document.getElementById('completion-odds-pct');
  const oddsBar = document.getElementById('completion-odds-bar');
  const oddsText = document.getElementById('completion-odds-text');

  if (!oddsCard || !oddsPct || !oddsBar || !oddsText) return;

  const myMissing = ensureArray(myProfile.kell);
  if (myMissing.length === 0) {
    oddsPct.textContent = '100%';
    oddsBar.style.width = '100%';
    oddsText.innerHTML = '<span style="color:var(--moss-soft);">Gratulálunk! Az albumod betelt! 🎉</span>';
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

  allUsersData.forEach(u => {
    const rawCity = (u.telepules || '').trim();
    if (!rawCity) return;
    const cityKey = normalizeText(rawCity);
    if (!cityStats[cityKey]) {
      cityStats[cityKey] = { name: rawCity, users: 0, duplicates: 0 };
    }
    cityStats[cityKey].users += 1;
    
    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      cityStats[cityKey].duplicates += q;
      totalPoolCount += q;
    });
  });

  const poolEl = document.getElementById('stats-total-pool-count');
  if (poolEl) poolEl.textContent = `${totalPoolCount.toLocaleString('hu-HU')} db`;

  const sortedCities = Object.values(cityStats).sort((a, b) => (b.users * 3 + b.duplicates) - (a.users * 3 + a.duplicates));

  const pinsOverlay = document.getElementById('heatmap-overlay-pins');
  if (pinsOverlay) {
    pinsOverlay.innerHTML = '';
    sortedCities.forEach(c => {
      const norm = normalizeText(c.name);
      const coords = CITY_COORDINATES[norm];
      if (coords) {
        const score = c.users * 2 + c.duplicates;
        const heatCls = score >= 20 ? 'fire' : score >= 8 ? 'warm' : 'cool';
        const size = score >= 20 ? 34 : score >= 8 ? 26 : 20;

        const pin = document.createElement('div');
        pin.className = `heat-pin ${heatCls}`;
        pin.style.left = `${coords.x}%`;
        pin.style.top = `${coords.y}%`;
        pin.style.width = `${size}px`;
        pin.style.height = `${size}px`;
        pin.title = `${c.name}: ${c.users} gyűjtő, ${c.duplicates} dupla matrica`;
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

    cityListEl.innerHTML = sortedCities.slice(0, 8).map((c, idx) => {
      const score = c.users * 2 + c.duplicates;
      const badgeCls = score >= 20 ? 'heat-chip-fire' : score >= 8 ? 'heat-chip-warm' : 'heat-chip-cool';
      const label = score >= 20 ? '🔥 Izzik a csere' : score >= 8 ? '🟡 Pörög' : '🟢 Éledezve';

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

function filterMatchesByCityName(cityName) {
  myProfile.telepules = cityName;
  switchTab('cserek');
  const cityBtn = document.getElementById('btn-match-city');
  if (cityBtn) setActiveMatchFilter(cityBtn, 'city');
  showToast(`📍 Szűrés: ${cityName}`);
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
      <span style="color:var(--moss-soft); font-size:0.8rem;">${c.supply} db dupla</span>
    </div>
  `).join('');
  const uCount = document.getElementById('stats-users-count');
  if (uCount) uCount.textContent = allUsersData.length;

  renderCompletionOdds();
  renderHeatmap();
}

safeAddListener('btn-refresh-stats', 'click', () => {
  renderStatistics();
  showToast("Statisztika és hőtérkép frissítve.");
});

// =========================================================================
// 11. FOTÓBEOLVASÓ (AI VISION PROXY)
// =========================================================================
let scannerRecognizedNums = [];

safeAddListener('btn-open-scanner', 'click', () => {
  document.getElementById('modal-scanner')?.classList.add('open');
});

function closeScannerModal() {
  document.getElementById('modal-scanner')?.classList.remove('open');
  if (document.getElementById('scanner-results-box')) document.getElementById('scanner-results-box').style.display = 'none';
  if (document.getElementById('scanner-loader')) document.getElementById('scanner-loader').style.display = 'none';
}

safeAddListener('btn-close-scanner', 'click', closeScannerModal);

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

    scannerRecognizedNums = ensureArray(data.numbers);
    scannerRecognizedNums.sort((a, b) => a - b);
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

safeAddListener('btn-scanner-add-manual', 'click', () => {
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

safeAddListener('btn-scanner-save-van', 'click', () => {
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

safeAddListener('btn-scanner-save-kell', 'click', () => {
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

safeAddListener('btn-scanner-save-foglalva', 'click', () => {
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
    switchTab('profil');
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

safeAddListener('btn-send-message', 'click', async () => {
  const messageText = document.getElementById('contact-msg-input')?.value.trim() || '';
  if (!messageText) return showToast("Kérlek írj be egy üzenetet!");

  const loader = document.getElementById('contact-send-loader');
  const sendBtn = document.getElementById('btn-send-message');
  if (loader) loader.style.display = 'block';
  if (sendBtn) sendBtn.disabled = true;

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

    showToast("✨ Üzeneted sikeresen elküldve a partnernek!");
    document.getElementById('modal-contact')?.classList.remove('open');
  } catch (err) {
    showToast("Küldési hiba: " + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
    if (sendBtn) sendBtn.disabled = false;
  }
});

safeAddListener('btn-close-contact', 'click', () => {
  document.getElementById('modal-contact')?.classList.remove('open');
});

safeAddListener('btn-copy-msg', 'click', () => {
  const val = document.getElementById('contact-msg-input')?.value || '';
  navigator.clipboard.writeText(val);
  showToast("Üzenet kimásolva a vágólapra!");
});

safeAddListener('btn-msg-tab-inbox', 'click', () => {
  activeInboxTab = 'inbox';
  document.getElementById('btn-msg-tab-inbox')?.classList.add('active');
  document.getElementById('btn-msg-tab-sent')?.classList.remove('active');
  renderMessages();
});

safeAddListener('btn-msg-tab-sent', 'click', () => {
  activeInboxTab = 'sent';
  document.getElementById('btn-msg-tab-sent')?.classList.add('active');
  document.getElementById('btn-msg-tab-inbox')?.classList.remove('active');
  renderMessages();
});

safeAddListener('btn-refresh-inbox', 'click', () => {
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
        <button class="btn" onclick="document.getElementById('modal-auth')?.classList.add('open')">Belépés / Fiók</button>
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
            <strong>${isIncoming ? '📩 Feladó:' : '📤 Címzett:'} ${escapeHtml(partnerName)} ${escapeHtml(partnerCity)}</strong>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
        </div>
        <div class="message-body">${escapeHtml(msg.message || msg.text || '')}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          ${isIncoming ? `
            <button class="btn btn-sm" data-action="reply-message" data-sender-uid="${escapeHtml(msg.fromUid)}" data-sender-name="${escapeHtml(msg.fromName)}">
              ↩️ Válasz ${escapeHtml(msg.fromName)}-nek
            </button>
          ` : '<div></div>'}
          <button class="btn btn-secondary btn-sm" data-action="delete-message" data-msg-id="${escapeHtml(msg.id)}" style="color:var(--danger); border-color:var(--danger);">
            🗑️ Törlés
          </button>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('messages-inbox-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'reply-message') {
    const targetUser = { id: btn.dataset.senderUid, nev: btn.dataset.senderName };
    setupContactModal(targetUser, `Szia ${targetUser.nev}!\n\nKöszönöm a megkeresést. `, `Válasz: Lutra csere`);
  } else if (btn.dataset.action === 'delete-message') {
    if (!confirm("Biztosan törölni szeretnéd ezt az üzenetet?")) return;
    try {
      await db.collection("messages").doc(btn.dataset.msgId).delete();
      showToast("Üzenet törölve.");
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
  }
});

function triggerTopNotification(icon, text, actionFn) {
  const banner = document.getElementById('top-notification-banner');
  const iconEl = document.getElementById('top-banner-icon');
  const textEl = document.getElementById('top-banner-text');
  const actionBtn = document.getElementById('btn-top-banner-action');
  const closeBtn = document.getElementById('btn-top-banner-close');

  if (!banner || !textEl) return;
  if (iconEl) iconEl.textContent = icon;
  textEl.textContent = text;
  banner.style.display = 'flex';

  if (actionBtn) {
    actionBtn.onclick = () => {
      banner.style.display = 'none';
      if (actionFn) actionFn();
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
    if (badge) {
      if (myIncomingMessages.length > 0) {
        badge.textContent = myIncomingMessages.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    renderMessages();
  };

  const unsubIn = db.collection("messages").where("toUid", "==", uid).onSnapshot(snap => {
    const isInitial = (previousIncomingCount === null);
    const newCount = snap.docs.length;

    if (!isInitial && newCount > previousIncomingCount) {
      if ("vibrate" in navigator) {
        navigator.vibrate([180, 90, 180]);
      }
      triggerTopNotification('📩', "Új belső üzeneted érkezett egy cserepartnertől!", () => switchTab('uzeneteim'));
      showToast("📩 Új üzeneted érkezett!");
    }
    previousIncomingCount = newCount;

    myIncomingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refresh();
  }, err => console.error("messages listener:", err));

  const unsubOut = db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    if (!a.targetCity || a.targetCity.trim() === '' || a.targetCity.toLowerCase() === 'mindenki') return true;
    return a.targetCity.toLowerCase() === myCity;
  });

  if (!relevant) return;

  if (relevant.format === 'banner' || !relevant.format) {
    const icon = relevant.type === 'event' ? '📅' : relevant.type === 'feature' ? '🚀' : '📢';
    triggerTopNotification(icon, `${relevant.title}: ${relevant.content.slice(0, 50)}...`, () => showAnnouncementModal(relevant));
  }

  if (relevant.format === 'popup') {
    const dismissedKey = `dismissed_announcement_${relevant.id}`;
    if (!localStorage.getItem(dismissedKey)) {
      showAnnouncementModal(relevant);
    }
  }
}

function showAnnouncementModal(announcement) {
  const modal = document.getElementById('modal-announcement');
  if (!modal) return;
  const iconEl = document.getElementById('announcement-modal-icon');
  const titleEl = document.getElementById('announcement-modal-title');
  const bodyEl = document.getElementById('announcement-modal-body');

  if (iconEl) iconEl.textContent = announcement.type === 'event' ? '📅' : announcement.type === 'feature' ? '🚀' : '🎉';
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

safeAddListener('btn-admin-publish-msg', 'click', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod!");
  const title = document.getElementById('admin-msg-title')?.value.trim() || '';
  const content = document.getElementById('admin-msg-content')?.value.trim() || '';
  const type = document.getElementById('admin-msg-type')?.value || 'event';
  const format = document.getElementById('admin-msg-format')?.value || 'banner';
  const city = document.getElementById('admin-msg-city')?.value.trim() || '';

  if (!title || !content) return showToast("Add meg az üzenet címét és szövegét!");

  try {
    await db.collection("announcements").add({
      title,
      content,
      type,
      format,
      targetCity: city,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (document.getElementById('admin-msg-title')) document.getElementById('admin-msg-title').value = '';
    if (document.getElementById('admin-msg-content')) document.getElementById('admin-msg-content').value = '';
    showToast("🎉 Rendszerüzenet sikeresen élesítve!");
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

safeAddListener('admin-active-announcements', 'click', async (e) => {
  const btn = e.target.closest('[data-action="deactivate-announcement"]');
  if (!btn) return;
  try {
    await db.collection("announcements").doc(btn.dataset.id).update({ active: false });
    showToast("Hír leállítva.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

safeAddListener('btn-open-reset', 'click', () => document.getElementById('modal-reset')?.classList.add('open'));
safeAddListener('btn-close-reset', 'click', () => document.getElementById('modal-reset')?.classList.remove('open'));
safeAddListener('btn-reset-van', 'click', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Duplák törölve.");
});
safeAddListener('btn-reset-kell', 'click', () => {
  myProfile.kell = [];
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Hiányzók törölve.");
});
safeAddListener('btn-reset-foglalva', 'click', () => {
  myProfile.foglalva = [];
  myProfile.foglalvaCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Foglaltak törölve.");
});
safeAddListener('btn-reset-all', 'click', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  myProfile.kell = [];
  myProfile.foglalva = [];
  myProfile.foglalvaCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Összes adat törölve.");
});

// OKLEVÉL KÉP GENERÁLÁSA ÉS LETÖLTÉSE (HTML5 CANVAS)
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
  ctx.fillText('🏆 WWF MAGYARORSZÁG & LIDL 2026 🏆', 600, 120);

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

  ctx.font = '60px sans-serif';
  ctx.fillText('🦦 🌍 🌿', 600, 720);

  const link = document.createElement('a');
  link.download = `Lutra_Szuperhos_Oklevel_${(myProfile.nev || 'Gyujto').replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast("📥 Oklevél kép letöltve!");
}

safeAddListener('btn-view-certificate', 'click', () => {
  const nameEl = document.getElementById('cert-user-name');
  const dateEl = document.getElementById('cert-date-label');
  if (nameEl) nameEl.textContent = myProfile.nev || 'Gyűjtő';
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('hu-HU');
  document.getElementById('modal-certificate')?.classList.add('open');
  if (window.confetti) confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
});

safeAddListener('btn-download-cert-img', 'click', downloadCertificateImage);
safeAddListener('btn-close-cert', 'click', () => document.getElementById('modal-certificate')?.classList.remove('open'));
safeAddListener('btn-close-cert-2', 'click', () => document.getElementById('modal-certificate')?.classList.remove('open'));
safeAddListener('btn-cert-share-fb', 'click', () => {
  navigator.clipboard.writeText(`Betelt a 2026-os Lidl Lutra albumom! Mind a 108 matrica megvan! ${window.location.href}`);
  showToast("Szöveg másolva a vágólapra!");
});

safeAddListener('btn-open-auth', 'click', () => document.getElementById('modal-auth')?.classList.add('open'));
safeAddListener('btn-close-auth', 'click', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', 'click', () => switchTab('profil'));

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

safeAddListener('btn-save-profile', 'click', async () => {
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

  myProfile.nev = nev;
  myProfile.telepules = tel;
  myProfile.email = em;
  myProfile.isGiftOffering = document.getElementById('prof-gift')?.checked || false;
  myProfile.showEmailToUsers = document.getElementById('prof-show-email')?.checked || false;
  myProfile.allowInspect = document.getElementById('prof-allow-inspect')?.checked || false;
  myProfile.gdprAccepted = true;

  try {
    const batch = db.batch();

    const userRef = db.collection("users").doc(currentUser.uid);
    batch.set(userRef, {
      nev: myProfile.nev,
      telepules: myProfile.telepules,
      email: myProfile.email,
      privateNote: myProfile.privateNote,
      isGiftOffering: myProfile.isGiftOffering,
      showEmailToUsers: myProfile.showEmailToUsers,
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
      isGiftOffering: myProfile.isGiftOffering,
      showEmailToUsers: myProfile.showEmailToUsers,
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
    showToast("Profil adatok elmentve!");
  } catch (err) {
    showToast("Mentési hiba: " + err.message);
  }
});

safeAddListener('btn-delete-account', 'click', async () => {
  if (!currentUser) return showToast("Nem vagy bejelentkezve.");
  if (!confirm("Biztosan törölni szeretnéd a fiókodat és az összes adatodat?")) return;

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

      if (user) {
        if (guestNotice) guestNotice.style.display = 'none';
        if (adminTab) adminTab.style.display = user.email === ADMIN_EMAIL ? 'inline-block' : 'none';

        if (authArea) {
          authArea.innerHTML = `
            <div class="user-badge"><span>👤 ${escapeHtml(user.displayName || user.email.split('@')[0])}</span></div>
            <button class="btn btn-secondary" id="btn-logout" style="padding:4px 10px; font-size:0.75rem;">Kilépés</button>
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
        myIncomingMessages = [];
        myOutgoingMessages = [];

        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();

        if (guestNotice) guestNotice.style.display = 'flex';
        if (authArea) authArea.innerHTML = `<button class="btn" id="btn-open-auth">Belépés / Fiók</button>`;
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
                    !myProfile.telepules || !myProfile.telepules.trim() ||
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
        isGiftOffering: parsed.isGiftOffering,
        showEmailToUsers: parsed.showEmailToUsers,
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

      renderGrid();
      renderAlbumChapter();

      const nI = document.getElementById('prof-nev'); if (nI) nI.value = myProfile.nev || '';
      const tI = document.getElementById('prof-telepules'); if (tI) tI.value = myProfile.telepules || '';
      const eI = document.getElementById('prof-email'); if (eI) eI.value = myProfile.email || '';
      const gI = document.getElementById('prof-gift'); if (gI) gI.checked = !!myProfile.isGiftOffering;
      const seI = document.getElementById('prof-show-email'); if (seI) seI.checked = !!myProfile.showEmailToUsers;
      const aiI = document.getElementById('prof-allow-inspect'); if (aiI) aiI.checked = myProfile.allowInspect !== false;
      const gdI = document.getElementById('prof-gdpr'); if (gdI) gdI.checked = !!myProfile.gdprAccepted;

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

safeAddListener('btn-google-login', 'click', async () => {
  if (!auth) return;
  try {
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    showToast("Sikeres belépés!");
  } catch (e) { showToast(e.message); }
});

safeAddListener('btn-email-login', 'click', async () => {
  if (!auth) return;
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  try {
    await auth.signInWithEmailAndPassword(em, pw);
    showToast("Sikeres belépés!");
  } catch (e) { showToast("Hibás belépési adatok!"); }
});

safeAddListener('btn-email-signup', 'click', async () => {
  if (!auth) return;
  const em = document.getElementById('auth-email')?.value.trim() || '';
  const pw = document.getElementById('auth-pass')?.value || '';
  if (pw.length < 6) return showToast("A jelszónak legalább 6 karakteresnek kell lennie!");
  try {
    await auth.createUserWithEmailAndPassword(em, pw);
    showToast("Sikeres regisztráció!");
  } catch (e) { showToast(e.message); }
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'inline-flex';
});

safeAddListener('btn-pwa-install', 'click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    const btn = document.getElementById('btn-pwa-install');
    if (btn) btn.style.display = 'none';
  }
  deferredPrompt = null;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn("SW regisztráció:", err));
  });
}

// Biztonsági inicializálás
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderGrid();
  renderAlbumChapter();
  initFirebase();
} catch (err) {
  console.error("Indítási hiba:", err);
}
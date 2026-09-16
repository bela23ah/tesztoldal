// =========================================================================
// app_v2.js — javított verzió (2026.09.16)
//  1) listenToAllUsers(): az e-mail alapú szűrés megszűnt (az e-mail már a
//     'users' kollekcióban van, nem a 'public_profiles'-ban) -> ettől volt
//     üres az allUsersData és a párosítások listája
//  2) nickname/city -> nev/telepules normalizálás a többi felhasználónál is
//  3) a public_profiles listener az auth állapothoz kötve (belépéskor újraindul),
//     valódi hibakezeléssel a néma () => {} helyett
//  4) renderMatches() a saját profil frissülésekor is lefut
//  5) üzenetküldés uid alapon (e-mail cím nem megy át a kliensen), a 'messages'
//     listener szűrt lekérdezésekkel -> WORKER OLDALI MÓDOSÍTÁST IGÉNYEL
// =========================================================================

// =========================================================================
// 0. BIZTONSÁGI SEGÉDFÜGGVÉNYEK & XSS VÉDELEM
// =========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function ensureArray(val) {
  if (Array.isArray(val)) return val.map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 108);
  if (val && typeof val === 'object') return Object.keys(val).map(Number).filter(n => !isNaN(n) && n >= 1 && n <= 108);
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

// =========================================================================
// 1. STRUKTÚRA ÉS ÁLLAPOT
// =========================================================================
const ALBUM_SIZE = 108;
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

let myProfile = {
  nev: "Vendég gyűjtő",
  telepules: "",
  email: "",
  isGiftOffering: false,
  gdprAccepted: false,
  van: ensureArray(safeJsonParse('lutra_van', [])),
  vanCounts: safeJsonParse('lutra_van_counts', {}),
  kell: ensureArray(safeJsonParse('lutra_kell', []))
};

let allUsersData = [];
let myIncomingMessages = [];
let myOutgoingMessages = [];
let activeInboxTab = 'inbox';

let currentFilter = 'all';
let matchFilter = 'all';
let currentChapterIndex = 1;
let currentUser = null;
let myDocUnsubscribe = null;
let allUsersUnsubscribe = null;
let messagesUnsubscribe = null;
let db = null;
let auth = null;

let activeContactTarget = {
  uid: '',
  nev: '',
  telepules: '',
  subject: ''
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

// =========================================================================
// 2. RÁCSOS ÉS ALBUM NÉZET
// =========================================================================
function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));

  for (let i = 1; i <= ALBUM_SIZE; i++) {
    const isVan = vanSet.has(i);
    const isKell = kellSet.has(i);

    if (currentFilter === 'van' && !isVan) continue;
    if (currentFilter === 'kell' && !isKell) continue;

    let cls = isVan ? 'van' : isKell ? 'kell' : '';
    const qty = (myProfile.vanCounts && myProfile.vanCounts[i]) ? myProfile.vanCounts[i] : 1;
    const qtyBadge = (isVan && qty > 1) ? `<span class="qty-badge">×${qty}</span>` : '';
    const animalName = STICKER_NAMES[i] || `Matrica #${i}`;

    html += `<div class="matrica-cell ${cls}" data-num="${i}" title="${i}. ${escapeHtml(animalName)} (${STICKER_ORIENTS[i] || 'fekvő'})">
      ${i}
      ${qtyBadge}
    </div>`;
  }
  grid.innerHTML = html;

  const cVan = document.getElementById('count-van');
  const cKell = document.getElementById('count-kell');
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
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

  let totalInChapter = 0;
  let markedInChapter = 0;

  chapter.elemek.forEach(el => {
    const nums = el.type === 'combo' ? el.nums : [el.num];
    totalInChapter += nums.length;
    nums.forEach(n => {
      if (vanSet.has(n) || kellSet.has(n)) markedInChapter++;
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
          const isVan1 = vanSet.has(n1), isKell1 = kellSet.has(n1);
          const isVan2 = vanSet.has(n2), isKell2 = kellSet.has(n2);
          const q1 = (myProfile.vanCounts && myProfile.vanCounts[n1]) ? myProfile.vanCounts[n1] : 1;
          const q2 = (myProfile.vanCounts && myProfile.vanCounts[n2]) ? myProfile.vanCounts[n2] : 1;
          return `
            <div class="combo-wrapper">
              <div class="combo-title">
                <span>${escapeHtml(el.name)}</span>
              </div>
              <div class="combo-halves">
                <div class="combo-half ${isVan1 ? 'van' : isKell1 ? 'kell' : ''}" data-num="${n1}">
                  ${(isVan1 && q1 > 1) ? `<span class="qty-badge">×${q1}</span>` : ''}
                  <span class="sticker-num">#${n1}</span>
                  <span class="sticker-tag">${isVan1 ? 'Dupla' : isKell1 ? 'Kell' : 'Bal fél'}</span>
                </div>
                <div class="combo-half ${isVan2 ? 'van' : isKell2 ? 'kell' : ''}" data-num="${n2}">
                  ${(isVan2 && q2 > 1) ? `<span class="qty-badge">×${q2}</span>` : ''}
                  <span class="sticker-num">#${n2}</span>
                  <span class="sticker-tag">${isVan2 ? 'Dupla' : isKell2 ? 'Kell' : 'Jobb fél'}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          const isVan = vanSet.has(el.num);
          const isKell = kellSet.has(el.num);
          const q = (myProfile.vanCounts && myProfile.vanCounts[el.num]) ? myProfile.vanCounts[el.num] : 1;
          let cls = isVan ? 'van' : isKell ? 'kell' : '';
          let tag = isVan ? 'Dupla' : isKell ? 'Hiányzik' : 'Üres';
          let orientClass = el.orient === 'álló' ? 'orient-allo' : 'orient-fekvo';
          return `
            <div class="slot ${orientClass} ${cls}" data-num="${el.num}">
              ${(isVan && q > 1) ? `<span class="qty-badge">×${q}</span>` : ''}
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

// =========================================================================
// 3. VILLÓDZÁSMENTES ÉRINTÉSKEZELŐ (300 MS DEBOUNCE)
// =========================================================================
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

  if (vanIdx > -1) {
    myProfile.van.splice(vanIdx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num);
  } else if (kellIdx > -1) {
    myProfile.kell.splice(kellIdx, 1);
  } else {
    myProfile.van.push(num);
    myProfile.vanCounts[num] = 1;
  }
  saveMyState();
}

function showQtyPopover(num, targetEl) {
  activePopoverNum = num;
  const currentQty = (myProfile.vanCounts && myProfile.vanCounts[num]) ? myProfile.vanCounts[num] : 1;
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
  localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
  localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
  
  renderGrid();
  renderAlbumChapter();
  refreshMatchesIfVisible();

  if (currentUser && myProfile.gdprAccepted === true && db) {
    db.collection("public_profiles").doc(currentUser.uid).set({
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
  }
}

document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    if (!myProfile.van.includes(activePopoverNum)) {
      myProfile.van.push(activePopoverNum);
      const kIdx = myProfile.kell.indexOf(activePopoverNum);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    }
    myProfile.vanCounts[activePopoverNum] = qty;
    saveMyState();
    hideQtyPopover();
    showToast(`${activePopoverNum}. matrica: ${qty} db`);
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#qty-popover') && !e.target.closest('[data-num]')) hideQtyPopover();
});

// =========================================================================
// 4. TÖMEGES BEVITEL & FB POSZT
// =========================================================================
document.getElementById('btn-toggle-batch').addEventListener('click', () => {
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

document.getElementById('btn-apply-batch-van').addEventListener('click', () => {
  const raw = document.getElementById('batch-input-text').value.trim();
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
  document.getElementById('batch-input-text').value = '';
  document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db matrica mentve a Duplákhoz.`);
});

document.getElementById('btn-apply-batch-kell').addEventListener('click', () => {
  const raw = document.getElementById('batch-input-text').value.trim();
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.keys(parsed).forEach(nStr => {
    const num = parseInt(nStr, 10);
    if (!myProfile.kell.includes(num)) myProfile.kell.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) {
      myProfile.van.splice(vIdx, 1);
      delete myProfile.vanCounts[num];
    }
    count++;
  });
  saveMyState();
  document.getElementById('batch-input-text').value = '';
  document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db matrica mentve a Hiányzókhoz.`);
});

document.getElementById('btn-copy-fb-post').addEventListener('click', () => {
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

// =========================================================================
// 5. NÉZET ÉS FÜLEK VÁLTÁSA
// =========================================================================
document.getElementById('btn-mode-grid').addEventListener('click', () => {
  document.getElementById('btn-mode-grid').classList.add('active');
  document.getElementById('btn-mode-album').classList.remove('active');
  document.getElementById('grid-view-container').style.display = 'block';
  document.getElementById('album-view-container').style.display = 'none';
  renderGrid();
});

document.getElementById('btn-mode-album').addEventListener('click', () => {
  document.getElementById('btn-mode-album').classList.add('active');
  document.getElementById('btn-mode-grid').classList.remove('active');
  document.getElementById('grid-view-container').style.display = 'none';
  document.getElementById('album-view-container').style.display = 'block';
  renderAlbumChapter();
});

document.getElementById('btn-album-prev').addEventListener('click', () => {
  if (currentChapterIndex > 0) { currentChapterIndex--; renderAlbumChapter(); }
});

document.getElementById('btn-album-next').addEventListener('click', () => {
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
  if (viewName === 'statisztika') renderStatistics();
  if (viewName === 'uzeneteim') renderMessages();
  if (viewName === 'matricaim') {
    renderGrid();
    renderAlbumChapter();
  }
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => switchTab(t.dataset.view));
});

// =========================================================================
// 6. PÁROSÍTÁSOK & 3 FŐS KÖRCSERÉK
// =========================================================================
document.getElementById('btn-match-all').addEventListener('click', function() { setActiveMatchFilter(this, 'all'); });
document.getElementById('btn-match-city').addEventListener('click', function() {
  if (!myProfile.telepules) return showToast("Előbb add meg a településed a Profil fülön!");
  setActiveMatchFilter(this, 'city');
});
document.getElementById('btn-match-gift').addEventListener('click', function() { setActiveMatchFilter(this, 'gift'); });
document.getElementById('btn-match-loop').addEventListener('click', function() { setActiveMatchFilter(this, 'loop'); });

function refreshMatchesIfVisible() {
  const v = document.getElementById('view-cserek');
  if (v && v.classList.contains('active')) renderMatches();
}

function setActiveMatchFilter(btn, filterType) {
  document.querySelectorAll('#view-cserek .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  matchFilter = filterType;
  renderMatches();
}

document.getElementById('btn-refresh-matches').addEventListener('click', () => {
  renderMatches();
  showToast("Adatok frissítve.");
});

function computeLoopMatches() {
  const myId = currentUser ? currentUser.uid : 'me';
  // Az ensureArray() már számmá konvertál és 1..108 közé szűr
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

  // Az ensureArray() már számmá konvertál és 1..108 közé szűr
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
          <h3 style="margin:0;">${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''}</h3>
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
      <button class="btn" data-action="contact-match" data-uid="${escapeHtml(m.id)}">
  Kapcsolatfelvétel
</button>
    </div>
  `).join('');
}

document.getElementById('matches-list').addEventListener('click', (e) => {
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

// =========================================================================
// 7. KERESŐ & STATISZTIKA
// =========================================================================
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

document.getElementById('btn-search').addEventListener('click', () => {
  const raw = document.getElementById('search-input').value.trim();
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

document.getElementById('btn-search-all-missing').addEventListener('click', () => {
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
          <h3>${escapeHtml(u.nev || 'Névtelen')} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''}</h3>
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

document.getElementById('search-results').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="contact-search"]');
  if (!btn) return;
  const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
  if (targetUser) {
    openDirectContactModal(targetUser, btn.dataset.found, targetUser.isGiftOffering);
  }
});

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
}

document.getElementById('btn-refresh-stats').addEventListener('click', () => {
  renderStatistics();
  showToast("Statisztika frissítve.");
});

// =========================================================================
// 8. FOTÓBEOLVASÓ (AI VISION PROXY)
// =========================================================================
let scannerRecognizedNums = [];

document.getElementById('btn-open-scanner').addEventListener('click', () => {
  document.getElementById('modal-scanner').classList.add('open');
});

function closeScannerModal() {
  document.getElementById('modal-scanner').classList.remove('open');
  document.getElementById('scanner-results-box').style.display = 'none';
  document.getElementById('scanner-loader').style.display = 'none';
}

document.getElementById('btn-close-scanner').addEventListener('click', closeScannerModal);

document.getElementById('scanner-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const loader = document.getElementById('scanner-loader');
  const resultsBox = document.getElementById('scanner-results-box');
  loader.style.display = 'block';
  resultsBox.style.display = 'none';

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
});

async function processScannerImageWithProxy(base64Data) {
  try {
    const res = await fetch(WORKER_ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data })
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error("A képfelismerő szerver nem adott érvényes választ.");
    }

    if (!res.ok) throw new Error(data.error || "Hiba történt a kép beolvasásakor.");

    scannerRecognizedNums = ensureArray(data.numbers);
    scannerRecognizedNums.sort((a, b) => a - b);
    renderScannerTags();
  } catch (err) {
    showToast('Hiba: ' + err.message);
  } finally {
    document.getElementById('scanner-loader').style.display = 'none';
  }
}

function renderScannerTags() {
  document.getElementById('scanner-count-label').textContent = scannerRecognizedNums.length;
  const box = document.getElementById('scanner-tags-box');
  if (scannerRecognizedNums.length === 0) {
    box.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Nem található érvényes szám a képen.</span>';
    document.getElementById('scanner-results-box').style.display = 'block';
    return;
  }

  box.innerHTML = scannerRecognizedNums.map((num, idx) => `
    <span style="background:var(--water-mid); padding:2px 8px; border-radius:999px; font-size:0.8rem; display:inline-flex; align-items:center; gap:4px; border:1px solid var(--amber);">
      #${num}
      <span data-del-idx="${idx}" style="cursor:pointer; color:var(--danger); font-weight:bold;">✕</span>
    </span>
  `).join('');
  document.getElementById('scanner-results-box').style.display = 'block';
}

document.getElementById('scanner-tags-box').addEventListener('click', (e) => {
  const delBtn = e.target.closest('[data-del-idx]');
  if (!delBtn) return;
  const idx = parseInt(delBtn.dataset.delIdx, 10);
  scannerRecognizedNums.splice(idx, 1);
  renderScannerTags();
});

document.getElementById('btn-scanner-add-manual').addEventListener('click', () => {
  const input = document.getElementById('scanner-manual-num');
  const num = parseInt(input.value, 10);
  if (num >= 1 && num <= ALBUM_SIZE) {
    scannerRecognizedNums.push(num);
    scannerRecognizedNums.sort((a, b) => a - b);
    renderScannerTags();
    input.value = '';
  } else {
    showToast("Adj meg egy számot 1 és 108 között!");
  }
});

document.getElementById('btn-scanner-save-van').addEventListener('click', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető szám.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + 1;
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica mentve a Dupláid közé.`);
});

document.getElementById('btn-scanner-save-kell').addEventListener('click', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető szám.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.kell.includes(num)) myProfile.kell.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) {
      myProfile.van.splice(vIdx, 1);
      delete myProfile.vanCounts[num];
    }
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica mentve a Hiányzóid közé.`);
});

document.getElementById('btn-scanner-copy-formatted').addEventListener('click', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs felismert szám.");
  const counts = {};
  scannerRecognizedNums.forEach(n => counts[n] = (counts[n] || 0) + 1);
  const formatted = Object.entries(counts).map(([num, qty]) => qty > 1 ? `${num}*${qty}` : `${num}`).join(', ');
  navigator.clipboard.writeText(formatted);
  showToast("Formázott lista másolva!");
});

// =========================================================================
// 9. 100% BIZTONSÁGOS KAPCSOLATFELVÉTEL ÉS BELSŐ POSTAFIÓK
// =========================================================================
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
    document.getElementById('modal-auth').classList.add('open');
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
    subject: subject
  };

  document.getElementById('contact-modal-title').textContent = `Üzenet küldése: ${escapeHtml(activeContactTarget.nev)}`;
  document.getElementById('contact-msg-input').value = msg;
  document.getElementById('modal-contact').classList.add('open');
}

function openContactModal(targetUser, give, get, isGift) {
  if (!checkSenderProfileReady()) return;
  const subject = "Lutra 2026 matricacsere megkeresés";
  const msg = isGift && !give ?
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 csereoldalon láttam a felajánlásodat, hogy a dupláidat szívesen odaadod ajándékba.\nSzeretném elkérni az alábbi matricá(ka)t:\n${get}\n\nHogyan tudnánk lebonyolítani az átadást/postázást?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})` :
    `Szia ${targetUser.nev}!\n\nA Lutra 2026 platformon találtam meg a gyűjteményedet, és tudnánk egymásnak segíteni:\n\nÉn tudom adni neked: ${give}\nTe tudod adni nekem: ${get}\n\nMegfelelne a csere postán vagy személyesen?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;

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

// BELSŐ ÜZENET KÜLDÉSE + RESEND ÉRTESÍTÉS A HÁTTÉRBEN
document.getElementById('btn-send-message').addEventListener('click', async () => {
  const messageText = document.getElementById('contact-msg-input').value.trim();
  if (!messageText) return showToast("Kérlek írj be egy üzenetet!");

  const loader = document.getElementById('contact-send-loader');
  const sendBtn = document.getElementById('btn-send-message');
  loader.style.display = 'block';
  sendBtn.disabled = true;

  try {
    // 1. Mentés a Firestore belső üzenetek közé (In-App Chat)
    if (db && currentUser) {
      await db.collection("messages").add({
        fromUid: currentUser.uid,
        fromName: myProfile.nev,
        fromCity: myProfile.telepules || '',
        toUid: activeContactTarget.uid,
        toName: activeContactTarget.nev,
        subject: activeContactTarget.subject,
        message: messageText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    // 2. Kézbesítés a Cloudflare Worker + Resend API-n keresztül (értesítés)
    try {
      // A címzett e-mail címét NEM a kliens küldi (az a 'users' kollekcióban van,
      // és nem publikus). A Worker az Admin SDK-val a toUid alapján olvassa ki,
      // az ID tokent pedig ellenőrzi, hogy ne lehessen kívülről spamelni.
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
      console.warn("Értesítési e-mail küldés figyelmeztetés:", e);
    }

    showToast("✨ Üzeneted sikeresen elküldve a partnernek!");
    document.getElementById('modal-contact').classList.remove('open');

  } catch (err) {
    console.error("Küldési hiba:", err);
    showToast("Küldési hiba: " + err.message);
  } finally {
    loader.style.display = 'none';
    sendBtn.disabled = false;
  }
});

document.getElementById('btn-close-contact').addEventListener('click', () => {
  document.getElementById('modal-contact').classList.remove('open');
});

document.getElementById('btn-copy-msg').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('contact-msg-input').value);
  showToast("Üzenet kimásolva a vágólapra!");
});

// =========================================================================
// 10. BELSŐ ÜZENETEK MEGJELENÍTÉSE (INBOX / SENT)
// =========================================================================
document.getElementById('btn-msg-tab-inbox').addEventListener('click', () => {
  activeInboxTab = 'inbox';
  document.getElementById('btn-msg-tab-inbox').classList.add('active');
  document.getElementById('btn-msg-tab-sent').classList.remove('active');
  renderMessages();
});

document.getElementById('btn-msg-tab-sent').addEventListener('click', () => {
  activeInboxTab = 'sent';
  document.getElementById('btn-msg-tab-sent').classList.add('active');
  document.getElementById('btn-msg-tab-inbox').classList.remove('active');
  renderMessages();
});

document.getElementById('btn-refresh-inbox').addEventListener('click', () => {
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
        <button class="btn" onclick="document.getElementById('modal-auth').classList.add('open')">Belépés / Fiók</button>
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
        <div class="message-body">${escapeHtml(msg.message)}</div>
        ${isIncoming ? `
          <button class="btn" style="font-size:0.75rem; padding:4px 12px;" data-action="reply-message" data-sender-uid="${escapeHtml(msg.fromUid)}" data-sender-name="${escapeHtml(msg.fromName)}">
            ↩️ Válasz ${escapeHtml(msg.fromName)}-nek
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

document.getElementById('messages-inbox-list').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="reply-message"]');
  if (!btn) return;
  const targetUser = {
    id: btn.dataset.senderUid,
    nev: btn.dataset.senderName
  };
  setupContactModal(targetUser, `Szia ${targetUser.nev}!\n\nKöszönöm a megkeresést. `, `Válasz: Lutra csere`);
});

function listenToMyMessages(uid) {
  if (!db) return;
  if (messagesUnsubscribe) messagesUnsubscribe();

  // Nem a teljes 'messages' kollekciót olvassuk (az mindenki üzenetét jelentené),
  // hanem két szűrt lekérdezést: nekem szólók + általam küldöttek.
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
    myIncomingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refresh();
  }, err => console.error("messages (bejövő) listener hiba:", err.code, err.message));

  const unsubOut = db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    refresh();
  }, err => console.error("messages (küldött) listener hiba:", err.code, err.message));

  messagesUnsubscribe = () => { unsubIn(); unsubOut(); };
}

// =========================================================================
// 11. LENULLÁZÁS ÉS OKLEVÉL
// =========================================================================
document.getElementById('btn-open-reset').addEventListener('click', () => document.getElementById('modal-reset').classList.add('open'));
document.getElementById('btn-close-reset').addEventListener('click', () => document.getElementById('modal-reset').classList.remove('open'));
document.getElementById('btn-reset-van').addEventListener('click', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  saveMyState();
  document.getElementById('modal-reset').classList.remove('open');
  showToast("Duplák törölve.");
});
document.getElementById('btn-reset-kell').addEventListener('click', () => {
  myProfile.kell = [];
  saveMyState();
  document.getElementById('modal-reset').classList.remove('open');
  showToast("Hiányzók törölve.");
});
document.getElementById('btn-reset-all').addEventListener('click', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  myProfile.kell = [];
  saveMyState();
  document.getElementById('modal-reset').classList.remove('open');
  showToast("Összes adat törölve.");
});

document.getElementById('btn-view-certificate').addEventListener('click', () => {
  document.getElementById('cert-user-name').textContent = myProfile.nev || 'Gyűjtő';
  document.getElementById('cert-date-label').textContent = new Date().toLocaleDateString('hu-HU');
  document.getElementById('modal-certificate').classList.add('open');
  if (window.confetti) confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
});
document.getElementById('btn-close-cert').addEventListener('click', () => document.getElementById('modal-certificate').classList.remove('open'));
document.getElementById('btn-close-cert-2').addEventListener('click', () => document.getElementById('modal-certificate').classList.remove('open'));
document.getElementById('btn-cert-share-fb').addEventListener('click', () => {
  navigator.clipboard.writeText(`Betelt a 2026-os Lidl Lutra albumom! Mind a 108 matrica megvan! ${window.location.href}`);
  showToast("Szöveg másolva a vágólapra!");
});

document.getElementById('btn-open-auth').addEventListener('click', () => document.getElementById('modal-auth').classList.add('open'));
document.getElementById('btn-close-auth').addEventListener('click', () => document.getElementById('modal-auth').classList.remove('open'));
document.getElementById('link-open-profile').addEventListener('click', () => switchTab('profil'));

// =========================================================================
// 12. FIREBASE AUTH, PROFIL, ADATVÉDELEM ÉS FIÓKTÖRLÉS
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
      currentUser = user;
      const authArea = document.getElementById('auth-area');
      const guestNotice = document.getElementById('guest-notice');

      if (user) {
        if (guestNotice) guestNotice.style.display = 'none';
        if (authArea) {
          authArea.innerHTML = `
            <div class="user-badge"><span>👤 ${escapeHtml(user.displayName || user.email.split('@')[0])}</span></div>
            <button class="btn btn-secondary" id="btn-logout" style="padding:4px 10px; font-size:0.75rem;">Kilépés</button>
          `;
          document.getElementById('btn-logout').addEventListener('click', () => {
            if (myDocUnsubscribe) myDocUnsubscribe();
            if (allUsersUnsubscribe) allUsersUnsubscribe();
            if (messagesUnsubscribe) messagesUnsubscribe();
            auth.signOut();
          });
        }
        document.getElementById('modal-auth').classList.remove('open');
        listenToMyProfile(user.uid);
        listenToMyMessages(user.uid);
        listenToAllUsers();   // belépés után (újra) rácsatlakozunk a public_profiles-ra
      } else {
        if (myDocUnsubscribe) { myDocUnsubscribe(); myDocUnsubscribe = null; }
        if (messagesUnsubscribe) { messagesUnsubscribe(); messagesUnsubscribe = null; }
        myIncomingMessages = [];
        myOutgoingMessages = [];
        listenToAllUsers();   // vendégként is megpróbáljuk (ha a rules engedi)
        if (guestNotice) guestNotice.style.display = 'flex';
        if (authArea) authArea.innerHTML = `<button class="btn" id="btn-open-auth">Belépés / Fiók</button>`;
        const btnAuth = document.getElementById('btn-open-auth');
        if (btnAuth) btnAuth.addEventListener('click', () => document.getElementById('modal-auth').classList.add('open'));
      }
      checkMandatoryProfile();
    });
  } catch (e) {
    console.warn("Firebase inicializálási figyelmeztetés:", e);
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
  if (allUsersUnsubscribe) { allUsersUnsubscribe(); allUsersUnsubscribe = null; }

  allUsersUnsubscribe = db.collection("public_profiles").onSnapshot(snapshot => {
    allUsersData = [];
    snapshot.forEach(doc => {
      const u = doc.data();
      // FONTOS: az e-mail már NINCS a public_profiles-ban (a 'users' kollekcióban
      // tároljuk), ezért nem szabad rá szűrni — ettől maradt üresen a lista.
      if (!u || u.gdprAccepted !== true) return;

      const van = ensureArray(u.van);
      const kell = ensureArray(u.kell);
      if (van.length === 0 && kell.length === 0) return; // üres profil, nincs mit cserélni

      allUsersData.push({
        ...u,
        id: doc.id,                                   // a spread UTÁN, hogy ne írja felül
        nev: u.nickname || u.nev || 'Névtelen gyűjtő', // migrált mezőnevek kezelése
        telepules: u.city || u.telepules || '',
        van,
        kell,
        vanCounts: u.vanCounts || {},
        isGiftOffering: u.isGiftOffering === true
      });
    });
    renderMatches();
    renderStatistics();
  }, err => {
    console.error("public_profiles listener hiba:", err.code, err.message);
    allUsersData = [];
    const list = document.getElementById('matches-list');
    if (list) {
      list.innerHTML = `<p class="view-intro">Nem sikerült betölteni a cserepartnereket (${escapeHtml(err.code || 'ismeretlen hiba')}).
        Ha ki vagy jelentkezve, lépj be a fiókodba, majd frissítsd az oldalt.</p>`;
    }
  });
}

function listenToMyProfile(uid) {
  if (!db) return;
  if (myDocUnsubscribe) myDocUnsubscribe();
  
  // A publikus adatokat (matricák, név, település, gdpr) a public_profiles-ból figyeljük valós időben
  myDocUnsubscribe = db.collection("public_profiles").doc(uid).onSnapshot(async doc => {
    if (doc.exists) {
      const d = doc.data();
      
      // Opcionálisan lekérhetjük az e-mail címet a secure users kollekcióból, ha ott van
      let userEmail = myProfile.email || '';
      try {
        const userDoc = await db.collection("users").doc(uid).get();
        if (userDoc.exists && userDoc.data().email) {
          userEmail = userDoc.data().email;
        }
      } catch (err) {}

      myProfile = {
        ...myProfile,
        ...d,
        email: userEmail,
        nev: d.nickname || d.nev || '',         // Kezelve a migráció szerinti mezőneveket is
        telepules: d.city || d.telepules || '', // Kezelve a migráció szerinti mezőneveket is
        van: ensureArray(d.van),
        kell: ensureArray(d.kell),
        vanCounts: d.vanCounts || {}
      };
      
      localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
      localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
      localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
      renderGrid();
      renderAlbumChapter();

      const nI = document.getElementById('prof-nev'); if (nI) nI.value = myProfile.nev || '';
      const tI = document.getElementById('prof-telepules'); if (tI) tI.value = myProfile.telepules || '';
      const eI = document.getElementById('prof-email'); if (eI) eI.value = myProfile.email || '';
      const gI = document.getElementById('prof-gift'); if (gI) gI.checked = !!myProfile.isGiftOffering;
      const gdI = document.getElementById('prof-gdpr'); if (gdI) gdI.checked = !!myProfile.gdprAccepted;

      checkMandatoryProfile();
      refreshMatchesIfVisible();   // a saját van/kell változásakor a cserelista is frissüljön
    }
  }, err => {
    console.error("public_profiles/{uid} listener hiba:", err.code, err.message);
  });
}

document.getElementById('btn-save-profile').addEventListener('click', async () => {
  if (!currentUser) return showToast("Előbb lépj be a fiókodba!");
  const nev = document.getElementById('prof-nev').value.trim();
  const tel = document.getElementById('prof-telepules').value.trim();
  const em = document.getElementById('prof-email').value.trim();
  const gdpr = document.getElementById('prof-gdpr').checked;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nev) return showToast("A megjelenő név megadása kötelező!");
  if (!tel) return showToast("A település megadása kötelező a helyi cserékhez!");
  if (!em || !emailRegex.test(em)) return showToast("Kérlek adj meg egy érvényes e-mail címet!");
  if (!gdpr) return showToast("A cserékhez el kell fogadnod az adatkezelést!");

  myProfile.nev = nev;
  myProfile.telepules = tel;
  myProfile.email = em;
  myProfile.isGiftOffering = document.getElementById('prof-gift').checked;
  myProfile.gdprAccepted = true;

  try {
    const batch = db.batch();

    // 1. Bizalmas/szenzitív adatok mentése a 'users' kollekcióba (pl. e-mail)
    const userRef = db.collection("users").doc(currentUser.uid);
    batch.set(userRef, {
      email: myProfile.email,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Publikus adatok és matricák mentése a 'public_profiles' kollekcióba (ezt látják a mások)
    const publicRef = db.collection("public_profiles").doc(currentUser.uid);
    batch.set(publicRef, {
      nickname: myProfile.nev,
      city: myProfile.telepules,
      isGiftOffering: myProfile.isGiftOffering,
      gdprAccepted: true,
      van: myProfile.van,
      vanCounts: myProfile.vanCounts,
      kell: myProfile.kell,
      gdprAcceptedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Batch commit végrehajtása
    await batch.commit();

    checkMandatoryProfile();
    showToast("Profil adatok elmentve a felhőbe!");
  } catch (err) {
    showToast("Mentési hiba: " + err.message);
  }
});

document.getElementById('btn-delete-account').addEventListener('click', async () => {
  if (!currentUser) return showToast("Nem vagy bejelentkezve.");
  if (!confirm("Biztosan törölni szeretnéd a fiókodat és az összes mentett adatodat a csereplatformról?")) return;

  try {
    const batch = db.batch();

    // 1. Bizalmas adatok törlése a 'users' kollekcióból
    const userRef = db.collection("users").doc(currentUser.uid);
    batch.delete(userRef);

    // 2. Publikus profil és matricák törlése a 'public_profiles' kollekcióból
    const publicRef = db.collection("public_profiles").doc(currentUser.uid);
    batch.delete(publicRef);

    // Batch végrehajtása
    await batch.commit();

    myProfile = {
      nev: "Vendég gyűjtő", telepules: "", email: "",
      isGiftOffering: false, gdprAccepted: false, van: [], vanCounts: {}, kell: []
    };
    localStorage.removeItem('lutra_van');
    localStorage.removeItem('lutra_van_counts');
    localStorage.removeItem('lutra_kell');
    if (myDocUnsubscribe) myDocUnsubscribe();
    if (allUsersUnsubscribe) allUsersUnsubscribe();
    if (messagesUnsubscribe) messagesUnsubscribe();
    await auth.signOut();
    renderGrid();
    renderAlbumChapter();
    showToast("Adataid és adatlapod véglegesen törölve lettek.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

document.getElementById('btn-google-login').addEventListener('click', async () => {
  if (!auth) return;
  try {
    await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    showToast("Sikeres belépés!");
  } catch (e) { showToast(e.message); }
});

document.getElementById('btn-email-login').addEventListener('click', async () => {
  if (!auth) return;
  const em = document.getElementById('auth-email').value.trim();
  const pw = document.getElementById('auth-pass').value;
  try {
    await auth.signInWithEmailAndPassword(em, pw);
    showToast("Sikeres belépés!");
  } catch (e) { showToast("Hibás belépési adatok!"); }
});

document.getElementById('btn-email-signup').addEventListener('click', async () => {
  if (!auth) return;
  const em = document.getElementById('auth-email').value.trim();
  const pw = document.getElementById('auth-pass').value;
  if (pw.length < 6) return showToast("A jelszónak legalább 6 karakteresnek kell lennie!");
  try {
    await auth.createUserWithEmailAndPassword(em, pw);
    showToast("Sikeres regisztráció!");
  } catch (e) { showToast(e.message); }
});

// =========================================================================
// AZONNALI INDÍTÁS
// =========================================================================
attachStickerInteraction(document.getElementById('matrica-grid'));
attachStickerInteraction(document.getElementById('album-chapter-content'));

// Rács és album azonnali kirajzolása:
renderGrid();
renderAlbumChapter();
initFirebase();
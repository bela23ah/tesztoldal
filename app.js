// =========================================================================
// 0. BIZTONSÁGI ESZKÖZÖK (XSS & ADATTISZTÍTÁS)
// =========================================================================
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
    console.warn("Hibás localStorage adat a(z) " + key + " kulcsnál:", e);
    return fallback;
  }
}

// =========================================================================
// 1. PROXY & FIREBASE KONFIGURÁCIÓ
// =========================================================================
const SCANNER_API_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

const firebaseConfig = {
  apiKey: "AIzaSyDatTdD6Ggcf7LbWZ0zBAyXf1JkspM6CEs",
  authDomain: "lutra-csereplatform.firebaseapp.com",
  databaseURL: "https://lutra-csereplatform-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lutra-csereplatform",
  storageBucket: "lutra-csereplatform.firebasestorage.app",
  messagingSenderId: "311436055202",
  appId: "1:311436055202:web:010e622b11eb6c02f7fdfb"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const ALBUM_SIZE = 108;
let currentUser = null;
let myProfile = {
  nev: "Vendég gyűjtő",
  telepules: "",
  email: "",
  isGiftOffering: false,
  gdprAccepted: false,
  van: ensureArray(safeJsonParse('lutra_van', [])),
  vanCounts: safeJsonParse('lutra_van_counts', {}),
  kell: ensureArray(safeJsonParse('lutra_kell', [])),
  foglalt: ensureArray(safeJsonParse('lutra_foglalt', []))
};
let allUsersData = [];
let currentFilter = 'all';
let matchFilter = 'all'; // 'all' | 'city' | 'gift' | 'loop'
let myDocUnsubscribe = null;
let allUsersUnsubscribe = null;

// =========================================================================
// 2. SZÉP ÉS TISZTA ALBUM FEJEZET STRUKTÚRA A HIVATALOS PDF TÁJOLÁSSAL
// =========================================================================
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
// 3. VALÓS IDEJŰ PROFIL & KÖZÖSSÉGI SZINKRONIZÁLÁS (PC <-> MOBIL)
// =========================================================================
function listenToAllUsers() {
  if (allUsersUnsubscribe) allUsersUnsubscribe();
  try {
    allUsersUnsubscribe = db.collection("users").onSnapshot((snapshot) => {
      allUsersData = [];
      snapshot.forEach(doc => {
        const uData = doc.data();
        if (uData && uData.gdprAccepted === true && uData.email && uData.email.trim() && uData.email !== 'undefined') {
          allUsersData.push({ id: doc.id, ...uData });
        }
      });
      renderMatches();
      renderStatistics();
    }, (err) => console.warn("AllUsers snapshot hiba:", err));
  } catch (err) {
    console.warn("Snapshot indítási hiba:", err);
  }
}

function listenToMyOwnProfile(uid) {
  if (myDocUnsubscribe) myDocUnsubscribe();
  myDocUnsubscribe = db.collection("users").doc(uid).onSnapshot((doc) => {
    if (doc.exists) {
      const cloudData = doc.data();
      const cleanVan = ensureArray(cloudData.van);
      const cleanKell = ensureArray(cloudData.kell).filter(n => !cleanVan.includes(n));
      const cleanFoglalt = ensureArray(cloudData.foglalt).filter(n => !cleanVan.includes(n) && !cleanKell.includes(n));

      myProfile = {
        ...myProfile,
        ...cloudData,
        van: cleanVan,
        kell: cleanKell,
        foglalt: cleanFoglalt,
        vanCounts: cloudData.vanCounts || {}
      };

      localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
      localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts));
      localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
      localStorage.setItem('lutra_foglalt', JSON.stringify(myProfile.foglalt));
      
      const nevInput = document.getElementById('prof-nev');
      const telInput = document.getElementById('prof-telepules');
      const emailInput = document.getElementById('prof-email');
      const giftInput = document.getElementById('prof-gift');
      const gdprInput = document.getElementById('prof-gdpr');

      if (nevInput) nevInput.value = myProfile.nev || '';
      if (telInput) telInput.value = myProfile.telepules || '';
      if (emailInput) emailInput.value = myProfile.email || '';
      if (giftInput) giftInput.checked = myProfile.isGiftOffering || false;
      if (gdprInput) gdprInput.checked = myProfile.gdprAccepted || false;

      renderGrid();
      renderAlbumChapter();
      checkMandatoryProfile();
    }
  }, (err) => console.warn("MyDoc snapshot hiba:", err));
}

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const authArea = document.getElementById('auth-area');
  const guestNotice = document.getElementById('guest-notice');

  if (user) {
    if (guestNotice) guestNotice.style.display = 'none';
    if (authArea) {
      authArea.innerHTML = `
        <div class="user-badge">
          <span>👤 ${escapeHtml(user.displayName || user.email.split('@')[0])}</span>
        </div>
        <button class="btn btn-secondary" id="btn-logout" style="padding: 4px 10px; font-size: 0.75rem;">Kilépés</button>
      `;
      document.getElementById('btn-logout').onclick = () => {
        if (myDocUnsubscribe) { myDocUnsubscribe(); myDocUnsubscribe = null; }
        if (allUsersUnsubscribe) { allUsersUnsubscribe(); allUsersUnsubscribe = null; }
        auth.signOut();
      };
    }
    closeAuthModal();
    listenToMyOwnProfile(user.uid);
  } else {
    if (guestNotice) guestNotice.style.display = 'flex';
    if (authArea) {
      authArea.innerHTML = `<button class="btn" id="btn-open-auth">Belépés / Fiók</button>`;
      document.getElementById('btn-open-auth').onclick = openAuthModal;
    }
  }
  renderGrid();
  renderAlbumChapter();
  listenToAllUsers();
  checkMandatoryProfile();
});

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

const linkOpenProf = document.getElementById('link-open-profile');
if (linkOpenProf) linkOpenProf.addEventListener('click', () => switchTab('profil'));

function openAuthModal() { document.getElementById('modal-auth').classList.add('open'); }
function closeAuthModal() { document.getElementById('modal-auth').classList.remove('open'); }

document.getElementById('btn-google-login').addEventListener('click', async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
    showToast("Sikeres belépés Google-lal!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

document.getElementById('btn-email-login').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if (!email || !pass) return showToast("Add meg az adatokat!");
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    showToast("Sikeres belépés!");
  } catch (err) { showToast("Sikertelen belépés: Hibás adatok!"); }
});

document.getElementById('btn-email-signup').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const pass = document.getElementById('auth-pass').value;
  if (!email || pass.length < 6) return showToast("Min. 6 karakteres jelszó kell!");
  try {
    await auth.createUserWithEmailAndPassword(email, pass);
    showToast("Sikeres regisztráció!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

// =========================================================================
// 4. 4-ÁLLAPOTÚ MATRICA KEZELÉS (VAN -> KELL -> FOGLALT -> ÜRES)
// =========================================================================
let activePopoverNum = null;
const popover = document.getElementById('qty-popover');

function toggleStickerState(num) {
  hideQtyPopover();
  const vanIdx = myProfile.van.indexOf(num);
  const kellIdx = myProfile.kell.indexOf(num);
  const foglaltIdx = myProfile.foglalt.indexOf(num);

  if (vanIdx > -1) {
    // 1 -> 2: Van-ból Kell lesz
    myProfile.van.splice(vanIdx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num);
  } else if (kellIdx > -1) {
    // 2 -> 3: Kell-ből Foglalt (Kék) lesz
    myProfile.kell.splice(kellIdx, 1);
    myProfile.foglalt.push(num);
  } else if (foglaltIdx > -1) {
    // 3 -> 4: Foglalt-ból Üres lesz
    myProfile.foglalt.splice(foglaltIdx, 1);
  } else {
    // 4 -> 1: Üresből Van lesz
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
  const padding = 10;

  if (left - halfWidth < padding) {
    left = halfWidth + padding;
  } else if (left + halfWidth > viewportWidth - padding) {
    left = viewportWidth - halfWidth - padding;
  }

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

document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    
    if (!myProfile.van.includes(activePopoverNum)) {
      myProfile.van.push(activePopoverNum);
      const kIdx = myProfile.kell.indexOf(activePopoverNum);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
      const fIdx = myProfile.foglalt.indexOf(activePopoverNum);
      if (fIdx > -1) myProfile.foglalt.splice(fIdx, 1);
    }
    
    myProfile.vanCounts[activePopoverNum] = qty;
    saveMyState();
    hideQtyPopover();
    showToast(`${activePopoverNum}. matrica: ${qty} db beállítva`);
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#qty-popover') && !e.target.closest('.matrica-cell') && !e.target.closest('.slot') && !e.target.closest('.combo-half')) {
    hideQtyPopover();
  }
});

function saveMyState() {
  myProfile.van = ensureArray(myProfile.van);
  myProfile.kell = ensureArray(myProfile.kell).filter(n => !myProfile.van.includes(n));
  myProfile.foglalt = ensureArray(myProfile.foglalt).filter(n => !myProfile.van.includes(n) && !myProfile.kell.includes(n));
  
  localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
  localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
  localStorage.setItem('lutra_foglalt', JSON.stringify(myProfile.foglalt));
  
  renderGrid();
  renderAlbumChapter();

  if (currentUser && myProfile.gdprAccepted === true) {
    db.collection("users").doc(currentUser.uid).set({
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      foglalt: myProfile.foglalt,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(e => console.warn("Mentési hiba:", e));
  }
}

// =========================================================================
// 5. TÖMEGES BEVITEL & FB POSZT
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
  if (!raw) return showToast("Írj be matricaszámokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.entries(parsed).forEach(([nStr, qty]) => {
    const num = parseInt(nStr, 10);
    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    const fIdx = myProfile.foglalt.indexOf(num);
    if (fIdx > -1) myProfile.foglalt.splice(fIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + qty;
    count += qty;
  });
  saveMyState();
  document.getElementById('batch-input-text').value = '';
  document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db matrica hozzáadva a Duplákhoz.`);
});

document.getElementById('btn-apply-batch-kell').addEventListener('click', () => {
  const raw = document.getElementById('batch-input-text').value.trim();
  if (!raw) return showToast("Írj be matricaszámokat!");
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
    const fIdx = myProfile.foglalt.indexOf(num);
    if (fIdx > -1) myProfile.foglalt.splice(fIdx, 1);
    count++;
  });
  saveMyState();
  document.getElementById('batch-input-text').value = '';
  document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db matrica hozzáadva a Hiányzókhoz.`);
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
  const currentUrl = window.location.href;

  const fbPost = `Lidl Lutra 2026 matricacsere!
Gyűjtő: ${myProfile.nev}${userCity}

DUPLÁK, AMIK VANNAK (${vanSorted.length} féle):
${vanText}

AMIK MÉG HIÁNYOZNAK (${kellSorted.length} db):
${kellText}

Nézd meg a teljes listámat és cseréljünk itt:
${currentUrl}`;

  navigator.clipboard.writeText(fbPost);
  showToast("Csereposzt kimásolva a vágólapra!");
});

// =========================================================================
// 6. RÁCSOS NÉZET
// =========================================================================
function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;
  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglaltSet = new Set(ensureArray(myProfile.foglalt));

  for (let i = 1; i <= ALBUM_SIZE; i++) {
    const isVan = vanSet.has(i);
    const isKell = kellSet.has(i);
    const isFoglalt = foglaltSet.has(i);

    if (currentFilter === 'van' && !isVan) continue;
    if (currentFilter === 'kell' && !isKell) continue;
    if (currentFilter === 'foglalt' && !isFoglalt) continue;

    let cls = isVan ? 'van' : isKell ? 'kell' : isFoglalt ? 'foglalt' : '';
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
  const cFoglalt = document.getElementById('count-foglalt');
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
  if (cFoglalt) cFoglalt.textContent = myProfile.foglalt.length;
}

let longPressTimer = null;
let isLongPressTriggered = false;

function attachStickerInteraction(container) {
  if (!container) return;

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
    isLongPressTriggered = false;
    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }, 450);
  }, { passive: true });

  container.addEventListener('touchend', () => clearTimeout(longPressTimer));
  container.addEventListener('touchmove', () => clearTimeout(longPressTimer));

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

attachStickerInteraction(document.getElementById('matrica-grid'));

// =========================================================================
// 7. SZÉP ÉS TISZTA FEJEZET ALBUM NÉZET
// =========================================================================
let currentChapterIndex = 1;
const albumSelect = document.getElementById('album-chapter-select');

if (albumSelect) {
  albumSelect.innerHTML = '';
  FEJEZETEK.forEach((f, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = f.cim;
    albumSelect.appendChild(opt);
  });

  albumSelect.addEventListener('change', (e) => {
    currentChapterIndex = parseInt(e.target.value, 10);
    renderAlbumChapter();
  });
}

function renderAlbumChapter() {
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
  const foglaltSet = new Set(ensureArray(myProfile.foglalt));

  let totalInChapter = 0;
  let markedInChapter = 0;

  chapter.elemek.forEach(el => {
    const nums = el.type === 'combo' ? el.nums : [el.num];
    totalInChapter += nums.length;
    nums.forEach(n => {
      if (vanSet.has(n) || kellSet.has(n) || foglaltSet.has(n)) markedInChapter++;
    });
  });

  const html = `
    <div class="page-header">
      <h3 class="page-title">${escapeHtml(chapter.cim)}</h3>
      <span class="page-progress">${markedInChapter} / ${totalInChapter} bejelölve</span>
    </div>
    <div class="slots-grid">
      ${chapter.elemek.map(el => {
        if (el.type === 'combo') {
          const [n1, n2] = el.nums;
          const isVan1 = vanSet.has(n1), isKell1 = kellSet.has(n1), isFoglalt1 = foglaltSet.has(n1);
          const isVan2 = vanSet.has(n2), isKell2 = kellSet.has(n2), isFoglalt2 = foglaltSet.has(n2);
          const q1 = (myProfile.vanCounts && myProfile.vanCounts[n1]) ? myProfile.vanCounts[n1] : 1;
          const q2 = (myProfile.vanCounts && myProfile.vanCounts[n2]) ? myProfile.vanCounts[n2] : 1;
          const cls1 = isVan1 ? 'van' : isKell1 ? 'kell' : isFoglalt1 ? 'foglalt' : '';
          const cls2 = isVan2 ? 'van' : isKell2 ? 'kell' : isFoglalt2 ? 'foglalt' : '';
          const tag1 = isVan1 ? 'Dupla' : isKell1 ? 'Kell' : isFoglalt1 ? 'Foglalt' : 'Bal fél';
          const tag2 = isVan2 ? 'Dupla' : isKell2 ? 'Kell' : isFoglalt2 ? 'Foglalt' : 'Jobb fél';
          return `
            <div class="combo-wrapper">
              <div class="combo-title">
                <span>${escapeHtml(el.name)}</span>
              </div>
              <div class="combo-halves">
                <div class="combo-half ${cls1}" data-num="${n1}">
                  ${(isVan1 && q1 > 1) ? `<span class="qty-badge">×${q1}</span>` : ''}
                  <span class="sticker-num">#${n1}</span>
                  <span class="sticker-tag">${tag1}</span>
                </div>
                <div class="combo-half ${cls2}" data-num="${n2}">
                  ${(isVan2 && q2 > 1) ? `<span class="qty-badge">×${q2}</span>` : ''}
                  <span class="sticker-num">#${n2}</span>
                  <span class="sticker-tag">${tag2}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          const isVan = vanSet.has(el.num);
          const isKell = kellSet.has(el.num);
          const isFoglalt = foglaltSet.has(el.num);
          const q = (myProfile.vanCounts && myProfile.vanCounts[el.num]) ? myProfile.vanCounts[el.num] : 1;
          let cls = isVan ? 'van' : isKell ? 'kell' : isFoglalt ? 'foglalt' : '';
          let tag = isVan ? 'Dupla' : isKell ? 'Hiányzik' : isFoglalt ? 'Foglalt' : 'Üres';
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

  container.innerHTML = html;
}

attachStickerInteraction(document.getElementById('album-chapter-content'));

const btnAlbumPrev = document.getElementById('btn-album-prev');
if (btnAlbumPrev) {
  btnAlbumPrev.addEventListener('click', () => {
    if (currentChapterIndex > 0) { currentChapterIndex--; renderAlbumChapter(); }
  });
}

const btnAlbumNext = document.getElementById('btn-album-next');
if (btnAlbumNext) {
  btnAlbumNext.addEventListener('click', () => {
    if (currentChapterIndex < FEJEZETEK.length - 1) { currentChapterIndex++; renderAlbumChapter(); }
  });
}

const btnModeGrid = document.getElementById('btn-mode-grid');
const btnModeAlbum = document.getElementById('btn-mode-album');
const gridContainer = document.getElementById('grid-view-container');
const albumContainer = document.getElementById('album-view-container');

if (btnModeGrid && btnModeAlbum && gridContainer && albumContainer) {
  btnModeGrid.addEventListener('click', () => {
    btnModeGrid.classList.add('active');
    btnModeAlbum.classList.remove('active');
    gridContainer.style.display = 'block';
    albumContainer.style.display = 'none';
    renderGrid();
  });

  btnModeAlbum.addEventListener('click', () => {
    btnModeAlbum.classList.add('active');
    btnModeGrid.classList.remove('active');
    gridContainer.style.display = 'none';
    albumContainer.style.display = 'block';
    renderAlbumChapter();
  });
}

document.querySelectorAll('.filter-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderGrid();
  });
});

// =========================================================================
// 8. PÁROSÍTÁSOK & KÖRCSERÉK (FOGLALT MATRICÁK KIZÁRÁSÁVAL)
// =========================================================================
document.getElementById('btn-match-all').addEventListener('click', function() { setActiveMatchFilter(this, 'all'); });
document.getElementById('btn-match-city').addEventListener('click', function() {
  if (!myProfile.telepules) return showToast("Előbb add meg a településed a Profil fülön!");
  setActiveMatchFilter(this, 'city');
});
document.getElementById('btn-match-gift').addEventListener('click', function() { setActiveMatchFilter(this, 'gift'); });
document.getElementById('btn-match-loop').addEventListener('click', function() { setActiveMatchFilter(this, 'loop'); });

function setActiveMatchFilter(btn, filterType) {
  document.querySelectorAll('#view-cserek .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  matchFilter = filterType;
  renderMatches();
}

document.getElementById('btn-refresh-matches').addEventListener('click', () => {
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).get().then(doc => {
      if (doc.exists) {
        const cloudData = doc.data();
        const cleanVan = ensureArray(cloudData.van);
        const cleanKell = ensureArray(cloudData.kell).filter(n => !cleanVan.includes(n));
        const cleanFoglalt = ensureArray(cloudData.foglalt).filter(n => !cleanVan.includes(n) && !cleanKell.includes(n));
        myProfile = { ...myProfile, ...cloudData, van: cleanVan, kell: cleanKell, foglalt: cleanFoglalt };
        renderGrid();
        renderAlbumChapter();
      }
    }).catch(e => console.warn("Frissítési hiba:", e));
  }
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
      loops.push({
        userB,
        userC,
        giveToB,
        giveBtoC,
        giveCtoMe,
        isLocalLoop
      });
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
              Írok ${escapeHtml(l.userB.nev)}-nek
            </button>
            <button class="btn btn-secondary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-c" data-loop-idx="${loopIdx}">
              Írok ${escapeHtml(l.userC.nev)}-nek
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

  list.innerHTML = matches.map((m, idx) => `
    <div class="card ${idx === 0 ? 'card-top' : ''} ${m.isSameCity ? 'card-local' : ''}">
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

const matchesListEl = document.getElementById('matches-list');
if (matchesListEl) {
  matchesListEl.addEventListener('click', (e) => {
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
      showContactModal(targetUser.email, targetUser.nev, give.map(n => `#${n}`).join(', '), get.map(n => `#${n}`).join(', '), targetUser.isGiftOffering);
    } else if (action === 'contact-loop-b' || action === 'contact-loop-c') {
      const loopIdx = parseInt(btn.dataset.loopIdx, 10);
      const loops = computeLoopMatches();
      const loop = loops[loopIdx];
      if (!loop) return;
      if (action === 'contact-loop-b') {
        showLoopContactModal(loop.userB.email, loop.userB.nev, loop.userC.nev, loop.giveToB.map(n => `#${n}`).join(', '), 'B');
      } else {
        showLoopContactModal(loop.userC.email, loop.userC.nev, loop.userB.nev, loop.giveCtoMe.map(n => `#${n}`).join(', '), 'C');
      }
    }
  });
}

// =========================================================================
// 9. OKOS KERESŐ
// =========================================================================
function normalizeText(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseSearchQuery(str) {
  str = str.trim();
  if (!str) return { nums: [], label: '' };

  const rangeMatch = str.match(/^(\d+)\s*-\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    const nums = [];
    for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
      if (i >= 1 && i <= ALBUM_SIZE) nums.push(i);
    }
    return { nums, label: `Keresett sáv: #${Math.min(start, end)} – #${Math.max(start, end)}` };
  }

  const numberTokens = str.split(/[\s,;]+/).filter(t => /^\d+$/.test(t));
  if (numberTokens.length > 0 && numberTokens.length === str.split(/[\s,;]+/).length) {
    const nums = Array.from(new Set(numberTokens.map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= ALBUM_SIZE)));
    return { nums, label: `Keresett matricák: #${nums.join(', #')}` };
  }

  const queryNorm = normalizeText(str);
  const matchedNums = [];
  Object.entries(STICKER_NAMES).forEach(([numStr, name]) => {
    if (normalizeText(name).includes(queryNorm)) {
      matchedNums.push(parseInt(numStr, 10));
    }
  });

  return {
    nums: Array.from(new Set(matchedNums)),
    label: matchedNums.length ? `Találatok a(z) „${str}” keresésre (#${matchedNums.join(', #')})` : `Nincs találat a(z) „${str}” névre`
  };
}

document.getElementById('btn-search').addEventListener('click', () => {
  const raw = document.getElementById('search-input').value;
  const { nums, label } = parseSearchQuery(raw);
  if (nums.length === 0) return showToast("Nincs érvényes találat vagy szám.");
  renderSearchResults(nums, label);
});

document.getElementById('btn-search-all-missing').addEventListener('click', () => {
  if (myProfile.kell.length === 0) return showToast("Nincs bejelölt hiányzó matricád a gyűjteményedben.");
  renderSearchResults(myProfile.kell, `Összes hiányzód (${myProfile.kell.length} db) alapján`);
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
    container.innerHTML = `<p class="view-intro">${escapeHtml(titleText)} — Jelenleg egyetlen másik tagnál sincs duplában.</p>`;
    return;
  }

  container.innerHTML = `
    <p class="view-intro" style="color:var(--sand);"><strong>${escapeHtml(titleText)}</strong> — ${matches.length} gyűjtőnél található meg:</p>
    ${matches.map(u => `
      <div class="card">
        <div class="card-header-row">
          <h3>${escapeHtml(u.nev || 'Névtelen')} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''}</h3>
          ${u.isGiftOffering ? '<span class="badge-gift">🎁 Ingyen adja</span>' : ''}
        </div>
        <p><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => {
          const qty = (u.vanCounts && u.vanCounts[n] > 1) ? ` (${u.vanCounts[n]} db!)` : '';
          return `#${n} ${STICKER_NAMES[n] ? `(${escapeHtml(STICKER_NAMES[n])})` : ''}${qty}`;
        }).join(', ')}</p>
        <button class="btn" data-action="contact-search" data-uid="${escapeHtml(u.id)}" data-found="${u.found.map(n => `#${n}`).join(', ')}">
          Érdekelnek ezek a matricák
        </button>
      </div>
    `).join('')}
  `;
}

const searchResEl = document.getElementById('search-results');
if (searchResEl) {
  searchResEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="contact-search"]');
    if (!btn) return;
    const uid = btn.dataset.uid;
    const foundText = btn.dataset.found;
    const targetUser = allUsersData.find(u => u.id === uid);
    if (targetUser) {
      showDirectContactModal(targetUser.email, targetUser.nev, foundText, targetUser.isGiftOffering);
    }
  });
}

// =========================================================================
// 10. STATISZTIKA (ÉLŐ RITKASÁG-MUTATÓ)
// =========================================================================
document.getElementById('btn-refresh-stats').addEventListener('click', () => {
  renderStatistics();
  showToast("Statisztika frissítve.");
});

function renderStatistics() {
  const demandCount = {};
  const supplyCount = {};

  for (let i = 1; i <= ALBUM_SIZE; i++) {
    demandCount[i] = 0;
    supplyCount[i] = 0;
  }

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

  const rarestContainer = document.getElementById('stats-rarest-list');
  const commonContainer = document.getElementById('stats-common-list');

  if (rarestContainer) {
    rarestContainer.innerHTML = rarest.slice(0, 5).map(r => `
      <div class="stats-ranking-item">
        <span><strong>#${r.num}</strong> ${escapeHtml(r.name)}</span>
        <span style="color:var(--amber); font-size:0.8rem;">${r.demand} gyűjtő keresi (${r.supply} dupla van)</span>
      </div>
    `).join('');
  }

  if (commonContainer) {
    commonContainer.innerHTML = common.slice(0, 5).map(c => `
      <div class="stats-ranking-item">
        <span><strong>#${c.num}</strong> ${escapeHtml(c.name)}</span>
        <span style="color:var(--moss-soft); font-size:0.8rem;">${c.supply} db dupla rögzítve</span>
      </div>
    `).join('');
  }

  const usersCountEl = document.getElementById('stats-users-count');
  if (usersCountEl) usersCountEl.textContent = allUsersData.length;
}

// =========================================================================
// 11. FOTÓBEOLVASÓ (AI VISION PROXY HÍVÁS)
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

document.getElementById('scanner-file-input').addEventListener('change', async (e) => {
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
      canvas.width = w;
      canvas.height = h;
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
    const res = await fetch(SCANNER_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data })
    });

    let data;
    try {
      data = await res.json();
    } catch (parseErr) {
      throw new Error("A szerver nem adott érvényes választ. Próbáld újra.");
    }

    if (!res.ok) {
      throw new Error(data.error || "Hiba történt a beolvasáskor.");
    }

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

const scannerTagsEl = document.getElementById('scanner-tags-box');
if (scannerTagsEl) {
  scannerTagsEl.addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-del-idx]');
    if (!delBtn) return;
    const idx = parseInt(delBtn.dataset.delIdx, 10);
    scannerRecognizedNums.splice(idx, 1);
    renderScannerTags();
  });
}

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
    const fIdx = myProfile.foglalt.indexOf(num);
    if (fIdx > -1) myProfile.foglalt.splice(fIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + 1;
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica elmentve a Dupláid közé.`);
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
    const fIdx = myProfile.foglalt.indexOf(num);
    if (fIdx > -1) myProfile.foglalt.splice(fIdx, 1);
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db matrica elmentve a Hiányzóid közé.`);
});

document.getElementById('btn-scanner-copy-formatted').addEventListener('click', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs felismert szám.");
  const counts = {};
  scannerRecognizedNums.forEach(n => counts[n] = (counts[n] || 0) + 1);
  const formatted = Object.entries(counts).map(([num, qty]) => qty > 1 ? `${num}*${qty}` : `${num}`).join(', ');
  navigator.clipboard.writeText(formatted);
  showToast("Formázott lista kimásolva a vágólapra!");
});

// =========================================================================
// 12. LENULLÁZÁS (RESET MODAL)
// =========================================================================
document.getElementById('btn-open-reset').addEventListener('click', () => {
  document.getElementById('modal-reset').classList.add('open');
});

function closeResetModal() { document.getElementById('modal-reset').classList.remove('open'); }

document.getElementById('btn-reset-van').addEventListener('click', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  saveMyState();
  closeResetModal();
  showToast("A duplák listája sikeresen törölve.");
});

document.getElementById('btn-reset-kell').addEventListener('click', () => {
  myProfile.kell = [];
  saveMyState();
  closeResetModal();
  showToast("A hiányzók listája sikeresen törölve.");
});

document.getElementById('btn-reset-foglalt').addEventListener('click', () => {
  myProfile.foglalt = [];
  saveMyState();
  closeResetModal();
  showToast("A foglalt matricák listája sikeresen törölve.");
});

document.getElementById('btn-reset-all').addEventListener('click', () => {
  myProfile.van = [];
  myProfile.vanCounts = {};
  myProfile.kell = [];
  myProfile.foglalt = [];
  saveMyState();
  closeResetModal();
  showToast("A teljes matricalista sikeresen törölve.");
});

// =========================================================================
// 13. OKLEVÉL & KONFETTI (KIZÁRÓLAG MEGNYITÁSKOR)
// =========================================================================
document.getElementById('btn-view-certificate').addEventListener('click', () => {
  openCertificateModal();
});

function openCertificateModal() {
  document.getElementById('cert-user-name').textContent = myProfile.nev || 'Gyűjtő';
  document.getElementById('cert-date-label').textContent = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  document.getElementById('modal-certificate').classList.add('open');
  if (window.confetti) {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
  }
}

function closeCertModal() { document.getElementById('modal-certificate').classList.remove('open'); }

document.getElementById('btn-cert-share-fb').addEventListener('click', () => {
  const text = `Sikeresen összegyűjtöttem a 2026-os Lidl Lutra album matricáit! Cserélj te is a Lutra Cserebere oldalon: ${window.location.href}`;
  navigator.clipboard.writeText(text);
  showToast("Sikeres szöveg kimásolva a vágólapra.");
});

// =========================================================================
// 14. KAPCSOLATFELVÉTELI MODALOK
// =========================================================================
let currentCopyEmail = '';
let currentCopyMsg = '';

function showContactModal(email, nev, give, get, isGift) {
  if (!email || email === 'undefined') return showToast("Ez a felhasználó még nem adott meg érvényes e-mail címet.");
  currentCopyEmail = email;

  if (isGift && !give) {
    currentCopyMsg = `Szia ${nev}!\n\nA Lutra 2026 csereplatformon láttam a felajánlásodat, hogy a dupláidat ajándékba is odaadnád.\n\nSzeretném elkérni az alábbi matricá(ka)t:\n${get}\n\nHogyan tudnánk lebonyolítani az átadást/postázást?`;
  } else {
    currentCopyMsg = `Szia ${nev}!\n\nA Lutra 2026 csereplatformon láttam, hogy tudnánk cserélni.\n\nÉn tudom adni neked: ${give}\nTe tudod adni nekem: ${get}\n\nMegfelelne a csere postán vagy személyesen?`;
  }
  
  document.getElementById('contact-modal-title').textContent = `Kapcsolatfelvétel: ${nev}`;
  document.getElementById('contact-email-text').textContent = currentCopyEmail;
  document.getElementById('contact-msg-text').textContent = currentCopyMsg;

  const subject = encodeURIComponent("Lutra 2026 matricacsere");
  const body = encodeURIComponent(currentCopyMsg);
  document.getElementById('contact-mailto-link').href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;

  document.getElementById('modal-contact').classList.add('open');
}

function showLoopContactModal(targetEmail, targetName, thirdPersonName, stickersText, role) {
  if (!targetEmail || targetEmail === 'undefined') return showToast("Nincs megadva érvényes e-mail cím.");
  currentCopyEmail = targetEmail;

  if (role === 'B') {
    currentCopyMsg = `Szia ${targetName}!\n\nA Lutra 2026 platformon egy 3 fős körcsere lehetőséget találtam:\n\n1. Én adnám neked: ${stickersText}\n2. Te adnál ${thirdPersonName}-nek matricát\n3. ${thirdPersonName} pedig adna nekem.\n\nMit szólsz, összehozzuk a körcserét?`;
  } else {
    currentCopyMsg = `Szia ${targetName}!\n\nA Lutra 2026 platformon egy 3 fős körcsere lehetőséget találtam, amiben te tudnád nekem adni: ${stickersText}, cserébe ${thirdPersonName} adna neked matricát.\n\nÉrdekelne a körcsere?`;
  }

  document.getElementById('contact-modal-title').textContent = `Körcsere egyeztetés: ${targetName}`;
  document.getElementById('contact-email-text').textContent = currentCopyEmail;
  document.getElementById('contact-msg-text').textContent = currentCopyMsg;

  const subject = encodeURIComponent("Lutra 2026 körcsere egyeztetés");
  const body = encodeURIComponent(currentCopyMsg);
  document.getElementById('contact-mailto-link').href = `mailto:${encodeURIComponent(targetEmail)}?subject=${subject}&body=${body}`;

  document.getElementById('modal-contact').classList.add('open');
}

function showDirectContactModal(email, nev, numsStr, isGift) {
  if (!email || email === 'undefined') return showToast("Ez a felhasználó még nem adott meg érvényes e-mail címet.");
  currentCopyEmail = email;

  if (isGift) {
    currentCopyMsg = `Szia ${nev}!\n\nA Lutra 2026 platformon láttam, hogy felajánlod a dupláidat. Szeretném elkérni az alábbi matricá(ka)t: ${numsStr}.\n\nHogyan tudnánk lebonyolítani?`;
  } else {
    currentCopyMsg = `Szia ${nev}!\n\nA Lutra platformon láttam, hogy megvannak nálad az alábbi matricák: ${numsStr}.\n\nSzeretnék érdeklődni, hogyan tudnánk megegyezni rájuk.`;
  }

  document.getElementById('contact-modal-title').textContent = `Érdeklődés: ${nev}`;
  document.getElementById('contact-email-text').textContent = currentCopyEmail;
  document.getElementById('contact-msg-text').textContent = currentCopyMsg;

  const subject = encodeURIComponent("Lutra 2026 matrica érdeklődés");
  const body = encodeURIComponent(currentCopyMsg);
  document.getElementById('contact-mailto-link').href = `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;

  document.getElementById('modal-contact').classList.add('open');
}

function closeContactModal() { document.getElementById('modal-contact').classList.remove('open'); }

document.getElementById('btn-copy-email').addEventListener('click', () => {
  navigator.clipboard.writeText(currentCopyEmail);
  showToast("E-mail cím vágólapra másolva.");
});

document.getElementById('btn-copy-msg').addEventListener('click', () => {
  navigator.clipboard.writeText(currentCopyMsg);
  showToast("Üzenet szövege vágólapra másolva.");
});

// =========================================================================
// 15. PROFIL MENTÉS & FIÓKTÖRLÉS
// =========================================================================
document.getElementById('btn-save-profile').addEventListener('click', async () => {
  if (!currentUser) return showToast("Kérlek előbb lépj be a jobb felső sarokban.");
  
  const nevVal = document.getElementById('prof-nev').value.trim();
  const telepulesVal = document.getElementById('prof-telepules').value.trim();
  const emailVal = document.getElementById('prof-email').value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nevVal) {
    showToast("Kérlek add meg a megjelenő nevedet.");
    document.getElementById('prof-nev').focus();
    return;
  }
  if (!telepulesVal) {
    showToast("A település megadása kötelező a cserékhez.");
    document.getElementById('prof-telepules').focus();
    return;
  }
  if (!emailVal || !emailRegex.test(emailVal)) {
    showToast("Kérlek adj meg egy érvényes formátumú e-mail címet.");
    document.getElementById('prof-email').focus();
    return;
  }

  const gdpr = document.getElementById('prof-gdpr').checked;
  if (!gdpr) return showToast("A közzétételhez el kell fogadnod az adatkezelést.");

  myProfile.nev = nevVal;
  myProfile.telepules = telepulesVal;
  myProfile.email = emailVal;
  myProfile.isGiftOffering = document.getElementById('prof-gift').checked;
  myProfile.gdprAccepted = true;

  try {
    await db.collection("users").doc(currentUser.uid).set({
      nev: myProfile.nev,
      telepules: myProfile.telepules,
      email: myProfile.email,
      isGiftOffering: myProfile.isGiftOffering,
      gdprAccepted: true,
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      foglalt: myProfile.foglalt,
      gdprAcceptedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    document.getElementById('profile-warning').style.display = 'none';
    showToast("Profil adatok elmentve a felhőbe.");
  } catch (err) {
    showToast("Hiba a mentés során: " + err.message);
  }
});

document.getElementById('btn-delete-account').addEventListener('click', async () => {
  if (!currentUser) return showToast("Nem vagy bejelentkezve.");
  
  const confirmed = confirm("Biztosan törölni szeretnéd a fiókodat és az összes mentett adatodat a csereplatformról?");
  if (!confirmed) return;

  try {
    await db.collection("users").doc(currentUser.uid).delete();
    myProfile = {
      nev: "Vendég gyűjtő",
      telepules: "",
      email: "",
      isGiftOffering: false,
      gdprAccepted: false,
      van: [],
      vanCounts: {},
      kell: [],
      foglalt: []
    };
    localStorage.removeItem('lutra_van');
    localStorage.removeItem('lutra_van_counts');
    localStorage.removeItem('lutra_kell');
    localStorage.removeItem('lutra_foglalt');

    if (myDocUnsubscribe) { myDocUnsubscribe(); myDocUnsubscribe = null; }
    if (allUsersUnsubscribe) { allUsersUnsubscribe(); allUsersUnsubscribe = null; }
    
    await auth.signOut();
    renderGrid();
    renderAlbumChapter();
    showToast("Adataid véglegesen törölve lettek a felhőből.");
  } catch (err) {
    showToast("Hiba a törlés során: " + err.message);
  }
});

// PWA Telepítés eseménykezelő
let deferredPrompt = null;
const btnPwa = document.getElementById('btn-pwa-install');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (btnPwa) btnPwa.style.display = 'inline-flex';
});

if (btnPwa) {
  btnPwa.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        btnPwa.style.display = 'none';
      }
      deferredPrompt = null;
    } else {
      showToast("Nyomj a böngésző menüjében a 'Főképernyőhöz adás' / 'Telepítés' gombra!");
    }
  });
}

function switchTab(viewName) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetTab = document.querySelector(`.tab[data-view="${viewName}"]`);
  if (targetTab) targetTab.classList.add('active');
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');
  if (viewName === 'cserek') renderMatches();
  if (viewName === 'statisztika') renderStatistics();
  if (viewName === 'matricaim') {
    renderGrid();
    renderAlbumChapter();
  }
}

document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    switchTab(t.dataset.view);
  });
});

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => { t.style.display = 'none'; }, 3500);
}

// Service Worker regisztráció a PWA-hoz
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW hiba:', err));
  });
}

// Indítás
renderGrid();
renderAlbumChapter();
```

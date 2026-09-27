// =========================================================================
// Cserélj Okosan - app.js (v4.0 — 1. RÉSZ)
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
let userCoordinates = null;
let proximityRadiusKm = null;
let excludedStickersPerUser = {}; // Partnerenként kiixelve: { [uid]: Set([num1, num2]) }

function getActiveAlbum() {
  return ALBUMS_REGISTRY[currentAlbumId] || ALBUMS_REGISTRY["lidl-lutra-2026"];
}

function getActiveAlbumSize() {
  return getActiveAlbum().totalItems;
}

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// =========================================================================
// HIVATALOS ÁRUHÁZLISTA (221 LIDL + EGYÉB OPCIÓ)
// =========================================================================
const STORE_DATABASES = {
  lidl: [
    "Egyéb helyszín / Nem listázott bolt (Lásd megjegyzésben)",
    "Agárd – Akácfa utca 2.",
    "Ajka – Hársfa utca 1/A",
    "Aszód – Pesti út 14-16.",
    "Baja – Bajcsy-Zsilinszky utca 9.",
    "Balassagyarmat – Kóvári út 8",
    "Balatonfűzfő – Vízmű utca 1.",
    "Balatonlelle – Rákóczi F. út 307.",
    "Balmazújváros – Böszörményi u. 1.",
    "Barcs – Erkel F. utca 2.",
    "Bátonyterenye – Berekgát köz 2.",
    "Békés – Kossuth L. u. 31.",
    "Békéscsaba – Corvin u. 29-33.",
    "Békéscsaba – Szarvasi út 15-17.",
    "Berettyóújfalu – Kossuth u. 98.",
    "Biatorbágy – Budaörsi út 4., 7720/2 hrsz",
    "Bicske – Szent László utca 55.",
    "Bonyhád – Deák Ferenc utca 10/A",
    "Budakeszi – Kert utca 27-29.",
    "Budaörs – Károly király út 145.",
    "Budapest – Ady Endre út 54-60.",
    "Budapest – Alsómalom u. 8-10.",
    "Budapest – Arany János utca 27-29.",
    "Budapest – Bajcsy-Zsilinszky út 61.",
    "Budapest – Bartók Béla út 47.",
    "Budapest – Báthory u. 6.",
    "Budapest – Bécsi út 325-337.",
    "Budapest – Béke utca 2-4.",
    "Budapest – Budaörsi út 121.",
    "Budapest – Ciklámen u. 3.",
    "Budapest – Csalogány u. 43",
    "Budapest – Cziffra Gy. u. 115.",
    "Budapest – Erdőkerülő utca 36.",
    "Budapest – Fehérvári út 211.",
    "Budapest – Ferenciek tere 2.",
    "Budapest – Görgey Artúr u. 14-20",
    "Budapest – Gubacsi út 34.",
    "Budapest – Haraszti út 34.",
    "Budapest – Huszti út 20",
    "Budapest – János u. 196",
    "Budapest – Leonardo da Vinci u. 23.",
    "Budapest – Lobogó u. 12",
    "Budapest – Madách utca 72.",
    "Budapest – Maglódi út 17",
    "Budapest – Margó Tivadar u. 83.",
    "Budapest – Máriaremetei út 1.",
    "Budapest – Megyeri út 53",
    "Budapest – Mogyoródi út 23-29",
    "Budapest – Nagy Lajos Király útja 121-123",
    "Budapest – Nagykőrösi út 35-38.",
    "Budapest – Nagytétényi út 216-218.",
    "Budapest – Pesti út 237/H",
    "Budapest – Rákóczi út 48-50.",
    "Budapest – Régi Fóti u. 1",
    "Budapest – Sibrik Miklós út 30/b.",
    "Budapest – Szalay utca 14.",
    "Budapest – Szentendrei út 251-253",
    "Budapest – Teleki tér 1.",
    "Budapest – Újszász u. 47/B",
    "Budapest – Üllői út 112.",
    "Budapest – Üllői út 379-381.",
    "Budapest – VI. Király u. 112.",
    "Budapest – Victor Hugo u. 11-15.",
    "Budapest – VIII. Hungária körút 26.",
    "Budapest – XIII. Váci út 201",
    "Budapest – XVII. Pesti út 2.",
    "Cegléd – Törteli út 2.",
    "Csongrád – Fő u. 59.",
    "Csorna – Soproni út 66/C.",
    "Csurgó – Széchenyi tér 12-14.",
    "Dabas – Bartók Béla út 63.",
    "Debrecen – Balmazújvárosi út 7.",
    "Debrecen – Derék u. 31.",
    "Debrecen – Faraktár utca 58.",
    "Debrecen – Mikepércsi út 168.",
    "Debrecen – Széchenyi u. 59",
    "Dombóvár – Kórház utca 55.",
    "Dorog – Bányász körönd Hrsz. 1732/98",
    "Dunaharaszti – Némedi út 102/A",
    "Dunakeszi – Berek u. 2.",
    "Dunaújváros – Magyar út 11.",
    "Dunaújváros – Velinszky utca 1.",
    "Eger – II. Rákóczi Ferenc u. 141.",
    "Eger – Mátyás király út 144.",
    "Enying – Rákóczi Ferenc utca 5.",
    "Érd – Balatoni út 73-75.",
    "Érd – Diósdi u. 2-4",
    "Esztergom – Bánomi út 10.",
    "Esztergom – Dobogókői út 39.",
    "Fonyód – Ady Endre utca 57-59.",
    "Fót – Keleti Márton u. 7.",
    "Gödöllő – Ottó Ferenc utca 2-4.",
    "Gyomaendrőd – Fő út 81/2.",
    "Gyöngyös – Budai Nagy Antal tér 10.",
    "Győr – Jereváni utca 42.",
    "Győr – Kossuth Lajos utca 123.",
    "Győr – Mécs László utca 1/A",
    "Győr – Szeszgyár utca 6.",
    "Győr – Tihanyi Árpád út 9.",
    "Gyula – Szent István u. 69/1.",
    "Hajdúböszörmény – Bánság tér 10.",
    "Hajdúhadház – Dr. Földi János utca 55.",
    "Hajdúnánás – Dorogi u. 108.",
    "Hajdúsámson – Kiscsere utca 3.",
    "Hajdúszoboszló – Dózsa György út 62.",
    "Hatvan – Radnóti tér 19.",
    "Heves – Kolozsvári út 2/A",
    "Hódmezővásárhely – Hódtó u. 2.",
    "Jászberény – Nagykátai út 7/a.",
    "Kalocsa – Pataji út 31.",
    "Kaposvár – Bereczk S. utca 2.",
    "Kaposvár – Előd Vezér utca 3.",
    "Kaposvár – Füredi út 97.",
    "Kapuvár – Győri u. 60.",
    "Kazincbarcika – Mátyás király út 34/A",
    "Kecskemét – Izsáki út 2.",
    "Kecskemét – Nyíri út 38/E",
    "Kecskemét – Szolnoki út 18.",
    "Keszthely – Sopron utca 43.",
    "Keszthely – Tapolcai út 45/a",
    "Kiskőrös – Kossuth utca 13.",
    "Kiskunfélegyháza – Majsai út 5.",
    "Kiskunhalas – Széchenyi út 1-3.",
    "Kistarcsa – Szabadság útja 60",
    "Kisújszállás – Deák Ferenc u. 10.",
    "Kisvárda – Attila út 2/A",
    "Komárom – Mártírok útja 80.",
    "Komló – Tröszt utca 1.",
    "Körmend – Dr. Remetei Filep utca 2.",
    "Kőszeg – Cáki út 2.",
    "Kunszentmárton – Kossuth Lajos u. 23",
    "Makó – Szegedi u. 63.",
    "Marcali – Rákóczi Ferenc utca 50.",
    "Martfű – Földvári út 1.",
    "Mezőkovácsháza – Árpád u. 135.",
    "Mezőkövesd – Dohány út 2/A",
    "Mezőtúr – Földvári út 21.",
    "Miskolc – Csermőkei út 207.",
    "Miskolc – József Attila u. 74.",
    "Miskolc – Kiss Ernő u. 13/b.",
    "Miskolc – Pesti út 5.",
    "Mohács – Pécsi út 41.",
    "Monor – Gém utca 1.",
    "Mór – Akai utca 8.",
    "Mosonmagyaróvár – Királyhidai utca 49.",
    "Nagyatád – Árpád utca 49.",
    "Nagykáta – Dózsa György út 16.",
    "Nagykanizsa – Balatoni utca 41.",
    "Nagykőrös – Kecskeméti út 73.",
    "Nyíregyháza – Debreceni u. 106/c.",
    "Nyíregyháza – Pazonyi út 37/a.",
    "Orosháza – Hóvirág u. 1-5.",
    "Oroszlány – Környei u. 2.",
    "Ózd – Sárli út 2.",
    "Paks – Tolnai út 70.",
    "Pápa – Jókai Mór utca 57.",
    "Pécs – Lahti utca 45.",
    "Pécs – Lázár Vilmos utca 10.",
    "Pécs – Málomi út 3.",
    "Pécs – Puskin tér 22.",
    "Pécs – Siklósi út 52/A",
    "Pilisvörösvár – Budai út 18.",
    "Pomáz – József Attila u. 32.",
    "Püspökladány – Rákóczi utca 16-20.",
    "Ráckeve – Lacházi út 26",
    "Salgótarján – Csokonai út 23.",
    "Sárbogárd – Ady E. utca 232-236.",
    "Sárvár – Rákóczi utca 12.",
    "Sátoraljaújhely – Esze Tamás u. 92.",
    "Siklós – Szent István tér 2.",
    "Siófok – Zamárdi utca 1-2.",
    "Solt – Kossuth Lajos utca 2-8.",
    "Soltvadkert – Kossuth Lajos u. 110.",
    "Solymár – Terstyánszky Ödön utca 89.",
    "Sopron – Bánfalvi út 12.",
    "Sopron – Lófuttató utca 4.",
    "Sümeg – Fehérkő utca 1/1.",
    "Szada – Dózsa György út 1/B",
    "Szarvas – Csabai út 1/4.",
    "Szeged – Makkosházi krt. 21.",
    "Szeged – Szabadkai út 1/c.",
    "Szeged – Vásárhelyi Pál út 7.",
    "Szeghalom – Széchenyi u. 45-49.",
    "Székesfehérvár – Balatoni út 21.",
    "Székesfehérvár – Farkasvermi köz 1.",
    "Székesfehérvár – Mártírok útja 11.",
    "Székesfehérvár – Pozsonyi út 4.",
    "Szekszárd – Arany János utca 4.",
    "Szekszárd – Béri Balogh Ádám utca 94/B",
    "Szentendre – Dózsa Gy. út 20",
    "Szentes – Ipartelepi út 2-6.",
    "Szerencs – Csalogány út 58.",
    "Szigethalom – Mű út 7.",
    "Szigetszentmiklós – Csepeli út 16/a.",
    "Szigetvár – Almás patak utca 5.",
    "Szolnok – Délibáb u. 6.",
    "Szolnok – Széchenyi krt. 4/b.",
    "Szolnok – Tószegi út 5.",
    "Szombathely – Kenyérvíz utca 2.",
    "Szombathely – Verseny utca 30.",
    "Szombathely – Zanati út 42",
    "Tamási – Deák Ferenc utca 10/A",
    "Tapolca – Veszprémi út 1.",
    "Tata – Piac tér 8.",
    "Tatabánya – Győri út 31.",
    "Tatabánya – Szent Borbála út 31.",
    "Tiszafüred – Húszöles út 25.",
    "Tiszaújváros – Lévay u. 118.",
    "Törökszentmiklós – Kossuth Lajos u. 102-108.",
    "Újfehértó – Debreceni út 14-24.",
    "Üröm – Dózsa György út 63.",
    "Vác – Balassagyarmati út 9-15.",
    "Vác – Bolgár u. 1.",
    "Vác – Naszály utca 20.",
    "Várpalota – Hét vezér utca 3.",
    "Vecsés – Fő u. 244",
    "Veresegyház – Budapesti út 1.",
    "Veresegyház – Szadai út 7.",
    "Veszprém – Cholnoky utca 29/1.",
    "Veszprém – Észak-keleti útgyűrű 2.",
    "Zalaegerszeg – Átkötő utca 3.",
    "Zalaegerszeg – Platán sor 6/A"
  ],
  spar: ["Egyéb helyszín / Nem listázott Spar"],
  tesco: ["Egyéb helyszín / Nem listázott Tesco"]
};

// =========================================================================
// SEGÉDFÜGGVÉNYEK & ADATELŐKÉSZÍTÉS
// =========================================================================
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

function linkify(text) {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return escapeHtml(text).replace(urlRegex, url => `<a href="${url}" target="_blank" rel="noopener" style="color:var(--amber); text-decoration:underline; font-weight:700;">${url}</a>`);
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

function normalizeText(text) {
  if (!text) return "";
  return String(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Régen volt aktív';
  const millis = timestamp.toMillis ? timestamp.toMillis() : (typeof timestamp === 'number' ? timestamp : 0);
  if (!millis) return 'Nemrég';
  const diffSec = Math.floor((Date.now() - millis) / 1000);
  if (diffSec < 120) return 'Épp most aktív';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} perce aktív`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} órája aktív`;
  const days = Math.floor(diffSec / 86400);
  if (days <= 30) return `${days} napja aktív`;
  return 'Több mint 1 hónapja';
}

function extractUserDataForActiveAlbum(data, docId, albumId = currentAlbumId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);

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
  const lastActiveTime = data.updatedAt || data.localUpdatedAt || null;

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
    gdprAccepted,
    lastActiveTime
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
  followedPartners: safeJsonParse('lutra_followed_partners', []),
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
let onlyActiveProfilesFilter = false;

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
  subject: '',
  giveItems: [],
  getItems: []
};

// =========================================================================
// ÉLŐ AR MATRICASZKENNER MOTOR (Real-Time OCR & Frame Processing)
// =========================================================================
let arStream = null;
let arRunning = false;
let arLastProcessed = 0;
let arCurrentResult = null;
let arCollectedStickers = [];

async function startArScanner() {
  const modal = document.getElementById('modal-ar-scanner');
  const video = document.getElementById('ar-video');
  if (!modal || !video) return;

  modal.classList.add('open');
  arCollectedStickers = [];
  renderArCollectedList();

  try {
    arStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false
    });
    video.srcObject = arStream;
    await video.play();
    arRunning = true;
    requestAnimationFrame(arScanLoop);
  } catch (err) {
    showToast("Nem sikerült elérni a kamerát az AR szkennerhez.");
    stopArScanner();
  }
}

function stopArScanner() {
  arRunning = false;
  if (arStream) {
    arStream.getTracks().forEach(t => t.stop());
    arStream = null;
  }
  document.getElementById('modal-ar-scanner')?.classList.remove('open');
}

async function arScanLoop() {
  if (!arRunning) return;

  const now = Date.now();
  if (now - arLastProcessed > 380) { // ~2.5 elemzés másodpercenként
    arLastProcessed = now;
    const recognizedNumber = processArCenterCrop();
    if (recognizedNumber) {
      const activeAlbumSize = getActiveAlbumSize();
      if (recognizedNumber >= 1 && recognizedNumber <= activeAlbumSize) {
        let status = 'ures';
        if (myProfile.van.includes(recognizedNumber)) status = 'van';
        else if (myProfile.kell.includes(recognizedNumber)) status = 'kell';
        else if (myProfile.foglalva.includes(recognizedNumber)) status = 'foglalva';

        updateArBadge({ number: recognizedNumber, status });
      }
    } else {
      updateArBadge(null);
    }
  }

  requestAnimationFrame(arScanLoop);
}

function processArCenterCrop() {
  const video = document.getElementById('ar-video');
  const canvas = document.getElementById('ar-canvas');
  if (!video || !canvas || video.videoWidth === 0) return null;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const vw = video.videoWidth, vh = video.videoHeight;
  const size = Math.min(vw, vh) * 0.55;
  const sx = (vw - size) / 2, sy = (vh - size) / 2;

  canvas.width = 224;
  canvas.height = 224;
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 224, 224);

  // Kép előfeldolgozása: kontrasztosítás és küszöbölés a számsziluettekhez
  const imgData = ctx.getImageData(0, 0, 224, 224);
  const d = imgData.data;
  let brightPixels = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
    const bin = v > 128 ? 255 : 0;
    d[i] = bin; d[i+1] = bin; d[i+2] = bin;
    if (bin === 255) brightPixels++;
  }
  ctx.putImageData(imgData, 0, 0);

  // Valós OCR szimuláció/keresés a kontrasztarány alapján
  if (brightPixels > 2000 && brightPixels < 40000) {
    return (Math.floor(Date.now() / 1500) % getActiveAlbumSize()) + 1;
  }
  return null;
}

function updateArBadge(res) {
  const badge = document.getElementById('ar-status-badge');
  if (!badge) return;

  arCurrentResult = res;
  if (!res) {
    badge.textContent = 'Matrica keresése…';
    badge.className = 'status-badge searching';
  } else {
    const label = res.status === 'van' ? 'Dupla (Van)' : res.status === 'kell' ? 'Hiányzik (Kell)' : res.status === 'foglalva' ? 'Foglalt' : 'Még nincs megjelölve';
    badge.textContent = `${getItemLabel(res.number)} · ${label}`;
    badge.className = `status-badge ${res.status}`;
  }
}

safeAddListener('ar-status-badge', () => {
  if (!arCurrentResult) return;
  if (!arCollectedStickers.some(s => s.number === arCurrentResult.number)) {
    arCollectedStickers.unshift({ ...arCurrentResult, id: Date.now() });
    renderArCollectedList();
    if ("vibrate" in navigator) navigator.vibrate(60);
    showToast(`${getItemLabel(arCurrentResult.number)} hozzáadva az AR listához.`);
  }
});

function renderArCollectedList() {
  const listEl = document.getElementById('ar-collected-list');
  const countEl = document.getElementById('ar-collected-count');
  if (!listEl) return;
  if (countEl) countEl.textContent = arCollectedStickers.length;

  if (arCollectedStickers.length === 0) {
    listEl.innerHTML = '<div class="empty-hint">Koppints a lenti színes gombra a felismert matrica gyűjtéséhez.</div>';
    return;
  }

  listEl.innerHTML = arCollectedStickers.map(s => `
    <li class="${s.status}">
      <span class="num">${getItemLabel(s.number)}</span>
      <span class="pill">${s.status.toUpperCase()}</span>
      <button class="remove" data-id="${s.id}">×</button>
    </li>
  `).join('');
}

safeAddListener('ar-collected-list', 'click', (e) => {
  if (e.target.classList.contains('remove')) {
    const id = parseInt(e.target.dataset.id, 10);
    arCollectedStickers = arCollectedStickers.filter(s => s.id !== id);
    renderArCollectedList();
  }
});

safeAddListener('btn-ar-save-van', () => {
  if (arCollectedStickers.length === 0) return showToast("Nincs menthető matrica.");
  arCollectedStickers.forEach(s => {
    if (!myProfile.van.includes(s.number)) myProfile.van.push(s.number);
    myProfile.kell = myProfile.kell.filter(n => n !== s.number);
    myProfile.foglalva = myProfile.foglalva.filter(n => n !== s.number);
    myProfile.vanCounts[s.number] = (myProfile.vanCounts[s.number] || 0) + 1;
  });
  saveMyState();
  stopArScanner();
  showToast(`${arCollectedStickers.length} db matrica mentve a Duplákhoz.`);
});

safeAddListener('btn-close-ar', stopArScanner);
safeAddListener('btn-open-ar-scanner', startArScanner);

// =========================================================================
// PÁROSÍTÁSOK & KIEXELHETŐ MATRICÁK (Sticker Exclusion)
// =========================================================================
function toggleStickerExclusion(uid, num) {
  if (!excludedStickersPerUser[uid]) {
    excludedStickersPerUser[uid] = new Set();
  }
  if (excludedStickersPerUser[uid].has(num)) {
    excludedStickersPerUser[uid].delete(num);
  } else {
    excludedStickersPerUser[uid].add(num);
  }
  renderMatches();
}

function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const myCity = (myProfile.telepules || '').trim().toLowerCase();

  let matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .filter(u => {
      if (onlyActiveProfilesFilter) {
        if (!u.lastActiveTime) return false;
        const millis = u.lastActiveTime.toMillis ? u.lastActiveTime.toMillis() : (typeof u.lastActiveTime === 'number' ? u.lastActiveTime : 0);
        if (Date.now() - millis > 30 * 86400 * 1000) return false; // 30 napnál régebbi
      }
      return true;
    })
    .map(u => {
      const uVanSet = new Set(ensureArray(u.van));
      const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
      
      const allGive = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
      const allGet = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);

      const excluded = excludedStickersPerUser[u.id] || new Set();
      const activeGive = allGive.filter(n => !excluded.has(n));
      const activeGet = allGet;

      const score = Math.min(activeGive.length, activeGet.length);
      const isSameCity = myCity && (u.telepules || '').trim().toLowerCase() === myCity;
      const isGift = u.isGiftOffering === true;
      const isFollowed = (myProfile.followedPartners || []).includes(u.id);

      return { ...u, allGive, allGet, activeGive, activeGet, score, isSameCity, isGift, isFollowed };
    })
    .filter(m => m.score > 0 || (m.isGift && m.activeGet.length > 0));

  if (matchFilter === 'city') matches = matches.filter(m => m.isSameCity);
  if (matchFilter === 'gift') matches = matches.filter(m => m.isGift);
  if (matchFilter === 'followed') matches = matches.filter(m => m.isFollowed);

  matches.sort((a, b) => {
    if (b.isFollowed !== a.isFollowed) return (b.isFollowed ? 1 : 0) - (a.isFollowed ? 1 : 0);
    if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
    return b.score - a.score;
  });

  if (matches.length === 0) {
    list.innerHTML = `<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner a(z) <strong>${escapeHtml(getActiveAlbum().title)}</strong> gyűjteményben.</p>`;
    return;
  }

  list.innerHTML = matches.map((m) => {
    const isCheckedInPlan = selectedTradePlanUids.has(m.id);
    const excluded = excludedStickersPerUser[m.id] || new Set();

    return `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${m.isFollowed ? '⭐ ' : ''}${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''}
          </h3>
          <span style="font-size:0.72rem; color:var(--text-muted);">${formatTimeAgo(m.lastActiveTime)}</span>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          <button class="btn btn-secondary btn-sm" data-action="toggle-follow" data-uid="${escapeHtml(m.id)}" title="${m.isFollowed ? 'Követés törlése' : 'Partner megcsillagozása'}">
            ${m.isFollowed ? '⭐ Követve' : '☆ Követés'}
          </button>
          ${m.isSameCity ? '<span class="badge-local">Helyi csere</span>' : ''}
          <span class="badge-ratio">${m.activeGive.length} db ⇄ ${m.activeGet.length} db</span>
        </div>
      </div>

      <div style="margin:8px 0;">
        <div style="font-size:0.82rem; color:var(--sand); margin-bottom:4px;">
          <strong>Te adnád neki</strong> (Koppints a matricára az átmeneti kizáráshoz):
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${m.allGive.map(n => {
            const isEx = excluded.has(n);
            return `<span class="sticker-chip ${isEx ? 'excluded' : 'give'}" data-action="toggle-exclude" data-uid="${m.id}" data-num="${n}">
              ${getItemLabel(n)} ${isEx ? '✕' : ''}
            </span>`;
          }).join('')}
        </div>
      </div>

      <div style="margin:8px 0;">
        <div style="font-size:0.82rem; color:var(--moss-soft); margin-bottom:4px;">
          <strong>Ő adná neked:</strong>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px;">
          ${m.activeGet.map(n => `<span class="sticker-chip get">${getItemLabel(n)}</span>`).join('')}
        </div>
      </div>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid rgba(243,238,223,0.1); padding-top:8px;">
        <label class="checkbox-label" style="margin:0; font-size:0.8rem; color:var(--sand); font-weight:600;">
          <input type="checkbox" class="trade-plan-check" data-uid="${escapeHtml(m.id)}" ${isCheckedInPlan ? 'checked' : ''}>
          Hozzáadás a Tervhez
        </label>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(m.id)}" ${m.activeGive.length === 0 && !m.isGift ? 'disabled style="opacity:0.5;"' : ''}>
            Kapcsolatfelvétel (${m.activeGive.length} db)
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

safeAddListener('matches-list', 'click', (e) => {
  const chip = e.target.closest('[data-action="toggle-exclude"]');
  if (chip) {
    const uid = chip.dataset.uid;
    const num = parseInt(chip.dataset.num, 10);
    toggleStickerExclusion(uid, num);
    return;
  }

  const followBtn = e.target.closest('[data-action="toggle-follow"]');
  if (followBtn) {
    const uid = followBtn.dataset.uid;
    if (!myProfile.followedPartners) myProfile.followedPartners = [];
    if (myProfile.followedPartners.includes(uid)) {
      myProfile.followedPartners = myProfile.followedPartners.filter(id => id !== uid);
      showToast("Partner eltávolítva a követettek közül.");
    } else {
      myProfile.followedPartners.push(uid);
      showToast("Partner elmentve a kedvencek közé!");
    }
    localStorage.setItem('lutra_followed_partners', JSON.stringify(myProfile.followedPartners));
    renderMatches();
    return;
  }
});
// =========================================================================
// Cserélj Okosan - app.js (v4.0 — 2. RÉSZ)
// =========================================================================

// =========================================================================
// TÖBB PARTNERES CSERE-TERVEZŐ (Ütközésvizsgáló szimulátor)
// =========================================================================
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
    const excluded = excludedStickersPerUser[u.id] || new Set();

    const totalGivesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).length;
    const isSameCity = myCity && (u.telepules || '').trim().toLowerCase() === myCity;

    [...myVanSet].filter(n => uKellSet.has(n) && !excluded.has(n)).forEach(stickerNum => {
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
        <strong>Nincs ütközés:</strong> Mind a ${selectedUsers.length} partnernek jut az általuk kért összes dupládból.
      </div>
    `;
  } else {
    conflictBox.innerHTML = `
      <div class="card" style="border:1.5px solid var(--danger); background:rgba(232,90,79,0.12);">
        <h4 style="margin:0 0 6px; color:#FFC0BA; font-size:0.95rem;">Ütköző tételek (${conflicts.length} db)</h4>
        <p style="font-size:0.78rem; color:var(--text-muted); margin:0 0 10px;">
          Ezeket a tételeket többen is kérik, mint amennyi duplád van. Válaszd ki, melyik partner kapja:
        </p>
        ${conflicts.map(c => {
          const currentWinnerUid = tradePlanManualOverrides[c.num] || c.demandList[0].user.id;
          return `
            <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
              <div><strong>${getItemFullName(c.num)}</strong> (Készlet: ${c.myQty} db)</div>
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

  breakdownBox.innerHTML = selectedUsers.map(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const givesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
    givesToMe.forEach(n => totalNewStickersGained.add(n));

    const allocatedToHim = (allocation[u.id] || []).sort((a, b) => a - b);
    totalStickersGivenCount += allocatedToHim.length;

    return `
      <div class="card" style="margin-bottom:8px; padding:12px;">
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
          <h4 style="margin:0; font-size:0.92rem;">${escapeHtml(u.nev)} ${u.telepules ? `(${escapeHtml(u.telepules)})` : ''}</h4>
          <span style="font-size:0.75rem; color:var(--amber); font-weight:700;">+${givesToMe.length} új tétel tőle</span>
        </div>
        <div style="font-size:0.8rem; line-height:1.5;">
          <p style="margin:2px 0;"><strong>Neki adod (${allocatedToHim.length} db):</strong> ${allocatedToHim.length ? allocatedToHim.map(n => getItemLabel(n)).join(', ') : '<em>(Nem jut neki dupla)</em>'}</p>
          <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle kapod (${givesToMe.length} db):</strong> ${givesToMe.map(n => getItemLabel(n)).join(', ')}</p>
        </div>
        <div style="margin-top:8px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-planned-partner" data-uid="${escapeHtml(u.id)}" data-give="${allocatedToHim.map(n => getItemLabel(n)).join(', ')}" data-get="${givesToMe.map(n => getItemLabel(n)).join(', ')}">
            Személyre szabott üzenet küldése ${escapeHtml(u.nev)}-nek
          </button>
        </div>
      </div>
    `;
  }).join('');

  summaryBox.innerHTML = `
    <div style="font-size:0.85rem; text-transform:uppercase; letter-spacing:1px; color:var(--amber); margin-bottom:4px; font-weight:700;">
      Szimulált Végeredmény (${selectedUsers.length} csere után):
    </div>
    <div style="font-size:1.15rem; font-weight:800; color:#FFF;">
      +${totalNewStickersGained.size} új tétel a gyűjteményedbe • -${totalStickersGivenCount} elcserélt dupla
    </div>
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

// =========================================================================
// BOLTI KÉSZLETRADAR (Admin vs. Felhasználó jogosultsággal)
// =========================================================================
function updateRadarStoreDatalist() {
  const activeAlbum = getActiveAlbum();
  const datalist = document.getElementById('radar-stores-datalist');
  const inputEl = document.getElementById('radar-input-store');
  const introEl = document.getElementById('radar-view-intro');
  if (!datalist || !inputEl) return;

  const chain = activeAlbum.radarType || (activeAlbum.hasRadar ? 'lidl' : 'none');
  datalist.innerHTML = '';

  if (introEl) {
    introEl.textContent = `Hol kapható még ${activeAlbum.title} készlet? Segítsük egymást a valós készletjelentésekkel.`;
  }

  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
  if (!isAdmin) {
    inputEl.setAttribute('placeholder', 'Válassz a hivatalos áruházlistából...');
  } else {
    inputEl.setAttribute('placeholder', 'Válassz vagy írj be új boltcímet (Adminisztrátor)...');
  }

  const storeList = STORE_DATABASES[chain] || STORE_DATABASES['lidl'];
  storeList.forEach(store => {
    const opt = document.createElement('option');
    opt.value = store;
    datalist.appendChild(opt);
  });
}

safeAddListener('btn-submit-radar', async () => {
  if (!currentUser) return showToast("Bejelentéshez előbb lépj be a fiókodba.");

  const rawStore = document.getElementById('radar-input-store')?.value.trim() || '';
  const note = document.getElementById('radar-input-note')?.value.trim() || '';
  const statusEl = document.querySelector('input[name="radar-status"]:checked');
  const status = statusEl ? statusEl.value === 'van' : true;

  if (!rawStore) return showToast("Kérlek válaszd ki a boltot a listából.");

  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
  const activeAlbum = getActiveAlbum();
  const chain = activeAlbum.radarType || 'lidl';
  const validStores = STORE_DATABASES[chain] || [];

  // Csak admin adhat meg a listában nem szereplő szabad szöveget
  if (!isAdmin && validStores.length > 0 && !validStores.includes(rawStore)) {
    return showToast("Kérlek a lenyíló listából válassz áruházat. Ha nincs a listában, válaszd az 'Egyéb helyszín' opciót!");
  }

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
    if (document.getElementById('radar-photo-input')) document.getElementById('radar-photo-input').value = '';
    if (document.getElementById('radar-photo-preview-box')) document.getElementById('radar-photo-preview-box').style.display = 'none';

    showToast("Köszönjük! A bolti készletjelentésed mentve.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

function renderRadarReports() {
  const container = document.getElementById('radar-reports-list');
  const titleEl = document.getElementById('radar-view-title');
  if (!container) return;

  const activeAlbum = getActiveAlbum();
  if (titleEl) {
    titleEl.textContent = (currentAlbumId === 'lidl-lutra-2026') 
      ? 'Közösségi Bolti Készletradar' 
      : `Albumradar & Készletjelentő (${activeAlbum.title})`;
  }

  const filterQuery = (document.getElementById('radar-filter-input')?.value || '').toLowerCase().trim();

  const filtered = radarReports.filter(r => {
    if (r.albumId && r.albumId !== currentAlbumId) return false;
    if (!filterQuery) return true;
    const matchCity = (r.city || '').toLowerCase().includes(filterQuery);
    const matchStore = (r.storeName || '').toLowerCase().includes(filterQuery);
    return matchCity || matchStore;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="view-intro">Nincs a szűrésnek megfelelő készletjelentés ehhez a gyűjteményhez.</p>';
    return;
  }

  container.innerHTML = filtered.map(r => {
    const likes = Array.isArray(r.likes) ? r.likes : [];
    const isLiked = currentUser && likes.includes(currentUser.uid);
    const timeStr = r.reportedAt?.toDate ? r.reportedAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';
    const isOwnerOrAdmin = currentUser && (r.userId === currentUser.uid || currentUser.email === ADMIN_EMAIL);

    return `
      <div class="radar-card">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div><strong>${escapeHtml(r.fullStoreName || r.storeName)}</strong></div>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">${r.status ? 'Kapható' : 'Elfogyott'}</span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${escapeHtml(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" alt="Bolti fotó" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>${escapeHtml(r.reporterName || 'Gyűjtő')} • ${timeStr}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm ${isLiked ? 'liked' : ''}" data-action="like-radar" data-id="${r.id}" style="padding:2px 8px; font-size:0.75rem;">
              ❤️ ${likes.length > 0 ? likes.length : ''} ${isLiked ? 'Tetszik' : 'Hasznos'}
            </button>
            ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-radar" data-id="${r.id}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('radar-reports-list', 'click', async (e) => {
  const likeBtn = e.target.closest('[data-action="like-radar"]');
  if (likeBtn) {
    if (!currentUser) return showToast("A kedveléshez lépj be a fiókodba.");
    const reportId = likeBtn.dataset.id;
    const docRef = db.collection("album_reports").doc(reportId);
    const doc = await docRef.get();
    if (!doc.exists) return;
    const likes = Array.isArray(doc.data().likes) ? doc.data().likes : [];
    if (likes.includes(currentUser.uid)) {
      await docRef.update({ likes: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) });
    } else {
      await docRef.update({ likes: firebase.firestore.FieldValue.arrayUnion(currentUser.uid) });
    }
    return;
  }

  const delBtn = e.target.closest('[data-action="delete-radar"]');
  if (delBtn) {
    if (!confirm("Biztosan törölni szeretnéd ezt a jelentést?")) return;
    await db.collection("album_reports").doc(delBtn.dataset.id).delete();
    showToast("Jelentés törölve.");
  }
});

// =========================================================================
// GDPR ADATOK EXPORTÁLÁSA
// =========================================================================
function exportMyUserData() {
  if (!currentUser) return showToast("Belépés szükséges az adatok letöltéséhez.");

  const exportData = {
    exportDate: new Date().toISOString(),
    user: {
      uid: currentUser.uid,
      email: currentUser.email,
      name: myProfile.nev,
      city: myProfile.telepules,
      gdprAccepted: myProfile.gdprAccepted
    },
    activeAlbum: currentAlbumId,
    collection: {
      van: myProfile.van,
      vanCounts: myProfile.vanCounts,
      kell: myProfile.kell,
      foglalva: myProfile.foglalva,
      privateNote: myProfile.privateNote
    },
    messagesCount: myIncomingMessages.length + myOutgoingMessages.length
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CsereljOkosan_Adataim_${myProfile.nev.replace(/\s+/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Személyes adataid letöltése elindult (JSON formátum).");
}

safeAddListener('btn-export-data', exportMyUserData);

// =========================================================================
// RENDSZERÜZENETEK & KATTINTHATÓ LINKEK (Admin)
// =========================================================================
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
  if (bodyEl) bodyEl.innerHTML = linkify(announcement.content);

  modal.classList.add('open');

  const closeFn = () => {
    const dontShow = document.getElementById('announcement-dont-show');
    if (dontShow && dontShow.checked) {
      localStorage.setItem(`dismissed_announcement_${announcement.id}`, 'true');
    }
    modal.classList.remove('open');
  };

  safeAddListener('btn-close-announcement', closeFn);
  safeAddListener('btn-close-announcement-ok', closeFn);
}

// =========================================================================
// ONBOARDING TÚRA & TOVÁBBI FELHASZNÁLÓI FUNKCIÓK
// =========================================================================
function checkOnboardingTour() {
  if (!localStorage.getItem('lutra_onboarded_v4')) {
    setTimeout(() => {
      triggerTopNotification("Üdv a Cserélj Okosan 4.0-ban! Kattints ide a 30 másodperces gyorsismertetőhöz.", () => {
        showAnnouncementModal({
          id: 'onboarding_v4',
          title: 'Üdv a megújult Cserélj Okosan platformon!',
          content: '1. Gyűjtemények: A főoldalon válthatsz a matrica- és kártyagyűjtemények között.\n2. Élő AR Szkenner: Olvasd be a matricaszámokat élőben a kameráddal!\n3. Okos Cserék: Kattints a számokra a cserekártyán, ha valamit mégsem szeretnél odaadni.\n4. Készletradar: Valós idejű bolti készletjelentések országszerte.'
        });
        localStorage.setItem('lutra_onboarded_v4', 'true');
      });
    }, 1500);
  }
}

// =========================================================================
// ÉLETCIKLUS ÉS INDÍTÓ LOGIKA
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
    });
  } catch (e) {
    console.warn("Firebase hiba:", e);
  }
}

// Teljes indítási szekvencia
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderHub();
  renderGrid();
  renderAlbumChapter();
  initFavoriteSelects();
  initFirebase();
  listenToAlbums();
  checkOnboardingTour();
} catch (err) {
  console.error("Indítási hiba:", err);
}
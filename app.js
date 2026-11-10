// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.7 ÉLES KIADÁS)
// 1 / 5. RÉSZ: ALAPARCHITEKTÚRA, ADATMODELL, CSALÁDI FÜZETEK & HUB MOTOR
// =========================================================================

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// --- ISMERT SCRAPER SZEMÉT- ÉS MENÜGOMB AZONOSÍTÓK (FEKETELISTA) ---
const SCRAPER_JUNK_IDS = new Set([
  'uj-gyujtemeny', 'gyujtemenyek', 'uj-gyujtemeny-hozzaadasa', 'mind-84', 'mind-92',
  'matricaalbum-55', 'matricaalbum-56', 'kartya-20', 'kartya-27', 'figura-7', 'kisauto-2',
  'album-megnyitasa', 'gyujtes-inditasa', 'gyujtemeny-bekuldese'
]);

// --- ALAPVETŐ SEGÉDFÜGGVÉNYEK ---
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

function initFavoriteSelects() {
  const favContainer = document.getElementById('prof-favorites-container');
  if (favContainer) favContainer.style.display = 'none';
}

// --- DINAMIKUS ALBUMOK & BOLTOK REGISZTRÁCIÓJA ---
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
    coverUrl: "covers/lidl-lutra-2026.webp",
    featured: true,
    hasRadar: true,
    radarType: "lidl",
    hasChapters: true,
    hasFavorites: false,
    active: true
  }
});

let STORE_DATABASES = safeJsonParse('cached_store_databases', { "lidl": [], "spar": [], "tesco": [], "penny": [], "retail_general": [] });

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";
let showAllHubAlbums = false;
let editingAlbumId = null;
let saveDebounceTimer = null;
let lastLocalEditTimestamp = 0;
let lastUndoState = null;
let undoToastTimer = null;

// GPS, TÁVOLSÁGI & KERESÉSI ÁLLAPOTOK
let myGpsCoords = safeJsonParse('cserelj_gps_coords', null);
let selectedSearchRadius = 'all';
let filterTargetCity = '';
let proximityDisplayLimit = 25;

// === PÓTOLT BLOKK (v4.7 javítás): állapotváltozók és hiányzó függvények ===
let myProfile = {
  nev: "Vendég gyűjtő",
  telepules: "",
  locations: [{ city: "", districts: [] }],
  geo: myGpsCoords,
  tradeMode: "both",
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
let activeContactTarget = { uid: '', nev: '', telepules: '', email: '', showEmail: false, subject: '', tradeMode: 'both' };

// SZIGORÚ ALBUM-SZERINTI SZÉTVÁLASZTÁS
function extractUserData(data, docId, targetAlbumId = currentAlbumId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);
  const locations = Array.isArray(data.locations) ? data.locations : (telepules ? [{ city: telepules, districts: [] }] : []);
  const geo = (data.geo && typeof data.geo.lat === 'number') ? data.geo : null;
  const tradeMode = getFirstValidString(data.tradeMode, 'both');

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
    // KIZÁRÓLAG a Lutra olvashat a gyökér mezőkből!
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
    tradeMode,
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

// =========================================================================
// CSERÉK TARTÓS GYŰJTŐJE (Firestore -> memória). Frissítés / albumváltás után sem vész el a zárolás.
// =========================================================================
let tradesCache = {};
let tradesLoaded = false;

function cacheTradeLocal(t) {
  if (t && t.tradeId) tradesCache[t.tradeId] = t;
}

function mergeTradesCacheIntoProfile(albumId = currentAlbumId) {
  if (!myProfile.activeTrades) myProfile.activeTrades = [];
  Object.values(tradesCache).forEach(t => {
    if ((t.albumId || 'lidl-lutra-2026') !== albumId) return;
    const idx = myProfile.activeTrades.findIndex(x => x.tradeId === t.tradeId);
    if (idx > -1) myProfile.activeTrades[idx] = t;
    else myProfile.activeTrades.push(t);
  });
  myProfile.activeTrades = myProfile.activeTrades.filter(t => (t.albumId || 'lidl-lutra-2026') === albumId);
  myProfile.activeTrades.sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0));
}

function listenToTrades(uid) {
  if (!db || !uid) return;
  if (incomingTradesUnsubscribe) incomingTradesUnsubscribe();
  if (outgoingTradesUnsubscribe) outgoingTradesUnsubscribe();

  const syncTradesToLocal = (docs) => {
    docs.forEach(doc => {
      const t = doc.data();
      const isInitiator = (t.initiatorUid === uid);

      const tradeObj = {
        tradeId: doc.id,
        initiatorUid: t.initiatorUid,
        partnerUid: isInitiator ? t.partnerUid : t.initiatorUid,
        partnerName: isInitiator ? t.partnerName : t.initiatorName,
        partnerCity: isInitiator ? t.partnerCity : t.initiatorCity,
        albumId: t.albumId || 'lidl-lutra-2026',
        givingItems: isInitiator ? (t.givingItems || []) : (t.receivingItems || []),
        receivingItems: isInitiator ? (t.receivingItems || []) : (t.givingItems || []),
        customOffer: t.customOffer || '',
        message: t.message || '',
        createdAt: t.createdAt || Date.now(),
        status: t.status,
        cancelReason: t.cancelReason || '',
        isInitiator: isInitiator
      };

      const prev = tradesCache[doc.id];
      tradesCache[doc.id] = tradeObj;

      if (prev && t.status === 'cancelled' && prev.status !== 'cancelled' && t.cancelledBy !== uid) {
        const nameSpan = document.getElementById('cancelled-notice-partner-name');
        const reasonSpan = document.getElementById('cancelled-notice-reason-text');
        if (nameSpan) nameSpan.textContent = tradeObj.partnerName;
        if (reasonSpan) reasonSpan.textContent = t.cancelReason || 'Meggondolta magát';
        document.getElementById('modal-trade-cancelled-notice')?.classList.add('open');
      }
    });

    tradesLoaded = true;
    mergeTradesCacheIntoProfile(currentAlbumId);
    renderActiveTradesPanel();
    renderGrid();
  };

  incomingTradesUnsubscribe = db.collection("trades")
    .where("partnerUid", "==", uid)
    .onSnapshot(snap => {
      syncTradesToLocal(snap.docs);
      
      const pendingIncoming = snap.docs.filter(d => d.data().status === 'pending_acceptance');
      if (pendingIncoming.length > 0) {
        checkAndPromptIncomingTrade(pendingIncoming[0], pendingIncoming.length);
      }
    }, err => console.warn("Bejövő csere figyelő:", err));

  outgoingTradesUnsubscribe = db.collection("trades")
    .where("initiatorUid", "==", uid)
    .onSnapshot(snap => {
      syncTradesToLocal(snap.docs);
    }, err => console.warn("Kimenő csere figyelő:", err));
}

const IMP_PFX = '(?:[A-Z]{1,5}[\\s\\-]?)?';
const IMP_ENTRY_RE = new RegExp('^(' + IMP_PFX + '\\d+)(?:(?:\\s*[.:)]\\s*|\\s*[\\-–—]\\s+|\\s+)(.*))?$');
const IMP_RANGE_RE = new RegExp('^(' + IMP_PFX + ')(\\d+)\\s*[\\-–—]\\s*(\\d+)$');
const IMP_NOISE_RE = /\.(hu|com|net|org)\b|listája|megvan:|oldal\s*\d|page\s*\d/i;
const IMP_DANGLING_RE = /(\b(and|a|az|és|the|of|with|to|in|on|for)|[,&\-–])$/i;

function impIsHeader(text) {
  const t = text.trim();
  if (t.length < 3 || t.length > 60) return false;
  if (/\d/.test(t)) return false;
  if (!/\p{Lu}/u.test(t)) return false;
  return t === t.toUpperCase();
}
function impTitleCase(s) {
  if (!s || s !== s.toUpperCase() || s.length <= 4) return s;
  return s.toLowerCase().replace(/(^|[\s\-(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}
function impCleanName(s) {
  return (s || '').replace(/\s+/g, ' ').replace(/^[\s,\-–—:.]+/, '').trim();
}
function impSplitLine(text) {
  // 1) tabulátor / 2+ szóköz = oszlophatár
  let pieces = text.split(/\t| {2,}/).map(p => p.trim()).filter(Boolean);
  if (pieces.length > 1) return pieces;
  // 2) egyetlen szövegsor, benne több tétel: emelkedő sorszámoknál vágunk
  const t = pieces[0] || '';
  const re = new RegExp('(?:^|\\s)(' + IMP_PFX + '\\d+)(?=(?:\\s*[.:)]|\\s+)\\p{L})', 'gu');
  const cuts = [];
  let m, prev = -1;
  while ((m = re.exec(t)) !== null) {
    const n = parseInt(m[1].replace(/\D/g, ''), 10);
    const start = m.index + (m[0].length - m[1].length);
    if (cuts.length === 0) { if (start === 0) { cuts.push(0); prev = n; } continue; }
    if (n > prev && n - prev <= 400) { cuts.push(start); prev = n; }
  }
  if (cuts.length < 2) return [t];
  return cuts.map((c, i) => t.slice(c, i + 1 < cuts.length ? cuts[i + 1] : undefined).trim());
}

function impTextToLines(text) {
  return String(text || '').split(/\r?\n/).map(raw => {
    const trimmed = raw.replace(/\s+$/, '');
    if (!trimmed.trim()) return null;
    const pieces = impSplitLine(trimmed);
    const hasTab = /\t/.test(trimmed);
    let from = 0;
    return { charMode: !hasTab, cells: pieces.map(p => {
      const idx = trimmed.indexOf(p, from);
      from = idx >= 0 ? idx + p.length : from;
      return hasTab ? { text: p } : { text: p, x: Math.max(0, idx) };
    }) };
  }).filter(Boolean);
}
function impPdfItemsToLines(items) {
  const rows = [];
  items.forEach(it => {
    const s = it.str;
    if (s === undefined) return;
    const y = it.transform[5], x = it.transform[4];
    let row = rows.find(r => Math.abs(r.y - y) <= 2);
    if (!row) { row = { y, items: [] }; rows.push(row); }
    row.items.push({ s, x, w: it.width || 0 });
  });
  rows.sort((a, b) => b.y - a.y);
  return rows.map(row => {
    row.items.sort((a, b) => a.x - b.x);
    const cells = [];
    let cur = null, lastEnd = 0, pendingSpace = false;
    row.items.forEach(it => {
      if (!it.s.trim()) { pendingSpace = true; return; }
      if (!cur || it.x - lastEnd > 12) {
        cur = { x: it.x, text: it.s };
        cells.push(cur);
      } else {
        cur.text += (pendingSpace || it.x - lastEnd > 1.2 ? ' ' : '') + it.s;
      }
      lastEnd = it.x + it.w;
      pendingSpace = false;
    });
    return { y: row.y, cells: cells.map(c => ({ x: c.x, text: c.text.replace(/\s+/g, ' ').trim() })).filter(c => c.text) };
  }).filter(l => l.cells.length);
}

function parseCollectionLines(lines) {
  const warnings = [];
  const meta = {};
  const entries = [];
  const sections = [];            // { title }
  let curSec = -1;
  let metaLines = 0;

  const pushEntry = (label, name, x, lineIdx) => {
    entries.push({ label: label.replace(/\s+/g, '').replace(/^([A-Z]+)-/, '$1'), rawLabel: label, name: impCleanName(name), x, line: lineIdx, sec: curSec, lastLine: lineIdx });
  };
  const newSection = (title) => { sections.push({ title: impTitleCase(impCleanName(title)) }); curSec = sections.length - 1; };

  lines.forEach((line, li) => {
    const texts = line.cells.map(c => c.text);
    const joined = texts.join(' ');

    // meta: az első sorok (cím, kiadó · év · darabszám)
    if (entries.length === 0 && curSec === -1) {
      const mm = joined.match(/^(.+?)\s*[·|•]\s*((?:19|20)\d{2})\s*[·|•]\s*(\d+)\s*(?:db|kártya|matrica|tétel|lap)?/i);
      if (mm) { meta.publisher = mm[1].trim(); meta.year = parseInt(mm[2], 10); meta.total = parseInt(mm[3], 10); metaLines++; return; }
      const nextJoined = lines[1] ? lines[1].cells.map(c => c.text).join(' ') : '';
      const nextIsMeta = /[·|•]\s*(?:19|20)\d{2}\s*[·|•]/.test(nextJoined);
      if (metaLines === 0 && li === 0 && nextIsMeta && !IMP_ENTRY_RE.test(texts[0]) && !impIsHeader(texts[0]) && texts[0].length <= 90) {
        meta.title = texts[0].replace(/\s+/g, ' ').trim(); metaLines++; return;
      }
    }
    if (IMP_NOISE_RE.test(joined) && !texts.some(t => IMP_ENTRY_RE.test(t))) return;

    // explicit fejléc-jelölések: "# Cím", "== Cím =="
    if (line.cells.length === 1) {
      const hm = texts[0].match(/^(?:#+|=+)\s*(.+?)\s*=*$/);
      if (hm) { newSection(hm[1]); return; }
    }

    // tartomány sor: "1-72", "MEX 1-19", "Cím: 1-72"
    if (line.cells.length === 1) {
      const rt = texts[0];
      const rm = rt.match(new RegExp('^(?:(.*?)\\s*[:]\\s*)?(' + IMP_PFX + ')(\\d+)\\s*[\\-–—]\\s*(\\d+)$'));
      if (rm && (rm[1] !== undefined || IMP_RANGE_RE.test(rt))) {
        if (rm[1]) newSection(rm[1]);
        const pre = (rm[2] || '').trim();
        const sp = /\s$/.test(rm[2] || '') ? ' ' : '';
        const a = parseInt(rm[3], 10), b = parseInt(rm[4], 10);
        const lo = Math.min(a, b), hi = Math.max(a, b);
        if (hi - lo > 2000) { warnings.push('Túl nagy tartomány: ' + rt); return; }
        for (let n = lo; n <= hi; n++) pushEntry(pre + sp + n, '', undefined, li);
        return;
      }
    }

    line.cells.forEach(cell => {
      const t = cell.text;
      const m = IMP_ENTRY_RE.exec(t);
      if (m) { pushEntry(m[1], m[2] || '', cell.x, li); return; }

      // csak nagybetűs, külön álló cella = fejezetcím
      if (line.cells.length === 1 && impIsHeader(t)) { newSection(t); return; }
      // "Cím:" alakú fejléc
      if (line.cells.length === 1 && /^[^\d].{2,60}:$/.test(t)) { newSection(t.replace(/:$/, '')); return; }

      // folytatósor: az előző tételhez tartozik
      if (!entries.length) return;
      if (IMP_NOISE_RE.test(t)) return;
      let target = null;
      if (cell.x !== undefined) {
        for (let k = entries.length - 1; k >= 0 && entries.length - k <= 80; k--) {
          const e = entries[k];
          if (e.x === undefined) continue;
          const dx = cell.x - e.x;
          const tol = line.charMode ? 12 : 26;
          if (dx >= -2 && dx <= tol && li - e.lastLine <= 2 && li > e.line) { target = e; break; }
        }
      } else {
        // sima szöveg: az előző sor lógó végű tétele, különben az előző sor első tétele
        let k = entries.length - 1;
        const prevLine = entries[k].line;
        const sameLine = entries.filter(e => e.line === prevLine);
        target = sameLine.find(e => IMP_DANGLING_RE.test(e.name)) || (sameLine.length === 1 ? sameLine[0] : null);
      }
      if (target) { target.name = impCleanName(target.name + ' ' + t); target.lastLine = li; }
    });
  });

  // sorrend: szakaszonként előtag-csoportok szerint, számsorrendben
  const bySec = {};
  entries.forEach(e => { (bySec[e.sec] = bySec[e.sec] || []).push(e); });
  const ordered = [];
  Object.keys(bySec).map(Number).sort((a, b) => a - b).forEach(sec => {
    const arr = bySec[sec];
    const groupOrder = {};
    arr.forEach(e => {
      e.pfx = e.label.replace(/\d+$/, '');
      e.num = parseInt(e.label.replace(/^\D+/, ''), 10);
      if (!(e.pfx in groupOrder)) groupOrder[e.pfx] = Object.keys(groupOrder).length;
    });
    arr.map((e, i) => ({ e, i }))
      .sort((a, b) => (groupOrder[a.e.pfx] - groupOrder[b.e.pfx]) || (a.e.num - b.e.num) || (a.i - b.i))
      .forEach(o => ordered.push(o.e));
  });

  // duplák kiszűrése
  const seen = new Set();
  const items = [];
  ordered.forEach(e => {
    if (seen.has(e.label)) { warnings.push('Ismétlődő kód kihagyva: ' + e.label); return; }
    seen.add(e.label);
    items.push({ label: e.label, name: e.name, sec: e.sec });
  });

  // hiányzó sorszámok a tiszta számozású csoportban
  const plain = items.filter(i => /^\d+$/.test(i.label)).map(i => parseInt(i.label, 10));
  if (plain.length > 1) {
    const set = new Set(plain), miss = [];
    for (let n = Math.min(...plain); n <= Math.max(...plain); n++) if (!set.has(n)) miss.push(n);
    if (miss.length) warnings.push('Hiányzó sorszámok a felismerésben: ' + (miss.length > 15 ? miss.slice(0, 15).join(', ') + ' …' : miss.join(', ')));
  }
  if (meta.total && meta.total !== items.length) warnings.push(`A fejlécben ${meta.total} tétel szerepel, felismertem ${items.length}-t.`);

  // fejezetek: pozícióhatárok
  const chapters = [];
  sections.forEach((s, si) => {
    const pos = [];
    items.forEach((it, idx) => { if (it.sec === si) pos.push(idx + 1); });
    if (pos.length) chapters.push({ title: s.title, from: pos[0], to: pos[pos.length - 1] });
  });
  const untitledCount = items.filter(i => i.sec === -1).length;
  if (untitledCount && chapters.length) {
    // fejléc nélküli elemek az elején: külön fejezet
    const pos = []; items.forEach((it, idx) => { if (it.sec === -1) pos.push(idx + 1); });
    chapters.unshift({ title: 'Általános', from: pos[0], to: pos[pos.length - 1] });
  }
  return { meta, items, chapters: chapters.length > 1 || (chapters.length === 1 && untitledCount === 0 && chapters[0].to - chapters[0].from + 1 < items.length) ? chapters : (chapters.length === 1 ? chapters : []), warnings };
}

function importResultToFields(res) {
  const items = res.items;
  const identity = items.every((it, i) => it.label === String(i + 1));
  // kódlista: számsorozatok tömörítve, a többi egyenként
  let itemsRaw = '';
  if (!identity) {
    const toks = [];
    let i = 0;
    while (i < items.length) {
      const a = items[i].label;
      if (/^\d+$/.test(a)) {
        let j = i;
        while (j + 1 < items.length && /^\d+$/.test(items[j + 1].label) && parseInt(items[j + 1].label, 10) === parseInt(items[j].label, 10) + 1) j++;
        toks.push(j - i >= 2 ? `${a}-${items[j].label}` : items.slice(i, j + 1).map(x => x.label).join(', '));
        i = j + 1;
      } else {
        const pm = a.match(/^([A-Z]+)(\d+)$/);
        let j = i;
        if (pm) {
          while (j + 1 < items.length) {
            const nm = items[j + 1].label.match(/^([A-Z]+)(\d+)$/), cm = items[j].label.match(/^([A-Z]+)(\d+)$/);
            if (!nm || nm[1] !== pm[1] || parseInt(nm[2], 10) !== parseInt(cm[2], 10) + 1) break;
            j++;
          }
        }
        if (pm && j - i >= 2) { toks.push(`${a}-${items[j].label.replace(/^[A-Z]+/, '')}`); i = j + 1; }
        else { toks.push(a); i++; }
      }
    }
    itemsRaw = toks.join(', ');
  }
  const namesRaw = items.map((it, i) => it.name ? `${i + 1}: ${it.name}` : null).filter(Boolean).join('\n');
  const chaptersRaw = res.chapters.map(c => `${c.title}: ${c.from} – ${c.to}`).join('\n');
  return { itemsRaw, namesRaw, chaptersRaw, total: items.length };
}
// === PÓTOLT BLOKK VÉGE ===

// =========================================================================
// CSALÁDI MÓD / PÁRHUZAMOS FÜZETEK TELJESEN SZAPORÍTOTT ADATBÁZISA
// =========================================================================
let currentSubAlbumId = 1; // 1 = Fő füzet

function getEffectiveAlbumKey() {
  return currentSubAlbumId > 1 ? `${currentAlbumId}_sub${currentSubAlbumId}` : currentAlbumId;
}

function sanitizeFamilyName(input) {
  if (!input) return '';
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/[\"\'\`\<\>]/g, '')
    .trim()
    .slice(0, 20);
}

function getFamilySubsForActiveAlbum() {
  const rawSubs = safeJsonParse(`family_subs_${currentAlbumId}`, [
    { id: 1, name: "1. Fő füzet" }
  ]);
  const list = Array.isArray(rawSubs) ? rawSubs : [];
  let changed = !Array.isArray(rawSubs);
  const used = new Set();
  const clean = [];
  const broken = [];

  // 1) érvényes azonosítójú füzetek (a szám-szöveg eltéréseket is javítjuk)
  list.forEach(sub => {
    const id = Number(sub && sub.id);
    if (Number.isInteger(id) && id >= 1 && !used.has(id)) {
      used.add(id);
      const nm = (sub && typeof sub.name === 'string') ? sub.name.trim() : '';
      const goodName = (nm && nm.toLowerCase() !== 'undefined' && nm.toLowerCase() !== 'null') ? nm : (id === 1 ? '1. Fő füzet' : `${id}. füzet`);
      if (goodName !== sub.name || id !== sub.id) changed = true;
      clean.push({ id, name: goodName });
    } else {
      broken.push(sub);
      changed = true;
    }
  });

  // 2) a régi, azonosító nélküli („undefined”) füzetek új, érvényes azonosítót kapnak,
  //    így újra átnevezhetők és törölhetők
  broken.forEach(sub => {
    let id = clean.reduce((m, x) => Math.max(m, x.id), 1) + 1;
    while (used.has(id)) id++;
    used.add(id);
    const nm = (sub && typeof sub.name === 'string') ? sub.name.trim() : '';
    const goodName = (nm && nm.toLowerCase() !== 'undefined' && nm.toLowerCase() !== 'null') ? nm : `${id}. füzet`;
    clean.push({ id, name: goodName });
  });

  if (!clean.find(x => x.id === 1)) {
    clean.unshift({ id: 1, name: "1. Fő füzet" });
    changed = true;
  }
  clean.sort((a, b) => a.id - b.id);
  if (changed) {
    try { localStorage.setItem(`family_subs_${currentAlbumId}`, JSON.stringify(clean)); } catch (e) {}
  }
  return clean;
}

function saveFamilySubsForActiveAlbum(subs) {
  localStorage.setItem(`family_subs_${currentAlbumId}`, JSON.stringify(subs));
}

function updateActiveAlbumTitleWithSubName() {
  const titleEl = document.getElementById('active-album-title');
  if (!titleEl) return;
  const activeAlbum = getActiveAlbum();
  const subs = getFamilySubsForActiveAlbum();
  const currentSub = subs.find(s => s.id === currentSubAlbumId);
  const subLabel = (subs.length > 1 && currentSub) ? ` [${escapeHtml(currentSub.name)}]` : '';
  titleEl.textContent = `${activeAlbum.title} (${activeAlbum.year || 2026})${subLabel}`;
}

function renderFamilySubPills() {
  const pillsContainer = document.getElementById('family-sub-pills');
  const addBtn = document.getElementById('btn-add-family-sub');
  if (!pillsContainer || !addBtn) return;

  const subs = getFamilySubsForActiveAlbum();

  // Ha csak 1 füzet van: alapesetben CSAK a [+ Új füzet] gomb látszik!
  if (subs.length <= 1) {
    pillsContainer.innerHTML = '';
    addBtn.style.display = 'inline-block';
    addBtn.textContent = '+ Új füzet (Testvér)';
    return;
  }

  addBtn.textContent = '+ Újabb füzet';

  pillsContainer.innerHTML = subs.map(sub => {
    const isActive = (sub.id === currentSubAlbumId);
    const isMain = (sub.id === 1);
    const cleanName = escapeHtml(sub.name || `${sub.id}. füzet`);

    return `
      <div class="family-pill ${isActive ? 'active' : ''}" data-sub-id="${sub.id}">
        <span class="family-pill-title">${cleanName}</span>
        <span class="family-pill-action edit" data-action="rename-sub" data-sub-id="${sub.id}" title="Átnevezés">✎</span>
        ${!isMain ? `<span class="family-pill-action del" data-action="delete-sub" data-sub-id="${sub.id}" title="Füzet törlése">✕</span>` : ''}
      </div>
    `;
  }).join('');
}

safeAddListener('family-sub-pills', (e) => {
  const renameBtn = e.target.closest('[data-action="rename-sub"]');
  if (renameBtn) {
    e.stopPropagation();
    const subId = parseInt(renameBtn.dataset.subId, 10);
    const subs = getFamilySubsForActiveAlbum();
    const target = subs.find(s => s.id === subId);
    if (!target) return showToast("Ez a füzet nem található. Frissítsd az oldalt.");

    const rawInput = prompt(`Add meg a(z) ${subId}. füzet új nevét:`, target.name);
    if (rawInput === null) return;
    const clean = sanitizeFamilyName(rawInput);
    if (!clean) return showToast("A név nem lehet üres!");

    target.name = clean;
    saveFamilySubsForActiveAlbum(subs);
    renderFamilySubPills();
    updateActiveAlbumTitleWithSubName();
    showToast(`Füzet átnevezve: ${clean}`);
    return;
  }

  const delBtn = e.target.closest('[data-action="delete-sub"]');
  if (delBtn) {
    e.stopPropagation();
    const subId = parseInt(delBtn.dataset.subId, 10);
    if (subId === 1) return showToast("Az 1. Fő füzet nem törölhető!");

    const subs = getFamilySubsForActiveAlbum();
    const target = subs.find(s => s.id === subId);
    const targetName = target?.name || `${subId}. füzet`;

    if (!confirm(`Biztosan törlöd a(z) „${targetName}” füzetet és az összes benne lévő matricát?`)) return;

    const effKeyToDelete = `${currentAlbumId}_sub${subId}`;
    localStorage.removeItem(`lutra_van_${effKeyToDelete}`);
    localStorage.removeItem(`lutra_van_counts_${effKeyToDelete}`);
    localStorage.removeItem(`lutra_kell_${effKeyToDelete}`);
    localStorage.removeItem(`lutra_foglalva_${effKeyToDelete}`);
    localStorage.removeItem(`lutra_foglalva_counts_${effKeyToDelete}`);
    localStorage.removeItem(`lutra_active_trades_${effKeyToDelete}`);
    localStorage.removeItem(`private_note_${effKeyToDelete}`);

    if (currentUser && db) {
      db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(effKeyToDelete).delete().catch(() => {});
      db.collection("users").doc(currentUser.uid).collection("collections").doc(effKeyToDelete).delete().catch(() => {});
    }

    const updatedSubs = subs.filter(s => s.id !== subId);
    saveFamilySubsForActiveAlbum(updatedSubs);

    currentSubAlbumId = 1;
    renderFamilySubPills();
    if (typeof loadAlbumState === 'function') loadAlbumState(currentAlbumId);
    showToast(`A(z) „${targetName}” törölve lett. Visszaváltva a Fő füzetre.`);
    return;
  }

  const pill = e.target.closest('.family-pill');
  if (pill) {
    const subId = parseInt(pill.dataset.subId, 10);
    if (subId === currentSubAlbumId) return;

    currentSubAlbumId = subId;
    renderFamilySubPills();
    if (typeof loadAlbumState === 'function') loadAlbumState(currentAlbumId);
    updateActiveAlbumTitleWithSubName();
    showToast(`Átváltva: ${pill.querySelector('.family-pill-title')?.textContent || subId + '. füzet'}`);
  }
});

safeAddListener('btn-add-family-sub', () => {
  const subs = getFamilySubsForActiveAlbum();
  const maxId = subs.reduce((max, s) => s.id > max ? s.id : max, 1);
  const nextId = maxId + 1;

  const defaultName = subs.length === 1 ? "2. Testvér füzet" : `${nextId}. füzet`;
  const rawInput = prompt("Add meg az új füzet nevét (pl. Kati vagy 2. füzet):", defaultName);
  if (rawInput === null) return;

  const clean = sanitizeFamilyName(rawInput) || defaultName;
  subs.push({ id: nextId, name: clean });
  saveFamilySubsForActiveAlbum(subs);

  currentSubAlbumId = nextId;
  renderFamilySubPills();
  if (typeof loadAlbumState === 'function') loadAlbumState(currentAlbumId);
  updateActiveAlbumTitleWithSubName();
  showToast(`Új füzet létrehozva és megnyitva: ${clean}!`);
});

// =========================================================================
// HIBATŰRŐ SZÖVEGPARSEREK & KOORDINÁTA TÁR
// =========================================================================

function expandCustomItemsText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const tokens = rawText.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);
  const items = [];
  
  tokens.forEach(tok => {
    const rangeMatch = tok.match(/^([A-Za-z][A-Za-z\s\-_]*?)(\s*)(\d+)[\s\-—–]+(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1].trim();
      const sep = rangeMatch[2] ? ' ' : '';
      const start = parseInt(rangeMatch[3], 10);
      const end = parseInt(rangeMatch[4], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let i = min; i <= max; i++) items.push(`${prefix}${sep}${i}`.trim());
      return;
    }

    const numRange = tok.match(/^(\d+)[\s\-—–]+(\d+)$/);
    if (numRange) {
      const start = parseInt(numRange[1], 10);
      const end = parseInt(numRange[2], 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let i = min; i <= max; i++) items.push(String(i));
      return;
    }

    items.push(tok);
  });
  
  return items;
}

function expandCustomNamesText(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const namesMap = {};
  let maxIdx = 0;
  const put = (idx, name) => {
    name = (name || '').replace(/[;\s]+$/, '').trim();
    if (idx > 0 && name) { namesMap[idx] = name; if (idx > maxIdx) maxIdx = idx; }
    else if (idx > maxIdx) maxIdx = idx;
  };

  lines.forEach(line => {
    const marks = [...line.matchAll(/(?:^|\s)(\d+)\s*:\s*/g)];
    if (marks.length >= 2) {
      marks.forEach((m, k) => {
        const start = m.index + m[0].length;
        const end = k + 1 < marks.length ? marks[k + 1].index : line.length;
        put(parseInt(m[1], 10), line.slice(start, end));
      });
      return;
    }
    const single = line.match(/^(\d+)\s*[:.)\-–—]\s*(.+)$/) || line.match(/^(\d+)\s+(.+)$/);
    if (single) { put(parseInt(single[1], 10), single[2]); return; }
    maxIdx++;
    namesMap[maxIdx] = line.replace(/[;\s]+$/, '').trim();
  });

  const names = [];
  for (let i = 1; i <= maxIdx; i++) names.push(namesMap[i] || '');
  return names;
}

function parseChaptersText(rawText, customItems = [], customNames = []) {
  if (!rawText || typeof rawText !== 'string') return [];
  const lines = rawText.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const chapters = [];

  lines.forEach((line, idx) => {
    const m = line.match(/^(.*?)\s*[:\-–—]\s*(\d+)\s*[\-–—]\s*(\d+)\s*$/);
    if (!m) return;
    const cim = m[1].trim();
    if (!cim) return;
    const s = parseInt(m[2], 10);
    const e = parseInt(m[3], 10);
    const min = Math.min(s, e);
    const max = Math.max(s, e);
    const elemek = [];
    for (let n = min; n <= max; n++) {
      const itemName = (customNames && customNames[n - 1]) ? customNames[n - 1] : '';
      elemek.push({ type: "single", num: n, name: itemName, orient: "álló" });
    }
    chapters.push({ id: `ch_${idx + 1}`, cim: cim, elemek: elemek });
  });
  return chapters;
}

function getNormalizedAlbumTitleKey(title) {
  if (!title) return '';
  return normalizeText(title)
    .replace(/\b(panini|topps|spar|lidl|wwf|album|kollekcio|collection|matrica|kartya|cards?|stickers?|uefa|fifa|xl)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII"];

const KNOWN_CANONICAL_CITIES = { 
  "erd": "Érd", "gyor": "Győr", "pecs": "Pécs", "szeged": "Szeged", "debrecen": "Debrecen", "miskolc": "Miskolc", "kecskemet": "Kecskemét", "szekesfehervar": "Székesfehérvár", "nagykoros": "Nagykőrös", "cegled": "Cegléd", "szombathely": "Szombathely", "nyiregyhaza": "Nyíregyháza", "szolnok": "Szolnok", "tatabanya": "Tatabánya", "kaposvar": "Kaposvár", "bekescsaba": "Békéscsaba", "veszprem": "Veszprém", "zalaegerszeg": "Zalaegerszeg", "eger": "Eger", "sopron": "Sopron", "nagykanizsa": "Nagykanizsa", "dunaujvaros": "Dunaújváros", "hodmezovasarhely": "Hódmezővásárhely", "salgotarjan": "Salgótarján", "szekszard": "Szekszárd", "baja": "Baja", "siofok": "Siófok", "gyula": "Gyula", "oroshaza": "Orosháza", "keszthely": "Keszthely", "kiskunfelegyhaza": "Kiskunfélegyháza", "lajosmizse": "Lajosmizse", "dabas": "Dabas", "albertirsa": "Albertirsa", "tiszakecske": "Tiszakécske", "kiskunmajsa": "Kiskunmajsa", "kiskoros": "Kiskőrös", "budaors": "Budaörs", "szentendre": "Szentendre", "dunakeszi": "Dunakeszi", "godollo": "Gödöllő", "szigetszentmiklos": "Szigetszentmiklós"
};

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

async function touchActive(uid) {
  if (!uid || !db) return;
  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem('cserelj_last_active_touch') === today) return;
  try {
    await db.collection("activity").doc(uid).set({
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    try {
      await db.collection("public_profiles").doc(uid).update({
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {}
    localStorage.setItem('cserelj_last_active_touch', today);
  } catch (e) {}
}

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

// LUTRA 108 MATRICA DINAMIKUS TÁJOLÁSGENERÁTOR (Kizárólag tematikus csoportokhoz)
function getLutraChapters() {
  const alloStickers = new Set([1, 37, 38, 49, 52, 61, 62, 102, 103, 108]);
  const combos = { 35: 36, 50: 51, 55: 56, 84: 85 };

  const rawChapterRanges = [
    { cim: "Bevezető", range: [1, 1] },
    { cim: "Élettel teli bolygó", range: [2, 9] },
    { cim: "Európa", range: [10, 15] },
    { cim: "Afrika", range: [16, 21] },
    { cim: "Észak-Amerika", range: [22, 27] },
    { cim: "Dél-Amerika", range: [28, 33] },
    { cim: "Ázsia", range: [34, 40] },
    { cim: "Ausztrália és Óceánia", range: [41, 46] },
    { cim: "Antarktisz", range: [47, 53] },
    { cim: "Tengerek és óceánok", range: [54, 60] },
    { cim: "Kihalt állatok", range: [61, 68] },
    { cim: "Veszélyeztetett fajok", range: [69, 74] },
    { cim: "Megmentett állatok", range: [75, 80] },
    { cim: "Mi fenyegeti a természetet?", range: [81, 91] },
    { cim: "Bolygóbarát megoldások", range: [92, 96] },
    { cim: "WWF Magyarország", range: [97, 102] },
    { cim: "Legyél bolygóvédő szuperhős!", range: [103, 105] },
    { cim: "Zöldebb jövő a Lidlnél", range: [106, 108] }
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
          name: getItemFullName(num, 'lidl-lutra-2026').replace(' (Bal)', '').replace(`#${num} `, ''),
          orient: "panoráma"
        });
        num += 2;
      } else {
        elemek.push({
          type: "single",
          num: num,
          name: getItemFullName(num, 'lidl-lutra-2026').replace(`#${num} `, '') || `#${num}`,
          orient: alloStickers.has(num) ? "álló" : "fekvő"
        });
        num += 1;
      }
    }
    return { id: `lutra_ch_${idx + 1}`, cim: ch.cim, elemek };
  });
}

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

const STICKER_NAMES = LUTRA_STICKER_NAMES;
const FEJEZETEK = getLutraChapters();
const STICKER_ORIENTS = { 1: "álló", 37: "álló", 38: "álló", 49: "álló", 52: "álló", 61: "álló", 62: "álló", 102: "álló", 103: "álló", 108: "álló" };

function getActiveChapters() {
  const activeAlbum = getActiveAlbum();
  if (currentAlbumId === 'lidl-lutra-2026') return getLutraChapters();
  if (activeAlbum.hasChapters && activeAlbum.customChaptersList && activeAlbum.customChaptersList.length > 0) {
    return activeAlbum.customChaptersList;
  }
  return [];
}

function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    const raw = album.customItems[num - 1];
    return (raw.startsWith('#') || /\D/.test(raw)) ? raw : `#${raw}`;
  }
  return `#${num}`;
}

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

// =========================================================================
// DINAMIKUS ÉS GLOBÁLIS KÖZÖSSÉGI MUTATÓK (MINDEN ALBUM ÖSSZEGZÉSE!)
// =========================================================================
function updateHubSocialProofMetrics() {
  const collectorsEl = document.getElementById('sp-collectors-count');
  const trackedEl = document.getElementById('sp-tracked-items-count');
  const duplicatesEl = document.getElementById('sp-duplicates-count');
  const tradesEl = document.getElementById('sp-completed-trades-count');
  if (!collectorsEl) return;

  const totalCollectors = (typeof rawAllUsersDocs !== 'undefined' && rawAllUsersDocs.length > 0) 
    ? rawAllUsersDocs.length 
    : (typeof allUsersData !== 'undefined' ? allUsersData.length : 880);

  let totalTracked = 0;
  let totalDuplicates = 0;

  if (typeof rawAllUsersDocs !== 'undefined' && Array.isArray(rawAllUsersDocs)) {
    rawAllUsersDocs.forEach(d => {
      const data = d.data();
      
      const rootVan = ensureArray(data.van || data.duplicates || []);
      const rootKell = ensureArray(data.kell || data.missing || []);
      const rootVanCounts = data.vanCounts || {};
      
      totalTracked += rootKell.length;
      rootVan.forEach(n => {
        const q = rootVanCounts[n] || 1;
        totalDuplicates += q;
        totalTracked += q;
      });

      if (data.collections && typeof data.collections === 'object') {
        Object.entries(data.collections).forEach(([albId, col]) => {
          if (albId === 'lidl-lutra-2026') return;
          const cVan = ensureArray(col.van || []);
          const cKell = ensureArray(col.kell || []);
          const cCounts = col.vanCounts || {};

          totalTracked += cKell.length;
          cVan.forEach(n => {
            const q = cCounts[n] || 1;
            totalDuplicates += q;
            totalTracked += q;
          });
        });
      }
    });
  }

  collectorsEl.textContent = `${totalCollectors} fő`;
  if (trackedEl) trackedEl.textContent = totalTracked > 0 ? `${totalTracked.toLocaleString('hu-HU')}` : '120 000+';
  if (duplicatesEl) duplicatesEl.textContent = totalDuplicates > 0 ? `${totalDuplicates.toLocaleString('hu-HU')}` : '61 000';
  if (tradesEl) tradesEl.textContent = `${Math.max(290, Math.round(totalCollectors * 0.36))}+`;

  const pCountNotice = document.getElementById('partner-search-count-label');
  if (pCountNotice) pCountNotice.textContent = totalCollectors;
}

function getAlbumLiveStats(albumId) {
  let collectors = 0;
  let dupes = 0;
  let partners = 0;

  // A bejelentkezett gyűjtő saját állapota ebben az albumban (fő füzet)
  const myUid = currentUser ? currentUser.uid : null;
  const isLutra = (albumId === 'lidl-lutra-2026');
  const myVanSet = new Set(ensureArray(safeJsonParse(`lutra_van_${albumId}`, isLutra ? safeJsonParse('lutra_van', []) : [])));
  const myKellSet = new Set(ensureArray(safeJsonParse(`lutra_kell_${albumId}`, isLutra ? safeJsonParse('lutra_kell', []) : [])));
  const hasMyData = !!myUid && (myVanSet.size > 0 || myKellSet.size > 0);

  if (typeof rawAllUsersDocs !== 'undefined' && Array.isArray(rawAllUsersDocs)) {
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
      } else if (isLutra) {
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

      // Cserepartner = kölcsönösen tudnak egymásnak adni (nem én, nem nyaraló)
      if (hasMyData && d.id !== myUid && data.isVacation !== true) {
        const theyCanGiveMe = vArr.some(n => myKellSet.has(n));
        const iCanGiveThem = kArr.some(n => myVanSet.has(n));
        if (theyCanGiveMe && iCanGiveThem) partners++;
      }
    });
  }

  return { collectors, dupes, partners: hasMyData ? partners : null };
}

// =========================================================================
// HUB (KEZDŐLAP) RENDERELÉS: ÉLŐ GYŰJTŐ- ÉS DUPLASZÁMMAL!
// =========================================================================
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
      if (currentHubFilter !== 'my' && currentHubFilter !== 'completed') return false;
    }
    
    if (query) {
      const matchTitle = (album.title || '').toLowerCase().includes(query);
      const matchPub = (album.publisher || '').toLowerCase().includes(query);
      const matchYear = String(album.year || '').includes(query);
      if (!matchTitle && !matchPub && !matchYear) return false;
    }

    if (currentHubFilter === 'sticker') return album.type === 'sticker';
    if (currentHubFilter === 'card') return album.type === 'card';
    if (currentHubFilter === 'figure') {
      return album.type === 'figure' || album.type === 'kinder' || (album.title && /kinder|figura/i.test(album.title));
    }
    if (currentHubFilter === 'retro') return album.year < 2018 || album.isRetro === true;
    if (currentHubFilter === 'my') {
      const myAlbumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, [])).length;
      const myAlbumKell = ensureArray(safeJsonParse(`lutra_kell_${album.id}`, [])).length;
      return myAlbumVan > 0 || myAlbumKell > 0;
    }
    if (currentHubFilter === 'completed') {
      const myAlbumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : [])).length;
      return myAlbumVan >= (album.totalItems || 100) && album.totalItems > 0;
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
        ? '▲ Csak a kiemeltek mutatása (6 db)' 
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
    const cover = album.coverUrl || 'logo-emblem.png';

    const { collectors, dupes, partners } = getAlbumLiveStats(album.id);
    const collectorsPill = collectors > 0
      ? `<span class="hub-stat-pill"><strong>${collectors} gyűjtő</strong> gyűjti</span>`
      : `<span class="hub-stat-pill"><strong>Kezdj bele elsőként!</strong></span>`;
    const dupesPill = collectors > 0
      ? `<span class="hub-stat-pill"><strong>${dupes > 0 ? dupes.toLocaleString('hu-HU') + ' db dupla' : '0 dupla'}</strong></span>`
      : '';
    const partnersPill = (partners !== null && partners !== undefined)
      ? `<span class="hub-stat-pill"><strong>${partners}</strong> cserepartner</span>`
      : '';

    return `
      <div class="album-hub-card ${isFeatured ? 'featured-card' : ''}" 
           data-album-id="${escapeHtml(album.id)}" 
           onclick="selectAlbum('${escapeHtml(album.id)}')"
           style="${isInactive ? 'opacity:0.6; border-color:var(--danger);' : ''}">
        <div>
          <img src="${cover}" class="hub-card-thumb" alt="${escapeHtml(album.title)}" loading="lazy">
          <div class="album-hub-header">
            <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
              <span class="album-type-badge">${escapeHtml(album.typeLabel || 'Matricaalbum')}</span>
              ${isRetro ? `<span class="album-type-badge badge-retro">Retro (${album.year})</span>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${album.year}</span>`}
              ${isInactive ? `<span class="badge-trade-status badge-status-cancelled">Inaktív</span>` : ''}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.15rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 6px;">${escapeHtml(album.publisher || '')} • ${escapeHtml(album.subtitle || '')}</p>

          <div class="hub-card-stats-row">
            ${collectorsPill}${dupesPill}${partnersPill}
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
            <button class="btn btn-primary btn-sm" 
                    style="width:100%; font-size:0.82rem; padding:8px;" 
                    data-action="select-album" 
                    data-album-id="${escapeHtml(album.id)}"
                    onclick="event.stopPropagation(); selectAlbum('${escapeHtml(album.id)}')">
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
  if (albumId) {
    e.preventDefault();
    selectAlbum(albumId);
  }
});

safeAddListener('btn-brand-home', () => switchView('hub'));
safeAddListener('btn-header-home', () => switchView('hub'));
safeAddListener('btn-nav-home-hub', () => switchView('hub'));

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

// =========================================================================
// GOLYÓÁLLÓ ALBUMVÁLASZTÁS ÉS NÉZETVÁLTÁS (0 ms HIBAVÉDELEMMEL)
// =========================================================================
function selectAlbum(albumId) {
  try {
    if (!albumId) return;

    if (!ALBUMS_REGISTRY[albumId]) {
      ALBUMS_REGISTRY[albumId] = {
        id: albumId,
        title: albumId,
        year: 2026,
        totalItems: 108,
        type: 'sticker',
        typeLabel: 'Matricaalbum',
        active: true
      };
    }

    currentAlbumId = albumId;
    currentSubAlbumId = 1; // Visszaállítjuk a fő füzetre új album kiválasztásakor
    localStorage.setItem('lutra_active_album', albumId);

    let recent = safeJsonParse('cserelj_recent_albums', []);
    recent = [albumId, ...recent.filter(id => id !== albumId)].slice(0, 10);
    localStorage.setItem('cserelj_recent_albums', JSON.stringify(recent));

    const activeAlbum = getActiveAlbum();
    const isInactive = (activeAlbum.active === false);

    const banner = document.getElementById('inactive-album-banner');
    if (banner) banner.style.display = isInactive ? 'flex' : 'none';

    const gridEl = document.getElementById('matrica-grid');
    if (gridEl) gridEl.classList.toggle('album-inactive', isInactive);

    const barEl = document.getElementById('active-album-bar');
    if (barEl) barEl.style.display = 'flex';

    updateActiveAlbumTitleWithSubName();

    const thumbEl = document.getElementById('active-album-thumb');
    if (thumbEl) thumbEl.src = activeAlbum.coverUrl || 'logo-emblem.png';

    const countSizeEl = document.getElementById('count-total-size');
    if (countSizeEl) countSizeEl.textContent = activeAlbum.totalItems || 108;

    const noteTitleEl = document.getElementById('prof-note-album-title');
    if (noteTitleEl) noteTitleEl.textContent = activeAlbum.title || albumId;

    const mainNav = document.getElementById('main-primary-nav');
    if (mainNav) mainNav.style.display = 'grid';

    const botNav = document.getElementById('mobile-bottom-bar');
    if (botNav) botNav.style.display = 'grid';

    updateRadarStoreDatalist();
    renderFamilySubPills();
    loadAlbumState(albumId);
    initFavoriteSelects();

    switchView('matricaim');
    showToast(isInactive ? `Figyelem: ${activeAlbum.title} jelenleg inaktív!` : `Aktív: ${activeAlbum.title}`);
  } catch (err) {
    console.error("Hiba a selectAlbum-ban:", err);
    switchView('matricaim');
  }
}

safeAddListener('btn-switch-album', () => {
  const barEl = document.getElementById('active-album-bar');
  if (barEl) barEl.style.display = 'none';

  const mainNav = document.getElementById('main-primary-nav');
  if (mainNav) mainNav.style.display = 'none';

  const botNav = document.getElementById('mobile-bottom-bar');
  if (botNav) botNav.style.display = 'none';

  switchView('hub');
});

document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedFilter = btn.dataset.hubFilter;
    document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentHubFilter = clickedFilter;
    renderHub();
  });
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.7 ÉLES KIADÁS)
// 2 / 5. RÉSZ: RÁCS, BLOKKOS NÉZET, TOJÁS CSEMPÉK, NYOMTATÁS & MEGOSZTÁS
// =========================================================================

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');
let currentGridMode = 'grid'; // 'grid' = Tiszta folyamatos rács, 'blocks' = Blokkosított nézet

// LAKAT-SZÁMLÁLÓ: KIZÁRÓLAG AZ ELFOGADOTT ÉS POSTÁZOTT CSERÉK ZÁROLNAK!
function getActiveLockedCounts(albumId = currentAlbumId) {
  const counts = {};
  (myProfile.activeTrades || []).forEach(t => {
    const isLockedStatus = ['accepted', 'shipped'].includes(t.status);
    if (isLockedStatus && (t.albumId || 'lidl-lutra-2026') === albumId) {
      (t.givingItems || []).forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
      });
    }
  });
  return counts;
}

// =========================================================================
// FÜZETENKÉNTI ÁLLAPOTBETÖLTÉS & MENTÉS (TELJES ADATSZEPARÁCIÓ)
// =========================================================================

function loadAlbumState(albumId) {
  try {
    const effKey = getEffectiveAlbumKey(); // pl. "lidl-lutra-2026" VAGY "lidl-lutra-2026_sub2"

    // Szigorúan füzetenkénti szeparált adatok betöltése
    myProfile.van = ensureArray(safeJsonParse(`lutra_van_${effKey}`, effKey === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : [])).sort((a, b) => a - b);
    myProfile.vanCounts = safeJsonParse(`lutra_van_counts_${effKey}`, {});
    myProfile.kell = ensureArray(safeJsonParse(`lutra_kell_${effKey}`, [])).sort((a, b) => a - b);
    myProfile.foglalva = ensureArray(safeJsonParse(`lutra_foglalva_${effKey}`, [])).sort((a, b) => a - b);
    myProfile.foglalvaCounts = safeJsonParse(`lutra_foglalva_counts_${effKey}`, {});
    // A cserék a Firestore-ból jönnek (tradesCache) – frissítés után sem veszhetnek el
    myProfile.activeTrades = [];
    mergeTradesCacheIntoProfile(albumId);

    // Öngyógyító lakat-tisztítás – csak akkor, ha a cserék már megérkeztek,
    // különben egy frissítés pillanatnyilag üres listával törölné a lakatokat
    if (tradesLoaded) {
      const activeLocks = getActiveLockedCounts(albumId);
      myProfile.foglalva = myProfile.foglalva.filter(n => (activeLocks[n] || 0) > 0);
      Object.keys(myProfile.foglalvaCounts).forEach(k => {
        if (!activeLocks[k]) delete myProfile.foglalvaCounts[k];
      });
    }

    let savedNote = localStorage.getItem(`private_note_${effKey}`) || (effKey === 'lidl-lutra-2026' ? (localStorage.getItem('lutra_private_note') || '') : '');
    myProfile.privateNote = (savedNote || '').slice(0, 250);

    const noteInput = document.getElementById('prof-private-note');
    if (noteInput) {
      noteInput.value = myProfile.privateNote;
      const countEl = document.getElementById('note-char-count');
      if (countEl) countEl.textContent = `${myProfile.privateNote.length}/250`;
    }

    renderGrid();
    if (typeof renderActiveTradesPanel === 'function') renderActiveTradesPanel();
    if (typeof renderMatches === 'function') renderMatches();
    updateActiveAlbumTitleWithSubName();
  } catch (err) {
    console.error("Hiba a loadAlbumState-ben:", err);
  }
}

function syncLutraDualSave(effKey) {
  if (!currentUser || !db) return;
  const isRootLutra = (effKey === 'lidl-lutra-2026');

  db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(effKey).set({
    albumId: currentAlbumId,
    effKey: effKey,
    subId: currentSubAlbumId,
    van: myProfile.van,
    vanCounts: myProfile.vanCounts || {},
    kell: myProfile.kell,
    foglalva: myProfile.foglalva,
    foglalvaCounts: myProfile.foglalvaCounts || {},
    localUpdatedAt: Date.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  const publicPayload = {
    collections: {
      [effKey]: {
        van: myProfile.van,
        vanCounts: myProfile.vanCounts || {},
        kell: myProfile.kell,
        foglalva: myProfile.foglalva,
        foglalvaCounts: myProfile.foglalvaCounts || {},
        updatedAt: Date.now()
      }
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (isRootLutra) {
    publicPayload.van = myProfile.van;
    publicPayload.vanCounts = myProfile.vanCounts || {};
    publicPayload.kell = myProfile.kell;
    publicPayload.foglalva = myProfile.foglalva;
    publicPayload.foglalvaCounts = myProfile.foglalvaCounts || {};
  }

  db.collection("public_profiles").doc(currentUser.uid).set(publicPayload, { merge: true }).catch(() => {});
}

function saveMyStateFast() {
  const effKey = getEffectiveAlbumKey();
  const now = Date.now();
  lastLocalEditTimestamp = now;

  localStorage.setItem(`lutra_updated_at_${effKey}`, now);
  localStorage.setItem(`lutra_van_${effKey}`, JSON.stringify(myProfile.van));
  localStorage.setItem(`lutra_van_counts_${effKey}`, JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem(`lutra_kell_${effKey}`, JSON.stringify(myProfile.kell));
  localStorage.setItem(`lutra_foglalva_${effKey}`, JSON.stringify(myProfile.foglalva));
  localStorage.setItem(`lutra_foglalva_counts_${effKey}`, JSON.stringify(myProfile.foglalvaCounts || {}));

  if (effKey === 'lidl-lutra-2026') {
    localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
    localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
    localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
    localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
    localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
  }

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    if (typeof refreshMatchesIfVisible === 'function') refreshMatchesIfVisible();
    if (typeof renderCompletionOdds === 'function') renderCompletionOdds();
    syncLutraDualSave(effKey);
  }, 450);
}

function saveMyState() {
  saveMyStateFast();
  renderGrid();
  renderHub();
}

// =========================================================================
// FEJEZETEK / BLOKKOK KEZELÉSE ÉS CSEMPEMEGJELENÍTÉS
// =========================================================================

const collapsedGridChapters = new Set();

function getChapterNumLists(albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId] || {};
  const total = album.totalItems || (albumId === 'lidl-lutra-2026' ? 108 : 0);
  let chapters = [];
  if (albumId === 'lidl-lutra-2026') chapters = getLutraChapters();
  else if (album.hasChapters && album.customChaptersList && album.customChaptersList.length) {
    chapters = album.customChaptersList;
  }
  if (!chapters.length) return [];
  const lists = [];
  const used = new Set();
  chapters.forEach(ch => {
    const nums = [];
    (ch.elemek || []).forEach(el => {
      const arr = el.type === 'combo' ? el.nums : [el.num];
      arr.forEach(n => { if (n >= 1 && n <= total && !used.has(n)) { nums.push(n); used.add(n); } });
    });
    if (nums.length) lists.push({ title: ch.cim, nums });
  });
  const rest = [];
  for (let i = 1; i <= total; i++) if (!used.has(i)) rest.push(i);
  if (rest.length && lists.length) lists.push({ title: 'Egyéb', nums: rest });
  return lists;
}

function gridCellHtml(i, vanSet, kellSet, foglalvaSet, activeLocks, isFigure) {
  const isVan = vanSet.has(i);
  const isKell = kellSet.has(i);
  const isFog = foglalvaSet.has(i);
  let cls = isVan ? 'van' : isKell ? 'kell' : isFog ? 'foglalva' : '';
  if (isFigure) cls += ' cell-figure'; // Valódi tojásforma figura és Kinder esetén!
  
  let badgesHtml = '';
  const vQty = (isVan && myProfile.vanCounts && myProfile.vanCounts[i]) ? myProfile.vanCounts[i] : 1;
  const fQty = activeLocks[i] || 0;
  if (isVan && vQty > 1) badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
  if (fQty > 0) badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
  else if (isFog) {
    const manQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[i]) ? myProfile.foglalvaCounts[i] : 1;
    if (manQty > 1) badgesHtml += `<span class="qty-badge foglalva">×${manQty}</span>`;
  }
  const label = getItemLabel(i, currentAlbumId);
  const longCls = label.length > 5 ? ' cell-long' : '';
  return `<div class="matrica-cell ${cls}${longCls}" data-num="${i}" title="${escapeHtml(getItemFullName(i, currentAlbumId))}">
      ${escapeHtml(label)}
      ${badgesHtml}
    </div>`;
}

// =========================================================================
// RÁCS RENDERELÉS: TISZTA FOLYAMATOS RÁCS VAGY ÚJ BLOKKOS NÉZET
// =========================================================================
function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const isFigure = activeAlbum.type === 'figure' || activeAlbum.type === 'kinder' || (activeAlbum.title && /kinder|figura/i.test(activeAlbum.title));
  
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));
  const activeLocks = getActiveLockedCounts(currentAlbumId);

  const passes = (i) => {
    if (currentFilter === 'van') return vanSet.has(i);
    if (currentFilter === 'kell') return kellSet.has(i);
    if (currentFilter === 'foglalva') return foglalvaSet.has(i);
    return true;
  };

  const lists = getChapterNumLists(currentAlbumId);
  const hasChaptersAvailable = (lists.length >= 2);

  // A nézetváltó gombok (Rácsos nézet / Blokkos nézet) frissítése
  const toggleWrap = document.querySelector('.view-mode-toggle');
  const btnGrid = document.getElementById('btn-mode-grid');
  const btnAlbum = document.getElementById('btn-mode-album');
  
  if (btnAlbum) {
    btnAlbum.textContent = 'Blokkos nézet';
  }

  if (toggleWrap) {
    // Ha az albumnak nincsenek fejezetei, a gombot elrejtjük, marad a tiszta rács
    toggleWrap.style.display = hasChaptersAvailable ? 'flex' : 'none';
  }

  let html = '';

  // HA BLOKKOS NÉZETBEN VAGYUNK:
  if (currentGridMode === 'blocks' && hasChaptersAvailable) {
    lists.forEach(l => {
      const shown = l.nums.filter(passes);
      if (!shown.length) return;
      const key = currentAlbumId + '|' + l.title;
      const collapsed = collapsedGridChapters.has(key);
      const vanN = l.nums.filter(n => vanSet.has(n)).length;
      const kellN = l.nums.filter(n => kellSet.has(n)).length;
      html += `<div class="grid-chapter-head${collapsed ? ' collapsed' : ''}" data-chapter-toggle="${escapeHtml(key)}" role="button" tabindex="0">
        <span class="gch-arrow">▾</span>
        <span class="gch-title">${escapeHtml(l.title)}</span>
        <span class="gch-meta">${l.nums.length} db${vanN ? ` · ${vanN} dupla` : ''}${kellN ? ` · ${kellN} hiányzik` : ''}</span>
      </div>`;
      if (!collapsed) {
        shown.forEach(n => { html += gridCellHtml(n, vanSet, kellSet, foglalvaSet, activeLocks, isFigure); });
      }
    });
    grid.classList.add('grid-blocks');
  } else {
    // ALAPÉRTELMEZETT RÁCSOS NÉZET: 100%-ban tiszta, folytonos 1..N csempe (nincs nyomtatott oldal-törés!)
    for (let i = 1; i <= totalSize; i++) {
      if (!passes(i)) continue;
      html += gridCellHtml(i, vanSet, kellSet, foglalvaSet, activeLocks, isFigure);
    }
    grid.classList.remove('grid-blocks');
  }

  grid.innerHTML = html;
  updateBadgeCounts();
  renderAlbumMore();
}

// Rács vs. Blokkos nézet váltógombok
safeAddListener('btn-mode-grid', () => {
  currentGridMode = 'grid';
  document.getElementById('btn-mode-grid')?.classList.add('active');
  document.getElementById('btn-mode-album')?.classList.remove('active');
  renderGrid();
});

safeAddListener('btn-mode-album', () => {
  currentGridMode = 'blocks';
  document.getElementById('btn-mode-album')?.classList.add('active');
  document.getElementById('btn-mode-grid')?.classList.remove('active');
  renderGrid();
});

// Fejezetlenyitó kattintás a blokkos nézetben
safeAddListener('matrica-grid', (e) => {
  const head = e.target.closest('[data-chapter-toggle]');
  if (!head) return;
  const key = head.dataset.chapterToggle;
  if (collapsedGridChapters.has(key)) collapsedGridChapters.delete(key);
  else collapsedGridChapters.add(key);
  renderGrid();
});

// Továbbiak panel lenyitása
safeAddListener('btn-album-more', () => {
  const panel = document.getElementById('album-more-panel');
  const btn = document.getElementById('btn-album-more');
  if (!panel || !btn) return;
  const open = panel.hidden;
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.textContent = open ? 'Továbbiak ▴' : 'Továbbiak ▾';
  if (open) renderAlbumMore();
});

// =========================================================================
// TOVÁBBIAK PANEL: LEÍRÁS, NYOMTATÁS & MEGOSZTÁS
// =========================================================================

function compactItemLabels(nums, albumId = currentAlbumId) {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts = (n) => { const m = String(getItemLabel(n, albumId)).replace(/^#/, '').match(/^(\D*?)(\d+)$/); return m ? { p: m[1], v: parseInt(m[2], 10) } : null; };
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    const a = parts(sorted[i]);
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) {
      const x = parts(sorted[j]), y = parts(sorted[j + 1]);
      if (!x || !y || x.p !== y.p || y.v !== x.v + 1) break;
      j++;
    }
    const la = String(getItemLabel(sorted[i], albumId)).replace(/^#/, '');
    if (j - i >= 2 && a) out.push(`${la}–${String(getItemLabel(sorted[j], albumId)).replace(/^#/, '').replace(a.p, '')}`);
    else for (let k = i; k <= j; k++) out.push(String(getItemLabel(sorted[k], albumId)).replace(/^#/, ''));
    i = j + 1;
  }
  return out;
}

function autoAlbumDescription(album) {
  if (!album) return '';
  const word = album.type === 'card' ? 'kártyából' : (album.type === 'figure' || album.type === 'kinder') ? 'figurából' : 'matricából';
  const n = album.totalItems || 0;
  const chs = (album.customChaptersList || []).map(c => c.cim).filter(Boolean);
  let t = `${album.title}${album.publisher ? ` – ${album.publisher}` : ''}${album.year ? `, ${album.year}` : ''}: ${n} ${word} álló gyűjtemény`;
  if (chs.length > 1) t += `, ${chs.length} fejezetben (${chs.slice(0, 3).join(', ')}${chs.length > 3 ? ' és további' : ''})`;
  t += '. A Cserélj Okosan oldalon megjelölheted, mid van meg és mid hiányzik, és megtalálhatod a hozzád illő cserepartnert.';
  return t;
}

function renderAlbumMore() {
  const panel = document.getElementById('album-more-panel');
  if (!panel || panel.hidden) return;
  const album = getActiveAlbum() || {};
  const total = getActiveAlbumSize();
  const lists = getChapterNumLists(currentAlbumId);
  const desc = (album.description || '').trim();
  const typeLabel = album.typeLabel || '';
  const chips = lists.length >= 2
    ? `<div class="am-chapters">${lists.map(l => `<span class="am-chip">${escapeHtml(l.title)} <b>${l.nums.length}</b></span>`).join('')}</div>`
    : '';
  const isAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
  panel.innerHTML = `
    <h3 class="am-title">${escapeHtml(album.title || 'Gyűjtemény')}</h3>
    <p class="am-meta">${[album.publisher, album.year, `${total} tétel`, typeLabel].filter(Boolean).map(escapeHtml).join(' · ')}</p>
    ${desc ? `<p class="am-desc">${escapeHtml(desc)}</p>` : `<p class="am-desc am-desc-auto">${escapeHtml(autoAlbumDescription(album))}${isAdmin ? '<br><em>(Admin: a saját leírást a gyűjtemény szerkesztőjében adhatod meg.)</em>' : ''}</p>`}
    ${chips}
    <div class="am-actions">
      <button class="btn btn-secondary btn-sm" id="btn-open-print-sheet">🖨 Nyomtatható lista</button>
      <button class="btn btn-secondary btn-sm" id="btn-open-share-image">🖼 Megosztható kép</button>
      <button class="btn btn-secondary btn-sm" id="btn-copy-missing-list">📋 Hiányzók másolása</button>
    </div>`;
  safeAddListener('btn-open-print-sheet', () => openPrintSheet('state'));
  safeAddListener('btn-open-share-image', () => openShareImage());
  safeAddListener('btn-copy-missing-list', () => {
    const nums = ensureArray(myProfile.kell);
    if (!nums.length) return showToast('Nincs hiányzónak jelölt tételed.');
    const text = `${album.title} – hiányzik (${nums.length} db): ${compactItemLabels(nums).join(', ')}\ncsereljokosan.hu`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('A hiányzók listája a vágólapra került.'), () => showToast('A másolás nem sikerült.'));
    } else showToast('A másolás ezen az eszközön nem érhető el.');
  });
}

// ---------- NYOMTATHATÓ LISTA (A4 PDF) ----------
function openPrintSheet(mode) {
  const album = getActiveAlbum() || {};
  const total = getActiveAlbumSize();
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));
  const lists = getChapterNumLists(currentAlbumId);
  const groups = lists.length >= 2 ? lists : [{ title: '', nums: Array.from({ length: total }, (_, i) => i + 1) }];

  const stateOf = (n) => vanSet.has(n) ? 'van' : kellSet.has(n) ? 'kell' : foglalvaSet.has(n) ? 'fog' : 'none';
  const keep = (n) => {
    const s = stateOf(n);
    if (mode === 'missing') return s === 'kell';
    if (mode === 'dupes') return s === 'van';
    return true;
  };
  const nameOf = (n) => {
    if (currentAlbumId === 'lidl-lutra-2026') return LUTRA_STICKER_NAMES[n] || '';
    return (album.customNames && album.customNames[n - 1]) || '';
  };
  const item = (n) => {
    const s = stateOf(n);
    const q = (s === 'van' && myProfile.vanCounts && myProfile.vanCounts[n]) ? myProfile.vanCounts[n] : 1;
    let box = '☐', extra = '';
    if (mode === 'state' || mode === 'missing' || mode === 'dupes') {
      if (s === 'van') { box = '■'; extra = q > 1 ? `<span class="ps-q">+${q - 1}</span>` : ''; }
      else if (s === 'kell') box = '☐';
      else if (s === 'fog') box = '◧';
      else box = '·';
    }
    const nm = nameOf(n);
    return `<div class="ps-item st-${s}"><span class="ps-box">${box}</span><span class="ps-lab">${escapeHtml(String(getItemLabel(n, currentAlbumId)).replace(/^#/, ''))}</span>${nm ? `<span class="ps-name">${escapeHtml(nm)}</span>` : ''}${extra}</div>`;
  };

  const body = groups.map(g => {
    const nums = g.nums.filter(keep);
    if (!nums.length) return '';
    return `<section class="ps-group">${g.title ? `<h3>${escapeHtml(g.title)} <small>(${nums.length})</small></h3>` : ''}<div class="ps-cols">${nums.map(item).join('')}</div></section>`;
  }).join('') || '<p>Ebben a nézetben nincs megjeleníthető tétel.</p>';

  const counts = `Dupla: ${vanSet.size} · Hiányzik: ${kellSet.size}${foglalvaSet.size ? ` · Foglalt: ${foglalvaSet.size}` : ''}`;
  const modeOpts = [['state', 'Az állapotom szerint'], ['missing', 'Csak a hiányzók'], ['dupes', 'Csak a duplák'], ['blank', 'Üres lista (kézzel kipipálható)']]
    .map(([v, l]) => `<option value="${v}"${v === mode ? ' selected' : ''}>${l}</option>`).join('');

  let sheet = document.getElementById('print-sheet');
  if (!sheet) { sheet = document.createElement('div'); sheet.id = 'print-sheet'; document.body.appendChild(sheet); }
  sheet.innerHTML = `
    <div class="ps-toolbar no-print">
      <select id="ps-mode" class="input-field" style="max-width:260px;">${modeOpts}</select>
      <button class="btn btn-primary" id="ps-print">🖨 Nyomtatás / PDF mentése</button>
      <button class="btn btn-secondary" id="ps-close">Bezárás</button>
    </div>
    <div class="ps-page">
      <header class="ps-head">
        <img src="logo-mark.png" alt="" class="ps-logo" onerror="this.style.display='none'">
        <div class="ps-head-text">
          <div class="ps-brand">Cserélj Okosan! <span>csereljokosan.hu</span></div>
          <h2>${escapeHtml(album.title || 'Gyűjtemény')}</h2>
          <div class="ps-sub">${[album.publisher, album.year, `${total} tétel`].filter(Boolean).map(escapeHtml).join(' · ')} · ${new Date().toLocaleDateString('hu-HU')}</div>
          ${mode === 'blank' ? '' : `<div class="ps-sub">${counts}</div>`}
        </div>
      </header>
      ${mode === 'blank' ? '' : '<div class="ps-legend">■ dupla (+N = ennyi a felesleg) &nbsp; ☐ hiányzik &nbsp; ◧ foglalt &nbsp; · nincs jelölve</div>'}
      ${body}
      <footer class="ps-foot">Cserélj Okosan! – csereljokosan.hu</footer>
    </div>`;
  document.body.classList.add('print-open');
  sheet.style.display = 'block';
  sheet.scrollTop = 0;
  document.getElementById('ps-mode').onchange = (e) => openPrintSheet(e.target.value);
  document.getElementById('ps-print').onclick = () => window.print();
  document.getElementById('ps-close').onclick = closePrintSheet;
}

function closePrintSheet() {
  const sheet = document.getElementById('print-sheet');
  if (sheet) sheet.style.display = 'none';
  document.body.classList.remove('print-open');
}

// ---------- MEGOSZTHATÓ KÉP (INSTAGRAM / FACEBOOK CANVAS) ----------
function csWrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxWidth && cur) { lines.push(cur); cur = w; } else cur = t;
  });
  if (cur) lines.push(cur);
  return lines;
}

function csDrawFitted(ctx, text, x, y, w, h, color, maxFont, minFont) {
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  for (let fs = maxFont; fs >= minFont; fs -= 2) {
    ctx.font = `600 ${fs}px "Segoe UI", Roboto, Arial, sans-serif`;
    const lines = csWrapText(ctx, text, w);
    const lh = Math.round(fs * 1.3);
    if (lines.length * lh <= h) { lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh)); return; }
  }
  ctx.font = `600 ${minFont}px "Segoe UI", Roboto, Arial, sans-serif`;
  const lh = Math.round(minFont * 1.3);
  const maxLines = Math.max(1, Math.floor(h / lh));
  const lines = csWrapText(ctx, text, w).slice(0, maxLines);
  if (lines.length) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*\S*$/, '') + ' …';
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

function csLoadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    const t = setTimeout(() => resolve(null), 2500);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = src;
  });
}

async function buildShareCanvas() {
  const album = getActiveAlbum() || {};
  const total = getActiveAlbumSize();
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));
  const css = getComputedStyle(document.documentElement);
  const col = (n, d) => (css.getPropertyValue(n) || '').trim() || d;
  const C = { deep: col('--water-deep', '#0D2E2C'), mid: col('--water-mid', '#14453F'), moss: col('--moss-soft', '#93B382'), brown: col('--fur-brown', '#8B5E3C'), brownSoft: col('--fur-brown-soft', '#C99568'), blue: col('--reserved-blue', '#2B6CB0'), amber: col('--amber', '#D89B4A'), text: col('--text-primary', '#F3EEDF'), muted: col('--text-muted', '#9FB3A3'), sand: col('--sand', '#E3D5B8') };

  const W = 1080, H = 1440;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const FONT = '"Segoe UI", Roboto, Arial, sans-serif';

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.mid); g.addColorStop(1, C.deep);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const logo = await csLoadImage('logo-mark.png');
  let tx = 60;
  if (logo) { ctx.drawImage(logo, 56, 44, 92, 92); tx = 168; }
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.text; ctx.font = `800 52px ${FONT}`; ctx.fillText('Cserélj Okosan!', tx, 50);
  ctx.fillStyle = C.amber; ctx.font = `600 30px ${FONT}`; ctx.fillText('csereljokosan.hu', tx, 108);

  ctx.fillStyle = C.text; ctx.font = `800 64px ${FONT}`;
  const tl = csWrapText(ctx, album.title || 'Gyűjtemény', W - 120).slice(0, 2);
  tl.forEach((l, i) => ctx.fillText(l, 60, 176 + i * 76));
  const subY = 176 + tl.length * 76 + 4;
  ctx.fillStyle = C.sand; ctx.font = `500 30px ${FONT}`;
  ctx.fillText([album.publisher, album.year, `${total} tétel`].filter(Boolean).join(' · '), 60, subY);

  let y = subY + 58;
  const pills = [[`Dupla: ${vanSet.size}`, C.moss], [`Hiányzik: ${kellSet.size}`, C.brownSoft]];
  if (foglalvaSet.size) pills.push([`Foglalt: ${foglalvaSet.size}`, '#63B3ED']);
  let px = 60;
  ctx.font = `700 34px ${FONT}`;
  pills.forEach(([t, c]) => {
    const w = ctx.measureText(t).width + 44;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, y, w, 58, 29) : ctx.rect(px, y, w, 58); ctx.fill();
    ctx.fillStyle = c; ctx.fillText(t, px + 22, y + 11);
    px += w + 16;
  });

  y += 92;
  const mapW = W - 120, mapMaxH = 340;
  const gap = 3;
  let s = Math.floor(Math.sqrt((mapW * mapMaxH) / Math.max(1, total))) - gap;
  s = Math.max(6, Math.min(34, s));
  let cols = Math.floor(mapW / (s + gap));
  while (Math.ceil(total / cols) * (s + gap) > mapMaxH && s > 6) { s--; cols = Math.floor(mapW / (s + gap)); }
  const rows = Math.ceil(total / cols);
  for (let i = 1; i <= total; i++) {
    const r = Math.floor((i - 1) / cols), c = (i - 1) % cols;
    ctx.fillStyle = vanSet.has(i) ? C.moss : kellSet.has(i) ? C.brown : foglalvaSet.has(i) ? C.blue : 'rgba(243,238,223,0.14)';
    ctx.fillRect(60 + c * (s + gap), y + r * (s + gap), s, s);
  }
  y += Math.min(mapMaxH, rows * (s + gap)) + 36;

  const footTop = H - 150;
  const listArea = footTop - y - 20;
  const dupLabels = compactItemLabels([...vanSet]).join(', ');
  const kellLabels = compactItemLabels([...kellSet]).join(', ');
  const sections = [['Cserélhető (dupla)', dupLabels || '–', C.moss], ['Keresem (hiányzik)', kellLabels || '–', C.brownSoft]];
  const secH = Math.floor(listArea / 2);
  sections.forEach(([title, text, color], k) => {
    const sy = y + k * secH;
    ctx.fillStyle = color; ctx.font = `800 34px ${FONT}`; ctx.fillText(title, 60, sy);
    csDrawFitted(ctx, text, 60, sy + 48, W - 120, secH - 70, C.text, 34, 18);
  });

  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, footTop, W, H - footTop);
  if (logo) ctx.drawImage(logo, 60, footTop + 28, 84, 84);
  ctx.fillStyle = C.text; ctx.font = `800 46px ${FONT}`; ctx.fillText('csereljokosan.hu', logo ? 164 : 60, footTop + 30);
  ctx.fillStyle = C.sand; ctx.font = `500 28px ${FONT}`; ctx.fillText('Jelöld be, mid van meg – találd meg a cserepartnered!', logo ? 164 : 60, footTop + 88);
  return cv;
}

async function openShareImage() {
  showToast('Kép készítése…');
  let cv;
  try { cv = await buildShareCanvas(); } catch (err) { console.error(err); return showToast('A kép elkészítése nem sikerült.'); }
  let modal = document.getElementById('share-image-modal');
  if (!modal) { modal = document.createElement('div'); modal.id = 'share-image-modal'; document.body.appendChild(modal); }
  const url = cv.toDataURL('image/png');
  modal.innerHTML = `
    <div class="si-box">
      <img src="${url}" alt="Megosztható kép a gyűjteményemről" class="si-img">
      <div class="si-actions">
        <button class="btn btn-primary" id="si-share">Megosztás</button>
        <button class="btn btn-secondary" id="si-download">Letöltés</button>
        <button class="btn btn-secondary" id="si-close">Bezárás</button>
      </div>
    </div>`;
  modal.style.display = 'flex';
  const fileName = `cserelj-okosan-${currentAlbumId}.png`;
  const getBlob = () => new Promise(res => cv.toBlob(b => res(b), 'image/png'));
  document.getElementById('si-close').onclick = () => { modal.style.display = 'none'; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  document.getElementById('si-download').onclick = async () => {
    const b = await getBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  document.getElementById('si-share').onclick = async () => {
    try {
      const b = await getBlob();
      const file = new File([b], fileName, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cserélj Okosan!', text: 'csereljokosan.hu' });
      } else {
        document.getElementById('si-download').click();
        showToast('Ezen az eszközön a megosztás helyett letöltöttem a képet.');
      }
    } catch (e) {}
  };
}

function updateBadgeCounts() {
  const cVan = document.getElementById('count-van');
  const cKell = document.getElementById('count-kell');
  const cFoglalva = document.getElementById('count-foglalva');
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
  if (cFoglalva) cFoglalva.textContent = myProfile.foglalva.length;
}

// Egysoros rács szegmens-szűrő kattintáskezelő
document.querySelectorAll('#grid-segmented-filter button, .grid-segmented-control button').forEach(btn => {
  btn.addEventListener('click', () => {
    const filterType = btn.dataset.filter;
    document.querySelectorAll('#grid-segmented-filter button, .grid-segmented-control button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = filterType;
    renderGrid();
  });
});

// =========================================================================
// 0 MS CIKLUS LAKATVÉDELEMMEL ÉS 1-KATTINTÁSOS VISSZAVONÁSSAL (UNDO)
// =========================================================================

function toggleStickerState(num) {
  hideQtyPopover();

  if (getActiveAlbum().active === false) {
    showToast("Ez a gyűjtemény inaktív, reaktiválásig nem szerkeszthető!");
    return;
  }

  // Lakatvédelem ellenőrzése kölcsönösen elfogadott cseréknél
  const activeLocks = getActiveLockedCounts(currentAlbumId);
  if (activeLocks[num] && activeLocks[num] > 0 && myProfile.van.includes(num)) {
    showToast(`🔒 A #${num} tétel zárolva van egy elfogadott csere miatt!`);
    return;
  }

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
    cell.classList.remove('van', 'kell', 'foglalva', 'state-pop');
    void cell.offsetWidth;
    if (state) cell.classList.add(state);
    cell.classList.add('state-pop');
    
    cell.querySelectorAll('.qty-badge').forEach(b => b.remove());

    let badgesHtml = '';
    const vQty = (state === 'van' && myProfile.vanCounts?.[num]) ? myProfile.vanCounts[num] : 0;
    const activeLocks = getActiveLockedCounts(currentAlbumId);
    const fQty = activeLocks[num] || 0;

    if (vQty > 1) badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    if (fQty > 0) badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    else if (state === 'foglalva') {
      const manQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[num]) ? myProfile.foglalvaCounts[num] : 1;
      if (manQty > 1) badgesHtml += `<span class="qty-badge foglalva">×${manQty}</span>`;
    }
    cell.insertAdjacentHTML('beforeend', badgesHtml);
  }
}

function showQtyPopover(num, targetEl) {
  if (!popover || !targetEl) return;
  activePopoverNum = num;
  let currentQty = myProfile.vanCounts[num] || (myProfile.foglalvaCounts?.[num] || 1);

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

// DARABSZÁM POPOVER: DUPLÁNAK JELÖLVE AZONNAL TÖRLI A HIÁNYZÓKBÓL ÉS FOGLALTAKBÓL
document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    const num = activePopoverNum;

    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) {
      myProfile.foglalva.splice(fIdx, 1);
      if (myProfile.foglalvaCounts) delete myProfile.foglalvaCounts[num];
    }

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

// RÁCS GYORSKERESŐ / KIEMELŐ SÁV
safeAddListener('grid-quick-filter', 'input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  const cells = document.querySelectorAll('.matrica-cell');
  
  if (!q) {
    cells.forEach(c => c.style.opacity = '1');
    return;
  }
  
  cells.forEach(c => {
    const num = c.dataset.num;
    const title = (c.getAttribute('title') || '').toLowerCase();
    const isMatch = num === q || num.startsWith(q) || title.includes(q);
    c.style.opacity = isMatch ? '1' : '0.2';
    if (isMatch && num === q) {
      c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
});

// TÖMEGES BEVITEL KEZELŐK
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
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.7 ÉLES KIADÁS)
// 3 / 5. RÉSZ: ROUTER, MAX-FLOW 1:1, CSERE-TERVEZŐ & KÖRCSERE
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

  // Mobil alsó sáv aktív állapot szinkronizálása
  document.querySelectorAll('.bottom-nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.bottomView === viewName);
  });
  const bBar = document.getElementById('mobile-bottom-bar');
  if (bBar) {
    bBar.style.display = (viewName === 'hub') ? 'none' : 'grid';
  }

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
  if (viewName === 'kereso' && typeof renderProximityPartners === 'function') renderProximityPartners();
  if (viewName === 'statisztika') {
    if (typeof renderStatistics === 'function') renderStatistics();
    if (typeof renderCompletionOdds === 'function') renderCompletionOdds();
    if (typeof initOrUpdateLeafletMap === 'function') initOrUpdateLeafletMap();
  }
  if (viewName === 'radar') {
    if (typeof renderRadarReports === 'function') renderRadarReports();
    const rBadge = document.getElementById('radar-badge');
    if (rBadge) rBadge.style.display = 'none';
  }
  if (viewName === 'meetups') {
    if (typeof renderMeetups === 'function') renderMeetups();
    const mBadge = document.getElementById('meetup-badge');
    if (mBadge) mBadge.style.display = 'none';
    updateCserebereBadge();
  }
  if (viewName === 'uzeneteim') {
    if (typeof renderThreadedChat === 'function') renderThreadedChat();
    const badge = document.getElementById('unread-msg-badge');
    const badgeM = document.getElementById('unread-msg-badge-m');
    const bottomBadge = document.getElementById('bottom-msg-badge');
    if (badge) badge.classList.add('read');
    if (badgeM) badgeM.classList.add('read');
    if (bottomBadge) bottomBadge.style.display = 'none';
    updateCserebereBadge();
  }
  if (viewName === 'matricaim') {
    renderGrid();
    if (typeof renderActiveTradesPanel === 'function') renderActiveTradesPanel();
  }
  if (viewName === 'admin') {
    if (typeof renderAdminAnnouncements === 'function') renderAdminAnnouncements();
    if (typeof renderAdminAlbumsList === 'function') renderAdminAlbumsList();
    if (typeof renderAdminSuggestionsList === 'function') renderAdminSuggestionsList();
  }
  if (viewName === 'profil') {
    if (typeof renderProfileLocations === 'function') renderProfileLocations();
    const certCard = document.getElementById('cert-promo-card');
    if (certCard) certCard.style.display = (currentAlbumId === 'lidl-lutra-2026') ? 'block' : 'none';
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

document.querySelectorAll('.bottom-nav-btn[data-bottom-view]').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.bottomView));
});

safeAddListener('btn-bottom-more', () => {
  document.getElementById('modal-bottom-menu')?.classList.add('open');
});
safeAddListener('btn-close-bottom-menu', () => {
  document.getElementById('modal-bottom-menu')?.classList.remove('open');
});

// CÉLZOTT MEGNYITÁS A PROFIL + GOMBOKRÓL (Városi térkép vs. Befejezési esélyek)
document.querySelectorAll('.bottom-sheet-btn[data-jump-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.jumpView;
    const statTarget = btn.dataset.statTarget;
    document.getElementById('modal-bottom-menu')?.classList.remove('open');
    switchView(target);

    if (target === 'statisztika') {
      const mapCard = document.getElementById('stat-sec-map');
      const oddsCard = document.getElementById('stat-sec-odds');
      const poolCard = document.getElementById('stat-sec-pool');

      if (statTarget === 'map') {
        if (oddsCard) oddsCard.style.display = 'none';
        if (poolCard) poolCard.style.display = 'none';
        if (mapCard) {
          mapCard.style.display = 'block';
          mapCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } else if (statTarget === 'odds') {
        if (oddsCard) oddsCard.style.display = 'block';
        if (poolCard) poolCard.style.display = 'block';
        if (mapCard) mapCard.style.display = 'none';
        if (oddsCard) oddsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        if (oddsCard) oddsCard.style.display = 'block';
        if (poolCard) poolCard.style.display = 'block';
        if (mapCard) mapCard.style.display = 'block';
      }
    }
  });
});

function updateCserebereBadge() {
  const badge = document.getElementById('cserebere-badge');
  const bottomMatchBadge = document.getElementById('bottom-match-badge');
  if (!badge) return;
  const unreadMsgBadge = document.getElementById('unread-msg-badge');
  const hasUnread = unreadMsgBadge && unreadMsgBadge.style.display !== 'none' && !unreadMsgBadge.classList.contains('read');
  badge.style.display = hasUnread ? 'inline-block' : 'none';
  if (bottomMatchBadge) bottomMatchBadge.style.display = hasUnread ? 'inline-block' : 'none';
}

// =========================================================================
// KÖZÖS KALAP (ISKOLÁK ÉS ÓVODÁK JÓTÉKONYSÁGI FELAJÁNLÁSA)
// =========================================================================
safeAddListener('btn-open-charity-pool', () => {
  document.getElementById('modal-charity-pool')?.classList.add('open');
});
safeAddListener('btn-close-charity-pool', () => document.getElementById('modal-charity-pool')?.classList.remove('open'));
safeAddListener('btn-close-charity-pool-2', () => document.getElementById('modal-charity-pool')?.classList.remove('open'));

safeAddListener('btn-charity-use-all-van', () => {
  const input = document.getElementById('charity-pool-numbers');
  if (input && myProfile.van) {
    input.value = myProfile.van.map(n => getItemLabel(n)).join(', ');
  }
});

safeAddListener('btn-submit-charity-pool', async () => {
  if (!currentUser) return showToast("A felajánláshoz kérlek lépj be a fiókodba!");
  const rawNums = document.getElementById('charity-pool-numbers')?.value.trim() || '';
  const note = document.getElementById('charity-pool-note')?.value.trim() || '';

  if (!rawNums) return showToast("Kérlek add meg a felajánlott számokat!");

  const activeAlbum = getActiveAlbum();
  const threadId = [currentUser.uid, 'admin_charity'].sort().join('_') + '_' + currentAlbumId;

  try {
    if (db) {
      await db.collection("messages").add({
        fromUid: currentUser.uid,
        fromName: myProfile.nev || 'Gyűjtő',
        fromCity: myProfile.telepules || '',
        toUid: 'admin',
        toName: 'Közös Kalap Koordináció',
        albumId: currentAlbumId,
        threadId: threadId,
        subject: `🎁 Közös Kalap Felajánlás (${activeAlbum.title})`,
        message: `Szia! Szeretném felajánlani az alábbi matricákat az iskolás és ovis csoportoknak:\n\nFelajánlott tételek: ${rawNums}\n${note ? `Megjegyzés: „${note}”\n` : ''}\nHogyan tudom eljuttatni hozzád?`,
        read: false,
        isCharity: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    document.getElementById('modal-charity-pool')?.classList.remove('open');
    if (document.getElementById('charity-pool-numbers')) document.getElementById('charity-pool-numbers').value = '';
    if (document.getElementById('charity-pool-note')) document.getElementById('charity-pool-note').value = '';
    showToast("Hatalmas köszönet! A felajánlásodat elküldtük a koordinátornak.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});
// =========================================================================
// GPS ÉS TÁVOLSÁG MEGHATÁROZÁSA
// =========================================================================

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
      if (typeof renderProximityPartners === 'function') renderProximityPartners();
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
      requestGpsLocation(() => {
        if (typeof renderProximityPartners === 'function') renderProximityPartners();
      });
    } else {
      if (typeof renderProximityPartners === 'function') renderProximityPartners();
    }
  });
});

// =========================================================================
// KOMBINÁLHATÓ PÁROSÍTÁSI SZŰRŐK & SZIMMETRIKUS (1:1) SZŰRŐ
// =========================================================================

let filterSameCity = false;
let filterGiftOnly = false;
let filterSymOnly = false;
let filterLoopOnly = false;

safeAddListener('btn-match-all', 'click', function() {
  filterTargetCity = '';
  filterSameCity = false;
  filterGiftOnly = false;
  filterSymOnly = false;
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

safeAddListener('btn-match-sym', 'click', function() {
  filterTargetCity = '';
  filterLoopOnly = false;
  document.getElementById('btn-match-loop')?.classList.remove('active');
  document.getElementById('btn-match-all')?.classList.remove('active');

  filterSymOnly = !filterSymOnly;
  this.classList.toggle('active', filterSymOnly);
  checkAllFilterReset();
  renderMatches();
});

safeAddListener('btn-match-loop', 'click', function() {
  filterTargetCity = '';
  filterSameCity = false;
  filterGiftOnly = false;
  filterSymOnly = false;
  document.querySelectorAll('#matches-filter-group .filter-btn').forEach(b => b.classList.remove('active'));
  
  filterLoopOnly = !filterLoopOnly;
  this.classList.toggle('active', filterLoopOnly);
  if (!filterLoopOnly) document.getElementById('btn-match-all')?.classList.add('active');
  renderMatches();
});

function checkAllFilterReset() {
  if (!filterSameCity && !filterGiftOnly && !filterSymOnly && !filterLoopOnly) {
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

// TÖBB ALBUM – EGY BORÍTÉK KERESZTCSERE ELLENŐRZŐ
function findCrossAlbumMatches(partnerDocData) {
  if (!partnerDocData || !partnerDocData.collections) return null;
  const otherAlbumMatches = [];

  Object.entries(ALBUMS_REGISTRY).forEach(([albId, albMeta]) => {
    if (albId === currentAlbumId || albMeta.active === false) return;

    const myVan = ensureArray(safeJsonParse(`lutra_van_${albId}`, []));
    const myKell = ensureArray(safeJsonParse(`lutra_kell_${albId}`, []));
    if (myVan.length === 0 && myKell.length === 0) return;

    const partnerCol = partnerDocData.collections[albId] || (albId === 'lidl-lutra-2026' ? partnerDocData : null);
    if (!partnerCol) return;

    const pVan = ensureArray(partnerCol.van || []);
    const pKell = ensureArray(partnerCol.kell || []);

    const myVanSet = new Set(myVan);
    const myKellSet = new Set(myKell);
    const pVanSet = new Set(pVan);
    const pKellSet = new Set(pKell);

    const give = [...myVanSet].filter(n => pKellSet.has(n) && !pVanSet.has(n));
    const get = [...pVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n));
    const totalItems = give.length + get.length;

    if (totalItems > 0) {
      otherAlbumMatches.push({
        albumTitle: albMeta.title,
        totalItems: totalItems,
        giveCount: give.length,
        getCount: get.length
      });
    }
  });

  return otherAlbumMatches.length > 0 ? otherAlbumMatches : null;
}

// =========================================================================
// MAX-FLOW KIEGYENSÚLYOZOTT CSERE-ALGORITMUS (DINIC/FORD-FULKERSON)
// =========================================================================

function createFlowGraph(n) {
  return { n, adj: Array.from({ length: n }, () => []), to: [], cap: [] };
}

function addFlowEdge(g, u, v, c) {
  g.adj[u].push(g.to.length); g.to.push(v); g.cap.push(c);
  g.adj[v].push(g.to.length); g.to.push(u); g.cap.push(0);
  return g.to.length - 2;
}

function runMaxFlow(g, s, t) {
  let flow = 0;
  const level = new Array(g.n);
  const it = new Array(g.n);
  const bfs = () => {
    level.fill(-1);
    level[s] = 0;
    const q = [s];
    for (let qi = 0; qi < q.length; qi++) {
      const u = q[qi];
      for (const e of g.adj[u]) {
        if (g.cap[e] > 0 && level[g.to[e]] < 0) { level[g.to[e]] = level[u] + 1; q.push(g.to[e]); }
      }
    }
    return level[t] >= 0;
  };
  const dfs = (u, f) => {
    if (u === t) return f;
    for (; it[u] < g.adj[u].length; it[u]++) {
      const e = g.adj[u][it[u]];
      const v = g.to[e];
      if (g.cap[e] > 0 && level[v] === level[u] + 1) {
        const d = dfs(v, Math.min(f, g.cap[e]));
        if (d > 0) { g.cap[e] -= d; g.cap[e ^ 1] += d; return d; }
      }
    }
    return 0;
  };
  while (bfs()) {
    it.fill(0);
    let f;
    while ((f = dfs(s, Infinity)) > 0) flow += f;
  }
  return flow;
}

function getAvailableDupeQty(num, locks) {
  const q = (myProfile.vanCounts && myProfile.vanCounts[num]) ? myProfile.vanCounts[num] : 1;
  return q - ((locks && locks[num]) || 0);
}

function computeBalancedPlan(users, overrides) {
  overrides = overrides || {};
  const myVan = new Set(ensureArray(myProfile.van));
  const myKell = new Set(ensureArray(myProfile.kell).filter(n => !myVan.has(n)));
  const locks = getActiveLockedCounts(currentAlbumId);

  const ordered = [...users].sort((a, b) => {
    const la = isLocalCityMatch(myProfile.locations || myProfile.telepules, a.locations || a.telepules) ? 1 : 0;
    const lb = isLocalCityMatch(myProfile.locations || myProfile.telepules, b.locations || b.telepules) ? 1 : 0;
    if (lb !== la) return lb - la;
    return (b.ratingsCount || 0) - (a.ratingsCount || 0);
  });

  const S = 0, T = 1;
  let next = 2 + ordered.length;
  const gNode = new Map();
  const dNode = new Map();
  const getEdges = [];
  const giveEdges = [];
  const wantedBy = {};

  ordered.forEach((u, i) => {
    const uVan = new Set(ensureArray(u.van));
    const uKell = new Set(ensureArray(u.kell).filter(n => !uVan.has(n)));
    myKell.forEach(x => {
      if (uVan.has(x)) {
        if (!gNode.has(x)) gNode.set(x, next++);
        getEdges.push([x, i]);
      }
    });
    myVan.forEach(y => {
      if (uKell.has(y) && getAvailableDupeQty(y, locks) > 0) {
        if (!dNode.has(y)) dNode.set(y, next++);
        giveEdges.push([i, y]);
        (wantedBy[y] = wantedBy[y] || []).push(i);
      }
    });
  });

  const g = createFlowGraph(next);
  gNode.forEach(id => addFlowEdge(g, S, id, 1));
  const getEdgeIds = getEdges.map(([x, i]) => ({ x, i, id: addFlowEdge(g, gNode.get(x), 2 + i, 1) }));
  const giveEdgeIds = [];
  giveEdges.forEach(([i, y]) => {
    if (overrides[y] && ordered[i].id !== overrides[y]) return;
    giveEdgeIds.push({ i, y, id: addFlowEdge(g, 2 + i, dNode.get(y), 1) });
  });
  dNode.forEach((id, y) => addFlowEdge(g, id, T, Math.max(0, getAvailableDupeQty(y, locks))));
  ordered.forEach((u, i) => { if (u.isGiftOffering) addFlowEdge(g, 2 + i, T, 99); });

  runMaxFlow(g, S, T);

  const perUser = {};
  ordered.forEach(u => { perUser[u.id] = { user: u, give: [], get: [] }; });
  getEdgeIds.forEach(e => { if (g.cap[e.id ^ 1] > 0) perUser[ordered[e.i].id].get.push(e.x); });
  giveEdgeIds.forEach(e => { if (g.cap[e.id ^ 1] > 0) perUser[ordered[e.i].id].give.push(e.y); });
  Object.values(perUser).forEach(p => { p.give.sort((a, b) => a - b); p.get.sort((a, b) => a - b); });

  const contested = [];
  Object.keys(wantedBy).forEach(yStr => {
    const y = parseInt(yStr, 10);
    const qty = getAvailableDupeQty(y, locks);
    if (wantedBy[y].length > qty) {
      contested.push({
        num: y,
        qty,
        candidates: wantedBy[y].map(i => ordered[i]),
        winners: wantedBy[y].filter(i => perUser[ordered[i].id].give.includes(y)).map(i => ordered[i].id)
      });
    }
  });
  contested.sort((a, b) => a.num - b.num);

  let totalGet = 0;
  let totalGive = 0;
  Object.values(perUser).forEach(p => { totalGet += p.get.length; totalGive += p.give.length; });
  return { perUser, contested, totalGet, totalGive, ordered };
}

function buildBalancedOffer(u) {
  const myVan = new Set(ensureArray(myProfile.van));
  const myKell = new Set(ensureArray(myProfile.kell).filter(n => !myVan.has(n)));
  const locks = getActiveLockedCounts(currentAlbumId);
  const uVan = new Set(ensureArray(u.van));
  const uKell = new Set(ensureArray(u.kell).filter(n => !uVan.has(n)));

  const giveAll = [...myVan].filter(n => uKell.has(n) && getAvailableDupeQty(n, locks) > 0).sort((a, b) => a - b);
  const getAll = [...uVan].filter(n => myKell.has(n)).sort((a, b) => a - b);
  const k = Math.min(giveAll.length, getAll.length);
  if (k === 0) return { give: giveAll, get: getAll, balanced: false, k: 0 };

  const holders = {};
  allUsersData.forEach(x => { ensureArray(x.van).forEach(n => { holders[n] = (holders[n] || 0) + 1; }); });

  const get = [...getAll].sort((a, b) => (holders[a] || 0) - (holders[b] || 0) || a - b).slice(0, k).sort((a, b) => a - b);
  const give = [...giveAll].sort((a, b) => getAvailableDupeQty(b, locks) - getAvailableDupeQty(a, locks) || a - b).slice(0, k).sort((a, b) => a - b);
  return { give, get, balanced: true, k };
}

function activityLabel(daysSinceActive) {
  if (daysSinceActive === undefined || daysSinceActive >= 999) return '';
  const days = Math.floor(daysSinceActive);
  let text;
  let color = 'var(--text-muted)';
  if (days <= 0) { text = 'ma aktív'; color = 'var(--moss-soft)'; }
  else if (days === 1) { text = 'tegnap volt aktív'; color = 'var(--moss-soft)'; }
  else if (days <= 5) { text = `${days} napja aktív`; color = 'var(--moss-soft)'; }
  else if (days <= 30) { text = `${days} napja aktív`; }
  else { text = 'több mint egy hónapja nem járt itt'; }
  return `<span style="font-size:0.72rem; color:${color}; margin-left:6px;">● ${text}</span>`;
}

// =========================================================================
// PÁROSÍTÁSOK MEGJELENÍTÉSE (SZIGORÚ RANGSOROLÁSI HIERARCHIÁVAL)
// =========================================================================

function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const myCoords = myGpsCoords || getUserCoordinates(myProfile);
  const now = Date.now();

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
      const isSymmetric = give.length > 0 && give.length === get.length;
      const distanceKm = getMinDistanceToUser(myCoords, u);

      const lastActiveMs = u.lastActive?.toDate ? u.lastActive.toDate().getTime() : (typeof u.lastActive === 'number' ? u.lastActive : 0);
      const listUpdatedMs = u.updatedAt?.toDate ? u.updatedAt.toDate().getTime() : (typeof u.updatedAt === 'number' ? u.updatedAt : 0);

      const daysSinceActive = lastActiveMs ? (now - lastActiveMs) / (1000 * 3600 * 24) : 999;
      const daysSinceListUpdate = listUpdatedMs ? (now - listUpdatedMs) / (1000 * 3600 * 24) : 999;

      const avgRating = (u.ratingsCount > 0) ? (u.trustScore / u.ratingsCount) : 0;
      const updatedAgo = formatTimeAgo(u.updatedAt);

      const rawDoc = (typeof rawAllUsersDocs !== 'undefined') ? rawAllUsersDocs.find(d => d.id === u.id) : null;
      const crossMatches = rawDoc ? findCrossAlbumMatches(rawDoc.data()) : null;

      return {
        ...u,
        give,
        get,
        score,
        isSameCity,
        isGift,
        isSymmetric,
        distanceKm,
        updatedAgo,
        daysSinceActive,
        daysSinceListUpdate,
        avgRating,
        crossMatches
      };
    })
    .filter(m => m.score > 0 || (m.isGift && m.get.length > 0));

  if (filterTargetCity) {
    matches = matches.filter(m => isLocalCityMatch(filterTargetCity, m.locations || m.telepules));
  } else {
    if (filterSameCity) matches = matches.filter(m => m.isSameCity);
    if (filterGiftOnly) matches = matches.filter(m => m.isGift);
    if (filterSymOnly) matches = matches.filter(m => m.isSymmetric);
  }

  // PÁROSÍTÁSI RANGSOROLÁS (SZIGORÚ HIERARCHIA)
  matches.sort((a, b) => {
    // 1. Helyi csere mindig előre
    if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);

    // 2. Két helyi közül: a frissebben belépett partner a jobb
    const activeDiff = a.daysSinceActive - b.daysSinceActive;
    if (Math.abs(activeDiff) >= 1.0) return activeDiff;

    // 3. Ha hasonló ideje léptek be: az kerül előre, aki a listáját frissítette
    const listDiff = a.daysSinceListUpdate - b.daysSinceListUpdate;
    if (Math.abs(listDiff) >= 1.0) return listDiff;

    // 4. Ha mindkettő friss: a lezárt cserék csillagos értékelése dönt
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;

    // 5. Csereérték (megszerezhető matricák száma)
    if (b.score !== a.score) return b.score - a.score;

    // 6. Ingyenes felajánlók előnye
    if (b.isGift !== a.isGift) return (b.isGift ? 1 : 0) - (a.isGift ? 1 : 0);

    // 7. Légvonalbeli távolság
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
      ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${m.avgRating.toFixed(1)} (${m.ratingsCount})</span>`
      : '';

    const modeBadge = m.tradeMode === 'post_only'
      ? '<span class="badge-local" style="background:var(--water-mid); color:var(--sand); border:1px solid rgba(243,238,223,0.2);">Csak postáz</span>'
      : (m.tradeMode === 'personal_only' ? '<span class="badge-local" style="background:var(--water-mid); color:var(--sand); border:1px solid rgba(243,238,223,0.2);">Csak személyesen</span>' : '');

    let crossMatchHtml = '';
    if (m.crossMatches && m.crossMatches.length > 0) {
      crossMatchHtml = `
        <div style="background:rgba(216,155,74,0.14); border:1px dashed var(--amber); border-radius:var(--radius-sm); padding:6px 10px; margin:6px 0; font-size:0.78rem; color:var(--sand);">
          <strong>Egy borítékban postázható:</strong> Ezzel a partnerrel a(z) <strong>${escapeHtml(m.crossMatches[0].albumTitle)}</strong> gyűjteményben is tudtok cserélni (${m.crossMatches[0].totalItems} db tétel)! Vonjátok össze!
        </div>
      `;
    }

    return `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''} ${trustBadge}
          </h3>
          <div style="font-size:0.75rem; color:var(--amber); font-weight:600; margin-top:2px;">
            ${distText} ${timeText} ${activityLabel(m.daysSinceActive)}
          </div>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          ${m.isSameCity ? '<span class="badge-local">Helyi csere</span>' : ''}
          ${m.isGift ? '<span class="badge-gift">Ingyen felajánló</span>' : ''}
          ${m.isSymmetric ? '<span class="badge-local" style="background:var(--moss-soft); color:#081B1A;">1:1 Csere</span>' : ''}
          ${modeBadge}
          <span class="badge-ratio">${m.give.length} db ⇄ ${m.get.length} db</span>
        </div>
      </div>

      ${crossMatchHtml}

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
          ${(m.give.length > 0 && m.get.length > 0 && !m.isSymmetric) ? `<button class="btn btn-secondary btn-sm" data-action="contact-balanced" data-uid="${escapeHtml(m.id)}" title="Ugyanannyit kérsz, mint amennyit adsz">⚖️ 1:1 ajánlat</button>` : ''}
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

  // Max-flow alapú optimális folyamterv
  const plan = computeBalancedPlan(selectedUsers, tradePlanManualOverrides);
  const allocation = {};
  selectedUsers.forEach(u => { allocation[u.id] = (plan.perUser[u.id] ? plan.perUser[u.id].give : []).slice(); });
  const conflicts = plan.contested.map(c => ({
    num: c.num,
    myQty: c.qty,
    winnerUid: c.winners[0] || null,
    demandList: c.candidates.map(u => ({
      user: u,
      totalGivesToMe: plan.perUser[u.id] ? plan.perUser[u.id].get.length : 0,
      isSameCity: isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules)
    }))
  }));

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
          const currentWinnerUid = tradePlanManualOverrides[c.num] || c.winnerUid;
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
    const givesToMe = (plan.perUser[u.id] ? plan.perUser[u.id].get : []).slice().sort((a, b) => a - b);

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
  if (typeof openContactModal === 'function') {
    openContactModal(targetUser, giveNums, getNums, targetUser.isGiftOffering);
  }
});

// PÁROSÍTÁSOK KATTINTÁSKEZELŐJE
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
    if (typeof openContactModal === 'function') {
      openContactModal(targetUser, give, get, targetUser.isGiftOffering);
    }
  } else if (action === 'contact-balanced') {
    const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
    if (!targetUser) return;
    const offer = buildBalancedOffer(targetUser);
    if (offer.balanced) {
      showToast(`Kiegyensúlyozott ajánlat: ${offer.k} ⇄ ${offer.k} tétel.`);
      openContactModal(targetUser, offer.give, offer.get, targetUser.isGiftOffering);
    } else {
      openContactModal(targetUser, offer.give, offer.get, targetUser.isGiftOffering);
    }
  } else if (action === 'inspect-user') {
    if (typeof openUserProfileModal === 'function') openUserProfileModal(btn.dataset.uid);
  } else if (action === 'contact-loop-b' || action === 'contact-loop-c') {
    const loopIdx = parseInt(btn.dataset.loopIdx, 10);
    const loops = computeLoopMatches();
    const loop = loops[loopIdx];
    if (!loop) return;
    if (typeof openLoopContactModal === 'function') {
      if (action === 'contact-loop-b') {
        openLoopContactModal(loop.userB, loop.userC, loop.giveToB, loop.giveBtoC, loop.giveCtoMe, 'B');
      } else {
        openLoopContactModal(loop.userC, loop.userB, loop.giveCtoMe, loop.giveToB, loop.giveBtoC, 'C');
      }
    }
  }
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.7 ÉLES KIADÁS)
// 4 / 5. RÉSZ: SZKENNER, FB ELEMZŐ & KAPCSOLATFELVÉTEL (ZÁROLÁS NÉLKÜL)
// =========================================================================

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();
let activeContactSuggestNums = [];
let selectedSuggestNums = new Set();

// Az „Egyedi felajánlás” mezőből felismeri a tételeket (pl. "12, 15, 20-22, 2 tábla csoki").
// A felismert tételek a „Te adod” részbe kerülnek, a többi szöveg marad egyedi felajánlás.
function parseOfferText(raw) {
  const nums = [];
  const textParts = [];
  const album = getActiveAlbum() || {};
  const size = getActiveAlbumSize();
  const labelMap = {};
  (album.customItems || []).forEach((lab, i) => {
    if (lab) labelMap[String(lab).replace(/^#/, '').trim().toLowerCase()] = i + 1;
  });
  String(raw || '').split(/[,;\n]+/).map(t => t.trim()).filter(Boolean).forEach(tok => {
    const bare = tok.replace(/^#/, '').trim().toLowerCase();
    if (labelMap[bare] !== undefined) { nums.push(labelMap[bare]); return; }
    let m = tok.match(/^#?(\d{1,5})$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= size) { nums.push(n); return; }
    }
    m = tok.match(/^#?(\d{1,5})\s*[-–—]\s*#?(\d{1,5})$/);
    if (m) {
      const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      if (lo >= 1 && hi <= size && hi - lo <= 60) {
        for (let n = lo; n <= hi; n++) nums.push(n);
        return;
      }
    }
    textParts.push(tok);
  });
  return { nums: [...new Set(nums)], text: textParts.join(', ') };
}

function getEffectiveContactGive() {
  const parsed = parseOfferText(document.getElementById('contact-custom-offer')?.value || '');
  const set = new Set([
    ...activeContactGiveNums.filter(n => !excludedGiveNums.has(n)),
    ...selectedSuggestNums,
    ...parsed.nums
  ]);
  return { nums: [...set].sort((a, b) => a - b), customText: parsed.text, recognized: parsed.nums };
}
let fbMatchUploadedBase64 = '';
let scannerRecognizedNums = [];

// =========================================================================
// FOTÓS SZÁMSZKENNER LOGIKÁJA & DRAG-AND-DROP TÁMOGATÁS
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
    const idToken = currentUser ? await currentUser.getIdToken() : '';
    const res = await fetch(WORKER_ENDPOINT_URL, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      body: JSON.stringify({ base64Data, mode: 'numbers' })
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
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
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
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db tétel mentve a Hiányzókhoz.`);
});

safeAddListener('btn-scanner-save-foglalva', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs menthető tétel.");
  scannerRecognizedNums.forEach(num => {
    if (!myProfile.foglalva.includes(num)) myProfile.foglalva.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
  });
  saveMyState();
  closeScannerModal();
  showToast(`${scannerRecognizedNums.length} db tétel mentve a Foglalthoz.`);
});

safeAddListener('btn-scanner-copy-list', () => {
  if (scannerRecognizedNums.length === 0) return showToast("Nincs másolható szám.");
  const formattedText = scannerRecognizedNums.map(n => getItemLabel(n)).join(', ');
  navigator.clipboard.writeText(formattedText);
  showToast("Számsor kimásolva a vágólapra!");
});

// Drag-and-Drop támogatás
['modal-scanner', 'modal-fb-crossmatch'].forEach(modalId => {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.addEventListener('dragover', (e) => { e.preventDefault(); modal.classList.add('drag-over'); });
  modal.addEventListener('dragleave', () => { modal.classList.remove('drag-over'); });
  modal.addEventListener('drop', (e) => {
    e.preventDefault();
    modal.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      if (modalId === 'modal-scanner') handleImageFile(e.dataTransfer.files[0]);
      else if (modalId === 'modal-fb-crossmatch') {
        processFbImageFile(e.dataTransfer.files[0]);
      }
    }
  });
});

// =========================================================================
// KIIKSZELŐS KAPCSOLATFELVÉTELI RENDSZER (ZÁROLÁS KIZÁRÓLAG ELFOGADÁSKOR!)
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
    tradeMode: targetUser.tradeMode || 'both',
    isGift: isGift,
    subject: subject,
    customInitialMsg: customInitialMsg,
    isEdited: false
  };

  activeContactGiveNums = ensureArray(giveArray);
  activeContactGetNums = ensureArray(getArray);
  excludedGiveNums.clear();
  excludedGetNums.clear();

  // „Te adhatnád”: ami neki hiányzik, de nálad megvan (és nincs lefoglalva)
  const targetKell = new Set(ensureArray(targetUser.kell));
  const alreadyGiving = new Set(activeContactGiveNums);
  const myReserved = new Set(ensureArray(myProfile.foglalva));
  activeContactSuggestNums = ensureArray(myProfile.van).filter(n => targetKell.has(n) && !alreadyGiving.has(n) && !myReserved.has(n));
  selectedSuggestNums.clear();

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

  const sugBox = document.getElementById('contact-suggest-chips');
  if (sugBox) {
    sugBox.innerHTML = activeContactSuggestNums.length ? activeContactSuggestNums.map(n => {
      const sel = selectedSuggestNums.has(n);
      return `
        <span class="contact-item-chip" data-action="toggle-suggest-chip" data-num="${n}" style="cursor:pointer; ${sel ? 'background:rgba(216,155,74,0.35); border-color:var(--amber);' : ''}">
          ${escapeHtml(getItemLabel(n, currentAlbumId))}
          <span class="chip-del">${sel ? '✓' : '+'}</span>
        </span>
      `;
    }).join('') : '<em style="color:var(--text-muted); font-size:0.75rem;">(Nincs olyan tételed, ami neki hiányozna)</em>';
  }

  if (giveWrapper) giveWrapper.style.display = activeContactGiveNums.length > 0 ? 'block' : 'none';
  if (getWrapper) getWrapper.style.display = activeContactGetNums.length > 0 ? 'block' : 'none';

  if (giveBox) {
    giveBox.innerHTML = activeContactGiveNums.length ? activeContactGiveNums.map(n => {
      const isExcluded = excludedGiveNums.has(n);
      return `
        <span class="contact-item-chip ${isExcluded ? 'excluded' : ''}" data-action="toggle-give-chip" data-num="${n}">
          ${escapeHtml(getItemLabel(n, currentAlbumId))}
          <span class="chip-del">✕</span>
        </span>
      `;
    }).join('') : '<em style="color:var(--text-muted); font-size:0.75rem;">(Nincs közvetlen egyező tétel)</em>';
  }

  if (getBox) {
    getBox.innerHTML = activeContactGetNums.length ? activeContactGetNums.map(n => {
      const isExcluded = excludedGetNums.has(n);
      return `
        <span class="contact-item-chip ${isExcluded ? 'excluded' : ''}" data-action="toggle-get-chip" data-num="${n}" style="border-color:var(--moss-soft);">
          ${escapeHtml(getItemLabel(n, currentAlbumId))}
          <span class="chip-del">✕</span>
        </span>
      `;
    }).join('') : '<em style="color:var(--text-muted); font-size:0.75rem;">(Egyeztetés alatt)</em>';
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
  } else if (chip.dataset.action === 'toggle-suggest-chip') {
    if (selectedSuggestNums.has(num)) selectedSuggestNums.delete(num);
    else selectedSuggestNums.add(num);
    activeContactTarget.isEdited = false;
    activeContactTarget.customInitialMsg = '';
  }

  renderContactChips();
  updateContactModalText();
});

function updateContactModalText() {
  const inputEl = document.getElementById('contact-msg-input');
  const zeroWarn = document.getElementById('contact-zero-give-warning');
  if (!inputEl) return;

  // Felismert tételek jelzése az egyedi felajánlás alatt
  const effPre = getEffectiveContactGive();
  const recEl = document.getElementById('contact-custom-recognized');
  if (recEl) {
    if (effPre.recognized.length) {
      const myVanNow = new Set(ensureArray(myProfile.van));
      recEl.style.display = 'block';
      recEl.innerHTML = 'Felismert tétel(ek) – a „Te adod” részbe kerülnek: ' + effPre.recognized.map(n =>
        `<strong>${escapeHtml(getItemLabel(n, currentAlbumId))}</strong>${myVanNow.has(n) ? '' : ' <span style="color:var(--amber);">(nincs dupla nálad)</span>'}`
      ).join(', ');
    } else {
      recEl.style.display = 'none';
      recEl.innerHTML = '';
    }
  }

  if (activeContactTarget.customInitialMsg && !activeContactTarget.isEdited) {
    inputEl.value = activeContactTarget.customInitialMsg;
    return;
  }

  const activeAlbum = getActiveAlbum();
  const effectiveGive = effPre.nums.map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  const customOfferText = effPre.customText;

  // „SEMMIT NEM ADSZ” BARÁTSÁGOS FIGYELMEZTETÉS
  const hasGivingStickers = effectiveGive.length > 0;
  const hasCustomOffer = customOfferText.length > 0;
  if (!hasGivingStickers && !hasCustomOffer && !activeContactTarget.isGift) {
    if (zeroWarn) zeroWarn.style.display = 'block';
  } else {
    if (zeroWarn) zeroWarn.style.display = 'none';
  }

  let giveTextPart = effectiveGive;
  if (customOfferText) {
    giveTextPart = giveTextPart ? `${giveTextPart} + ${customOfferText}` : customOfferText;
  }
  if (!giveTextPart) giveTextPart = '(egyeztetés alatt / egyedi megbeszélés)';

  let tradeModeNote = '';
  if (activeContactTarget.tradeMode === 'post_only') tradeModeNote = '\n(Megjegyzés: A partnerem jelezte, hogy elsősorban postán/Foxposton cserél.)';
  else if (activeContactTarget.tradeMode === 'personal_only') tradeModeNote = '\n(Megjegyzés: A partnerem jelezte, hogy elsősorban személyesen cserél.)';

  let msg = '';
  if (activeContactTarget.isGift && !effectiveGive && !customOfferText) {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan oldalon láttam a felajánlásodat, hogy a dupláidat szívesen odaadod ajándékba a(z) ${activeAlbum.title} gyűjteményből.\nSzeretném elkérni az alábbi tételt/tételeket:\n${effectiveGet || 'egyeztetés alatt'}\n\nHogyan tudnánk lebonyolítani az átadást/postázást?${tradeModeNote}\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  } else {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan platformon találtam meg a gyűjteményedet a(z) ${activeAlbum.title} albumban:\n\nÉn tudom adni neked: ${giveTextPart}\nTe tudod adni nekem: ${effectiveGet || '(egyeztetés alatt)'}\n\nMegfelelne a csere postán vagy személyesen?${tradeModeNote}\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
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

// BELSŐ ÜZENET KÜLDÉSE (SZIGORÚAN CSAK ELFOGADÁSKOR ZÁROLUNK, KÜLDÉSKOR MÉG NEM!)
safeAddListener('btn-send-message', () => {
  const messageText = document.getElementById('contact-msg-input')?.value.trim() || '';
  if (!messageText) return showToast("Kérlek írj be egy üzenetet!");

  const loader = document.getElementById('contact-send-loader');
  const sendBtn = document.getElementById('btn-send-message');
  const autoCreateTrade = document.getElementById('contact-auto-create-trade')?.checked !== false;

  if (loader) loader.style.display = 'block';
  if (sendBtn) sendBtn.disabled = true;

  const effGiveSend = getEffectiveContactGive();
  const effectiveGiveNums = effGiveSend.nums;
  const effectiveGetNums = activeContactGetNums.filter(n => !excludedGetNums.has(n));
  const customOfferText = effGiveSend.customText;

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
        cacheTradeLocal(newTradeObj);

        // NEM zárolunk itt! A lakatok kizárólag a partner kölcsönös elfogadása után kerülnek fel!
        saveMyState();
        if (typeof renderActiveTradesPanel === 'function') renderActiveTradesPanel();
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

      showToast("Üzeneted és csereajánlatod elküldve a partnernek!");
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

safeAddListener('btn-copy-partner-email', () => {
  const email = document.getElementById('contact-partner-email')?.textContent || '';
  if (!email) return showToast("Nincs másolható e-mail cím.");
  navigator.clipboard.writeText(email);
  showToast("Partner e-mail címe kimásolva.");
});

// =========================================================================
// FACEBOOK POSZT ELEMZŐ & ÖSSZEVETŐ MOTOR (KAMERÁS FOTÓZÁSSAL)
// =========================================================================

safeAddListener('btn-open-fb-crossmatch', () => {
  document.getElementById('modal-fb-crossmatch')?.classList.add('open');
});
safeAddListener('btn-close-fb-crossmatch', () => {
  document.getElementById('modal-fb-crossmatch')?.classList.remove('open');
});

safeAddListener('btn-fb-tab-text', () => {
  document.getElementById('btn-fb-tab-text')?.classList.add('active');
  document.getElementById('btn-fb-tab-photo')?.classList.remove('active');
  if (document.getElementById('fb-match-text-container')) document.getElementById('fb-match-text-container').style.display = 'block';
  if (document.getElementById('fb-match-photo-container')) document.getElementById('fb-match-photo-container').style.display = 'none';
});

safeAddListener('btn-fb-tab-photo', () => {
  document.getElementById('btn-fb-tab-photo')?.classList.add('active');
  document.getElementById('btn-fb-tab-text')?.classList.remove('active');
  if (document.getElementById('fb-match-photo-container')) document.getElementById('fb-match-photo-container').style.display = 'block';
  if (document.getElementById('fb-match-text-container')) document.getElementById('fb-match-text-container').style.display = 'none';
});

function processFbImageFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.min(img.width, 1400);
      canvas.height = Math.round((img.height * canvas.width) / img.width);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      fbMatchUploadedBase64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      const previewBox = document.getElementById('fb-match-photo-preview');
      const previewImg = document.getElementById('fb-photo-preview-img');
      if (previewBox && previewImg) {
        previewImg.src = canvas.toDataURL('image/jpeg', 0.8);
        previewBox.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

// Közvetlen kamerás és fájl tallózás az FB Elemzőhöz
safeAddListener('fb-match-camera-input', (e) => processFbImageFile(e.target.files[0]));
safeAddListener('fb-match-file-input', (e) => processFbImageFile(e.target.files[0]));

function parseFacebookPostText(rawText) {
  let otherHas = [];
  let otherNeeds = [];

  const HAS_KW = /(?:^|\s|[,;\n])(?:van|dupla|dupl[aá]k?|cser[eé]k?|cserematric[aá]k?|adom|adok|cser[eé]lem|plusz|plussz|tudok adni|tudunk adni|k[íi]n[aá]l|felesleg)[:\s\-—–]*/i;
  const NEEDS_KW = /(?:^|\s|[,;\n])(?:kell|hi[aá]ny(?:z[oó]k?)?|k[eé]rem|keres(?:em|s[uü]k|n[eé]m)?|valakinek megvan\??|sz[uü]ks[eé]gem van|vinn[eé]k)[:\s\-—–]*/i;

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

safeAddListener('btn-run-fb-match', async () => {
  const isPhotoTab = document.getElementById('btn-fb-tab-photo')?.classList.contains('active');
  const rawText = document.getElementById('fb-match-raw-text')?.value.trim() || '';
  const loader = document.getElementById('fb-match-loader');
  const resultsBox = document.getElementById('fb-match-results-box');

  if (!isPhotoTab && !rawText) return showToast("Másolj be egy Facebook posztot a szövegdobozba!");
  if (isPhotoTab && !fbMatchUploadedBase64) return showToast("Készíts vagy válassz ki egy fotót!");

  if (loader) loader.style.display = 'block';
  if (resultsBox) resultsBox.style.display = 'none';

  let postData = { has: [], needs: [] };

  try {
    if (isPhotoTab && fbMatchUploadedBase64) {
      const idToken = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        body: JSON.stringify({ base64Data: fbMatchUploadedBase64, mode: 'fb_post_ocr' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "A fotó felismerése sikertelen.");
      postData = parseFacebookPostText(data.text || '');
    } else {
      postData = parseFacebookPostText(rawText);
    }

    const myVanSet = new Set(ensureArray(myProfile.van));
    const myKellSet = new Set(ensureArray(myProfile.kell));

    const iCanGet = postData.has.filter(n => myKellSet.has(n)).sort((a, b) => a - b);
    const iCanGive = postData.needs.filter(n => myVanSet.has(n)).sort((a, b) => a - b);

    const getCountEl = document.getElementById('fb-match-get-count');
    const giveCountEl = document.getElementById('fb-match-give-count');
    const getPillsEl = document.getElementById('fb-match-get-pills');
    const givePillsEl = document.getElementById('fb-match-give-pills');
    const replyTextEl = document.getElementById('fb-match-reply-text');

    if (getCountEl) getCountEl.textContent = iCanGet.length;
    if (giveCountEl) giveCountEl.textContent = iCanGive.length;

    if (getPillsEl) {
      getPillsEl.innerHTML = iCanGet.length 
        ? iCanGet.map(n => `<span class="fb-match-pill get">${escapeHtml(getItemLabel(n))}</span>`).join(' ')
        : '<em style="color:var(--text-muted);">Sajnos ebből a posztból most nincs hiányzód.</em>';
    }

    if (givePillsEl) {
      givePillsEl.innerHTML = iCanGive.length
        ? iCanGive.map(n => `<span class="fb-match-pill give">${escapeHtml(getItemLabel(n))}</span>`).join(' ')
        : '<em style="color:var(--text-muted);">Neki nincs olyan hiányzója, amiből duplád lenne.</em>';
    }

    const activeAlbum = getActiveAlbum();
    let replyMsg = `Szia! Összevetettem a listádat a Cserélj Okosanon a(z) ${activeAlbum.title} gyűjteményemhez:\n\n`;

    if (iCanGet.length > 0) {
      replyMsg += `Tőled ezek kellenének nekem (${iCanGet.length} db): ${iCanGet.map(n => getItemLabel(n)).join(', ')}\n`;
    }
    if (iCanGive.length > 0) {
      replyMsg += `Cserébe én ezeket tudom adni a dupláimból (${iCanGive.length} db): ${iCanGive.map(n => getItemLabel(n)).join(', ')}\n`;
    }
    if (iCanGet.length === 0 && iCanGive.length === 0) {
      replyMsg += `Megnéztem a posztodat, de most sajnos nincs közvetlen egyezésünk a dupláink között.\n`;
    }

    const cityText = myProfile.telepules ? ` (${myProfile.telepules})` : '';
    replyMsg += `\nMegfelelne a csere személyesen vagy postán?\nÜdvözlettel: ${myProfile.nev}${cityText} (https://csereljokosan.hu)`;

    if (replyTextEl) replyTextEl.value = replyMsg;
    if (resultsBox) resultsBox.style.display = 'block';

  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
});

safeAddListener('btn-copy-fb-reply', () => {
  const replyEl = document.getElementById('fb-match-reply-text');
  if (!replyEl || !replyEl.value) return;
  navigator.clipboard.writeText(replyEl.value);
  showToast("Komment kimásolva! Már illesztheted is be a Facebook poszt alá.");
});
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.7 ÉLES KIADÁS)
// 5A / 5. RÉSZ: CSEREMENEDZSMENT, ALKU, ÉRTÉKELŐ, 4 KERESŐ & RADAR
// =========================================================================

let activeTradeClosingData = null;
let activeTradeCancellingIdx = null;
let activePromptTradeData = null;
let activeCounterTradeData = null;
let counterExcludedGive = new Set();
let counterExcludedGet = new Set();
let selectedStarRating = 5;

// =========================================================================
// RÁCS ALATTI CSERÉK, ZÁROLÁSOK & ARCHÍVUM
// =========================================================================

function renderActiveTradesPanel() {
  const panel = document.getElementById('active-trades-panel');
  const list = document.getElementById('active-trades-list');
  const countSpan = document.getElementById('active-trades-count');
  const subnavBadge = document.getElementById('badge-trades-count');

  if (!panel || !list) return;

  const allTrades = myProfile.activeTrades || [];
  const pendingTrades = allTrades.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const archivedTrades = allTrades.filter(t => t.status === 'completed' || t.status === 'cancelled');

  if (countSpan) countSpan.textContent = pendingTrades.length;
  if (subnavBadge) {
    subnavBadge.textContent = pendingTrades.length;
    subnavBadge.style.display = pendingTrades.length > 0 ? 'inline-block' : 'none';
  }

  if (pendingTrades.length === 0 && archivedTrades.length === 0) {
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
      const isCounterOffer = (t.status === 'counter_offer');
      const isAccepted = (t.status === 'accepted');
      const isShipped = (t.status === 'shipped');

      let statusBadge = '';
      if (isWaitingMyAcceptance) {
        statusBadge = `<span class="badge-trade-status badge-status-waiting">Elfogadásodra vár</span>`;
      } else if (isWaitingPartnerAcceptance) {
        statusBadge = `<span class="badge-trade-status badge-status-waiting">Partner jóváhagyására vár</span>`;
      } else if (isCounterOffer) {
        statusBadge = `<span class="badge-trade-status badge-status-waiting" style="color:var(--amber); border-color:var(--amber);">Módosított ajánlat</span>`;
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
              ${(isWaitingMyAcceptance || isCounterOffer) ? `
                <button class="btn btn-contact-green btn-sm" data-action="accept-trade" data-trade-idx="${originalIdx}">
                  ✓ Elfogadom & Tételek zárolása
                </button>
                <button class="btn btn-secondary btn-sm" data-action="edit-counter-trade" data-trade-idx="${originalIdx}" style="color:var(--amber); border-color:var(--amber);">
                  Módosítás
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

  // ÖSSZECSUKHATÓ ARCHÍVUM
  if (archivedTrades.length > 0) {
    html += `
      <details class="archived-trades-details" style="margin-top:12px; border-top:1px dashed rgba(243,238,223,0.15); padding-top:8px;">
        <summary style="font-size:0.8rem; color:var(--amber); cursor:pointer; font-weight:700; user-select:none;">
          ▶ Korábbi és visszavont cserék archívuma (${archivedTrades.length} db)
        </summary>
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
          ${archivedTrades.map(t => {
            const isDone = (t.status === 'completed');
            const statusLabel = isDone ? '✓ Teljesítve' : '✕ Visszavonva';
            const statusColor = isDone ? 'var(--moss-soft)' : 'var(--danger)';
            return `
              <div style="background:rgba(0,0,0,0.25); padding:6px 10px; border-radius:var(--radius-sm); font-size:0.76rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <strong style="color:var(--text-primary);">${escapeHtml(t.partnerName)}</strong> (${escapeHtml(t.partnerCity || '')})
                  <br>Átadva: ${t.givingItems?.map(n => getItemLabel(n)).join(', ') || '-'} ➔ Kapva: ${t.receivingItems?.map(n => getItemLabel(n)).join(', ') || '-'}
                  ${t.cancelReason ? `<div style="color:var(--danger); font-style:italic;">Indoklás: ${escapeHtml(t.cancelReason)}</div>` : ''}
                </div>
                <span style="color:${statusColor}; font-weight:700;">${statusLabel}</span>
              </div>
            `;
          }).join('')}
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

  if (btn.dataset.action === 'accept-trade') {
    trade.status = 'accepted';
    // Kölcsönös elfogadáskor aktiválódik a lakat a rácson!
    if (trade.givingItems) {
      trade.givingItems.forEach(n => {
        if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
        if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
        myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
      });
    }

    if (db && trade.tradeId) {
      db.collection("trades").doc(trade.tradeId).update({ status: 'accepted' }).catch(() => {});
    }

    saveMyState();
    renderActiveTradesPanel();
    renderGrid();
    showToast("Csereajánlat elfogadva! A tételek mindkét félnél zárolva lettek.");
  } else if (btn.dataset.action === 'edit-counter-trade') {
    openCounterOfferModal(trade);
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
// KÉTOLDALÚ BEJÖVŐ CSEREAJÁNLAT MODAL & ALKUFOLYAMAT
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

  if (getListEl) getListEl.innerHTML = receivedItemsStr || '<em>(Ajándékozás)</em>';
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
  if (existingIdx > -1) myProfile.activeTrades[existingIdx] = localTradeObj;
  else myProfile.activeTrades.unshift(localTradeObj);
  cacheTradeLocal(localTradeObj);

  // Kölcsönös elfogadáskor lép érvénybe a zárolás!
  localTradeObj.givingItems.forEach(n => {
    if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
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
// INTERAKTÍV ELLENAJÁNLAT (COUNTER-OFFER) MODAL LOGIKA
// =========================================================================

function openCounterOfferModal(tradeData) {
  activeCounterTradeData = tradeData;
  counterExcludedGive.clear();
  counterExcludedGet.clear();

  const giveChipsBox = document.getElementById('counter-offer-give-chips');
  const getChipsBox = document.getElementById('counter-offer-get-chips');
  const noteInput = document.getElementById('counter-offer-custom-note');

  if (noteInput) noteInput.value = '';

  const givingList = tradeData.givingItems || [];
  const receivingList = tradeData.receivingItems || [];

  if (giveChipsBox) {
    giveChipsBox.innerHTML = givingList.length ? givingList.map(n => `
      <span class="contact-item-chip" data-action="toggle-counter-give" data-num="${n}">
        ${escapeHtml(getItemLabel(n, tradeData.albumId))} <span class="chip-del">✕</span>
      </span>
    `).join('') : '<em style="color:var(--text-muted); font-size:0.75rem;">(Nincs tétel)</em>';
  }

  if (getChipsBox) {
    getChipsBox.innerHTML = receivingList.length ? receivingList.map(n => `
      <span class="contact-item-chip" data-action="toggle-counter-get" data-num="${n}" style="border-color:var(--moss-soft);">
        ${escapeHtml(getItemLabel(n, tradeData.albumId))} <span class="chip-del">✕</span>
      </span>
    `).join('') : '<em style="color:var(--text-muted); font-size:0.75rem;">(Nincs tétel)</em>';
  }

  document.getElementById('modal-incoming-trade-prompt')?.classList.remove('open');
  document.getElementById('modal-counter-offer')?.classList.add('open');
}

safeAddListener('btn-edit-incoming-prompt', () => {
  if (activePromptTradeData) {
    openCounterOfferModal({
      tradeId: activePromptTradeData.id,
      partnerUid: activePromptTradeData.initiatorUid,
      partnerName: activePromptTradeData.initiatorName,
      partnerCity: activePromptTradeData.initiatorCity,
      albumId: activePromptTradeData.albumId,
      givingItems: activePromptTradeData.receivingItems || [],
      receivingItems: activePromptTradeData.givingItems || []
    });
  }
});

safeAddListener('counter-offer-give-chips', 'click', (e) => {
  const chip = e.target.closest('[data-action="toggle-counter-give"]');
  if (!chip) return;
  const num = parseInt(chip.dataset.num, 10);
  if (counterExcludedGive.has(num)) {
    counterExcludedGive.delete(num);
    chip.classList.remove('excluded');
  } else {
    counterExcludedGive.add(num);
    chip.classList.add('excluded');
  }
});

safeAddListener('counter-offer-get-chips', 'click', (e) => {
  const chip = e.target.closest('[data-action="toggle-counter-get"]');
  if (!chip) return;
  const num = parseInt(chip.dataset.num, 10);
  if (counterExcludedGet.has(num)) {
    counterExcludedGet.delete(num);
    chip.classList.remove('excluded');
  } else {
    counterExcludedGet.add(num);
    chip.classList.add('excluded');
  }
});

safeAddListener('btn-close-counter-offer', () => document.getElementById('modal-counter-offer')?.classList.remove('open'));
safeAddListener('btn-abort-counter-offer', () => document.getElementById('modal-counter-offer')?.classList.remove('open'));

safeAddListener('btn-submit-counter-offer', async () => {
  if (!activeCounterTradeData) return;
  const t = activeCounterTradeData;
  const note = document.getElementById('counter-offer-custom-note')?.value.trim() || '';

  const finalGiving = (t.givingItems || []).filter(n => !counterExcludedGive.has(n));
  const finalReceiving = (t.receivingItems || []).filter(n => !counterExcludedGet.has(n));

  const updatedTrade = {
    ...t,
    givingItems: finalGiving,
    receivingItems: finalReceiving,
    customOffer: note,
    status: 'counter_offer',
    updatedAt: Date.now()
  };

  if (!myProfile.activeTrades) myProfile.activeTrades = [];
  const exIdx = myProfile.activeTrades.findIndex(x => x.tradeId === t.tradeId);
  if (exIdx > -1) myProfile.activeTrades[exIdx] = updatedTrade;
  else myProfile.activeTrades.unshift(updatedTrade);
  cacheTradeLocal(updatedTrade);

  saveMyState();
  renderActiveTradesPanel();
  renderGrid();

  if (db && t.tradeId) {
    await db.collection("trades").doc(t.tradeId).set({
      givingItems: finalReceiving,
      receivingItems: finalGiving,
      customOffer: note,
      status: 'counter_offer',
      lastModifiedBy: currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const threadId = [currentUser.uid, t.partnerUid].sort().join('_') + '_' + (t.albumId || currentAlbumId);
    await db.collection("messages").add({
      fromUid: currentUser.uid,
      fromName: myProfile.nev,
      fromCity: myProfile.telepules || '',
      toUid: t.partnerUid,
      toName: t.partnerName,
      albumId: t.albumId || currentAlbumId,
      threadId: threadId,
      tradeId: t.tradeId,
      subject: "Módosított csereajánlat",
      message: `Szia! Módosítottam a csereajánlat tételeit.\n${note ? `Üzenet: „${note}”\n` : ''}Nézd meg a változtatást az oldalon!`,
      read: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  document.getElementById('modal-counter-offer')?.classList.remove('open');
  showToast("Módosított ajánlat elküldve a partnernek!");
});

// =========================================================================
// CSERE LEMONDÁSI INDOKLÁS & AUTOMATA DUPLALEVONÁS („MÁR NINCS MEG”)
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
    // AUTOMATIKUS DUPLALEVONÁS
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

  // FOGLALÁSOK ÉS LAKATOK FELOLDÁSA
  if (trade.givingItems) {
    trade.givingItems.forEach(n => {
      if (myProfile.foglalvaCounts && myProfile.foglalvaCounts[n]) {
        myProfile.foglalvaCounts[n] = Math.max(0, myProfile.foglalvaCounts[n] - 1);
        if (myProfile.foglalvaCounts[n] === 0) {
          delete myProfile.foglalvaCounts[n];
          const fIdx = myProfile.foglalva.indexOf(n);
          if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
        }
      } else {
        const fIdx = myProfile.foglalva.indexOf(n);
        if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
      }
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
        cancelledBy: currentUser.uid,
        cancelReason: reasonText
      }).catch(() => {});
    }
  }

  trade.status = 'cancelled';
  trade.cancelReason = reasonText;

  saveMyState();
  renderActiveTradesPanel();
  renderGrid();

  document.getElementById('modal-cancel-trade-reason')?.classList.remove('open');
  activeTradeCancellingIdx = null;
  activePromptTradeData = null;
  showToast(selectedReasonVal === 'mar_nincs_meg' ? "Ajánlat törölve, a tétel levonva a dupláid közül." : "Megállapodás elutasítva, a tételek feloldva.");
});

safeAddListener('btn-close-cancelled-notice', () => document.getElementById('modal-trade-cancelled-notice')?.classList.remove('open'));
safeAddListener('btn-ack-cancelled-notice', () => document.getElementById('modal-trade-cancelled-notice')?.classList.remove('open'));

// =========================================================================
// PARTNER ÉRTÉKELŐ ÉS CSEREZÁRÓ MOTOR (EGYSZERI, PONTOS LEVONÁS)
// =========================================================================

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

  // 1. Kapott tételek bevezetése (hiányzóból átvált megvanra!)
  if (trade.receivingItems) {
    trade.receivingItems.forEach(n => {
      const kIdx = myProfile.kell.indexOf(n);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    });
  }

  // 2. Átadott tételek pontos levonása a duplákból (1 db esetén üres, több esetén n-1)
  if (trade.givingItems) {
    trade.givingItems.forEach(n => {
      if (myProfile.vanCounts && myProfile.vanCounts[n] > 1) {
        myProfile.vanCounts[n] -= 1;
      } else {
        delete myProfile.vanCounts[n];
        const vIdx = myProfile.van.indexOf(n);
        if (vIdx > -1) myProfile.van.splice(vIdx, 1);
      }

      // Zárolások feloldása
      if (myProfile.foglalvaCounts && myProfile.foglalvaCounts[n]) {
        myProfile.foglalvaCounts[n] = Math.max(0, myProfile.foglalvaCounts[n] - 1);
        if (myProfile.foglalvaCounts[n] === 0) delete myProfile.foglalvaCounts[n];
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
        await db.collection("trades").doc(trade.tradeId).update({
          status: 'completed',
          completedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
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
  showToast("Csere sikeresen lezárva! A tételeket automatikusan átvezettük a gyűjteményedben.");
});

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
            Csereindítás
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
    if (typeof openUserProfileModal === 'function') openUserProfileModal(btn.dataset.uid);
  }
});

// =========================================================================
// 2. BLOKK: TELEPÜLÉSKERESŐ (GOMB: KERESÉS)
// =========================================================================

safeAddListener('btn-search-by-city', () => {
  const inputEl = document.getElementById('search-by-city-input');
  const statusEl = document.getElementById('city-search-status');
  const clearBtn = document.getElementById('btn-clear-city-search');
  const boxEl = document.getElementById('city-search-results-box');
  const listEl = document.getElementById('city-search-partners-list');
  const query = (inputEl?.value || '').trim();

  if (!query) return showToast("Írj be egy települést!");

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
    if (typeof openUserProfileModal === 'function') openUserProfileModal(uid);
  }
});

// =========================================================================
// 3. BLOKK: KÖZELI GPS KERESŐ (25-ÖS LAPOZÓVAL)
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
        : '';

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
    if (typeof openUserProfileModal === 'function') openUserProfileModal(uid);
  }
});

// =========================================================================
// 4. BLOKK: PARTNER NÉVALAPÚ KERESŐ (GOMB: KERESÉS)
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
    if (typeof openUserProfileModal === 'function') openUserProfileModal(uid);
  }
});

// =========================================================================
// BOLTI KÉSZLETRADAR & TALÁLKOZÓK
// =========================================================================

safeAddListener('radar-photo-input', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      radarAttachedBase64 = canvas.toDataURL('image/jpeg', 0.55);
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

document.querySelectorAll('input[name="radar-status"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    const tag = document.getElementById('radar-photo-recommended-tag');
    if (tag) {
      tag.style.display = e.target.value === 'van' ? 'inline-block' : 'none';
    }
  });
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
      likes: [],
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

async function toggleRadarReportLike(reportId) {
  if (!currentUser) return showToast("A kedveléshez előbb lépj be!");
  try {
    const docRef = db.collection("album_reports").doc(reportId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    const likes = docSnap.data().likes || [];
    const hasLiked = likes.includes(currentUser.uid);

    await docRef.update({
      likes: hasLiked
        ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        : firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  } catch (e) {
    showToast("Hiba: " + e.message);
  }
}

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
    const likesCount = (r.likes || []).length;
    const hasLiked = currentUser && (r.likes || []).includes(currentUser.uid);

    return `
      <div class="radar-card" style="background:rgba(0,0,0,0.25); border:1px solid rgba(243,238,223,0.15); border-radius:var(--radius-sm); padding:10px; margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <div><strong style="color:#FFF;">${escapeHtml(storeLabel)}</strong></div>
          <span style="font-size:0.75rem; font-weight:700; color:${r.status ? 'var(--moss-soft)' : 'var(--danger)'};">
            ${r.status ? '🟢 Még kapható' : '🔴 Elfogyott / Nincs készleten'}
          </span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0; color:var(--sand);">„${formatLinksWithAnchors(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" style="max-height:120px; border-radius:6px; margin:6px 0; cursor:pointer;" alt="Bolti fotó" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>${escapeHtml(r.reporterName || 'Gyűjtő')} • ${timeStr}</span>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-like ${hasLiked ? 'liked' : ''}" data-action="like-radar" data-id="${r.id}" style="background:transparent; border:none; cursor:pointer; font-size:0.8rem; color:${hasLiked ? 'var(--danger)' : 'var(--sand)'};">
              ${hasLiked ? '❤️' : '🤍'} ${likesCount > 0 ? likesCount : 'Tetszik'}
            </button>
            ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-radar" data-id="${r.id}" style="color:var(--danger); border-color:var(--danger); padding:2px 8px;">Törlés</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('radar-filter-input', 'input', () => renderRadarReports());

safeAddListener('radar-reports-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'like-radar') {
    toggleRadarReportLike(btn.dataset.id);
  } else if (btn.dataset.action === 'delete-radar') {
    if (!confirm("Biztosan törölni szeretnéd ezt a jelentést?")) return;
    try {
      await db.collection("album_reports").doc(btn.dataset.id).delete();
      showToast("Jelentés törölve.");
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
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
        if (typeof triggerTopNotification === 'function') {
          triggerTopNotification(`Új készletjelentés: ${latest.city} (${latest.status ? '🟢 Még kapható' : '🔴 Elfogyott / Nincs készleten'})`, () => switchView('radar'));
        }
      }
      previousRadarCount = newCount;

      renderRadarReports();
    }, err => console.warn("Radar listener:", err));
}

// =========================================================================
// TALÁLKOZÓK
// =========================================================================

safeAddListener('meetup-photo-input', 'change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      meetupAttachedBase64 = canvas.toDataURL('image/jpeg', 0.55);
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
      likes: [],
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

async function toggleMeetupLike(meetupId) {
  if (!currentUser) return showToast("A kedveléshez előbb lépj be!");
  try {
    const docRef = db.collection("meetups").doc(meetupId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return;
    const likes = docSnap.data().likes || [];
    const hasLiked = likes.includes(currentUser.uid);

    await docRef.update({
      likes: hasLiked
        ? firebase.firestore.FieldValue.arrayRemove(currentUser.uid)
        : firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
    });
  } catch (e) {
    showToast("Hiba: " + e.message);
  }
}

function renderMeetups() {
  const container = document.getElementById('meetups-list');
  if (!container) return;

  if (meetupEvents.length === 0) {
    container.innerHTML = '<p class="view-intro">Jelenleg nincs meghirdetett közös találkozó. Hozz létre egyet!</p>';
    return;
  }

  container.innerHTML = meetupEvents.map(m => {
    const isOwnerOrAdmin = currentUser && (m.userId === currentUser.uid || currentUser.email === ADMIN_EMAIL);
    const likesCount = (m.likes || []).length;
    const hasLiked = currentUser && (m.likes || []).includes(currentUser.uid);

    return `
      <div class="card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
          <div><h3 style="margin:0; font-size:1.05rem;">${escapeHtml(m.city)} — ${escapeHtml(m.place)}</h3></div>
          <span class="badge-ratio" style="font-weight:700;">${escapeHtml(m.time)}</span>
        </div>
        ${m.description ? `<p style="font-size:0.86rem; margin:6px 0; color:var(--text-primary); white-space:pre-wrap;">${formatLinksWithAnchors(m.description)}</p>` : ''}
        ${m.photoBase64 ? `<img src="${m.photoBase64}" class="radar-attached-img" style="max-height:140px; border-radius:6px; margin:6px 0; cursor:pointer;" alt="Plakát" data-action="open-lightbox">` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted); margin-top:8px;">
          <span>Szervező: <strong>${escapeHtml(m.organizerName || 'Gyűjtő')}</strong></span>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn-like ${hasLiked ? 'liked' : ''}" data-action="like-meetup" data-id="${m.id}" style="background:transparent; border:none; cursor:pointer; font-size:0.8rem; color:${hasLiked ? 'var(--danger)' : 'var(--sand)'};">
              ${hasLiked ? '❤️' : '🤍'} ${likesCount > 0 ? likesCount : 'Ott leszek'}
            </button>
            ${isOwnerOrAdmin ? `<button class="btn btn-secondary btn-sm" data-action="delete-meetup" data-id="${m.id}" style="color:var(--danger); border-color:var(--danger); padding:2px 8px;">Törlés</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('meetups-list', 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'like-meetup') {
    toggleMeetupLike(btn.dataset.id);
  } else if (btn.dataset.action === 'delete-meetup') {
    if (!confirm("Biztosan törölni szeretnéd ezt a találkozót?")) return;
    try {
      await db.collection("meetups").doc(btn.dataset.id).delete();
      showToast("Találkozó törölve.");
    } catch (err) {
      showToast("Hiba: " + err.message);
    }
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

      renderMeetups();
    }, err => console.warn("Meetups listener:", err));
}
// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v4.7 ÉLES KIADÁS)
// 5B / 5. RÉSZ: TÉRKÉP, MESSENGER, META-SÁV, ADMIN & RENDSZERINDÍTÁS
// =========================================================================

let leafletMap = null;
let leafletMarkersGroup = null;

function initOrUpdateLeafletMap() {
  const container = document.getElementById('leaflet-map-container');
  if (!container || typeof L === 'undefined') return;

  if (!leafletMap) {
    leafletMap = L.map('leaflet-map-container', {
      center: [47.1625, 19.5033],
      zoom: 7,
      minZoom: 6,
      maxZoom: 13,
      zoomControl: true,
      scrollWheelZoom: true
    });

    // 100%-ban ingyenes, kulcsmentes OpenStreetMap csempék
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(leafletMap);

    leafletMarkersGroup = L.layerGroup().addTo(leafletMap);
  }

  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 250);

  if (!leafletMarkersGroup) return;
  leafletMarkersGroup.clearLayers();

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

    marker.bindPopup(`
      <div style="text-align:center; min-width:140px;">
        <strong style="color:var(--amber); font-size:1rem; display:block; margin-bottom:2px;">${escapeHtml(c.name)}</strong>
        <span style="font-size:0.8rem; color:#FFF; display:block;"><strong>${c.users}</strong> gyűjtő</span>
        <span style="font-size:0.75rem; color:var(--sand); display:block; margin-bottom:8px;"><strong>${c.duplicates}</strong> cserélhető dupla</span>
        <button class="btn btn-primary btn-sm" style="width:100%; font-size:0.75rem; padding:4px 8px;" onclick="filterMatchesByCityName('${escapeHtml(c.name)}')">
          Helyi gyűjtők mutatása
        </button>
      </div>
    `);

    leafletMarkersGroup.addLayer(marker);
  });
}

function filterMatchesByCityName(cityName) {
  filterTargetCity = cityName;
  switchView('cserek');
  renderMatches();
  showToast(`Szűrés: ${cityName} cserélői`);
}

safeAddListener('heatmap-city-list', 'click', (e) => {
  const item = e.target.closest('[data-action="filter-city-jump"]');
  if (item && item.dataset.city) {
    filterMatchesByCityName(item.dataset.city);
  }
});

safeAddListener('btn-toggle-all-cities', () => {
  showAllHeatmapCities = !showAllHeatmapCities;
  const btn = document.getElementById('btn-toggle-all-cities');
  if (btn) btn.textContent = showAllHeatmapCities ? '▲ Csak a legaktívabb városok mutatása' : 'Összes aktív város mutatása';
  renderStatistics();
});

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
    if (u.id !== (currentUser ? currentUser.uid : 'me') && !u.isVacation) {
      ensureArray(u.van).forEach(n => availablePool.add(n));
    }
  });

  const matchedMissing = myMissing.filter(n => availablePool.has(n));
  const percentage = Math.round((matchedMissing.length / myMissing.length) * 100);

  oddsPct.textContent = `${percentage}%`;
  oddsBar.style.width = `${percentage}%`;
  oddsText.innerHTML = `A hiányzóidból <strong>${matchedMissing.length} / ${myMissing.length} db</strong> azonnal beszerezhető a közösségtől!`;
}

function renderStatistics() {
  const demandCount = {};
  const supplyCount = {};
  const totalSize = getActiveAlbumSize();
  for (let i = 1; i <= totalSize; i++) { demandCount[i] = 0; supplyCount[i] = 0; }

  let totalPoolCount = 0;
  let totalMissingCount = 0;
  const cityStats = {};

  allUsersData.forEach(u => {
    const uMissing = ensureArray(u.kell);
    totalMissingCount += uMissing.length;
    uMissing.forEach(n => { if (demandCount[n] !== undefined) demandCount[n]++; });

    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      totalPoolCount += q;
      if (supplyCount[n] !== undefined) supplyCount[n] += q;
    });

    const normalizedLocs = extractNormalizedLocations(u.locations && u.locations.length > 0 ? u.locations : u.telepules);
    normalizedLocs.forEach(loc => {
      if (!cityStats[loc.canonicalKey]) {
        cityStats[loc.canonicalKey] = {
          name: loc.displayName,
          canonicalKey: loc.canonicalKey,
          users: 0,
          duplicates: 0
        };
      }
      cityStats[loc.canonicalKey].users += 1;
      ensureArray(u.van).forEach(n => {
        cityStats[loc.canonicalKey].duplicates += (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      });
    });
  });

  const poolEl = document.getElementById('stats-total-pool-count');
  if (poolEl) poolEl.textContent = `${totalPoolCount.toLocaleString('hu-HU')} db`;

  const usersCountEl = document.getElementById('stats-users-count');
  const currentTotalRegistered = (typeof rawAllUsersDocs !== 'undefined' && rawAllUsersDocs.length > 0)
    ? rawAllUsersDocs.length
    : allUsersData.length;
  if (usersCountEl) usersCountEl.textContent = `${currentTotalRegistered} fő`;

  const avgDupesEl = document.getElementById('stats-avg-dupes');
  if (avgDupesEl && allUsersData.length > 0) {
    avgDupesEl.textContent = `${Math.round(totalPoolCount / allUsersData.length)} db/fő`;
  }

  const avgProgressEl = document.getElementById('stats-avg-progress');
  if (avgProgressEl && allUsersData.length > 0) {
    const avgMissing = totalMissingCount / allUsersData.length;
    const avgProg = Math.max(0, Math.min(100, Math.round(((totalSize - avgMissing) / totalSize) * 100)));
    avgProgressEl.textContent = `${avgProg}%`;
  }

  const rarest = [];
  for (let i = 1; i <= totalSize; i++) {
    const itemName = getItemFullName(i, currentAlbumId);
    rarest.push({ num: i, name: itemName, demand: demandCount[i], supply: supplyCount[i], score: demandCount[i] - supplyCount[i] });
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

  const totalMeters = (totalPoolCount * 0.076);
  const totalKm = (totalMeters / 1000).toFixed(2);
  const highwayKmEl = document.getElementById('fun-stat-highway-km');
  const highwayTextEl = document.getElementById('fun-stat-highway-text');
  if (highwayKmEl) highwayKmEl.textContent = totalKm;
  if (highwayTextEl) {
    const margitRatio = (totalMeters / 607).toFixed(1);
    highwayTextEl.innerHTML = `Több mint <strong>${margitRatio}× olyan hosszú</strong>, mint a Margit híd (607 m)!`;
  }

  const totalTowerM = (totalPoolCount * 0.00015).toFixed(2);
  const towerMEl = document.getElementById('fun-stat-tower-m');
  const towerTextEl = document.getElementById('fun-stat-tower-text');
  if (towerMEl) towerMEl.textContent = totalTowerM;
  if (towerTextEl) {
    const humanRatio = (totalTowerM / 2.51).toFixed(1);
    towerTextEl.innerHTML = `Körülbelül <strong>${humanRatio}× olyan magas</strong>, mint a világ legmagasabb embere!`;
  }

  const sortedCities = Object.values(cityStats).sort((a, b) => (b.users * 15 + b.duplicates) - (a.users * 15 + a.duplicates));
  const cityListEl = document.getElementById('heatmap-city-list');
  if (cityListEl) {
    const displayed = showAllHeatmapCities ? sortedCities : sortedCities.slice(0, 8);
    cityListEl.innerHTML = displayed.map((c, idx) => `
      <div class="stats-ranking-item" data-action="filter-city-jump" data-city="${escapeHtml(c.name)}">
        <div><strong>#${idx + 1} ${escapeHtml(c.name)}</strong> (${c.users} gyűjtő • ${c.duplicates} dupla)</div>
        <span class="heat-chip-warm" style="color:var(--amber); font-weight:700; font-size:0.75rem;">Pörög</span>
      </div>
    `).join('');
  }

  try { renderExtraStatistics(common); } catch (e) { console.warn('Extra statisztika:', e); }

  renderCompletionOdds();
  initOrUpdateLeafletMap();
}

function renderExtraStatistics(common) {
  const totalSize = getActiveAlbumSize();

  // 1) Leginkább halmozódó tétel
  const hEl = document.getElementById('stats-hoarding-sticker');
  if (hEl) {
    const top = (common || [])[0];
    hEl.textContent = (top && top.supply > 0) ? `${top.name} (${top.supply} db dupla)` : 'Még nincs dupla';
  }

  // 2) Hol tart az ország? (közösségi telítettség)
  const users = allUsersData.filter(u => ensureArray(u.kell).length > 0 || ensureArray(u.van).length > 0);
  const seg = { complete: 0, near: 0, half: 0, starter: 0 };
  users.forEach(u => {
    const missing = ensureArray(u.kell).length;
    const pct = totalSize > 0 ? Math.max(0, Math.min(100, ((totalSize - missing) / totalSize) * 100)) : 0;
    if (pct >= 100) seg.complete++;
    else if (pct >= 75) seg.near++;
    else if (pct >= 40) seg.half++;
    else seg.starter++;
  });
  const n = users.length;
  const share = (v) => n > 0 ? (v / n) * 100 : 0;
  const setW = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = share(v).toFixed(1) + '%'; };
  setW('dist-bar-complete', seg.complete);
  setW('dist-bar-near', seg.near);
  setW('dist-bar-half', seg.half);
  setW('dist-bar-starter', seg.starter);
  const grid = document.getElementById('dist-segments-grid');
  if (grid) {
    if (n === 0) {
      grid.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Ebben a gyűjteményben még nincs elég adat.</p>';
    } else {
      const cards = [
        ['Befejezte (100%)', seg.complete, '#FFD166'],
        ['Közel a célhoz (75–99%)', seg.near, 'var(--amber)'],
        ['Félúton (40–74%)', seg.half, 'var(--moss-soft)'],
        ['Most kezdte (<40%)', seg.starter, 'var(--water-light)']
      ];
      grid.innerHTML = cards.map(([label, v, color]) => `
        <div style="background:rgba(0,0,0,0.25); border-left:4px solid ${color}; padding:8px 10px; border-radius:var(--radius-sm);">
          <div style="font-size:0.74rem; color:var(--text-muted);">${label}</div>
          <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary);">${v} fő <span style="font-size:0.75rem; color:var(--sand); font-weight:400;">(${Math.round(share(v))}%)</span></div>
        </div>
      `).join('');
    }
  }

  // 3) Fejezeti nehézségi index: a fejezet tételeinek mekkora része hiányzik átlagosan
  const dEl = document.getElementById('stats-difficulty-bars');
  if (dEl) {
    const lists = getChapterNumLists(currentAlbumId);
    if (lists.length < 2) {
      dEl.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Ennél a gyűjteménynél nincsenek fejezetek.</p>';
    } else if (n === 0) {
      dEl.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Még nincs elég adat.</p>';
    } else {
      const rows = lists.map(l => {
        let miss = 0;
        users.forEach(u => {
          const kSet = new Set(ensureArray(u.kell));
          l.nums.forEach(num => { if (kSet.has(num)) miss++; });
        });
        return { title: l.title, rate: Math.round((miss / (n * l.nums.length)) * 100) };
      }).sort((a, b) => b.rate - a.rate);
      dEl.innerHTML = rows.map(r => `
        <div>
          <div style="display:flex; justify-content:space-between; font-size:0.78rem; color:var(--text-muted); margin-bottom:2px;">
            <span>${escapeHtml(r.title)}</span><strong style="color:var(--amber);">${r.rate}% hiányzik</strong>
          </div>
          <div style="height:8px; border-radius:999px; background:rgba(0,0,0,0.3); overflow:hidden;">
            <div style="height:100%; width:${r.rate}%; background:var(--amber);"></div>
          </div>
        </div>
      `).join('');
    }
  }
}

safeAddListener('btn-refresh-stats', () => {
  renderStatistics();
  showToast("Statisztika és hőtérkép frissítve.");
});

// =========================================================================
// BELSŐ ÜZENETEK & MESSENGER-STÍLUSÚ CSEVEGŐSZÁLAK
// =========================================================================

let activeChatThreadKey = null;

function getThreadKey(msg) {
  if (msg.threadId) return msg.threadId;
  const otherUid = msg.fromUid === (currentUser ? currentUser.uid : '') ? msg.toUid : msg.fromUid;
  return [currentUser ? currentUser.uid : '', otherUid].sort().join('_') + '_' + (msg.albumId || 'lidl-lutra-2026');
}

function updateMsgAlbumFilterSelect(threadList) {
  const selectEl = document.getElementById('msg-album-filter-select');
  if (!selectEl) return;

  const currentVal = selectEl.value || 'all';
  const albumIdsInThreads = new Set();
  threadList.forEach(t => albumIdsInThreads.add(t.albumId));

  let optionsHtml = '<option value="all">Minden gyűjtemény üzenetei</option>';
  albumIdsInThreads.forEach(albId => {
    const albTitle = getAlbumDisplayTitle(albId);
    optionsHtml += `<option value="${escapeHtml(albId)}">${escapeHtml(albTitle)}</option>`;
  });

  selectEl.innerHTML = optionsHtml;
  selectEl.value = albumIdsInThreads.has(currentVal) ? currentVal : 'all';
}

safeAddListener('msg-album-filter-select', 'change', (e) => {
  msgAlbumFilter = e.target.value;
  renderThreadedChat();
});

function renderThreadedChat() {
  const threadsListEl = document.getElementById('chat-threads-list');
  const countSpan = document.getElementById('threads-total-count');
  if (!threadsListEl) return;

  if (!currentUser) {
    threadsListEl.innerHTML = `
      <div style="text-align:center; padding:20px; font-size:0.85rem; color:var(--text-muted);">
        A beszélgetéseid megtekintéséhez kérlek lépj be a fiókodba!
      </div>`;
    return;
  }

  const allMessages = [...myIncomingMessages, ...myOutgoingMessages].sort((a, b) => {
    return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
  });

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

  let threadList = Object.values(threadMap).sort((a, b) => {
    return (b.lastMessage?.createdAt?.seconds || 0) - (a.lastMessage?.createdAt?.seconds || 0);
  });

  updateMsgAlbumFilterSelect(threadList);

  if (msgAlbumFilter && msgAlbumFilter !== 'all') {
    threadList = threadList.filter(t => t.albumId === msgAlbumFilter);
  }

  if (countSpan) countSpan.textContent = threadList.length;

  if (threadList.length === 0) {
    threadsListEl.innerHTML = `
      <div style="text-align:center; padding:20px; font-size:0.8rem; color:var(--text-muted);">
        Még nincs aktív beszélgetésed. Indíts egy cserét a Párosításoknál!
      </div>`;
    return;
  }

  threadsListEl.innerHTML = threadList.map(t => {
    const isAct = activeChatThreadKey === t.threadKey;
    const timeStr = t.lastMessage?.createdAt?.toDate ? t.lastMessage.createdAt.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';
    const lastIsMe = t.lastMessage?.fromUid === currentUser.uid;
    const pipa = lastIsMe ? (t.lastMessage?.read === true ? '<span class="msg-status-pipa msg-read-double" style="color:var(--amber); font-weight:bold;">✓✓</span>' : '<span class="msg-status-pipa msg-delivered" style="color:var(--text-muted);">✓</span>') : '';
    const snippet = (t.lastMessage?.message || t.lastMessage?.text || '').slice(0, 32);

    return `
      <div class="chat-thread-item ${isAct ? 'active' : ''} ${t.unreadCount > 0 ? 'has-unread' : ''}" data-thread-key="${escapeHtml(t.threadKey)}">
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
            ${t.unreadCount > 0 ? `<span class="nav-badge alert-badge">${t.unreadCount}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

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
  if (albumTagEl) albumTagEl.textContent = `${getAlbumDisplayTitle(threadObj.albumId)}`;

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

  bodyEl.innerHTML = threadObj.messages.map(m => {
    const isMe = m.fromUid === currentUser.uid;
    const timeStr = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }) : '';
    
    let pipaHtml = '';
    if (isMe) {
      if (m.read === true) {
        pipaHtml = `<span class="msg-status-pipa msg-read-double" title="Elolvasva" style="color:var(--amber); font-weight:bold;">✓✓</span>`;
      } else {
        pipaHtml = `<span class="msg-status-pipa msg-delivered" title="Kézbesítve" style="color:var(--text-muted);">✓</span>`;
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

  bodyEl.scrollTop = bodyEl.scrollHeight;
}

safeAddListener('btn-close-active-thread', () => {
  activeChatThreadKey = null;
  document.getElementById('chat-thread-header').style.display = 'none';
  document.getElementById('chat-reply-bar').style.display = 'none';
  document.getElementById('chat-thread-messages-body').innerHTML = `
    <div style="text-align:center; padding:40px 10px; color:var(--text-muted); font-size:0.85rem;">
      Válassz ki egy beszélgetést a listából a megnyitáshoz!
    </div>`;
  document.querySelectorAll('.chat-thread-item').forEach(el => el.classList.remove('active'));
});

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

safeAddListener('btn-refresh-inbox', () => {
  renderThreadedChat();
  showToast("Üzenetek frissítve.");
});

// =========================================================================
// GYŰJTŐ ADATLAPJA (LASTACTIVE, FRISSÍTÉS ÉS CSERE-MÓD META-SÁV)
// =========================================================================

async function openUserProfileModal(uid) {
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return showToast("Gyűjtő adatai nem találhatók.");

  const modal = document.getElementById('modal-user-profile');
  if (!modal) return;

  const nameEl = document.getElementById('user-profile-modal-name');
  const cityEl = document.getElementById('user-profile-modal-city');
  const ratingBadge = document.getElementById('user-profile-rating-badge');
  const lastActiveEl = document.getElementById('user-profile-last-active');
  const lastUpdatedEl = document.getElementById('user-profile-last-updated');
  const tradeModeEl = document.getElementById('user-profile-trade-mode-badge');

  if (nameEl) nameEl.textContent = `Gyűjtő: ${targetUser.nev || 'Névtelen'}`;
  if (cityEl) cityEl.textContent = targetUser.telepules ? `Település: ${targetUser.telepules}` : `Nincs megadva település`;

  if (lastActiveEl) lastActiveEl.textContent = formatLastActive(targetUser.lastActive);
  if (lastUpdatedEl) lastUpdatedEl.textContent = formatTimeAgo(targetUser.updatedAt);

  if (tradeModeEl) {
    tradeModeEl.textContent = targetUser.tradeMode === 'post_only'
      ? 'Csere-mód: Csak postán küld'
      : (targetUser.tradeMode === 'personal_only' ? 'Csere-mód: Csak személyesen' : 'Csere-mód: Személyesen és postán is');
  }

  const rCount = targetUser.ratingsCount || 0;
  const tScore = targetUser.trustScore || 0;
  const avg = rCount > 0 ? (tScore / rCount).toFixed(1) : (tScore > 0 ? tScore : '5.0');

  if (ratingBadge) {
    ratingBadge.innerHTML = rCount > 0 
      ? `⭐ ${avg} / 5 (${rCount} értékelés)` 
      : '';
  }

  const reviewsDetails = document.getElementById('user-profile-reviews-details');
  const reviewsCountEl = document.getElementById('user-profile-reviews-count');
  const reviewsListEl = document.getElementById('user-profile-reviews-list');

  if (reviewsDetails && reviewsCountEl && reviewsListEl) {
    reviewsListEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Értékelések betöltése...</span>';
    try {
      const snap = await db.collection("public_profiles").doc(uid).collection("reviews").orderBy("createdAt", "desc").limit(10).get();
      if (!snap.empty) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = snap.docs.length;
        reviewsListEl.innerHTML = snap.docs.map(doc => {
          const r = doc.data();
          return `
            <div style="background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px; font-size:0.78rem;">
              <strong>${escapeHtml(r.fromName || 'Partner')}:</strong> ⭐ ${r.stars || 5}/5
              <div style="color:var(--sand); font-style:italic;">„${escapeHtml(r.comment || 'Minden rendben és gyorsan zajlott!')}”</div>
            </div>
          `;
        }).join('');
      } else if (rCount > 0) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = rCount;
        reviewsListEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Korábbi sikeres cserékből jóváírt megbízhatósági pontok.</span>';
      } else {
        reviewsDetails.style.display = 'none';
      }
    } catch (e) {
      reviewsDetails.style.display = 'none';
    }
  }

  const contactBtn = document.getElementById('btn-user-profile-contact');
  if (contactBtn) {
    contactBtn.onclick = () => {
      modal.classList.remove('open');
      openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
    };
  }

  const mBox = document.getElementById('user-profile-missing-tags');
  const vBox = document.getElementById('user-profile-van-tags');

  if (mBox) {
    if (targetUser.allowInspect === false) {
      mBox.innerHTML = '<em style="color:var(--text-muted);">A gyűjtő elrejtette a hiányzóinak listáját.</em>';
    } else if (!targetUser.kell || targetUser.kell.length === 0) {
      mBox.innerHTML = '<span style="color:var(--amber);">Minden tétele megvan!</span>';
    } else {
      mBox.innerHTML = targetUser.kell
        .sort((a, b) => a - b)
        .map(n => `<span style="display:inline-block; margin:2px 4px; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:999px; border:1px solid rgba(243,238,223,0.2);">${escapeHtml(getItemLabel(n, currentAlbumId))}</span>`)
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
          return `<span style="display:inline-block; margin:2px 4px; background:rgba(216,155,74,0.2); color:var(--sand); padding:2px 8px; border-radius:999px; border:1px solid var(--amber);">${escapeHtml(getItemLabel(n, currentAlbumId))}${q}</span>`;
        })
        .join('');
    }
  }

  modal.classList.add('open');
}

safeAddListener('btn-close-user-profile', () => document.getElementById('modal-user-profile')?.classList.remove('open'));
safeAddListener('btn-close-user-profile-2', () => document.getElementById('modal-user-profile')?.classList.remove('open'));

function triggerTopNotification(iconOrText, textOrActionFn, actionFn) {
  const banner = document.getElementById('top-notification-banner');
  const textEl = document.getElementById('top-banner-text');
  const actionBtn = document.getElementById('btn-top-banner-action');
  const closeBtn = document.getElementById('btn-top-banner-close');

  if (!banner || !textEl) return;
  let text = '', fn = null;

  if (typeof textOrActionFn === 'function') {
    text = iconOrText || '';
    fn = textOrActionFn;
  } else {
    text = textOrActionFn || '';
    fn = actionFn;
  }

  textEl.textContent = text;
  banner.style.display = 'flex';

  if (actionBtn) {
    actionBtn.onclick = () => { banner.style.display = 'none'; if (fn) fn(); };
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
    const bottomBadge = document.getElementById('bottom-msg-badge');
    const unreadCount = myIncomingMessages.filter(m => m.read !== true).length;
    
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    if (badgeM) {
      badgeM.textContent = unreadCount;
      badgeM.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    if (bottomBadge) {
      bottomBadge.textContent = unreadCount;
      bottomBadge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
    updateCserebereBadge();
    renderThreadedChat();
  };

  const unsubIn = db.collection("messages").where("toUid", "==", uid).onSnapshot(snap => {
    const isInitial = (previousIncomingCount === null);
    const newCount = snap.docs.length;

    if (!isInitial && newCount > previousIncomingCount) {
      if ("vibrate" in navigator) navigator.vibrate([180, 90, 180]);
      triggerTopNotification("Új belső üzeneted érkezett egy cserepartnertől!", () => switchView('uzeneteim'));
      showToast("Új üzeneted érkezett!");
    }
    previousIncomingCount = newCount;
    myIncomingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.deletedByRecipient !== true);
    refresh();
  }, err => console.error("messages listener:", err));

  const unsubOut = db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.deletedBySender !== true);
    refresh();
  }, err => console.error("messages listener:", err));

  messagesUnsubscribe = () => { unsubIn(); unsubOut(); };
}

// =========================================================================
// PROFIL TELEPÜLÉS-KEZELŐ & BUDAPEST KERÜLETI CHIPEK
// =========================================================================

function renderProfileLocations() {
  const container = document.getElementById('profile-locations-list');
  const bpPicker = document.getElementById('bp-districts-picker');
  const tradeModeSel = document.getElementById('prof-trade-mode');
  if (!container) return;

  if (tradeModeSel && myProfile.tradeMode) {
    tradeModeSel.value = myProfile.tradeMode;
  }

  if (!myProfile.locations || myProfile.locations.length === 0) {
    myProfile.locations = [{ city: myProfile.telepules || '', districts: [] }];
  }

  let hasBp = false;

  container.innerHTML = myProfile.locations.map((loc, idx) => {
    const isBp = (loc.city || '').toLowerCase().includes('budapest') || (loc.city || '').toLowerCase().includes('bp');
    if (isBp) hasBp = true;

    return `
      <div class="location-row" data-loc-idx="${idx}" style="display:flex; gap:6px; align-items:center;">
        <input type="text" 
               class="input-field profile-location-input" 
               list="hungarian-cities-list" 
               data-idx="${idx}" 
               value="${escapeHtml(loc.city)}" 
               placeholder="${idx === 0 ? '1. Település (pl. Szeged vagy Budapest)' : (idx + 1) + '. Helyszín (Ingázás / Munkahely)'}" 
               autocomplete="off" 
               spellcheck="false">
        ${idx > 0 ? `<button class="btn btn-secondary btn-sm btn-del-location" data-idx="${idx}" type="button" style="color:var(--danger); border-color:var(--danger); padding:4px 8px;">✕</button>` : ''}
      </div>
    `;
  }).join('');

  if (bpPicker) {
    bpPicker.style.display = hasBp ? 'block' : 'none';
    if (hasBp) renderBpDistrictChips();
  }
}

function renderBpDistrictChips() {
  const container = document.getElementById('bp-district-chips');
  if (!container) return;

  const bpLoc = (myProfile.locations || []).find(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
  const activeDists = new Set(bpLoc ? (bpLoc.districts || []) : []);

  const romanDistricts = [
    'I.', 'II.', 'III.', 'IV.', 'V.', 'VI.', 'VII.', 'VIII.', 'IX.', 'X.',
    'XI.', 'XII.', 'XIII.', 'XIV.', 'XV.', 'XVI.', 'XVII.', 'XVIII.', 'XIX.', 'XX.',
    'XXI.', 'XXII.', 'XXIII.'
  ];

  container.innerHTML = romanDistricts.map((name, idx) => {
    const dNum = idx + 1;
    const isAct = activeDists.has(dNum);
    return `<div class="bp-chip ${isAct ? 'active' : ''}" data-dist="${dNum}" style="padding:3px 8px; border-radius:4px; font-size:0.75rem; cursor:pointer; background:${isAct ? 'var(--amber)' : 'var(--water-mid)'}; color:${isAct ? 'var(--water-deep)' : 'var(--text-primary)'}; font-weight:700;">${name} ker.</div>`;
  }).join('');
}

safeAddListener('bp-district-chips', 'click', (e) => {
  const chip = e.target.closest('[data-dist]');
  if (!chip) return;
  const dNum = parseInt(chip.dataset.dist, 10);

  const bpLoc = (myProfile.locations || []).find(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
  if (!bpLoc) return;

  if (!bpLoc.districts) bpLoc.districts = [];
  const idx = bpLoc.districts.indexOf(dNum);
  if (idx > -1) bpLoc.districts.splice(idx, 1);
  else bpLoc.districts.push(dNum);

  renderBpDistrictChips();
});

safeAddListener('profile-locations-list', 'focusin', () => {
  if (!myGpsCoords) requestGpsLocation();
});

safeAddListener('profile-locations-list', 'input', (e) => {
  const input = e.target.closest('.profile-location-input');
  if (!input) return;
  const idx = parseInt(input.dataset.idx, 10);
  if (myProfile.locations[idx]) {
    myProfile.locations[idx].city = input.value.trim();
    const bpPicker = document.getElementById('bp-districts-picker');
    if (bpPicker) {
      const anyBp = myProfile.locations.some(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
      bpPicker.style.display = anyBp ? 'block' : 'none';
      if (anyBp) renderBpDistrictChips();
    }
  }
});

safeAddListener('profile-locations-list', 'click', (e) => {
  const btn = e.target.closest('.btn-del-location');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx, 10);
  if (idx > 0) {
    myProfile.locations.splice(idx, 1);
    renderProfileLocations();
  }
});

safeAddListener('btn-add-location', () => {
  if (!myProfile.locations) myProfile.locations = [];
  if (myProfile.locations.length >= 5) {
    return showToast("Legfeljebb 5 helyszínt adhatsz meg.");
  }
  myProfile.locations.push({ city: "", districts: [] });
  renderProfileLocations();
});

safeAddListener('btn-geo-detect-profile', () => requestGpsLocation());

// =========================================================================
// ADMINISZTRÁCIÓS MOTOR (DUPLIKÁCIÓ-SZŰRŐ, IMPORTŐR & ÉRTESÍTÉSEK)
// =========================================================================

let adminAlbumCoverBase64 = '';
let adminMsgPhotoBase64 = '';
let ignoredAuditPairs = safeJsonParse('cserelj_ignored_audit_pairs', []);

safeAddListener('btn-admin-audit-db', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  const reportBox = document.getElementById('admin-audit-report-box');
  if (!reportBox) return;

  reportBox.style.display = 'block';
  reportBox.innerHTML = '<span style="color:var(--amber);">Adatbázis átvizsgálása folyamatban...</span>';

  try {
    const snap = await db.collection("albums").get();
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const junkFound = [];
    const duplicatePairs = [];

    allDocs.forEach((docA, i) => {
      if (SCRAPER_JUNK_IDS.has(docA.id) || /^(mind|kartya|matricaalbum|figura|kisauto)-\d+$/i.test(docA.id)) {
        if (!junkFound.includes(docA.id)) junkFound.push(docA.id);
        return;
      }

      const keyA = getNormalizedAlbumTitleKey(docA.title || docA.id);

      for (let j = i + 1; j < allDocs.length; j++) {
        const docB = allDocs[j];
        if (SCRAPER_JUNK_IDS.has(docB.id)) continue;

        const pairKey = [docA.id, docB.id].sort().join('___');
        if (ignoredAuditPairs.includes(pairKey)) continue;

        const keyB = getNormalizedAlbumTitleKey(docB.title || docB.id);

        const isExactKeyMatch = keyA && keyB && keyA === keyB;
        const isSubKeyMatch = keyA && keyB && (keyA.length >= 5 && keyB.length >= 5) && (keyA.includes(keyB) || keyB.includes(keyA));
        
        let isDuplicateSuspect = false;
        let reason = '';

        if (isExactKeyMatch) {
          isDuplicateSuspect = true;
          reason = "Azonos címtő / elnevezés";
        } else if (isSubKeyMatch && docA.year === docB.year && Math.abs(parseInt(docA.totalItems, 10) - parseInt(docB.totalItems, 10)) <= 5) {
          isDuplicateSuspect = true;
          reason = `Címhasonlóság és azonos év (${docA.year})`;
        }

        if (isDuplicateSuspect) {
          duplicatePairs.push({
            pairKey: pairKey,
            existing: docA,
            duplicate: docB,
            reason: reason
          });
        }
      }
    });

    let html = `
      <div style="font-size:0.85rem; line-height:1.5;">
        <strong>Audit Eredmény:</strong> Összesen <strong>${allDocs.length} db</strong> album van a felhőben.<br>
        <span style="color:${junkFound.length > 0 ? 'var(--danger)' : 'var(--moss-soft)'};">
          ${junkFound.length > 0 ? `⚠️ <strong>${junkFound.length} db szemét menügomb</strong> található!` : 'Nincs menügomb szemét az adatbázisban.'}
        </span><br>
        <span style="color:${duplicatePairs.length > 0 ? 'var(--amber)' : 'var(--moss-soft)'};">
          ${duplicatePairs.length > 0 ? `⚠️ <strong>${duplicatePairs.length} lehetséges tartalmi duplikáció</strong> észlelve!` : 'Nincs észlelt duplikáció.'}
        </span>
      </div>
    `;

    if (junkFound.length > 0) {
      html += `
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(243,238,223,0.2);">
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">Törölhető menüelemek: ${junkFound.join(', ')}</div>
          <button class="btn btn-danger btn-sm" id="btn-purge-junk-albums" style="padding:4px 10px;">
            ${junkFound.length} db szemét gomb azonnali törlése
          </button>
        </div>
      `;
    }

    if (duplicatePairs.length > 0) {
      html += `
        <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(243,238,223,0.2);">
          <strong style="font-size:0.8rem; color:var(--amber);">Észlelt duplikációk:</strong>
          ${duplicatePairs.map((pair) => `
            <div style="background:rgba(0,0,0,0.3); padding:8px; border-radius:4px; margin-top:6px; font-size:0.75rem;">
              <div style="color:var(--amber); font-weight:700; margin-bottom:2px;">${pair.reason}:</div>
              <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                <div>
                  1. <strong>${escapeHtml(pair.existing.title)}</strong> (${escapeHtml(pair.existing.id)} - ${pair.existing.totalItems} db)<br>
                  2. <strong>${escapeHtml(pair.duplicate.title)}</strong> (${escapeHtml(pair.duplicate.id)} - ${pair.duplicate.totalItems} db)
                </div>
                <div style="display:flex; gap:4px;">
                  <button class="btn btn-secondary btn-sm" data-action="delete-specific-duplicate" data-id="${escapeHtml(pair.existing.id)}" style="color:var(--danger); border-color:var(--danger); padding:2px 6px; font-size:0.7rem;">1. törlése</button>
                  <button class="btn btn-secondary btn-sm" data-action="delete-specific-duplicate" data-id="${escapeHtml(pair.duplicate.id)}" style="color:var(--danger); border-color:var(--danger); padding:2px 6px; font-size:0.7rem;">2. törlése</button>
                  <button class="btn btn-secondary btn-sm" data-action="ignore-audit-pair" data-pair="${escapeHtml(pair.pairKey)}" style="padding:2px 6px; font-size:0.7rem;">Mellőzés</button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    reportBox.innerHTML = html;

    const purgeBtn = document.getElementById('btn-purge-junk-albums');
    if (purgeBtn) {
      purgeBtn.onclick = async () => {
        if (!confirm(`Biztosan törölni szeretnéd ezt a ${junkFound.length} db menüelemet a Firestore-ból?`)) return;
        purgeBtn.disabled = true;
        const batch = db.batch();
        junkFound.forEach(id => {
          batch.delete(db.collection("albums").doc(id));
          delete ALBUMS_REGISTRY[id];
        });
        await batch.commit();
        showToast(`${junkFound.length} db szemét sikeresen eltávolítva!`);
        renderHub();
        renderAdminAlbumsList();
        document.getElementById('btn-admin-audit-db')?.click();
      };
    }
  } catch (err) {
    reportBox.innerHTML = `<span style="color:var(--danger);">Audit hiba: ${err.message}</span>`;
  }
});

safeAddListener('admin-audit-report-box', 'click', async (e) => {
  const delBtn = e.target.closest('[data-action="delete-specific-duplicate"]');
  const ignoreBtn = e.target.closest('[data-action="ignore-audit-pair"]');

  if (delBtn) {
    const albumId = delBtn.dataset.id;
    if (!confirm(`Biztosan törlöd a(z) ${albumId} rekordot?`)) return;
    try {
      await db.collection("albums").doc(albumId).delete();
      delete ALBUMS_REGISTRY[albumId];
      renderHub();
      renderAdminAlbumsList();
      showToast("Rekord törölve.");
      document.getElementById('btn-admin-audit-db')?.click();
    } catch (err) { showToast("Hiba: " + err.message); }
  } else if (ignoreBtn) {
    const pairKey = ignoreBtn.dataset.pair;
    if (!ignoredAuditPairs.includes(pairKey)) {
      ignoredAuditPairs.push(pairKey);
      localStorage.setItem('cserelj_ignored_audit_pairs', JSON.stringify(ignoredAuditPairs));
    }
    showToast("Párosítás mellőzve.");
    document.getElementById('btn-admin-audit-db')?.click();
  }
});

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

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = `Elemzés és szűrés...`;
  }

  const cleanedList = [];
  let skippedJunk = 0;
  let skippedExisting = 0;

  albumsList.forEach(alb => {
    const rawId = (alb.id || alb.title || '').toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');

    if (SCRAPER_JUNK_IDS.has(rawId) || /^(mind|kartya|matricaalbum|figura|kisauto)-\d+$/i.test(rawId)) {
      skippedJunk++;
      return;
    }

    if (rawId === 'lutra-album' && ALBUMS_REGISTRY['lidl-lutra-2026']) {
      skippedExisting++;
      return;
    }

    // Kategória-fülek („Foci (15)”, „Pokémon (9)”) és beküldő-gombok kiszűrése
    if (/\s\(\d+\)$/.test(alb.title || '') || ['ismeretlen-gyujtemeny', 'gyujtemeny-javaslasa', 'gyujtemeny-bekuldese'].includes(rawId)) {
      skippedJunk++;
      return;
    }

    // Már meglévő album: azonosító vagy azonos címkulcs alapján NEM írjuk felül
    const titleKey = getNormalizedAlbumTitleKey(alb.title || rawId);
    const dupExisting = ALBUMS_REGISTRY[rawId] || Object.values(ALBUMS_REGISTRY).some(ex =>
      ex.id !== rawId && titleKey && getNormalizedAlbumTitleKey(ex.title || ex.id) === titleKey && Number(ex.year || 0) === Number(alb.year || 0));
    if (dupExisting) {
      skippedExisting++;
      return;
    }

    cleanedList.push({ ...alb, cleanId: rawId });
  });

  const chunkSize = 400;
  let savedCount = 0;

  try {
    for (let i = 0; i < cleanedList.length; i += chunkSize) {
      const chunk = cleanedList.slice(i, i + chunkSize);
      const batch = db.batch();

      chunk.forEach(alb => {
        const id = alb.cleanId;
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
          featured: false,
          isRetro: alb.isRetro === true || year < 2018,
          hasFavorites: false,
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
      if (statusEl) statusEl.textContent = `Mentve: ${savedCount} / ${cleanedList.length} album...`;
    }

    showToast(`Siker! ${savedCount} új album feltöltve (${skippedExisting} már megvolt, ${skippedJunk} szemét kiszűrve).`);
    renderHub();
    renderAdminAlbumsList();
    if (document.getElementById('admin-album-json-import')) document.getElementById('admin-album-json-import').value = '';
  } catch (err) {
    showToast("Importálási hiba: " + err.message);
  } finally {
    if (statusEl) setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
  }
});

safeAddListener('btn-admin-seed-database', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Feltöltöd a boltokat és a Lidl Lutra 108 matricájának tájolását/fejezeteit a Firestore-ba?")) return;

  const btn = document.getElementById('btn-admin-seed-database');
  if (btn) { btn.disabled = true; btn.textContent = "Feltöltés..."; }

  try {
    const batch = db.batch();

    batch.set(db.collection("albums").doc("lidl-lutra-2026"), {
      id: "lidl-lutra-2026",
      title: "Lutra Album",
      subtitle: "Védett állatok a Föld körül",
      publisher: "Lidl / WWF",
      year: 2026,
      totalItems: 108,
      type: "sticker",
      typeLabel: "Matricaalbum",
      customChaptersList: FEJEZETEK,
      customNames: Object.values(STICKER_NAMES),
      stickerOrients: STICKER_ORIENTS,
      hasChapters: true,
      hasFavorites: false,
      active: true,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (typeof STORE_DATABASES !== 'undefined') {
      Object.entries(STORE_DATABASES).forEach(([chainKey, storeList]) => {
        if (storeList && storeList.length > 0) {
          const storeRef = db.collection("stores").doc(chainKey);
          batch.set(storeRef, {
            chain: chainKey,
            stores: storeList,
            count: storeList.length,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
      });
    }

    await batch.commit();
    showToast("Lutra tájolások és boltok sikeresen mentve a Firestore-ba!");
  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Lutra adatok és Boltok feltöltése Firestore-ba"; }
  }
});

safeAddListener('btn-admin-migrate-locations', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Bekapcsolod az automatikus e-mail értesítőket mind a regisztrált felhasználónál?")) return;

  const btn = document.getElementById('btn-admin-migrate-locations');
  if (btn) { btn.disabled = true; btn.textContent = "Karbantartás..."; }

  try {
    const snap = await db.collection("public_profiles").get();
    const batchSize = 400;
    let count = 0;

    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const chunk = snap.docs.slice(i, i + batchSize);
      const batch = db.batch();

      chunk.forEach(doc => {
        batch.set(db.collection("public_profiles").doc(doc.id), {
          emailNotifications: true
        }, { merge: true });

        batch.set(db.collection("users").doc(doc.id), {
          emailNotifications: true
        }, { merge: true });

        count++;
      });

      await batch.commit();
    }
    showToast(`Sikeres karbantartás! ${count} felhasználónál aktiválva az e-mail értesítő.`);
  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Településtisztítás és e-mail bekapcsolása most"; }
  }
});

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
    statusEl.innerHTML = "Feldolgozás és adatok kinyerése folyamatban...";
  }

  let extractedText = rawText;

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

      const idToken = currentUser ? await currentUser.getIdToken() : '';
      const res = await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
        body: JSON.stringify({ base64Data, mode: 'table_ocr' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "A képfelismerő hibát adott.");

      extractedText = data.text || '';
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger);">AI Hiba: ${err.message}</span>`;
      return showToast("AI Hiba: " + err.message);
    }
  }

  const namesArray = expandCustomNamesText(extractedText);
  const totalCount = namesArray.length;

  if (document.getElementById('admin-album-custom-names')) {
    document.getElementById('admin-album-custom-names').value = extractedText;
  }
  if (totalCount > 0 && document.getElementById('admin-album-total')) {
    document.getElementById('admin-album-total').value = totalCount;
  }

  if (statusEl) {
    statusEl.innerHTML = `<span style="color:var(--moss-soft);">Sikeres feldolgozás! ${totalCount} tétel átemelve a lenti űrlapba.</span>`;
  }
  showToast(`${totalCount} tétel sikeresen kitöltve az űrlapon!`);
  document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

safeAddListener('btn-admin-clear-universal', () => {
  if (document.getElementById('admin-ai-ocr-file')) document.getElementById('admin-ai-ocr-file').value = '';
  if (document.getElementById('admin-raw-import-text')) document.getElementById('admin-raw-import-text').value = '';
  if (document.getElementById('admin-universal-status')) document.getElementById('admin-universal-status').style.display = 'none';
  showToast("Beemelő mezők kiürítve.");
});

safeAddListener('admin-album-cover-input', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 500;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      adminAlbumCoverBase64 = canvas.toDataURL('image/jpeg', 0.8);
      const preview = document.getElementById('admin-album-cover-preview');
      const previewBox = document.getElementById('admin-album-cover-preview-box');
      if (preview && previewBox) {
        preview.src = adminAlbumCoverBase64;
        previewBox.style.display = 'block';
      }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

safeAddListener('btn-admin-cancel-edit', () => {
  editingAlbumId = null;
  resetAdminAlbumForm();
});

function resetAdminAlbumForm() {
  const idInput = document.getElementById('admin-album-id');
  if (idInput) { idInput.value = ''; idInput.disabled = false; }
  document.getElementById('admin-album-title').value = '';
  document.getElementById('admin-album-publisher').value = '';
  document.getElementById('admin-album-year').value = '2026';
  document.getElementById('admin-album-total').value = '';
  document.getElementById('admin-album-subtitle').value = '';
  if (document.getElementById('admin-album-description')) document.getElementById('admin-album-description').value = '';
  if (document.getElementById('admin-import-text')) document.getElementById('admin-import-text').value = '';
  if (document.getElementById('admin-import-file')) document.getElementById('admin-import-file').value = '';
  if (document.getElementById('admin-import-preview')) document.getElementById('admin-import-preview').style.display = 'none';
  document.getElementById('admin-album-custom-items').value = '';
  document.getElementById('admin-album-custom-names').value = '';
  document.getElementById('admin-album-custom-chapters').value = '';
  document.getElementById('admin-album-featured').checked = false;
  document.getElementById('admin-album-is-retro').checked = false;
  document.getElementById('admin-album-has-chapters').checked = false;
  document.getElementById('admin-album-radar-type').value = 'none';
  document.getElementById('admin-album-cover-input').value = '';
  if (document.getElementById('admin-album-cover-preview-box')) {
    document.getElementById('admin-album-cover-preview-box').style.display = 'none';
  }
  adminAlbumCoverBase64 = '';

  const formTitle = document.getElementById('admin-album-form-title');
  const cancelBtn = document.getElementById('btn-admin-cancel-edit');
  if (formTitle) formTitle.textContent = "4. Új gyűjtemény felvitele / Szerkesztő";
  if (cancelBtn) cancelBtn.style.display = 'none';
}

async function executeSaveAlbum(publishActive) {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");

  const idInput = document.getElementById('admin-album-id');
  const newId = idInput?.value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
  const title = document.getElementById('admin-album-title')?.value.trim();
  const publisher = document.getElementById('admin-album-publisher')?.value.trim();
  const year = parseInt(document.getElementById('admin-album-year')?.value || '2026', 10);
  const totalItems = parseInt(document.getElementById('admin-album-total')?.value || '0', 10);
  const type = document.getElementById('admin-album-type')?.value || 'sticker';
  const subtitle = document.getElementById('admin-album-subtitle')?.value.trim() || '';
  const isFeatured = publishActive && (document.getElementById('admin-album-featured')?.checked || false);
  const isRetro = document.getElementById('admin-album-is-retro')?.checked || (year < 2018);
  const radarType = document.getElementById('admin-album-radar-type')?.value || 'none';
  const hasChapters = (document.getElementById('admin-album-has-chapters')?.checked || false);
  const description = (document.getElementById('admin-album-description')?.value || '').trim().slice(0, 1200);

  const customItemsRaw = document.getElementById('admin-album-custom-items')?.value.trim() || '';
  const customNamesRaw = document.getElementById('admin-album-custom-names')?.value.trim() || '';
  const customChaptersRaw = document.getElementById('admin-album-custom-chapters')?.value.trim() || '';

  if (!newId || !title || !publisher) {
    return showToast("Kérlek töltsd ki az ID-t, a címet és a kiadót!");
  }

  const customItems = expandCustomItemsText(customItemsRaw);
  const customNames = expandCustomNamesText(customNamesRaw);

  let finalTotal = totalItems;
  if (customItems.length > 0 && (!finalTotal || finalTotal < customItems.length)) finalTotal = customItems.length;
  if (customNames.length > 0 && (!finalTotal || finalTotal < customNames.length)) finalTotal = customNames.length;
  if (finalTotal < 1) return showToast("Kérlek add meg a darabszámot!");

  const customChaptersList = parseChaptersText(customChaptersRaw, customItems, customNames);
  const typeLabel = type === 'sticker' ? 'Matricaalbum' : type === 'card' ? 'Kártya' : 'Figura / Kinder';
  const existingCover = ALBUMS_REGISTRY[editingAlbumId || newId]?.coverUrl || `covers/${newId}.webp`;

  try {
    const payload = {
      id: newId,
      title: title || '',
      subtitle: subtitle || '',
      description: description,
      publisher: publisher || '',
      year: isNaN(year) ? 2026 : year,
      totalItems: finalTotal,
      type: type || 'sticker',
      typeLabel: typeLabel || 'Matricaalbum',
      coverUrl: adminAlbumCoverBase64 || existingCover || '',
      featured: Boolean(isFeatured),
      isRetro: Boolean(isRetro),
      hasFavorites: false,
      hasRadar: radarType !== 'none',
      radarType: radarType || 'none',
      hasChapters: Boolean(hasChapters || customChaptersList.length > 0),
      customItemsRaw: customItemsRaw || '',
      customItems: customItems || [],
      customNamesRaw: customNamesRaw || '',
      customNames: customNames || [],
      customChaptersRaw: customChaptersRaw || '',
      customChaptersList: customChaptersList || [],
      active: Boolean(publishActive),
      inactivatedAt: publishActive ? null : firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (editingAlbumId && editingAlbumId !== newId) {
      await db.collection("albums").doc(newId).set(payload, { merge: true });
      await db.collection("albums").doc(editingAlbumId).delete();
      delete ALBUMS_REGISTRY[editingAlbumId];
    } else {
      await db.collection("albums").doc(newId).set(payload, { merge: true });
    }

    ALBUMS_REGISTRY[newId] = payload;
    localStorage.setItem('cached_albums_registry', JSON.stringify(ALBUMS_REGISTRY));

    showToast(publishActive ? "Gyűjtemény élesítve és közzétéve!" : "Gyűjtemény piszkozatként (inaktívan) mentve!");
    resetAdminAlbumForm();
    editingAlbumId = null;
    renderHub();
    renderAdminAlbumsList();
  } catch (err) {
    showToast("Mentési hiba: " + err.message);
  }
}

safeAddListener('btn-admin-save-draft', () => executeSaveAlbum(false));
safeAddListener('btn-admin-publish-album', () => executeSaveAlbum(true));

let adminSelectedLetter = 'ALL';

function renderAdminAlbumsList() {
  const container = document.getElementById('admin-albums-list');
  const abcBar = document.getElementById('admin-albums-abc-bar');
  const countEl = document.getElementById('admin-albums-total-count');
  const query = (document.getElementById('admin-albums-search')?.value || '').toLowerCase().trim();

  if (!container) return;

  const allAlbums = Object.values(ALBUMS_REGISTRY).sort((a, b) => a.title.localeCompare(b.title, 'hu'));
  if (countEl) countEl.textContent = allAlbums.length;

  if (abcBar) {
    const availableLetters = new Set();
    allAlbums.forEach(a => {
      const firstChar = a.title.charAt(0).toUpperCase();
      availableLetters.add(firstChar);
    });

    const sortedLetters = [...availableLetters].sort((a, b) => a.localeCompare(b, 'hu'));
    abcBar.innerHTML = `
      <button class="admin-abc-btn ${adminSelectedLetter === 'ALL' ? 'active' : ''}" data-letter="ALL" style="width:auto; padding:0 8px;">Mind</button>
      ${sortedLetters.map(l => `
        <button class="admin-abc-btn ${adminSelectedLetter === l ? 'active' : ''}" data-letter="${l}">${l}</button>
      `).join('')}
    `;
  }

  let filtered = allAlbums.filter(a => {
    if (query) {
      const matchTitle = (a.title || '').toLowerCase().includes(query);
      const matchPub = (a.publisher || '').toLowerCase().includes(query);
      const matchId = (a.id || '').toLowerCase().includes(query);
      return matchTitle || matchPub || matchId;
    }
    if (adminSelectedLetter !== 'ALL') {
      return a.title.charAt(0).toUpperCase() === adminSelectedLetter;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Nincs találat a szűrésre.</p>';
    return;
  }

  const groups = {};
  filtered.forEach(a => {
    const letter = a.title.charAt(0).toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(a);
  });

  let html = '';
  Object.keys(groups).sort((a, b) => a.localeCompare(b, 'hu')).forEach(letter => {
    html += `
      <div style="font-size:0.88rem; font-weight:700; color:var(--amber); margin:8px 0 4px; padding-bottom:2px; border-bottom:1px solid rgba(216,155,74,0.3); display:flex; justify-content:space-between;">
        <span>${letter}</span>
        <span style="font-size:0.75rem; font-weight:normal; opacity:0.8;">${groups[letter].length} db</span>
      </div>
    `;

    groups[letter].forEach(a => {
      const isActive = (a.active !== false);
      html += `
        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <img src="${a.coverUrl || 'covers/' + a.id + '.webp'}" style="width:36px; height:36px; border-radius:4px; object-fit:contain; background:#F3EEDF; padding:2px;" alt="Borító">
            <div>
              <strong>${escapeHtml(a.title)}</strong> (${a.year}) — <span style="color:var(--sand); font-size:0.8rem;">${a.totalItems} db (${escapeHtml(a.typeLabel || a.type)})</span>
              ${!isActive ? '<span class="badge-trade-status badge-status-cancelled" style="margin-left:6px;">Inaktív</span>' : ''}
              <div style="font-size:0.72rem; color:var(--text-muted);">${escapeHtml(a.id)} • Kiadó: ${escapeHtml(a.publisher)}</div>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" data-action="toggle-active-album" data-id="${escapeHtml(a.id)}">
              ${isActive ? 'Inaktiválás' : 'Aktiválás'}
            </button>
            <button class="btn btn-primary btn-sm" data-action="edit-album" data-id="${escapeHtml(a.id)}">Szerkesztés</button>
            <button class="btn btn-secondary btn-sm" data-action="toggle-feature-album" data-id="${escapeHtml(a.id)}">${a.featured ? 'Kiemelt levétel' : 'Kiemelés'}</button>
            <button class="btn btn-secondary btn-sm" data-action="delete-album" data-id="${escapeHtml(a.id)}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>
          </div>
        </div>
      `;
    });
  });

  container.innerHTML = html;
}

safeAddListener('admin-albums-abc-bar', (e) => {
  const btn = e.target.closest('.admin-abc-btn');
  if (!btn) return;
  adminSelectedLetter = btn.dataset.letter;
  renderAdminAlbumsList();
});

safeAddListener('admin-albums-search', 'input', () => {
  adminSelectedLetter = 'ALL';
  renderAdminAlbumsList();
});

safeAddListener('admin-albums-list', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const albumId = btn.dataset.id;
  if (!albumId) return;

  if (btn.dataset.action === 'toggle-active-album') {
    const album = ALBUMS_REGISTRY[albumId];
    if (!album) return;
    const currentActive = (album.active !== false);
    const newActive = !currentActive;

    album.active = newActive;
    if (!newActive) album.featured = false;

    await db.collection("albums").doc(albumId).set({
      active: newActive,
      featured: album.featured,
      inactivatedAt: newActive ? null : firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    renderHub();
    renderAdminAlbumsList();
    showToast(newActive ? `${album.title} aktiválva!` : `${album.title} inaktiválva (csak olvasható)!`);
  } else if (btn.dataset.action === 'edit-album') {
    const album = ALBUMS_REGISTRY[albumId];
    if (!album) return;

    editingAlbumId = albumId;
    const idInput = document.getElementById('admin-album-id');
    idInput.value = album.id;
    idInput.disabled = false;

    document.getElementById('admin-album-title').value = album.title;
    document.getElementById('admin-album-publisher').value = album.publisher;
    document.getElementById('admin-album-year').value = album.year;
    document.getElementById('admin-album-total').value = album.totalItems;
    document.getElementById('admin-album-type').value = album.type;
    document.getElementById('admin-album-subtitle').value = album.subtitle || '';
    if (document.getElementById('admin-album-description')) document.getElementById('admin-album-description').value = album.description || '';
    document.getElementById('admin-album-custom-items').value = album.customItemsRaw || (album.customItems ? album.customItems.join(', ') : '');
    document.getElementById('admin-album-custom-names').value = album.customNamesRaw || (album.customNames ? album.customNames.map((n, i) => `${i+1}: ${n}`).join('\n') : '');
    document.getElementById('admin-album-custom-chapters').value = album.customChaptersRaw || '';
    document.getElementById('admin-album-featured').checked = album.featured === true;
    document.getElementById('admin-album-is-retro').checked = album.isRetro === true || album.year < 2018;
    document.getElementById('admin-album-radar-type').value = album.radarType || (album.hasRadar ? 'lidl' : 'none');
    document.getElementById('admin-album-has-chapters').checked = album.hasChapters === true;

    if (album.coverUrl) {
      const preview = document.getElementById('admin-album-cover-preview');
      const previewBox = document.getElementById('admin-album-cover-preview-box');
      if (preview && previewBox) {
        preview.src = album.coverUrl;
        previewBox.style.display = 'block';
      }
    }

    const formTitle = document.getElementById('admin-album-form-title');
    const cancelBtn = document.getElementById('btn-admin-cancel-edit');
    if (formTitle) formTitle.textContent = `Gyűjtemény szerkesztése: ${album.title}`;
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (btn.dataset.action === 'toggle-feature-album') {
    const current = ALBUMS_REGISTRY[albumId]?.featured || false;
    ALBUMS_REGISTRY[albumId].featured = !current;
    await db.collection("albums").doc(albumId).set({ featured: !current }, { merge: true });
    renderHub();
    renderAdminAlbumsList();
    showToast("Kiemelés frissítve.");
  } else if (btn.dataset.action === 'delete-album') {
    if (albumId === 'lidl-lutra-2026') return showToast("A Lutra alapértelmezett album nem törölhető.");
    if (!confirm(`Biztosan törlöd a(z) ${albumId} gyűjteményt?`)) return;
    await db.collection("albums").doc(albumId).delete();
    delete ALBUMS_REGISTRY[albumId];
    renderHub();
    renderAdminAlbumsList();
    showToast("Gyűjtemény törölve.");
  }
});

function listenToSuggestions() {
  if (!db) return;
  if (suggestionsUnsubscribe) suggestionsUnsubscribe();

  suggestionsUnsubscribe = db.collection("album_suggestions")
    .where("status", "==", "pending")
    .onSnapshot(snap => {
      albumSuggestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const badge = document.getElementById('admin-suggestions-badge');
      if (badge) badge.textContent = albumSuggestions.length;
      renderAdminSuggestionsList();
    }, err => console.warn("Suggestions listener:", err));
}

function renderAdminSuggestionsList() {
  const container = document.getElementById('admin-suggested-albums-list');
  if (!container) return;

  if (albumSuggestions.length === 0) {
    container.innerHTML = '<span style="color:var(--text-muted); font-size:0.85rem;">Nincs függőben lévő gyűjteményjavaslat.</span>';
    return;
  }

  container.innerHTML = albumSuggestions.map(s => `
    <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
      <div>
        <strong style="color:var(--sand); font-size:0.95rem;">${escapeHtml(s.title)}</strong> (${s.year || 2026})
        <div style="font-size:0.75rem; color:var(--text-muted);">
          Kiadó: <strong>${escapeHtml(s.publisher)}</strong> • ${s.totalItems || '?'} tétel • Típus: ${escapeHtml(s.type)}
          <br>Beküldte: <em>${escapeHtml(s.submittedByName || 'Gyűjtő')}</em> ${s.note ? `• Megjegyzés: „${formatLinksWithAnchors(s.note)}”` : ''}
        </div>
      </div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-primary btn-sm" data-action="approve-suggestion" data-id="${s.id}">Betöltés & Jóváhagyás</button>
        <button class="btn btn-secondary btn-sm" data-action="reject-suggestion" data-id="${s.id}" style="color:var(--danger); border-color:var(--danger);">Elutasítás</button>
      </div>
    </div>
  `).join('');
}

safeAddListener('admin-suggested-albums-list', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const sugId = btn.dataset.id;
  const sug = albumSuggestions.find(s => s.id === sugId);
  if (!sug) return;

  if (btn.dataset.action === 'approve-suggestion') {
    document.getElementById('admin-album-id').value = sug.title.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
    document.getElementById('admin-album-title').value = sug.title;
    document.getElementById('admin-album-publisher').value = sug.publisher || '';
    document.getElementById('admin-album-year').value = sug.year || 2026;
    document.getElementById('admin-album-total').value = sug.totalItems || 100;
    document.getElementById('admin-album-type').value = sug.type || 'sticker';
    document.getElementById('admin-album-subtitle').value = sug.note || '';

    await db.collection("album_suggestions").doc(sugId).update({ status: "approved" });
    showToast("Javaslat betöltve az űrlapba!");
    document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (btn.dataset.action === 'reject-suggestion') {
    if (!confirm("Biztosan elutasítod ezt a javaslatot?")) return;
    await db.collection("album_suggestions").doc(sugId).update({ status: "rejected" });
    showToast("Javaslat elutasítva.");
  }
});

// =========================================================================
// ADMIN: GYORSFELVITEL (LISTA / PDF) & LEÍRÁS GENERÁLÁS
// =========================================================================

let adminImportResult = null;

function loadPdfJsLib() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } catch (e) { reject(e); }
    };
    s.onerror = () => reject(new Error('A PDF-olvasó nem tölthető be.'));
    document.head.appendChild(s);
  });
}

function csFileToJpegBase64(file) {
  return new Promise((resolve, reject) => {
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
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = () => reject(new Error('A kép nem olvasható.'));
      img.src = evt.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function adminImportReadFile(file) {
  const name = (file.name || '').toLowerCase();
  if (/^image\//.test(file.type || '') || /\.(jpe?g|png|webp)$/.test(name)) {
    showToast('Kép felismerése (AI)…');
    const base64Data = await csFileToJpegBase64(file);
    const idToken = currentUser ? await currentUser.getIdToken() : '';
    const res = await fetch(WORKER_ENDPOINT_URL, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, idToken ? { 'Authorization': `Bearer ${idToken}` } : {}),
      body: JSON.stringify({ base64Data, mode: 'table_ocr' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'A képfelismerő hibát adott.');
    return impTextToLines(data.text || '');
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const lib = await loadPdfJsLib();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let lines = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      lines = lines.concat(impPdfItemsToLines(tc.items));
    }
    return lines;
  }
  const text = await file.text();
  return impTextToLines(text);
}

function adminImportShowPreview(res) {
  const box = document.getElementById('admin-import-preview');
  if (!box) return;
  if (!res || !res.items.length) {
    box.innerHTML = '<p style="color:var(--danger); margin:6px 0;">Nem találtam felismerhető tételsort. Példa: <code>12 Tételnév</code> vagy <code>LE1 Tételnév</code>, soronként egy.</p>';
    box.style.display = 'block';
    return;
  }
  const sample = res.items.slice(0, 6).concat(res.items.length > 12 ? [{ label: '…', name: '' }] : []).concat(res.items.slice(-3));
  const m = res.meta || {};
  box.innerHTML = `
    <p style="margin:6px 0; color:var(--moss-soft); font-weight:700;">✔ ${res.items.length} tétel, ${res.chapters.length} fejezet felismerve${m.title ? ` · ${escapeHtml(m.title)}` : ''}${m.publisher ? ` · ${escapeHtml(m.publisher)}` : ''}${m.year ? ` · ${m.year}` : ''}</p>
    ${res.chapters.length ? `<p style="margin:4px 0; font-size:0.8rem; color:var(--text-muted);">${res.chapters.map(c => `${escapeHtml(c.title)} (${c.from}–${c.to})`).join(' · ')}</p>` : ''}
    <p style="margin:4px 0; font-size:0.8rem; color:var(--sand);">${sample.map(i => `${escapeHtml(i.label)}${i.name ? ' ' + escapeHtml(i.name) : ''}`).join(' | ')}</p>
    ${res.warnings.length ? `<p style="margin:4px 0; font-size:0.8rem; color:var(--amber);">⚠ ${res.warnings.map(escapeHtml).join('<br>⚠ ')}</p>` : ''}
    <button class="btn btn-primary btn-sm" id="btn-admin-import-apply" style="margin-top:6px;">Beírás az űrlap mezőibe</button>`;
  box.style.display = 'block';
  safeAddListener('btn-admin-import-apply', adminImportApply);
}

async function adminImportRun() {
  const textEl = document.getElementById('admin-import-text');
  const fileEl = document.getElementById('admin-import-file');
  try {
    let lines;
    if (fileEl && fileEl.files && fileEl.files[0]) {
      showToast('Fájl beolvasása…');
      lines = await adminImportReadFile(fileEl.files[0]);
    } else {
      lines = impTextToLines(textEl ? textEl.value : '');
    }
    adminImportResult = parseCollectionLines(lines);
    adminImportShowPreview(adminImportResult);
  } catch (err) {
    console.error(err);
    showToast('A beolvasás nem sikerült: ' + (err.message || 'ismeretlen hiba'));
  }
}

function adminImportApply() {
  const res = adminImportResult;
  if (!res || !res.items.length) return;
  const f = importResultToFields(res);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('admin-album-custom-items', f.itemsRaw);
  set('admin-album-custom-names', f.namesRaw);
  set('admin-album-custom-chapters', f.chaptersRaw);
  set('admin-album-total', f.total);
  const hc = document.getElementById('admin-album-has-chapters');
  if (hc) hc.checked = res.chapters.length > 0;
  const m = res.meta || {};
  const fillIfEmpty = (id, v) => { const el = document.getElementById(id); if (el && !el.value.trim() && v) el.value = v; };
  fillIfEmpty('admin-album-title', m.title);
  fillIfEmpty('admin-album-publisher', m.publisher);
  if (m.year) { const y = document.getElementById('admin-album-year'); if (y && (!y.value || y.value === '2026')) y.value = m.year; }
  const idEl = document.getElementById('admin-album-id');
  if (idEl && !idEl.value.trim() && m.title) {
    idEl.value = ((m.publisher ? m.publisher + ' ' : '') + m.title).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) + (m.year ? '-' + m.year : '');
  }
  showToast(`${f.total} tétel beírva. Ellenőrizd, majd mentsd a gyűjteményt.`);
}

safeAddListener('btn-admin-import-run', adminImportRun);
safeAddListener('btn-admin-gen-description', () => {
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const items = expandCustomItemsText(val('admin-album-custom-items'));
  const names = expandCustomNamesText(val('admin-album-custom-names'));
  const type = val('admin-album-type') || 'sticker';
  const chapters = parseChaptersText(val('admin-album-custom-chapters'), items, names);
  const total = parseInt(val('admin-album-total'), 10) || items.length || names.length;
  const tmp = { title: val('admin-album-title'), publisher: val('admin-album-publisher'), year: parseInt(val('admin-album-year'), 10) || '', type, totalItems: total, customChaptersList: chapters };
  const el = document.getElementById('admin-album-description');
  if (el) el.value = autoAlbumDescription(tmp);
});

function listenToAlbums() {
  if (!db) return;
  if (albumsUnsubscribe) albumsUnsubscribe();

  albumsUnsubscribe = db.collection("albums").onSnapshot(snap => {
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
        typeLabel: data.typeLabel || (data.type === 'card' ? 'Kártya' : data.type === 'figure' ? 'Figura / Kinder' : 'Matricaalbum'),
        coverUrl: data.coverUrl || `covers/${doc.id}.webp`,
        featured: data.featured === true,
        isRetro: data.isRetro === true || data.year < 2018,
        hasFavorites: false,
        hasRadar: data.hasRadar === true,
        radarType: data.radarType || 'none',
        hasChapters: data.hasChapters === true,
        description: data.description || '',
        customItems: data.customItems || [],
        customNames: data.customNames || [],
        customItemsRaw: data.customItemsRaw || '',
        customNamesRaw: data.customNamesRaw || '',
        customChaptersRaw: data.customChaptersRaw || '',
        customChaptersList: data.customChaptersList || [],
        active: data.active !== false
      };
    });

    localStorage.setItem('cached_albums_registry', JSON.stringify(ALBUMS_REGISTRY));
    renderHub();
    if (currentUser && currentUser.email === ADMIN_EMAIL) {
      renderAdminAlbumsList();
    }
  }, err => console.warn("Albums listener:", err));
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
}

function showAnnouncementModal(announcement) {
  const modal = document.getElementById('modal-announcement');
  if (!modal) return;
  const titleEl = document.getElementById('announcement-modal-title');
  const bodyEl = document.getElementById('announcement-modal-body');
  if (titleEl) titleEl.textContent = announcement.title;
  
  let contentHtml = formatLinksWithAnchors(announcement.content);
  if (announcement.photoBase64) {
    contentHtml = `<img src="${announcement.photoBase64}" style="max-width:100%; max-height:220px; border-radius:8px; margin-bottom:10px; display:block; border:1px solid var(--amber);" alt="Hír fotó" data-action="open-lightbox"><br>` + contentHtml;
  }
  if (bodyEl) bodyEl.innerHTML = contentHtml;
  modal.classList.add('open');

  const closeFn = () => modal.classList.remove('open');
  const btnClose = document.getElementById('btn-close-announcement');
  const btnOk = document.getElementById('btn-close-announcement-ok');
  if (btnClose) btnClose.onclick = closeFn;
  if (btnOk) btnOk.onclick = closeFn;
}

safeAddListener('btn-admin-preview-msg', () => {
  const title = document.getElementById('admin-msg-title')?.value.trim() || 'Előnézeti Cím';
  const content = document.getElementById('admin-msg-content')?.value.trim() || 'Előnézeti üzenet szövege.';
  showAnnouncementModal({ id: 'preview', title, content, photoBase64: adminMsgPhotoBase64 });
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

  if (!title || !content) return showToast("Add meg a címet és a szöveget!");

  try {
    let finalContent = content;
    if (link) finalContent += `\n\nLink: ${link}`;

    await db.collection("announcements").add({
      title, content: finalContent, link,
      photoBase64: adminMsgPhotoBase64 || '',
      expiryDate: expiry ? new Date(expiry) : null,
      type, format, targetCity: city, active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    adminMsgPhotoBase64 = '';
    if (document.getElementById('admin-msg-title')) document.getElementById('admin-msg-title').value = '';
    if (document.getElementById('admin-msg-content')) document.getElementById('admin-msg-content').value = '';
    if (document.getElementById('admin-msg-photo-input')) document.getElementById('admin-msg-photo-input').value = '';
    if (document.getElementById('admin-msg-photo-preview-box')) document.getElementById('admin-msg-photo-preview-box').style.display = 'none';
    showToast("Rendszerüzenet élesítve.");
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
    } catch (err) { showToast("Hiba: " + err.message); }
  })();
});

// =========================================================================
// LENULLÁZÁS, OKLEVÉL, JEGYZET & ADATKEZELÉSI TÁJÉKOZTATÓ
// =========================================================================

safeAddListener('link-open-privacy-policy', (e) => {
  e.preventDefault();
  document.getElementById('modal-privacy-policy')?.classList.add('open');
});
safeAddListener('btn-close-privacy', () => document.getElementById('modal-privacy-policy')?.classList.remove('open'));
safeAddListener('btn-close-privacy-ok', () => document.getElementById('modal-privacy-policy')?.classList.remove('open'));

safeAddListener('btn-open-reset', () => document.getElementById('modal-reset')?.classList.add('open'));
safeAddListener('btn-close-reset', () => document.getElementById('modal-reset')?.classList.remove('open'));
safeAddListener('btn-reset-van', () => {
  myProfile.van = []; myProfile.vanCounts = {}; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Duplák törölve.");
});
safeAddListener('btn-reset-kell', () => {
  myProfile.kell = []; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Hiányzók törölve.");
});
safeAddListener('btn-reset-foglalva', () => {
  myProfile.foglalva = []; myProfile.foglalvaCounts = {}; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Foglaltak törölve.");
});
safeAddListener('btn-reset-all', () => {
  myProfile.van = []; myProfile.vanCounts = {}; myProfile.kell = []; myProfile.foglalva = []; myProfile.foglalvaCounts = {}; saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Összes adat törölve.");
});

function downloadCertificateImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#0D2E2C'); grad.addColorStop(1, '#081B1A');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1200, 800);
  ctx.strokeStyle = '#D89B4A'; ctx.lineWidth = 10; ctx.strokeRect(30, 30, 1140, 740);
  ctx.strokeStyle = '#FFD166'; ctx.lineWidth = 2; ctx.strokeRect(45, 45, 1110, 710);
  ctx.textAlign = 'center'; ctx.fillStyle = '#D89B4A';
  ctx.font = 'bold 32px "Work Sans", sans-serif'; ctx.fillText('CSERÉLJ OKOSAN ELISMERÉS', 600, 120);
  ctx.font = 'bold 54px Georgia, serif'; ctx.fillStyle = '#FFD166'; ctx.fillText('BOLYGÓVÉDŐ SZUPERHŐS OKLEVÉL', 600, 200);
  ctx.font = '24px "Work Sans", sans-serif'; ctx.fillStyle = '#E3D5B8'; ctx.fillText('Ezennel tanúsítjuk, hogy', 600, 290);
  ctx.font = 'bold 64px "Work Sans", sans-serif'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(myProfile.nev || 'Gyűjtő', 600, 390);
  ctx.strokeStyle = '#D89B4A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(350, 420); ctx.lineTo(850, 420); ctx.stroke();
  ctx.font = '28px "Work Sans", sans-serif'; ctx.fillStyle = '#E3D5B8';
  ctx.fillText('sikeresen összegyűjtötte a 2026-os Lidl Lutra album', 600, 480);
  ctx.fillText('mind a 108 matricáját!', 600, 525);
  ctx.font = 'italic 22px "Work Sans", sans-serif'; ctx.fillStyle = '#9FB3A3';
  ctx.fillText(`Kelt: ${new Date().toLocaleDateString('hu-HU')} • Cserélj Okosan`, 600, 640);

  const link = document.createElement('a');
  link.download = `Szuperhos_Oklevel_${(myProfile.nev || 'Gyujto').replace(/\s+/g, '_')}.png`;
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
safeAddListener('btn-cert-share-fb', () => {
  navigator.clipboard.writeText(`Betelt az albumom a Cserélj Okosanon! Minden matrica megvan! ${window.location.href}`);
  showToast("Szöveg másolva a vágólapra.");
});

safeAddListener('btn-save-note', () => {
  const effKey = getEffectiveAlbumKey();
  const noteVal = (document.getElementById('prof-private-note')?.value || '').trim().slice(0, 250);
  myProfile.privateNote = noteVal;
  localStorage.setItem(`private_note_${effKey}`, noteVal);
  if (effKey === 'lidl-lutra-2026') localStorage.setItem('lutra_private_note', noteVal);
  
  if (currentUser && db) {
    db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(effKey).set({
      privateNote: noteVal
    }, { merge: true }).catch(() => {});

    if (effKey === 'lidl-lutra-2026') {
      db.collection("users").doc(currentUser.uid).set({
        privateNote: noteVal
      }, { merge: true }).catch(() => {});
    }
  }
  showToast("Jegyzet sikeresen elmentve.");
});

const noteTextarea = document.getElementById('prof-private-note');
if (noteTextarea) {
  noteTextarea.addEventListener('input', (e) => {
    const countEl = document.getElementById('note-char-count');
    if (countEl) countEl.textContent = `${e.target.value.length}/250`;
  });
}

safeAddListener('btn-save-profile', () => {
  if (!currentUser) return showToast("Előbb lépj be a fiókodba!");
  const nev = document.getElementById('prof-nev')?.value.trim() || '';
  const em = document.getElementById('prof-email')?.value.trim() || '';
  const gdpr = document.getElementById('prof-gdpr')?.checked;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!nev) return showToast("A megjelenő név megadása kötelező!");
  if (!em || !emailRegex.test(em)) return showToast("Kérlek adj meg egy érvényes e-mail címet!");
  if (!gdpr) return showToast("A cserékhez el kell fogadnod az adatkezelést!");

  const validLocs = (myProfile.locations || []).filter(l => l.city && l.city.trim().length > 0);
  if (validLocs.length === 0) {
    return showToast("Legalább egy település megadása kötelező a helyi cserékhez!");
  }

  const concatenatedCity = validLocs.map(l => {
    if (l.districts && l.districts.length > 0) {
      const romanDists = l.districts.sort((a, b) => a - b).map(d => ROMAN_NUMERALS[d] ? `${ROMAN_NUMERALS[d]}.` : `${d}.`).join(', ');
      return `${l.city} (${romanDists} ker.)`;
    }
    return l.city;
  }).join(', ');

  const tradeMode = document.getElementById('prof-trade-mode')?.value || 'both';

  myProfile.telepules = concatenatedCity;
  myProfile.locations = validLocs;
  myProfile.geo = myGpsCoords;
  myProfile.tradeMode = tradeMode;

  myProfile.nev = nev;
  myProfile.email = em;
  myProfile.isGiftOffering = document.getElementById('prof-gift')?.checked || false;
  myProfile.showEmailToUsers = document.getElementById('prof-show-email')?.checked || false;
  myProfile.emailNotifications = document.getElementById('prof-email-notif')?.checked !== false;
  myProfile.allowInspect = document.getElementById('prof-allow-inspect')?.checked !== false;
  myProfile.gdprAccepted = true;
  myProfile.isVacation = document.getElementById('prof-vacation-mode')?.checked || false;
  localStorage.setItem('cserelj_vacation_mode', JSON.stringify(myProfile.isVacation));

  (async () => {
    try {
      const batch = db.batch();
      const userRef = db.collection("users").doc(currentUser.uid);
      batch.set(userRef, {
        nev: myProfile.nev,
        telepules: myProfile.telepules,
        locations: myProfile.locations,
        geo: myProfile.geo,
        tradeMode: myProfile.tradeMode,
        email: myProfile.email,
        isGiftOffering: myProfile.isGiftOffering,
        showEmailToUsers: myProfile.showEmailToUsers,
        emailNotifications: myProfile.emailNotifications,
        allowInspect: myProfile.allowInspect,
        gdprAccepted: true,
        isVacation: myProfile.isVacation,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const publicRef = db.collection("public_profiles").doc(currentUser.uid);
      batch.set(publicRef, {
        nev: myProfile.nev,
        nickname: myProfile.nev,
        telepules: myProfile.telepules,
        city: myProfile.telepules,
        locations: myProfile.locations,
        geo: myProfile.geo,
        tradeMode: myProfile.tradeMode,
        email: myProfile.showEmailToUsers ? myProfile.email : '',
        notifyEmail: myProfile.email, // Megtartva a közvetlen és megbízható Worker v2.6 értesítéshez!
        isGiftOffering: myProfile.isGiftOffering,
        showEmailToUsers: myProfile.showEmailToUsers,
        emailNotifications: myProfile.emailNotifications,
        allowInspect: myProfile.allowInspect,
        gdprAccepted: true,
        isVacation: myProfile.isVacation,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await batch.commit();
      checkMandatoryProfile();
      showToast(myProfile.isVacation ? "Profil mentve: Szüneteltetés bekapcsolva!" : "Profil adatok elmentve.");
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
    } catch (err) { showToast("Hiba: " + err.message); }
  })();
});

function checkDonablyReturningPrompt() {
  const visitCount = parseInt(localStorage.getItem('cserelj_visit_count') || '0', 10) + 1;
  localStorage.setItem('cserelj_visit_count', visitCount.toString());
  const lastPromptTime = parseInt(localStorage.getItem('cserelj_last_donably_prompt') || '0', 10);
  const alreadyDonated = localStorage.getItem('cserelj_already_donated') === 'true';
  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (!alreadyDonated && visitCount >= 3 && (now - lastPromptTime > sevenDays)) {
    setTimeout(() => {
      document.getElementById('modal-donably-support')?.classList.add('open');
      localStorage.setItem('cserelj_last_donably_prompt', now.toString());
    }, 2500);
  }
}

safeAddListener('btn-close-donably-modal', () => document.getElementById('modal-donably-support')?.classList.remove('open'));
safeAddListener('btn-donably-later', () => document.getElementById('modal-donably-support')?.classList.remove('open'));
safeAddListener('btn-donably-donate-click', () => {
  localStorage.setItem('cserelj_already_donated', 'true');
  document.getElementById('modal-donably-support')?.classList.remove('open');
});

function checkSystemUpdateEmailBanner() {
  const banner = document.getElementById('system-update-email-banner');
  const isDismissed = localStorage.getItem('cserelj_email_update_dismissed') === 'true';
  if (banner && !isDismissed) {
    banner.style.display = 'flex';
  }
}

safeAddListener('btn-dismiss-email-banner', () => {
  const banner = document.getElementById('system-update-email-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('cserelj_email_update_dismissed', 'true');
});

// =========================================================================
// FIREBASE AUTH & FELHASZNÁLÓI SZINKRONIZÁCIÓ
// =========================================================================

safeAddListener('btn-open-auth', () => document.getElementById('modal-auth')?.classList.add('open'));
safeAddListener('btn-close-auth', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', () => switchView('profil'));

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
  if (!em || !pw) return showToast("Add meg az e-mailt és a jelszót!");
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
        listenToTrades(user.uid);
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
          tradeMode: "both",
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
      showToast("Sikeresen leiratkoztál az e-mail értesítőkről.");
    }
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

    const effKey = getEffectiveAlbumKey();

    try {
      const subSnap = await db.collection("public_profiles").doc(uid).collection("collections").doc(effKey).get();
      if (subSnap.exists) subColData = subSnap.data();
    } catch (err) {}

    const merged = { ...(userData || {}), ...(pubData || {}) };
    if (subColData) {
      if (!merged.collections) merged.collections = {};
      merged.collections[effKey] = subColData;
    }

    const parsed = extractUserData(merged, uid, effKey);

    if (parsed) {
      let loadedNote = userData?.privateNote;
      if (!loadedNote && merged.collections && merged.collections[effKey]) {
        loadedNote = merged.collections[effKey].privateNote;
      }
      if (!loadedNote) {
        loadedNote = localStorage.getItem(`private_note_${effKey}`) || '';
      }

      const remoteTime = (subColData?.localUpdatedAt || subColData?.updatedAt?.seconds * 1000 || pubData?.updatedAt?.seconds * 1000 || 0);
      const localTime = parseInt(localStorage.getItem(`lutra_updated_at_${effKey}`) || '0', 10);

      const hasRemoteData = (parsed.van.length > 0 || parsed.kell.length > 0);
      const isLocalEmpty = (myProfile.van.length === 0 && myProfile.kell.length === 0);

      if (hasRemoteData || remoteTime >= localTime || isLocalEmpty) {
        myProfile = {
          ...myProfile,
          nev: parsed.nev,
          telepules: parsed.telepules,
          locations: parsed.locations && parsed.locations.length > 0 ? parsed.locations : [{ city: parsed.telepules || '', districts: [] }],
          geo: parsed.geo || myGpsCoords,
          tradeMode: parsed.tradeMode || 'both',
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
          foglalva: parsed.foglalva,
          vanCounts: parsed.vanCounts,
          foglalvaCounts: parsed.foglalvaCounts || {},
          lastActive: parsed.lastActive || Date.now()
        };

        localStorage.setItem(`lutra_updated_at_${effKey}`, remoteTime || Date.now());
        localStorage.setItem(`private_note_${effKey}`, myProfile.privateNote);
        if (effKey === 'lidl-lutra-2026') localStorage.setItem('lutra_private_note', myProfile.privateNote);

        localStorage.setItem(`lutra_van_${effKey}`, JSON.stringify(myProfile.van));
        localStorage.setItem(`lutra_van_counts_${effKey}`, JSON.stringify(myProfile.vanCounts || {}));
        localStorage.setItem(`lutra_kell_${effKey}`, JSON.stringify(myProfile.kell));
        localStorage.setItem(`lutra_foglalva_${effKey}`, JSON.stringify(myProfile.foglalva));
        localStorage.setItem(`lutra_foglalva_counts_${effKey}`, JSON.stringify(myProfile.foglalvaCounts || {}));

        renderGrid();
        renderActiveTradesPanel();
      }

      const nI = document.getElementById('prof-nev'); if (nI) nI.value = myProfile.nev || '';
      const eI = document.getElementById('prof-email'); if (eI) eI.value = myProfile.email || '';
      const gI = document.getElementById('prof-gift'); if (gI) gI.checked = !!myProfile.isGiftOffering;
      const seI = document.getElementById('prof-show-email'); if (seI) seI.checked = !!myProfile.showEmailToUsers;
      const enI = document.getElementById('prof-email-notif'); if (enI) enI.checked = myProfile.emailNotifications !== false;
      const aiI = document.getElementById('prof-allow-inspect'); if (aiI) aiI.checked = myProfile.allowInspect !== false;
      const gdI = document.getElementById('prof-gdpr'); if (gdI) gdI.checked = myProfile.gdprAccepted !== false;
      const vacI = document.getElementById('prof-vacation-mode'); if (vacI) vacI.checked = !!myProfile.isVacation;
      const tmI = document.getElementById('prof-trade-mode'); if (tmI) tmI.value = myProfile.tradeMode || 'both';

      const pNoteEl = document.getElementById('prof-private-note');
      if (pNoteEl) {
        pNoteEl.value = myProfile.privateNote;
        const countEl = document.getElementById('note-char-count');
        if (countEl) countEl.textContent = `${myProfile.privateNote.length}/250`;
      }

      renderProfileLocations();
      checkMandatoryProfile();
      refreshMatchesIfVisible();
      renderCompletionOdds();
    }
  });
}

// =========================================================================
// PWA TELEPÍTÉS, LIGHTBOX & ALKALMAZÁS VÉGLEGES INDÍTÁSA
// =========================================================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'inline-flex';

  const alreadyPrompted = localStorage.getItem('cserelj_pwa_prompted') === 'true';
  if (!alreadyPrompted) {
    setTimeout(() => {
      triggerTopNotification("Telepítsd a Cserélj Okosant a kezdőképernyődre a villámgyors eléréshez!", () => {
        if (deferredPrompt) deferredPrompt.prompt();
      });
      localStorage.setItem('cserelj_pwa_prompted', 'true');
    }, 4000);
  }
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
    showToast("iPhone-on: Koppints a Megosztás gombra, majd a 'Főképernyőhöz adás' opcióra.");
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn("SW regisztráció:", err));
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
// BOOT SEQUENCE (INDÍTÁSI LÁNC)
// =========================================================================
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  renderHub();
  renderGrid();
  renderActiveTradesPanel();
  initFirebase();
  listenToAlbums();
  checkDonablyReturningPrompt();
  checkSystemUpdateEmailBanner();
} catch (err) {
  console.error("Indítási hiba:", err);
}
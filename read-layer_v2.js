/* =========================================================================
   read-layer_v2.js – Firestore-olvasáscsökkentő réteg a Cserélj Okosan app.js-hez
   BETÖLTÉS: az app.js UTÁN, ugyanabban a HTML-ben:
       <script src="app.js"></script>
       <script src="read-layer_v2.js"></script>
   Az app.js-hez nem kell hozzányúlni. Ha gond van, a második script-sor törlésével
   az app visszaáll a régi működésre.

   Mit csinál:
   1) public_profiles: az egész gyűjtemény élő figyelése (onSnapshot) helyett
      - helyi gyorsítótár (localStorage: cs_partners_v3), 30 perc érvényességgel,
      - lusta betöltés: csak a Cserék / Kereső / Statisztika nézetnél kér adatot a szerverről,
      - a lejárat után csak a megváltozott profilokat kéri le (updatedAt alapú delta),
      - 14 naponta teljes újratöltés (törölt profilok, értékelések miatt),
      - a Frissítés gombok (Párosítások, Statisztika) azonnali lekérést indítanak (60 mp várakozással).
   2) Radar és találkozók: az élő figyelés csak addig fut, amíg a nézet nyitva van.
   3) Album váltásakor a partnerek listája újraszámolódik (nincs extra olvasás).
   4) Mélylink: a /?album=<azonosító> cím közvetlenül megnyitja az adott gyűjteményt
      (a landing oldalak gombjai ezt használják).
   5) Konzol: csReadStats() mutatja a rétegen keresztüli olvasások számát.
   ========================================================================= */
(function () {
  'use strict';

  var KEY = 'cs_partners_v3';
  var TTL_MS = 30 * 60 * 1000;
  var FULL_MS = 14 * 24 * 3600 * 1000;
  var DELTA_MARGIN_MS = 2 * 60 * 1000;
  var FORCE_COOLDOWN_MS = 60 * 1000;
  var LAZY_VIEWS = { cserek: 1, kereso: 1, statisztika: 1 };

  var store = null;        // { ts, full, maxU, docs: {id: data} }
  var loading = null;      // folyamatban lévő lekérés
  var lastForce = 0;
  var stats = { reads: 0, fetches: 0, full: 0, delta: 0 };

  function g(name) { try { return (0, eval)(name); } catch (e) { return undefined; } }
  function toast(m) { if (typeof showToast === 'function') showToast(m); }

  // ---------- szerializálás (Timestamp <-> {__t: ms}) ----------
  function ser(v) {
    if (v && typeof v === 'object') {
      if (typeof v.toMillis === 'function') return { __t: v.toMillis() };
      if (Array.isArray(v)) return v.map(ser);
      var o = {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = ser(v[k]);
      return o;
    }
    return v;
  }
  function deser(v) {
    if (v && typeof v === 'object') {
      if (typeof v.__t === 'number' && Object.keys(v).length === 1) {
        return (window.firebase && firebase.firestore && firebase.firestore.Timestamp)
          ? firebase.firestore.Timestamp.fromMillis(v.__t) : v.__t;
      }
      if (Array.isArray(v)) return v.map(deser);
      var o = {};
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = deser(v[k]);
      return o;
    }
    return v;
  }
  function slim(d) {
    var c = {};
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) c[k] = d[k];
    // más felhasználók e-mail címe nem kerül a helyi tárolóba, csak ha a tulajdonos engedte
    if (c.showEmailToUsers !== true) delete c.email;
    return c;
  }
  function ms(t) {
    if (!t) return 0;
    if (typeof t === 'number') return t;
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (t.seconds) return t.seconds * 1000;
    return 0;
  }

  function load() {
    if (store) return store;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && p.docs) { store = { ts: p.ts || 0, full: p.full || 0, maxU: p.maxU || 0, docs: deser(p.docs) }; return store; }
      }
    } catch (e) { /* sérült cache: újra letöltjük */ }
    store = { ts: 0, full: 0, maxU: 0, docs: {} };
    return store;
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ts: store.ts, full: store.full, maxU: store.maxU, docs: ser(store.docs) }));
    } catch (e) { /* tele a tároló: csak memóriában marad */ }
  }

  // ---------- az app globális állapotának feltöltése ----------
  function rebuild() {
    var s = load();
    var ids = Object.keys(s.docs);
    var raw = ids.map(function (id) { var d = s.docs[id]; return { id: id, exists: true, data: function () { return d; } }; });
    var list = [];
    var album = (typeof currentAlbumId !== 'undefined') ? currentAlbumId : undefined;
    raw.forEach(function (doc) {
      var u = null;
      try { u = extractUserData(doc.data(), doc.id, album); } catch (e) { u = null; }
      if (!u) return;
      if ((u.van || []).length === 0 && (u.kell || []).length === 0) return;
      list.push(u);
    });
    try { rawAllUsersDocs = raw; allUsersData = list; }  // eslint-disable-line no-undef
    catch (e) { window.rawAllUsersDocs = raw; window.allUsersData = list; }
  }
  function rerender() {
    ['renderMatches', 'renderStatistics', 'renderProximityPartners', 'renderHub'].forEach(function (fn) {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (e) { console.warn('read-layer render:', fn, e); }
    });
  }

  // ---------- lekérés ----------
  function fetchFull() {
    stats.full++;
    return db.collection('public_profiles').get().then(function (snap) {
      stats.reads += snap.size;
      var docs = {}, maxU = 0;
      snap.forEach(function (d) {
        var data = d.data();
        docs[d.id] = slim(data);
        var u = ms(data.updatedAt); if (u > maxU) maxU = u;
      });
      store = { ts: Date.now(), full: Date.now(), maxU: maxU, docs: docs };
    });
  }
  function fetchDelta() {
    stats.delta++;
    var since = firebase.firestore.Timestamp.fromMillis(Math.max(0, store.maxU - DELTA_MARGIN_MS));
    return db.collection('public_profiles').where('updatedAt', '>', since).get().then(function (snap) {
      stats.reads += snap.size;
      snap.forEach(function (d) {
        var data = d.data();
        store.docs[d.id] = slim(data);
        var u = ms(data.updatedAt); if (u > store.maxU) store.maxU = u;
      });
      store.ts = Date.now();
    });
  }

  // opts.force: azonnali frissítés (gomb); opts.full: teljes újratöltés
  function ensurePartnersLoaded(opts) {
    opts = opts || {};
    if (typeof db === 'undefined' || !db) return Promise.resolve();
    var s = load();
    var now = Date.now();
    var fresh = s.ts && (now - s.ts) < TTL_MS;
    if (fresh && !opts.force && !opts.full) return Promise.resolve();
    if (opts.force && (now - lastForce) < FORCE_COOLDOWN_MS && !opts.full) {
      toast('Az adatok épp most frissültek.');
      return Promise.resolve();
    }
    if (loading) return loading;
    if (opts.force) lastForce = now;

    var needFull = opts.full || !s.ts || !s.maxU || (now - s.full) > FULL_MS;
    stats.fetches++;
    loading = (needFull ? fetchFull() : fetchDelta().catch(function () { return fetchFull(); }))
      .then(function () { save(); rebuild(); rerender(); })
      .catch(function (e) { console.warn('Partnerek betöltése:', e); })
      .then(function () { loading = null; });
    return loading;
  }

  // egyetlen profil friss lekérése (adatlap megnyitása / üzenetküldés előtt)
  var lastSingle = {};
  function refreshPartner(uid) {
    if (!uid || typeof db === 'undefined' || !db) return Promise.resolve();
    var now = Date.now();
    if (lastSingle[uid] && now - lastSingle[uid] < FORCE_COOLDOWN_MS) return Promise.resolve();
    lastSingle[uid] = now;
    return db.collection('public_profiles').doc(uid).get().then(function (d) {
      stats.reads += 1;
      var s = load();
      if (d.exists) s.docs[uid] = slim(d.data()); else delete s.docs[uid];
      save(); rebuild();
    }).catch(function () { /* hálózati hiba: marad a cache */ });
  }

  // ---------- az app függvényeinek felülírása ----------
  // 1) az egész gyűjtemény élő figyelése helyett: cache betöltése, lekérés csak szükség esetén
  window.listenToAllUsers = function () {
    load();
    if (Object.keys(store.docs).length) { rebuild(); rerender(); }
  };

  // 2) radar és találkozók: élő figyelés csak a nézet nyitva tartása alatt
  var origRadar = window.listenToRadarReports;
  var origMeetups = window.listenToMeetups;
  window.listenToRadarReports = function () { /* indításkor nem figyelünk */ };
  window.listenToMeetups = function () { /* indításkor nem figyelünk */ };

  function detach(unsubName, flagReset) {
    try {
      var u = g(unsubName);
      if (typeof u === 'function') u();
      if (flagReset) flagReset();
    } catch (e) { /* nincs figyelő */ }
  }

  var origSwitch = window.switchView;
  window.switchView = function (viewName) {
    var r = origSwitch.apply(this, arguments);
    try {
      if (LAZY_VIEWS[viewName]) ensurePartnersLoaded();

      if (viewName === 'radar') {
        if (typeof origRadar === 'function' && !g('radarUnsubscribe')) origRadar();
      } else {
        detach('radarUnsubscribe', function () { radarUnsubscribe = null; });  // eslint-disable-line no-undef
      }
      if (viewName === 'meetups') {
        if (typeof origMeetups === 'function' && !g('meetupsUnsubscribe')) origMeetups();
      } else {
        detach('meetupsUnsubscribe', function () { meetupsUnsubscribe = null; });  // eslint-disable-line no-undef
      }
    } catch (e) { console.warn('read-layer switchView:', e); }
    return r;
  };

  // 3) album váltás: a partnerek újraszámolása a már meglévő adatból
  var origSelect = window.selectAlbum;
  if (typeof origSelect === 'function') {
    window.selectAlbum = function () {
      var r = origSelect.apply(this, arguments);
      try { rebuild(); } catch (e) { /* még nincs adat */ }
      return r;
    };
  }

  // 4) adatlap megnyitása és kapcsolatfelvétel előtt az adott profil friss lekérése
  var origProfile = window.openUserProfileModal;
  if (typeof origProfile === 'function') {
    window.openUserProfileModal = function (uid) {
      var self = this, args = arguments;
      return refreshPartner(uid).then(function () { return origProfile.apply(self, args); });
    };
  }
  var origContact = window.openContactModal;
  if (typeof origContact === 'function') {
    window.openContactModal = function (targetUser) {
      var self = this, args = arguments;
      if (!targetUser || !targetUser.id) return origContact.apply(self, args);
      var uid = targetUser.id;
      return refreshPartner(uid).then(function () {
        var fresh = (typeof allUsersData !== 'undefined') ? allUsersData.find(function (u) { return u.id === uid; }) : null;
        var a = Array.prototype.slice.call(args);
        if (fresh) a[0] = fresh;
        return origContact.apply(self, a);
      });
    };
  }

  // 5) Frissítés gombok
  function bindRefresh(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function () { ensurePartnersLoaded({ force: true }); });
  }
  bindRefresh('btn-refresh-matches');
  bindRefresh('btn-refresh-stats');

  // 6) mélylink: ?album=<id>
  (function deepLink() {
    var id = null;
    try { id = new URLSearchParams(location.search).get('album'); } catch (e) { /* nincs */ }
    if (!id || !/^[a-z0-9-]{1,120}$/i.test(id)) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var reg = (typeof ALBUMS_REGISTRY !== 'undefined') ? ALBUMS_REGISTRY : null;
      if (reg && reg[id] && typeof window.selectAlbum === 'function') {
        clearInterval(timer);
        try { window.selectAlbum(id); } catch (e) { console.warn('mélylink:', e); }
        try { history.replaceState(null, '', location.pathname); } catch (e) { /* semmi */ }
      } else if (tries > 40) {   // ~16 mp után feladjuk
        clearInterval(timer);
      }
    }, 400);
  })();

  // ---------- konzolos segédek ----------
  window.csReadStats = function () { console.table(stats); return stats; };
  window.csPartnersRefresh = function (full) { return ensurePartnersLoaded({ force: true, full: !!full }); };
  window.csPartnersReset = function () { try { localStorage.removeItem(KEY); } catch (e) { /* semmi */ } store = null; };
})();

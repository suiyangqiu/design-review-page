// Local stand-in for window.claude (db + user), store in sessionStorage.
// Identity: sessionStorage.mockme (u_reviewer by default). Read-only: sessionStorage.mockro = "1".
(function () {
  var KEY = "mockstore";
  var ME = sessionStorage.getItem("mockme") || "u_reviewer";
  var PEOPLE = { u_reviewer: "Riley Chen", u_owner: "Sam Patel", u_viewer: "Alex Nguyen" };
  var COLORS = { u_reviewer: "#8a3ffc", u_owner: "#1c3a5b", u_viewer: "#2f9a45" };
  function avatar(id) {
    var n = PEOPLE[id] || "?";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="' + (COLORS[id] || "#888") + '"/><text x="16" y="21" font-size="14" text-anchor="middle" fill="#fff" font-family="sans-serif">' + n.charAt(0) + "</text></svg>";
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(s) { sessionStorage.setItem(KEY, JSON.stringify(s)); }
  // Listeners keep their query's order and limit, as the real store does: an ordered, limited query
  // delivers only the documents inside its window. mockhang = "1": the store never answers.
  var listeners = [];
  function emit() {
    var s = load();
    var all = Object.keys(s).map(function (id) {
      var body = Object.freeze(Object.assign({}, s[id]));
      return { id: id, exists: true, data: function () { return body; } };
    }).sort(function (a, b) { return (a.data().createdAt || "") < (b.data().createdAt || "") ? -1 : 1; });
    listeners.forEach(function (l) {
      var docs = l.dir === "desc" ? all.slice().reverse() : all.slice();
      if (l.limit) docs = docs.slice(0, l.limit);
      setTimeout(function () { l.cb({ docs: docs, metadata: { fromCache: false, hasPendingWrites: false } }); }, 0);
    });
  }
  function newId() { return "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  // mocklostack = "1": the first create is stored but its answer is lost (unavailable), as when the
  // network drops the reply, so a retry must not store it twice.
  function docRef(id) {
    return {
      id: id,
      set: async function (d) {
        if (sessionStorage.getItem("mockro")) throw { code: "invalid_argument", message: "read only" };
        // mockfull = "1": the store is at its document cap, so creating a row fails.
        if (sessionStorage.getItem("mockfull") && !load()[id]) throw { code: "quota_exceeded", message: "documents in the collection" };
        var s = load(); s[id] = JSON.parse(JSON.stringify(d)); save(s); emit();
        if (sessionStorage.getItem("mocklostack") && !window.__lostOnce) { window.__lostOnce = true; throw { code: "unavailable" }; }
      },
      update: async function (d) { var s = load(); if (!s[id]) throw { code: "invalid_argument" }; Object.assign(s[id], d); save(s); emit(); },
      delete: async function () { var s = load(); delete s[id]; save(s); emit(); }
    };
  }
  function query() {
    var spec = { dir: "asc", limit: 0 };
    var q = {
      orderBy: function (field, dir) { spec.dir = dir === "desc" ? "desc" : "asc"; return q; },
      limit: function (n) { spec.limit = n; return q; },
      onSnapshot: function (cb) {
        if (sessionStorage.getItem("mockhang")) return function () {};
        listeners.push({ cb: cb, dir: spec.dir, limit: spec.limit }); emit(); return function () {};
      },
      doc: function (id) { return docRef(id || newId()); },
      add: async function (data) { var ref = docRef(newId()); await ref.set(data); return ref; }
    };
    return q;
  }
  var db = {
    collection: function () { return query(); },
    doc: function (path) { return docRef(path.split("/")[1]); }
  };
  function prof(id) { return { id: id, name: PEOPLE[id] || "", avatarUrl: avatar(id), isMe: id === ME }; }
  var user = {
    id: async function () { return ME; },
    can: async function () { return sessionStorage.getItem("mockro") ? false : true; },
    me: async function () { return prof(ME); },
    // mockslow = delay in ms before names come back; mockflaky = "1": the first answer for each id has name "".
    profiles: async function (ids) {
      window.__profileCalls = (window.__profileCalls || 0) + 1;
      var slow = Number(sessionStorage.getItem("mockslow") || 0);
      if (slow) await new Promise(function (r) { setTimeout(r, slow); });
      window.__asked = window.__asked || {};
      var o = {};
      ids.forEach(function (i) {
        var p = prof(i);
        if (sessionStorage.getItem("mockflaky") && !window.__asked[i]) p.name = "";
        window.__asked[i] = true;
        o[i] = p;
      });
      return o;
    }
  };
  window.claude = { use: async function (n) { return n === "db" ? db : n === "user" ? user : null; } };
})();

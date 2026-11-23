// 測試用的假 Firebase：資料只存在這個分頁的記憶體裡，不會連到真的資料庫。
// 測試可以先把資料放進 window.__SEED（格式：{ "rooms/暗號/集合": { 文件id: {...} } }）。
(function () {
  const store = window.__SEED || {};
  const subs = {};
  const snap = (path) => {
    const docs = Object.entries(store[path] || {}).map(([id, d]) => ({ id, data: () => d, exists: true }));
    return { docs, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const fire = (path) => (subs[path] || []).forEach((f) => f());
  function q(path, o = { w: [] }) {
    const run = () => {
      let d = snap(path).docs;
      for (const [k, op, v] of o.w)
        d = d.filter((x) => {
          const a = (x.data() || {})[k];
          return op === ">=" ? a >= v : op === "<=" ? a <= v : op === "==" ? a === v : true;
        });
      if (o.ob)
        d = [...d].sort((x, y) => {
          const a = String((x.data() || {})[o.ob]),
            b = String((y.data() || {})[o.ob]);
          return o.dir === "desc" ? b.localeCompare(a) : a.localeCompare(b);
        });
      if (o.lim) d = d.slice(0, o.lim);
      return {
        docs: d,
        metadata: { fromCache: false, hasPendingWrites: false },
        docChanges: () => d.map((x) => ({ type: "added", doc: x })),
      };
    };
    return {
      where: (k, op, v) => q(path, { ...o, w: [...o.w, [k, op, v]] }),
      orderBy: (k, dir) => q(path, { ...o, ob: k, dir }),
      limit: (n) => q(path, { ...o, lim: n }),
      get: () => Promise.resolve(run()),
      onSnapshot(a, b) {
        const fn = typeof a === "function" ? a : b;
        const g = () => fn(run());
        (subs[path] = subs[path] || []).push(g);
        setTimeout(g, 0);
        return () => {};
      },
    };
  }
  function col(path) {
    return Object.assign(q(path), {
      doc(id) {
        id = id || Math.random().toString(36).slice(2);
        const all = () => (store[path] = store[path] || {});
        return {
          id,
          set(d, o) {
            all()[id] = o && o.merge ? { ...all()[id], ...d } : d;
            fire(path);
            return Promise.resolve();
          },
          update(d) {
            all()[id] = { ...all()[id], ...d };
            fire(path);
            return Promise.resolve();
          },
          get: () => Promise.resolve({ exists: !!all()[id], id, data: () => all()[id] }),
          delete() {
            delete all()[id];
            fire(path);
            return Promise.resolve();
          },
          collection: (c) => col(path + "/" + id + "/" + c),
          onSnapshot(a, b) {
            const fn = typeof a === "function" ? a : b;
            setTimeout(() => fn({ exists: !!all()[id], data: () => all()[id] }), 0);
            return () => {};
          },
        };
      },
    });
  }
  window.__store = store;
  const fs = () => ({ collection: col, enablePersistence: () => Promise.resolve(), settings() {} });
  fs.FieldValue = { serverTimestamp: () => new Date().toISOString(), delete: () => null };
  window.firebase = { initializeApp() {}, firestore: fs };
})();

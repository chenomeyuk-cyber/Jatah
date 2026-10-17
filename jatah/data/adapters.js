// Adapter penyimpanan: {all(store), put(store, obj)}. IndexedDB untuk browser, memori untuk tes.
export function memoryAdapter() {
  const d = { wallets: new Map(), txs: new Map(), settings: new Map() };
  return { all: async s => [...d[s].values()].map(o => structuredClone(o)), put: async (s, o) => { d[s].set(o.id, structuredClone(o)); } };
}
export function idbAdapter(name = 'jatah') {
  const open = new Promise((ok, no) => {
    const q = indexedDB.open(name, 1);
    q.onupgradeneeded = () => ['wallets', 'txs', 'settings'].forEach(s => q.result.createObjectStore(s, { keyPath: 'id' }));
    q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error);
  });
  const run = (s, mode, f) => open.then(db => new Promise((ok, no) => { const r = f(db.transaction(s, mode).objectStore(s)); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
  return { all: s => run(s, 'readonly', o => o.getAll()), put: (s, o) => run(s, 'readwrite', t => t.put(o)) };
}

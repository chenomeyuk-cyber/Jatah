import { newTx, edit, remove, balance } from '../core/ledger.js';
import { walletStats } from '../core/budget.js';
export const SCHEMA = 1;
const MIGRATIONS = []; // MIGRATIONS[n] mengubah settings dari skema n ke n+1
const DEFAULT_WALLETS = [
  { id: 'makan', name: 'Uang makan', currency: 'MYR', kind: 'budget', rule: { budget: 80000, startDay: 1, reservePct: 5, carryMode: 'hangus' } },
  { id: 'gaji', name: 'Gaji', currency: 'IDR', kind: 'pool' },
  { id: 'darurat', name: 'Dana darurat', currency: 'MYR', kind: 'pool' },
  { id: 'tabungan', name: 'Tabungan', currency: 'IDR', kind: 'goal' },
];
const DEFAULT_SETTINGS = { id: 'main', schemaVersion: SCHEMA, kurs: 3800, minFood: 1500, salaryIDR: 0, capIDR: 0 };
export async function createStore(adapter, now = () => Date.now()) {
  let wallets = {}, txs = [], settings; const subs = new Set(), emit = () => subs.forEach(f => f());
  for (const w of await adapter.all('wallets')) wallets[w.id] = w;
  for (const w of DEFAULT_WALLETS) if (!wallets[w.id]) { wallets[w.id] = w; await adapter.put('wallets', w); }
  settings = (await adapter.all('settings'))[0] || { ...DEFAULT_SETTINGS };
  while (settings.schemaVersion < SCHEMA) settings = { ...MIGRATIONS[settings.schemaVersion](settings), schemaVersion: settings.schemaVersion + 1 };
  await adapter.put('settings', settings);
  txs = await adapter.all('txs');
  const save = async t => { const i = txs.findIndex(x => x.id === t.id); i < 0 ? txs.push(t) : (txs[i] = t); await adapter.put('txs', t); emit(); return t; };
  return {
    wallets: () => Object.fromEntries(Object.entries(wallets).filter(([, w]) => !w.deleted)), txs: () => txs.filter(t => !t.deleted), settings: () => settings, subscribe: f => (subs.add(f), () => subs.delete(f)),
    add: f => save(newTx(f, wallets, now())),
    edit: (id, patch) => save(edit(txs.find(t => t.id === id), patch, now())),
    remove: id => save(remove(txs.find(t => t.id === id), now())),
    undelete: id => save({ ...txs.find(t => t.id === id), deleted: false, updatedAt: now() }),
    balance: id => balance(id, txs),
    stats: (id, at = new Date(now())) => walletStats(wallets[id], txs, at),
    exportAll: () => ({ v: SCHEMA, wallets: Object.values(wallets), txs, settings }),
    async importAll(d) {
      if (!d || !Array.isArray(d.txs) || !Array.isArray(d.wallets)) throw new Error('Format backup tidak valid');
      for (const w of d.wallets) { wallets[w.id] = w; await adapter.put('wallets', w); }
      for (const t of d.txs) await save(t);
      if (d.settings) { settings = { ...settings, ...d.settings, id: 'main' }; await adapter.put('settings', settings); }
      emit();
    },
    async addWallet(w) { if (wallets[w.id]) throw new Error('Dompet sudah ada'); wallets[w.id] = w; await adapter.put('wallets', w); emit(); return w; },
    async removeWallet(id) {
      const wallet = wallets[id];
      if (!wallet || wallet.kind !== 'goal' || wallet.deleted) throw new Error('Target tabungan tidak ditemukan');
      for (const tx of txs.filter(t => !t.deleted && (t.walletId === id || t.toWalletId === id))) {
        await save(remove(tx, now()));
      }
      wallets[id] = { ...wallet, deleted: true };
      await adapter.put('wallets', wallets[id]); emit();
    },
    async setSettings(p) { settings = { ...settings, ...p }; await adapter.put('settings', settings); emit(); },
    async setRule(id, p) { wallets[id] = { ...wallets[id], rule: { ...wallets[id].rule, ...p } }; await adapter.put('wallets', wallets[id]); emit(); },
  };
}
import test from 'node:test'; import assert from 'node:assert/strict';
import { advise, walletStats } from '../core/index.js'; import { createStore } from '../data/store.js'; import { memoryAdapter } from '../data/adapters.js';
const now = new Date(2026, 9, 15, 12);
const W = { id: 'makan', rule: { budget: 80000, startDay: 1, reservePct: 5, carryMode: 'hangus' } };
const food = walletStats(W, [], now), base = { food, minFood: 1500, rate: 3800 };
test('Mau Beli: aman untuk pembelian kecil dari uang makan', () => {
  const a = advise({ ...base, price: 2000 }); assert.equal(a.level, 0); assert.equal(a.avgBefore, 4470); assert.equal(a.avgAfter, 4352); assert.ok(Math.abs(a.dayEq - 0.775) < 1e-3); assert.equal(a.rpEq, 76000);
});
test('Mau Beli: tunda jika rata-rata harian jatuh di bawah batas aman', () => { const a = advise({ ...base, price: 60000 }); assert.equal(a.level, 2); assert.ok(a.belowMin); });
test('Mau Beli: pikir dulu jika dari gaji >= 0.25 bulan gaji; tunda jika lewat batas belanja', () => {
  assert.equal(advise({ ...base, price: 100000, source: 'gaji', salaryIDR: 8e6 }).level, 1);
  assert.equal(advise({ ...base, price: 30000, source: 'gaji', salaryIDR: 8e6, capIDR: 1e6 }).level, 2);
  assert.equal(advise({ ...base, price: 5000, source: 'gaji', salaryIDR: 8e6 }).level, 0);
});
test('Mau Beli: dana darurat dan campur', () => {
  assert.equal(advise({ ...base, price: 5000, source: 'darurat', reserveLeft: 4000 }).level, 2); assert.equal(advise({ ...base, price: 3000, source: 'darurat', reserveLeft: 4000 }).level, 1);
  const c = advise({ ...base, price: 10000, source: 'campur', mix: 0.5 }); assert.equal(c.pm, 5000); assert.equal(c.pg, 5000);
});
test('store: seed dompet, simpan, edit, hapus, muat ulang dari adapter', async () => {
  const ad = memoryAdapter(); let t = +now; let s = await createStore(ad, () => t);
  assert.deepEqual(Object.keys(s.wallets()), ['makan', 'gaji', 'darurat','tabungan']);
  const x = await s.add({ type: 'expense', walletId: 'makan', amount: 900, category: 'makan' }); await s.add({ type: 'income', walletId: 'gaji', amount: 8e6 });
  assert.equal(s.balance('makan'), -900); assert.equal(s.balance('gaji'), 8e6);
  await s.edit(x.id, { amount: 1000 }); assert.equal(s.balance('makan'), -1000);
  const s2 = await createStore(ad, () => t); assert.equal(s2.txs().length, 2); assert.equal(s2.balance('makan'), -1000);
  await s2.remove(x.id); assert.equal(s2.balance('makan'), 0); await s2.undelete(x.id); assert.equal(s2.balance('makan'), -1000);
});
test('store: stats, pengaturan, dan aturan tersimpan', async () => {
  const ad = memoryAdapter(), s = await createStore(ad, () => +now); await s.add({ type: 'expense', walletId: 'makan', amount: 1000 });
  assert.equal(s.stats('makan').today, 1000); await s.setSettings({ kurs: 3900 }); await s.setRule('makan', { carryMode: 'terbawa' });
  const s2 = await createStore(ad, () => +now); assert.equal(s2.settings().kurs, 3900); assert.equal(s2.wallets().makan.rule.carryMode, 'terbawa'); assert.equal(s2.wallets().makan.rule.budget, 80000);
});
test('store: ekspor lalu impor ke store kosong', async () => {
  const a = await createStore(memoryAdapter(), () => +now);
  await a.add({ type: 'expense', walletId: 'makan', amount: 700 });
  await a.setSettings({ kurs: 4000 });
  const b = await createStore(memoryAdapter(), () => +now);
  await b.importAll(JSON.parse(JSON.stringify(a.exportAll())));
  assert.equal(b.balance('makan'), -700);
  assert.equal(b.settings().kurs, 4000);
  await assert.rejects(() => b.importAll({}));
});
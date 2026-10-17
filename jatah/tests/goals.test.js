import test from 'node:test'; import assert from 'node:assert/strict';
import { monthsLeft, goalPlan } from '../core/index.js'; import { createStore } from '../data/store.js'; import { memoryAdapter } from '../data/adapters.js';
const now = new Date(2026, 9, 15, 12);
test('bulan tersisa', () => {
  assert.equal(monthsLeft(now, '2027-10-15'), 12); assert.equal(monthsLeft(now, '2027-10-14'), 11);
  assert.equal(monthsLeft(now, '2026-11-01'), 1); assert.equal(monthsLeft(now, '2026-10-15'), 0); assert.equal(monthsLeft(now, '2026-10-01'), 0);
});
test('rencana target: perlu berapa per siklus', () => {
  const p = goalPlan({ target: 50e6, saved: 5e6, deadline: '2027-10-15', now, rate: 3800 });
  assert.equal(p.state, 'jalan'); assert.equal(p.need, 45e6); assert.equal(p.perCycle, 3750000); assert.equal(p.perCycleMYR, 98684); assert.ok(Math.abs(p.pct - 0.1) < 1e-9);
  assert.equal(goalPlan({ target: 10, saved: 10, deadline: '2027-01-01', now }).state, 'tercapai');
  assert.equal(goalPlan({ target: 10e6, saved: 1e6, deadline: '2026-01-01', now }).state, 'lewat');
  assert.equal(goalPlan({ saved: 5, now }).state, 'bebas');
  assert.equal(goalPlan({ target: 10e6, saved: 4e6, deadline: '2026-11-20', now }).perCycle, 6e6);
});
test('store: dompet bawaan baru ditambahkan ke data lama; target sebagai dompet; setor = transfer', async () => {
  const ad = memoryAdapter(); await ad.put('wallets', { id: 'makan', name: 'Uang makan', currency: 'MYR', kind: 'budget', rule: { budget: 80000, startDay: 1, reservePct: 5, carryMode: 'hangus' } });
  await ad.put('wallets', { id: 'gaji', name: 'Gaji', currency: 'IDR', kind: 'pool' });
  const s = await createStore(ad, () => +now); assert.ok(s.wallets().tabungan && s.wallets().darurat);
  await s.addWallet({ id: 'gnikah', name: 'Dana nikah', currency: 'IDR', kind: 'goal', goal: { target: 50e6, deadline: '2027-10-15' } });
  await assert.rejects(() => s.addWallet({ id: 'gnikah', name: 'x', currency: 'IDR' }));
  await s.add({ type: 'income', walletId: 'gaji', amount: 8e6 }); await s.add({ type: 'transfer', walletId: 'gaji', toWalletId: 'gnikah', amount: 2e6 });
  assert.equal(s.balance('gaji'), 6e6); assert.equal(s.balance('gnikah'), 2e6);
  const s2 = await createStore(ad, () => +now); assert.equal(s2.wallets().gnikah.goal.target, 50e6); assert.equal(s2.balance('gnikah'), 2e6);
});
test('store: hapus target menghapus transfer terkait dan tetap terhapus setelah reload', async () => {
  const ad = memoryAdapter(), s = await createStore(ad, () => +now);
  await s.addWallet({ id: 'gtrip', name: 'Liburan', currency: 'IDR', kind: 'goal', goal: { target: 5e6, deadline: '2027-10-15' } });
  await s.add({ type: 'income', walletId: 'gaji', amount: 8e6 });
  await s.add({ type: 'transfer', walletId: 'gaji', toWalletId: 'gtrip', amount: 2e6 });
  await s.removeWallet('gtrip');
  assert.equal(s.wallets().gtrip, undefined);
  assert.equal(s.balance('gaji'), 8e6);
  assert.equal(s.txs().length, 1);

  const s2 = await createStore(ad, () => +now);
  assert.equal(s2.wallets().gtrip, undefined);
  assert.equal(s2.balance('gaji'), 8e6);
});
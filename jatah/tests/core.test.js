import test from 'node:test'; import assert from 'node:assert/strict';
import * as C from '../core/index.js';
const W = { makan: { id: 'makan', currency: 'MYR', rule: { budget: 80000, startDay: 1, reservePct: 5, carryMode: 'hangus' } },
  gaji: { id: 'gaji', currency: 'IDR' }, };
const ex = (amt, ts, o = {}) => C.newTx({ type: 'expense', walletId: 'makan', amount: amt, ts, ...o }, W, ts);
const now = new Date(2026, 9, 15, 12);

test('uang integer & format', () => { assert.equal(C.toMinor(12.34, 'MYR'), 1234); assert.equal(C.toMinor(0.1 + 0.2, 'MYR'), 30); assert.equal(C.fmt(-1234, 'MYR'), '−RM 12,34'); });
test('kurs disimpan per transaksi, kurs baru tak mengubah catatan lama', () => {
  const t = C.newTx({ type: 'transfer', walletId: 'gaji', toWalletId: 'makan', amount: 380000, fxRate: 1 / 3800 }, W);
  assert.equal(t.toAmount, 10000); const old = t.toAmount; assert.equal(C.convert(380000, 'IDR', 'MYR', 1 / 4000), 9500); assert.equal(t.toAmount, old);
  assert.throws(() => C.newTx({ type: 'transfer', walletId: 'gaji', toWalletId: 'makan', amount: 1 }, W));
});
test('saldo dihitung dari transaksi; transfer, hapus, adjust', () => {
  const tx = [C.newTx({ type: 'income', walletId: 'makan', amount: 80000 }, W), ex(1500, +now), C.newTx({ type: 'transfer', walletId: 'gaji', toWalletId: 'makan', amount: 380000, fxRate: 1 / 3800 }, W)];
  assert.equal(C.balance('makan', tx), 80000 - 1500 + 10000); assert.equal(C.balance('gaji', tx), -380000);
  tx[1] = C.remove(tx[1]); assert.equal(C.balance('makan', tx), 90000);
  tx.push(C.newTx({ type: 'adjust', walletId: 'makan', amount: -500 }, W)); assert.equal(C.balance('makan', tx), 89500);
});
test('validasi', () => { assert.throws(() => ex(12.5, 1)); assert.throws(() => ex(0, 1)); assert.throws(() => C.newTx({ type: 'expense', walletId: 'x', amount: 1 }, W)); });
test('siklus: tanggal 31 dipendekkan di bulan pendek, panjang siklus benar', () => {
  assert.equal(C.cycle(new Date(2026, 1, 28), 31).total, 31); // 28 Feb -> 31 Mar
  const a = C.cycle(new Date(2026, 2, 10), 31); assert.equal(a.st.getDate(), 28); assert.equal(a.st.getMonth(), 1);
  const b = C.cycle(new Date(2026, 9, 15), 1); assert.equal(b.total, 31); assert.equal(b.idx, 14); assert.equal(b.left, 17);
  assert.equal(C.cycle(new Date(2026, 9, 1), 1).idx, 0); assert.equal(C.cycle(new Date(2026, 9, 31, 23, 59), 1).left, 1);
  assert.equal(C.cycle(new Date(2026, 9, 14), 15).st.getMonth(), 8);
});
test('paritas v5 (mode hangus): RM800, buffer 5%, spent 300 + hari ini 10', () => {
  const txs = [ex(30000, +new Date(2026, 9, 5)), ex(1000, +now)]; const s = C.walletStats(W.makan, txs, now);
  assert.equal(s.usable, 76000); assert.equal(s.allow, 2451); assert.equal(s.remain, 1451); assert.equal(s.spent, 31000);
});
test('hangus: hemat kemarin tidak menambah jatah; boros kemarin memotong', () => {
  const hemat = C.walletStats(W.makan, [ex(5000, +new Date(2026, 9, 5))], now); assert.equal(hemat.allow, 2451);
  const boros = C.walletStats(W.makan, [ex(75000, +new Date(2026, 9, 5))], now); assert.equal(boros.allow, 1000);
  const habis = C.walletStats(W.makan, [ex(90000, +new Date(2026, 9, 5))], now); assert.equal(habis.allow, 0);
});
test('terbawa: sisa dibagi ke sisa hari; lewat jatah jadi negatif', () => {
  const w = { ...W.makan, rule: { ...W.makan.rule, carryMode: 'terbawa' } };
  const s = C.walletStats(w, [ex(5000, +new Date(2026, 9, 5))], now); assert.equal(s.allow, Math.floor((76000 - 5000) / 17));
  const o = C.walletStats(W.makan, [ex(5000, +now)], now); assert.equal(o.remain, 2451 - 5000);
});
test('tambahan (bonus/transfer masuk) menaikkan anggaran siklus', () => {
  const s = C.walletStats(W.makan, [C.newTx({ type: 'income', walletId: 'makan', amount: 10000, ts: +new Date(2026, 9, 3) }, W)], now);
  assert.equal(s.budget, 90000); assert.equal(s.usable, 86000);
});
test('transaksi di luar siklus dan yang dihapus tidak dihitung', () => {
  const s = C.walletStats(W.makan, [ex(9999, +new Date(2026, 8, 30)), C.remove(ex(9999, +now))], now); assert.equal(s.spent, 0);
});
test('proyeksi', () => {
  assert.equal(C.projection({ spent: 0, elapsed: 5, total: 30, budget: 80000 }).state, 'kosong');
  assert.equal(C.projection({ spent: 10000, elapsed: 10, total: 30, budget: 80000 }).surplus, 50000);
  const p = C.projection({ spent: 40000, elapsed: 10, total: 30, budget: 80000 }); assert.equal(p.state, 'boros'); assert.equal(p.emptyDay, 20); assert.equal(p.maxDaily, 2000);
});

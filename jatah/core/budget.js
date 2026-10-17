import { cycle } from './period.js';
// Aturan dompet: { budget(minor), startDay, reservePct, carryMode: 'hangus'|'terbawa' }
// 'hangus'  = perilaku v5: jatah = min(usable/hari, sisa sebelum hari ini).
// 'terbawa' = sisa kemarin dibagi rata ke sisa hari.
// Pengeluaran = expense + transfer keluar. Tambahan = income + transfer masuk dalam siklus (menambah anggaran).
export function allowance({ usable, total, left, spentBefore, mode = 'hangus' }) {
  const avail = Math.max(0, usable - spentBefore);
  return mode === 'terbawa' ? Math.floor(avail / Math.max(1, left)) : Math.min(Math.floor(usable / total), avail);
}
export function walletStats(w, txs, now = new Date()) {
  const r = w.rule, c = cycle(now, r.startDay), a = +c.st, b = +c.en, t0 = +c.t0;
  let spent = 0, today = 0, extra = 0;
  for (const t of txs) {
    if (t.deleted || t.ts < a || t.ts >= b) continue;
    const out = (t.type === 'expense' && t.walletId === w.id) || (t.type === 'transfer' && t.walletId === w.id) ? t.amount : 0;
    const inn = (t.type === 'income' && t.walletId === w.id) ? t.amount : (t.type === 'transfer' && t.toWalletId === w.id) ? t.toAmount : 0;
    spent += out; extra += inn; if (t.ts >= t0) today += out;
  }
  const reserve = Math.round(r.budget * (r.reservePct || 0) / 100), total$ = r.budget + extra;
  const usable = total$ - reserve;
  const allow = allowance({ usable, total: c.total, left: c.left, spentBefore: spent - today, mode: r.carryMode });
  return { cycle: c, budget: total$, reserve, usable, spent, today, allow, remain: allow - today, left: total$ - spent };
}
export function projection({ spent, elapsed, total, budget }) {
  if (spent <= 0) return { state: 'kosong' };
  const avg = spent / elapsed, proj = avg * total;
  if (proj <= budget) return { state: 'aman', surplus: Math.round(budget - proj) };
  return { state: 'boros', emptyDay: Math.floor(budget / avg), maxDaily: Math.max(0, Math.floor((budget - spent) / Math.max(1, total - elapsed))) };
}

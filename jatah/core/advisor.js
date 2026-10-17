import { convert } from './fx.js';
// Mau Beli. price: sen MYR. food: hasil walletStats(dompet makan). Uang IDR dalam rupiah.
// source: makan | gaji | campur | darurat. Hasil: level 0 Aman, 1 Pikir dulu, 2 Tunda + angka mentah (UI yang memformat).
export function advise({ price, source = 'makan', mix = 0.5, food, minFood = 0, salaryIDR = 0, capIDR = 0, gajiSpentIDR = 0, rate, reserveLeft = 0 }) {
  const pm = source === 'gaji' || source === 'darurat' ? 0 : source === 'campur' ? Math.round(price * mix) : price;
  const pg = source === 'darurat' ? 0 : price - pm;
  const { total, left } = { total: food.cycle.total, left: Math.max(1, food.cycle.left) };
  const dayBudget = food.budget / total, remain = food.usable - food.spent;
  const r = { dayEq: price / dayBudget, rpEq: convert(price, 'MYR', 'IDR', rate), pm, pg };
  let lvl = 0;
  if (pm > 0) {
    r.avgBefore = Math.max(0, Math.floor(remain / left)); r.avgAfter = Math.max(0, Math.floor((remain - pm) / left));
    if ((remain - pm) / left < minFood) { lvl = 2; r.belowMin = true; } else if (pm >= 2 * dayBudget) lvl = 1;
  }
  if (pg > 0) {
    const rp = convert(pg, 'MYR', 'IDR', rate);
    if (salaryIDR > 0) { r.salaryMonths = rp / salaryIDR; if (r.salaryMonths >= 0.25) lvl = Math.max(lvl, 1); }
    if (capIDR > 0) { r.capLeft = capIDR - gajiSpentIDR - rp; if (r.capLeft < 0) lvl = 2; }
  }
  if (source === 'darurat') { r.reserveAfter = reserveLeft - price; lvl = r.reserveAfter < 0 ? 2 : 1; }
  return { level: lvl, verdict: ['aman', 'pikir', 'tunda'][lvl], ...r };
}

import { convert } from './fx.js';
// Target tabungan. deadline: 'YYYY-MM-DD'. Semua uang integer (Rp). rate = Rp per 1 RM.
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
// Jumlah bulan penuh sampai tenggat (minimal 1 jika tenggat belum lewat, 0 jika sudah lewat/hari ini).
export function monthsLeft(now, deadline) {
  const d = parse(deadline), n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d <= n) return 0;
  let m = (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth(); if (d.getDate() < n.getDate()) m--;
  return Math.max(1, m);
}
export function goalPlan({ target = 0, saved, deadline, now = new Date(), rate }) {
  if (!(target > 0)) return { state: 'bebas', pct: 0, need: 0 };
  if (saved >= target) return { state: 'tercapai', pct: 1, need: 0 };
  const pct = Math.max(0, saved / target), need = target - saved, ml = deadline ? monthsLeft(now, deadline) : null;
  if (deadline && ml === 0) return { state: 'lewat', pct, need };
  const perCycle = ml ? Math.ceil(need / ml) : null;
  return { state: 'jalan', pct, need, monthsLeft: ml, perCycle, perCycleMYR: perCycle != null && rate ? convert(perCycle, 'IDR', 'MYR', 1 / rate) : null };
}
// Siklus per dompet. Tanggal mulai 1-31; bulan yang lebih pendek memakai hari terakhir bulan itu.
const dim = (y, m) => new Date(y, m + 1, 0).getDate();
const at = (y, m, sd) => new Date(y, m, Math.min(sd, dim(y, m)));
export const dayStart = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export function cycle(now, startDay = 1) {
  const y = now.getFullYear(), m = now.getMonth(), t0 = dayStart(now);
  let st = at(y, m, startDay); if (t0 < st) st = at(y, m - 1, startDay);
  const en = at(st.getFullYear(), st.getMonth() + 1, startDay);
  const total = Math.round((en - st) / 864e5), idx = Math.round((t0 - st) / 864e5);
  return { st, en, t0, total, idx, left: total - idx }; // left = sisa hari termasuk hari ini
}

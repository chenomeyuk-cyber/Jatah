// Semua uang disimpan sebagai integer satuan terkecil (sen / rupiah). Tidak ada float di data.
export const CUR = { MYR: { digits: 2, sym: 'RM' }, IDR: { digits: 0, sym: 'Rp' } };
const d = c => { if (!CUR[c]) throw new Error('Mata uang tidak dikenal: ' + c); return CUR[c].digits; };
export const toMinor = (v, c) => Math.round(v * 10 ** d(c));
export const fromMinor = (m, c) => m / 10 ** d(c);
export const fmt = (m, c) => {
  const neg = m < 0, v = fromMinor(Math.abs(m), c);
  return (neg ? '−' : '') + CUR[c].sym + ' ' + v.toLocaleString('id-ID', { minimumFractionDigits: d(c), maximumFractionDigits: d(c) });
};

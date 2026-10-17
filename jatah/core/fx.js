import { CUR } from './money.js';
// rate = berapa satuan mata uang tujuan untuk 1 satuan mata uang asal (mis. 1 MYR = 3800 IDR).
export function convert(minor, from, to, rate) {
  if (from === to) return minor;
  if (!(rate > 0)) throw new Error('Kurs wajib diisi untuk transaksi lintas mata uang');
  return Math.round((minor / 10 ** CUR[from].digits) * rate * 10 ** CUR[to].digits);
}

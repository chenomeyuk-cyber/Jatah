import { convert } from './fx.js';
// Ledger: semua uang adalah transaksi. Saldo SELALU dihitung, tidak disimpan.
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newId(now = Date.now()) {
  let t = '', n = now; for (let i = 0; i < 10; i++) { t = ALPHA[n % 32] + t; n = Math.floor(n / 32); }
  let r = ''; for (let i = 0; i < 8; i++) r += ALPHA[Math.floor(Math.random() * 32)];
  return t + r;
}
// type: income | expense | transfer | adjust. amount integer minor di mata uang dompet asal.
// transfer lintas mata uang: toAmount dihitung dari fxRate dan DISIMPAN bersama kurs (kurs per transaksi).
export function newTx(f, wallets, now = Date.now()) {
  const w = wallets[f.walletId]; if (!w) throw new Error('Dompet tidak ada');
  if (!Number.isInteger(f.amount)) throw new Error('Nominal harus integer satuan terkecil');
  if (f.type !== 'adjust' && f.amount <= 0) throw new Error('Nominal harus lebih dari 0');
  if (!['income', 'expense', 'transfer', 'adjust'].includes(f.type)) throw new Error('Tipe tidak valid');
  const tx = { id: newId(now), category: '', note: '', tags: [], ts: now, ...f, createdAt: now, updatedAt: now, deleted: false };
  if (f.type === 'transfer') {
    const to = wallets[f.toWalletId]; if (!to) throw new Error('Dompet tujuan tidak ada');
    if (f.toWalletId === f.walletId) throw new Error('Dompet asal dan tujuan sama');
    tx.toAmount = f.toAmount ?? convert(f.amount, w.currency, to.currency, f.fxRate);
  }
  return tx;
}
export const edit = (tx, patch, now = Date.now()) => ({ ...tx, ...patch, id: tx.id, updatedAt: now });
export const remove = (tx, now = Date.now()) => ({ ...tx, deleted: true, updatedAt: now });
// Perubahan saldo satu dompet akibat satu transaksi.
export function delta(tx, walletId) {
  if (tx.deleted) return 0;
  if (tx.type === 'transfer') return tx.walletId === walletId ? -tx.amount : tx.toWalletId === walletId ? tx.toAmount : 0;
  if (tx.walletId !== walletId) return 0;
  return tx.type === 'expense' ? -tx.amount : tx.amount; // income & adjust (adjust boleh negatif)
}
export const balance = (walletId, txs, upTo = Infinity) => txs.reduce((s, t) => (t.ts <= upTo ? s + delta(t, walletId) : s), 0);

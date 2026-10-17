# Jatah v6

Tanpa build step dan tanpa dependency. Satu-satunya syarat: Node.js 20+ (hanya untuk tes dan dev server).

## Struktur
- `core/`   logika uang murni (money, fx, ledger, period, budget, advisor). Tidak menyentuh browser.
- `data/`   penyimpanan: `store.js` (dompet, transaksi, pengaturan) dan `adapters.js` (IndexedDB / memori).
- `tests/`  unit test semua rumus uang.
- `scripts/serve.js` dev server lokal.
- `index.html`, `sw.js`, `manifest.webmanifest`, ikon: file yang dilayani ke browser (akar proyek = akar deploy).

## Perintah
    npm test        # jalankan semua unit test
    npm run dev     # buka http://localhost:8080 (ganti port: PORT=3000 npm run dev)

## Deploy ke Cloudflare Pages
Opsi A (cepat): dash.cloudflare.com, Workers & Pages, Create, Upload assets, seret SELURUH isi folder ini.
Opsi B (disarankan): push folder ini ke Git, hubungkan ke Cloudflare Pages dengan Framework preset "None", Build command kosong, Output directory `/`. Setiap push otomatis deploy.

## Aturan rilis
- Setiap mengubah file yang di-cache, naikkan nama cache di `sw.js` (`jatah-v6` jadi `jatah-v7`).
- Jalankan `npm test` sebelum deploy. Tes yang gagal berarti jangan deploy.
- Mengubah struktur data: tambah fungsi di `MIGRATIONS` pada `data/store.js` dan naikkan `SCHEMA`.
- Pasang di HP: buka alamat .pages.dev di Chrome, lalu Install. IndexedDB hanya teruji asli di browser, jadi cek di HP setiap rilis.

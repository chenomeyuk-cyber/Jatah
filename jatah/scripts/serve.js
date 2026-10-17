// Dev server tanpa dependency. Jalankan: npm run dev  (ganti port: PORT=3000 npm run dev, di Windows PowerShell: $env:PORT=3000; npm run dev)
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { extname, resolve, sep, posix } from 'node:path'; import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url))), port = +process.env.PORT || 8080;

const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };


http.createServer(async (q, s) => {
  let p; try { p = posix.normalize('/' + decodeURIComponent(q.url.split('?')[0])); } catch { return s.writeHead(400).end('400'); } // selalu pakai "/" (aman di Windows)
  if (p.endsWith('/')) p += 'index.html';
  const f = resolve(root, '.' + p);
  if (f !== root && !f.startsWith(root + sep)) return s.writeHead(403).end('403');
  try { const b = await readFile(f); s.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); s.end(b); }
  catch { s.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('404: ' + p + '\nFolder yang dilayani: ' + root + '\nPastikan index.html ada di folder itu.'); }
}).listen(port, () => console.log('Jatah dev server: http://localhost:' + port + '  (folder: ' + root + ')'));

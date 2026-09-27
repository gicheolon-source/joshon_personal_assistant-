/* 로컬 개발 서버: public/ 정적 + api/*.js 핸들러. node dev.mjs  (.env.local 있으면 읽음) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
process.chdir(path.dirname(fileURLToPath(import.meta.url)));
if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
process.env.DESK_SECRET ||= 'dev-secret'; process.env.DESK_PASSWORD ||= 'dev'; process.env.INGEST_TOKEN ||= 'dev-ingest';
const port = Number(process.env.PORT || 3100);
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) {
    const f = path.join('api', url.pathname.slice(5).replace(/[^\w-]/g, '') + '.js');
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end('no api'); }
    const mod = await import('./' + f.split(path.sep).join('/') + '?t=' + fs.statSync(f).mtimeMs);
    try { await mod.default(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.statusCode = 500; res.end(); }
    return;
  }
  const p = path.join('public', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end('not found'); }
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
}).listen(port, () => console.log('josh-desk dev on http://localhost:' + port));

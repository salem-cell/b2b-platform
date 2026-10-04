// خادم تطوير محلي يحاكي Vercel: /api/<مسار> → الدالة نفسها (api/<مسار>.js)، والباقي ملفات ثابتة.
// للاختبار الشامل مع نظام العمليات محليًا (scripts/e2e-ops.mjs). يتطلب LOCAL_PG_URL (Postgres محلي).
//   LOCAL_PG_URL=postgres://… PORT=3100 node scripts/local-server.mjs
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.env.PORT || 3100);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };

if (!process.env.LOCAL_PG_URL) {
  console.error('LOCAL_PG_URL is required (a local PostgreSQL) — this server never talks to the live database.');
  process.exit(1);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://local');
  try {
    if (url.pathname.startsWith('/api/')) {
      const file = join(ROOT, 'api', `${normalize(url.pathname.slice(5)).replace(/^([/\\])+/, '')}.js`);
      if (!file.startsWith(join(ROOT, 'api'))) throw Object.assign(new Error('bad path'), { status: 400 });
      await stat(file).catch(() => { throw Object.assign(new Error('not found'), { status: 404 }); });
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    const p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) throw Object.assign(new Error('bad path'), { status: 400 });
    const data = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch (e) {
    res.statusCode = e.status || 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, '127.0.0.1', () => console.log(`[sales-local] http://127.0.0.1:${PORT}`));

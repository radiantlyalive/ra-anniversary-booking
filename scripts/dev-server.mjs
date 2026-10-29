// Local dev server, no Netlify CLI or login needed. Serves public/ and runs each function in
// netlify/functions at the path it declares in its own `config`. Mock mode unless .env says otherwise.
import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && m[2] !== '' && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
process.env.BOOKING_MODE ||= 'mock';
const port = Number(process.env.PORT || 8888);

const routes = new Map();
for (const f of readdirSync('netlify/functions').filter((n) => n.endsWith('.js'))) {
  const mod = await import(pathToFileURL(join('netlify/functions', f)).href);
  if (mod.config?.path) routes.set(mod.config.path, mod.default);
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const fn = routes.get(url.pathname);
    if (fn) {
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length && !['GET', 'HEAD'].includes(req.method) ? Buffer.concat(chunks) : undefined;
      const headers = new Headers(Object.entries(req.headers).filter(([, v]) => typeof v === 'string'));
      headers.set('x-nf-client-connection-ip', req.socket.remoteAddress || 'local');
      const r = await fn(new Request(url, { method: req.method, headers, body }), {});
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || p === '\\') p = '/demo.html';
    const file = join('public', p);
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      return res.end(readFileSync(file));
    }
    res.writeHead(404); res.end('Not found');
  } catch (e) { console.error(e); res.writeHead(500); res.end('Server error'); }
}).listen(port, () => console.log(`RA booking dev server (${process.env.BOOKING_MODE}) on http://localhost:${port}/demo.html`));

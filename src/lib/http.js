// Small helpers shared by every function.
const origin = () => process.env.ALLOWED_ORIGIN || 'https://www.radiantlyalive.com';

const cors = () => ({
  'access-control-allow-origin': origin(),
  'access-control-allow-headers': 'content-type, idempotency-key',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  vary: 'origin',
});

export const json = (status, body, extra = {}) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(), ...extra },
  });

export const html = (status, body, extra = {}) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'x-robots-tag': 'noindex', ...extra },
  });

export const preflight = (req) => (req.method === 'OPTIONS' ? json(204, null) : null);

// Error bodies carry a code only; the widget maps codes to approved copy.
export const fail = (status, code, extra = {}) => json(status, { error: code, ...extra });

export async function readJson(req, maxBytes = 8192) {
  const text = await req.text();
  if (text.length > maxBytes) { const e = new Error('too_large'); e.code = 'too_large'; throw e; }
  try { return text ? JSON.parse(text) : {}; } catch { const e = new Error('bad_json'); e.code = 'bad_json'; throw e; }
}

export const clientIp = (req) =>
  req.headers.get('cf-connecting-ip') ||
  req.headers.get('x-nf-client-connection-ip') || // kept for the tests and any proxy that sets it
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  'unknown';

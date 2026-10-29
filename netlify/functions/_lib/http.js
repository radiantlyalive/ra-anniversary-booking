// Small helpers shared by every function.
const origin = () => process.env.ALLOWED_ORIGIN || 'https://www.radiantlyalive.com';

export const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'access-control-allow-origin': origin(),
      'access-control-allow-headers': 'content-type, idempotency-key',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      ...extra,
    },
  });

export const preflight = (req) => (req.method === 'OPTIONS' ? json(204, {}) : null);

export const notBuilt = (name) =>
  json(501, { error: 'not_implemented', function: name, note: 'Draft scaffold. See README > Build plan.' });

export const mode = () => process.env.BOOKING_MODE || 'mock'; // mock | sandbox | live

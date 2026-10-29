// Wraps a function body: config problems become 503, anything else 500 with a code only.
import { json } from './http.js';

export const safe = (fn) => async (req, ctx) => {
  try { return await fn(req, ctx); }
  catch (e) {
    if (e?.code === 'not_configured') return json(503, { error: 'not_configured', missing: e.missing });
    if (e?.code === 'too_large' || e?.code === 'bad_json') return json(400, { error: 'bad_request' });
    console.error('function error:', e?.stack || e);
    return json(500, { error: 'server' });
  }
};

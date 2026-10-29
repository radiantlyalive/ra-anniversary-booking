// POST /api/momence-webhook   booked and cancelled events
// Keeps Klaviyo complete for front-desk bookings and waitlist moves, and ignores every
// session that is not an anniversary session (the studio has other classes).
//
// NOT DOCUMENTED YET: Momence's payload shape and whether it signs webhooks. Until
// docs/momence.md says so:
//   - the handler works on a normalised event (see service.handleMomenceEvent);
//   - outside mock mode the payload parser throws momence_docs_needed (501);
//   - the endpoint fails closed unless MOMENCE_WEBHOOK_SECRET is set, and then requires it in the
//     x-ra-webhook-secret header or ?secret= query value. That is a shared secret, not a signature.
import { timingSafeEqual } from 'node:crypto';
import { json, preflight, fail, readJson } from './_lib/http.js';
import { safe } from './_lib/handler.js';
import { isMock } from './_lib/env.js';
import { parseWebhook } from './_lib/momence-real.js';
import { handleMomenceEvent } from './_lib/service.js';

const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

function authorised(req) {
  const secret = process.env.MOMENCE_WEBHOOK_SECRET;
  if (!secret) return isMock();
  const given = req.headers.get('x-ra-webhook-secret') || new URL(req.url).searchParams.get('secret') || '';
  return same(given, secret);
}

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  if (!authorised(req)) return fail(401, 'unauthorised');
  const body = await readJson(req, 65536);
  const ev = isMock() ? body : parseWebhook(body);
  const r = await handleMomenceEvent(ev);
  return json(r.status, r.body);
});
export const config = { path: '/api/momence-webhook' };

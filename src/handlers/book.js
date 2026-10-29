// POST /api/book
// Header: Idempotency-Key (required, 8 to 100 chars: letters, digits, - _)
// Body: { type: 'full-day'|'single', sessions?: string[], name, email, whatsapp,
//         wholeDay?: boolean (required true for full-day), intent: 'free'|'donate',
//         website?: string (honeypot, must be empty), turnstileToken?: string }
// 201/200 -> { status: 'booked'|'partial'|'waitlisted', bookingRef, items:[{key,label,status}],
//              next: 'done'|'amount', firstName, duplicate? }
// Errors  -> { error: closed|validation|bot|rate_limited|session_full|in_progress|... }
// Both buttons book a FREE spot first. "Join with Donation" returns next:'amount'.
import { json, preflight, fail, readJson, clientIp } from '../lib/http.js';
import { safe } from '../lib/handler.js';
import { getConfig } from '../lib/config.js';
import { allow } from '../lib/ratelimit.js';
import * as idem from '../lib/idempotency.js';
import * as turnstile from '../lib/turnstile.js';
import { createBooking } from '../lib/service.js';

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const cfg = getConfig();
  const ip = clientIp(req);
  if (!(await allow('book', ip, cfg.limits.bookPerIp))) return fail(429, 'rate_limited');

  const body = await readJson(req);
  if (body.website) return fail(400, 'bot'); // honeypot
  const key = req.headers.get('idempotency-key');
  if (!idem.validKey(key)) return fail(400, 'idempotency_key_required');
  if (!(await turnstile.verify(body.turnstileToken, ip))) return fail(400, 'bot');

  const r = await idem.run('book', key, () => createBooking(body));
  return json(r.status, r.body);
});

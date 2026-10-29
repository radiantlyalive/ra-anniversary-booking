// POST /api/contribute
// Header: Idempotency-Key (required)
// Body: { bookingRef, amount }   amount is a whole number in the configured currency, minimum IDR 10,000
// 200 -> { checkoutUrl }  (Stripe-hosted Checkout, linked to the booking)
// "Skip, keep my free spot" needs no call: the free booking already stands, and a guest who
// abandons Stripe keeps it.
import { json, preflight, fail, readJson, clientIp } from '../lib/http.js';
import { safe } from '../lib/handler.js';
import { getConfig } from '../lib/config.js';
import { allow } from '../lib/ratelimit.js';
import * as idem from '../lib/idempotency.js';
import { startContribution } from '../lib/service.js';

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const cfg = getConfig();
  if (!(await allow('contribute', clientIp(req), cfg.limits.contributePerIp))) return fail(429, 'rate_limited');
  const body = await readJson(req);
  const key = req.headers.get('idempotency-key');
  if (!idem.validKey(key)) return fail(400, 'idempotency_key_required');
  const r = await idem.run('contribute', key, () => startContribution(body, key));
  return json(r.status, r.body);
});

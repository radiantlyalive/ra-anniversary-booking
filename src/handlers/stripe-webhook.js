// POST /api/stripe-webhook   (Stripe signs every call; the signature is verified, no exceptions
// outside mock mode with no secret set)
// checkout.session.completed with payment_status 'paid': tag the guest "Donor" in Momence and
// send "Anniversary Contributed" to Klaviyo. Anything else is acknowledged and ignored.
// Failure returns 500 so Stripe retries; steps are flagged so a retry repeats only what is missing.
import { json, preflight, fail } from '../lib/http.js';
import { safe } from '../lib/handler.js';
import { verifyWebhook } from '../lib/stripe.js';
import { handleStripeEvent } from '../lib/service.js';

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const raw = await req.text();
  let event;
  try { event = verifyWebhook(raw, req.headers.get('stripe-signature')); }
  catch (e) { if (e.code === 'bad_signature') return fail(400, 'bad_signature'); throw e; }
  const r = await handleStripeEvent(event);
  return json(r.status, r.body);
});

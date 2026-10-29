// POST /api/stripe-webhook   (checkout.session.completed)
// Verify the signature with STRIPE_WEBHOOK_SECRET, then:
//   Momence: tag the member with momenceTags.donor
//   Klaviyo: "Anniversary Contributed" event
// Must be idempotent: Stripe can deliver the same event more than once.
import { json, notBuilt } from './_lib/http.js';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  return notBuilt('stripe-webhook');
};
export const config = { path: '/api/stripe-webhook' };

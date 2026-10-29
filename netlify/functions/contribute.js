// POST /api/contribute
// Body: { bookingRef, amount } (amount in IDR, >= contributions.minimumOther)
// Opens a Stripe Checkout Session linked to the booking and member.
// The place is already held by /api/book, so abandoning Stripe loses nothing.
// Response: { checkoutUrl }
import { json, preflight, notBuilt } from './_lib/http.js';

export default async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  return notBuilt('contribute');
};
export const config = { path: '/api/contribute' };

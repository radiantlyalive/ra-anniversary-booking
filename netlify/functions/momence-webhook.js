// POST /api/momence-webhook   ("session booked", "booking cancelled")
// Keeps Klaviyo complete for front-desk bookings, cancellations and waitlist moves.
// A guest moved up from the waitlist gets "Anniversary Moved Up" ("You're in" email).
// Verification method depends on Momence: record it in docs/momence.md.
import { json, notBuilt } from './_lib/http.js';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  return notBuilt('momence-webhook');
};
export const config = { path: '/api/momence-webhook' };

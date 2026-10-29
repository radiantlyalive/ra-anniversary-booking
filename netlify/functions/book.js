// POST /api/book
// Body: { type: 'full-day' | 'single', sessions?: string[], name, email, whatsapp,
//         wholeDay?: boolean, intent: 'free' | 'donate', honeypot?: string }
// Header: Idempotency-Key (required)
// Flow: validate -> spam check -> find or create member -> book FREE first
//       (or waitlist if Full Day is full) -> Klaviyo event -> return next step.
// Response: { status: 'booked' | 'waitlisted', bookingRef, next: 'done' | 'amount' }
import { json, preflight, notBuilt } from './_lib/http.js';

export default async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  return notBuilt('book');
};
export const config = { path: '/api/book' };

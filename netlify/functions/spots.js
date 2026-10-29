// GET /api/spots -> { fullDay: { left, capacity, waiting }, bookingOpen }
// Feeds the live counter in the widget. Cache for a few seconds at most.
import { json, preflight } from './_lib/http.js';
import * as momence from './_lib/momence.js';

export default async (req) => {
  const pre = preflight(req); if (pre) return pre;
  const s = await momence.spotsLeft('full-day'); // TODO: use fullDay.momenceSessionId outside mock mode
  return json(200, { fullDay: s });
};
export const config = { path: '/api/spots' };

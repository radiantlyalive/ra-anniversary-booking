// GET /api/spots
// -> { mode, bookingOpen, opensAtDisplay, eventDateDisplay, deadlineDisplay,
//      fullDay:{capacity,booked,left,waiting,full},
//      sessions:[{key,label,time,place,capacity,left,full,waitlist}],
//      contributions:{currency,suggestedAmounts,minimum,word,recipientLine,refundWording},
//      features:{classCredit,mealPackage} }
// Feeds the live counter and the form. Times arrive already formatted in Bali time.
import { json, preflight, fail } from './_lib/http.js';
import { safe } from './_lib/handler.js';
import { publicState } from './_lib/service.js';

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'GET') return fail(405, 'method_not_allowed');
  return json(200, await publicState(), { 'cache-control': 'public, max-age=5' });
});
export const config = { path: '/api/spots' };

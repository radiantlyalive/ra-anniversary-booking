// GET  /api/reconfirm?t=<signed token>  -> shows the confirm page. Changes NOTHING,
//                                          because email scanners open links.
// POST /api/reconfirm { t, action: 'confirm' | 'release' }
//   confirm -> Momence tag momenceTags.confirmed, Klaviyo "Anniversary Confirmed"
//   release -> cancel the Full Day booking, Klaviyo "Anniversary Released";
//              Momence moves the waitlist up
// Tokens are signed with RECONFIRM_LINK_SECRET and expire after reconfirm.deadlineAt.
import { json, preflight, notBuilt } from './_lib/http.js';

export default async (req) => {
  const pre = preflight(req); if (pre) return pre;
  return notBuilt('reconfirm');
};
export const config = { path: '/api/reconfirm' };

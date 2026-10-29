// Scheduled every 15 minutes. Acts once, after reconfirm.deadlineAt (config, UTC internally).
// Releases unconfirmed Full Day bookings, skipping confirmed guests and contributors (when
// contributorsKeepSpotIfNoReconfirm is true). release 'team-review' only builds the list.
// Single-session bookings are never released. See service.runDeadline.
import { runDeadline } from './_lib/service.js';

export default async () => {
  const r = await runDeadline();
  console.log('deadline job:', JSON.stringify(r));
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } });
};
export const config = { schedule: '*/15 * * * *' };

// Scheduled. Runs every 15 minutes and acts only once, after reconfirm.deadlineAt.
// Releases unconfirmed Full Day bookings, SKIPPING contributors (donor tag) when
// contributions.contributorsKeepSpotIfNoReply is true. If reconfirm.release is
// 'team-review', it only produces the list for the team instead of releasing.
// Single-session bookings are never released.
import { notBuilt } from './_lib/http.js';

export default async () => notBuilt('deadline');
export const config = { schedule: '*/15 * * * *' };

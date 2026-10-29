// Klaviyo client. Sends events that trigger the guest emails.
// Proposed event names: Anniversary Booked, Anniversary Waitlisted, Anniversary Contributed,
// Anniversary Reconfirm Due, Anniversary Confirmed, Anniversary Released, Anniversary Moved Up.
import { mode } from './http.js';

export async function track(eventName, profile, properties = {}) {
  if (mode() === 'mock') { console.log('[klaviyo:mock]', eventName, profile.email, properties); return { ok: true }; }
  throw new Error('klaviyo.track: not built');
}

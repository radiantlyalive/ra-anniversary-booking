// Klaviyo client. Sends events that trigger the guest emails. Klaviyo flows own the emails
// and their timing (26 Nov reconfirm, 27 Nov reminder, "You're in").
//
// Mock mode records events in the store (shown on the demo page). Sandbox and live post to
// the Klaviyo events API (Create Event, checked against the docs on 2026-10-29: path, revision, content type,
// body shape). The Klaviyo-API-Key auth header was not on the fetched page, so confirm it on the first sandbox run.
import { isMock, requireEnv } from './env.js';
import * as store from './store.js';

export const EVENTS = {
  booked: 'Anniversary Booked',
  waitlisted: 'Anniversary Waitlisted',
  contributed: 'Anniversary Contributed',
  confirmed: 'Anniversary Confirmed',   // lets the flow stop the reminder
  released: 'Anniversary Released',
  movedUp: 'Anniversary Moved Up',      // the "You're in" email for waitlist guests
  cancelled: 'Anniversary Cancelled',
};

const KLAVIYO_REVISION = '2026-10-15'; // docs default on 2026-10-29. Klaviyo retires a revision 2 years after release, so 2024-10-15 is gone.
const E164 = /^\+[1-9]\d{7,14}$/; // Klaviyo wants phone_number in E.164

// uniqueId makes a retry harmless: the same event is never recorded or sent twice.
export async function track(eventName, profile, properties = {}, uniqueId) {
  if (isMock()) {
    const k = uniqueId ? `klaviyo:seen:${uniqueId}` : null;
    if (k && !(await store.setIfNew(k, 1))) return { ok: true, duplicate: true };
    const log = (await store.get('mock:klaviyo')) || [];
    log.push({ at: new Date().toISOString(), event: eventName, email: profile.email, properties });
    await store.set('mock:klaviyo', log);
    return { ok: true };
  }
  const res = await fetch('https://a.klaviyo.com/api/events', {
    method: 'POST',
    headers: {
      authorization: `Klaviyo-API-Key ${requireEnv('KLAVIYO_PRIVATE_KEY')}`,
      revision: KLAVIYO_REVISION,
      'content-type': 'application/vnd.api+json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      data: {
        type: 'event',
        attributes: {
          properties,
          unique_id: uniqueId,
          time: new Date().toISOString(),
          metric: { data: { type: 'metric', attributes: { name: eventName } } },
          profile: {
            data: {
              type: 'profile',
              attributes: {
                email: profile.email,
                phone_number: E164.test(profile.whatsapp || '') ? profile.whatsapp : undefined,
                first_name: profile.firstName,
              },
            },
          },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Klaviyo event failed: ${res.status}`);
  return { ok: true };
}

export const sentEvents = async () => (await store.get('mock:klaviyo')) || [];

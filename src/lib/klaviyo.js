// Klaviyo client. Sends events that trigger the guest emails. Klaviyo flows own the emails
// and their timing (26 Nov reconfirm, 27 Nov reminder, "You're in").
//
// Mock mode records events in the store (shown on the demo page). Sandbox and live post to
// the Klaviyo events API. UNVERIFIED: written from memory because developers.klaviyo.com was
// not reachable from the build session. Check endpoint, revision header and body shape
// against the current docs before the first sandbox run.
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

const KLAVIYO_REVISION = '2024-10-15'; // UNVERIFIED, confirm against the docs

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
  const res = await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: {
      authorization: `Klaviyo-API-Key ${requireEnv('KLAVIYO_PRIVATE_KEY')}`,
      revision: KLAVIYO_REVISION,
      'content-type': 'application/json',
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
                phone_number: profile.whatsapp,
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

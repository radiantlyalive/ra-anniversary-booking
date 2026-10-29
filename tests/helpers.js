// Test helpers: a fresh in-memory store and mock Momence for every test, plus tiny request builders.
import * as store from '../netlify/functions/_lib/store.js';
import * as mock from '../netlify/functions/_lib/momence-mock.js';
import { sentEvents } from '../netlify/functions/_lib/klaviyo.js';
import { open } from '../config/event.config.js';

process.env.BOOKING_MODE = 'mock';
process.env.RA_STORE = 'memory';

export async function fresh({ seedFullDay = 0, now = '2026-11-10T10:00:00+08:00' } = {}) {
  store.useStore(store.memoryStore());
  await mock.reset({ seedFullDay });
  if (now) await store.set('dev:now', new Date(now).toISOString());
}
export const setNow = (iso) => store.set('dev:now', new Date(iso).toISOString());

export const guest = (n = 1, extra = {}) => ({
  name: `Guest ${n}`, email: `guest${n}@example.com`, whatsapp: '+6281234567890', intent: 'free', ...extra,
});
export const fullDayGuest = (n = 1, extra = {}) => guest(n, { type: 'full-day', wholeDay: true, ...extra });

let k = 0;
export const idemKey = () => `test-key-${++k}-${Math.random().toString(36).slice(2, 10)}`;

export const post = (url, body, headers = {}) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
export const get = (url) => new Request(`http://localhost${url}`);

export const events = async (name) => (await sentEvents()).filter((e) => !name || e.event === name);
export const momenceState = () => mock.inspect();
export const bookedCount = async (key) => Object.values((await mock.inspect()).bookings).filter((b) => b.sessionKey === key && b.status === 'booked').length;

// Open decisions are null placeholders. A test that needs a different answer sets it, then restores it.
export function withOpen(key, value, fn) {
  const prev = open[key].value;
  open[key].value = value;
  return Promise.resolve(fn()).finally(() => { open[key].value = prev; });
}

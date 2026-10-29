import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, fullDayGuest, guest, post, events, bookedCount, momenceState } from './helpers.js';
import { createBooking, handleMomenceEvent, releaseSpot, publicState } from '../src/lib/service.js';
import * as mock from '../src/lib/momence-mock.js';
import momenceWebhook from '../src/handlers/momence-webhook.js';

beforeEach(() => fresh({ seedFullDay: 0 }));

async function fullWithQueue() {
  await mock.fillFullDay(1);
  const a = (await createBooking(fullDayGuest(1))).body;   // takes the last spot
  const w1 = (await createBooking(fullDayGuest(2))).body;  // waitlist
  const w2 = (await createBooking(fullDayGuest(3))).body;  // waitlist
  return { a, w1, w2 };
}

test('Full Day full: guests queue in order', async () => {
  const { a, w1, w2 } = await fullWithQueue();
  assert.equal(a.status, 'booked');
  assert.equal(w1.status, 'waitlisted');
  assert.equal(w2.status, 'waitlisted');
  const s = await publicState();
  assert.equal(s.fullDay.full, true);
  assert.equal(s.fullDay.waiting, 2);
});

test('a released spot moves the waitlist up and the next guest gets "You\'re in"', async () => {
  const { a } = await fullWithQueue();
  await releaseSpot(a.bookingRef);
  assert.equal(await bookedCount('full-day'), 50);
  const moved = await events('Anniversary Moved Up');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].email, 'guest2@example.com'); // first in the queue
  assert.match(moved[0].properties.reconfirm_url, /reconfirm/);
  assert.equal((await publicState()).fullDay.waiting, 1);
});

test('Momence "booked" webhook for a waitlisted guest sends Moved Up exactly once', async () => {
  const { w1 } = await fullWithQueue();
  const ev = { type: 'booked', bookingId: 'b_ext_1', sessionKey: 'full-day', member: { id: (await momenceState()).members['guest2@example.com'].id } };
  assert.equal((await handleMomenceEvent(ev)).body.movedUp, w1.bookingRef);
  assert.equal((await handleMomenceEvent(ev)).body.duplicate, true);
  assert.equal((await events('Anniversary Moved Up')).length, 1);
});

test('a front-desk booking reaches Klaviyo', async () => {
  const r = await handleMomenceEvent({ type: 'booked', bookingId: 'b_fd_1', sessionKey: 'full-day', member: { id: 'm_x', name: 'Putu Wayan', email: 'Putu@example.com', whatsapp: '+6281111111111' } });
  assert.ok(r.body.registered);
  const [ev] = await events('Anniversary Booked');
  assert.equal(ev.email, 'putu@example.com');
  assert.equal(ev.properties.source, 'front-desk');
});

test('a Momence cancellation reaches Klaviyo, our own release does not double up', async () => {
  const { a } = await fullWithQueue();
  const m = await momenceState();
  const bookingId = Object.values(m.bookings).find((b) => b.memberId === m.members['guest1@example.com'].id).id;
  await handleMomenceEvent({ type: 'cancelled', bookingId, sessionKey: 'full-day', member: { id: 'x' } });
  assert.equal((await events('Anniversary Cancelled')).length, 1);
  await handleMomenceEvent({ type: 'cancelled', bookingId, sessionKey: 'full-day', member: { id: 'x' } });
  assert.equal((await events('Anniversary Cancelled')).length, 1);
  assert.ok(a.bookingRef);
});

test('sessions that are not anniversary sessions are ignored (the studio has other classes)', async () => {
  const r = await handleMomenceEvent({ type: 'booked', bookingId: 'b_o', sessionKey: 'some-other-class', member: { id: 'm', email: 'x@example.com' } });
  assert.equal(r.body.ignored, 'not_an_anniversary_session');
  assert.equal((await events()).length, 0);
});

test('the Momence webhook endpoint fails closed without its secret when one is configured', async () => {
  process.env.MOMENCE_WEBHOOK_SECRET = 'hook-secret';
  try {
    const body = { type: 'booked', bookingId: 'b1', sessionKey: 'some-other-class', member: { id: 'm' } };
    assert.equal((await momenceWebhook(post('/api/momence-webhook', body))).status, 401);
    assert.equal((await momenceWebhook(post('/api/momence-webhook', body, { 'x-ra-webhook-secret': 'wrong' }))).status, 401);
    assert.equal((await momenceWebhook(post('/api/momence-webhook', body, { 'x-ra-webhook-secret': 'hook-secret' }))).status, 200);
  } finally { delete process.env.MOMENCE_WEBHOOK_SECRET; }
});

test('single-session waitlist is per session', async () => {
  await createBooking(guest(1, { type: 'single', sessions: ['demo-c'] }));
  await createBooking(guest(2, { type: 'single', sessions: ['demo-c'] }));
  const r = await createBooking(guest(3, { type: 'single', sessions: ['demo-c'] }));
  assert.equal(r.body.status, 'waitlisted');
  const s = await publicState();
  assert.equal(s.fullDay.waiting, 0);
});

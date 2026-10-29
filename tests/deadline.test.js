import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, setNow, fullDayGuest, guest, post, events, bookedCount, withOpen } from './helpers.js';
import { createBooking, runDeadline, confirmSpot, handleStripeEvent, publicState } from '../netlify/functions/_lib/service.js';
import * as mock from '../netlify/functions/_lib/momence-mock.js';
import { open } from '../config/event.config.js';
import { demoValues } from '../config/demo.values.js';
import deadline from '../netlify/functions/deadline.js';

beforeEach(() => fresh({ seedFullDay: 0 }));
const AFTER = '2026-11-28T12:01:00+08:00';
const refOf = async (n, extra) => (await createBooking(fullDayGuest(n, extra))).body.bookingRef;
const donate = (ref) => handleStripeEvent({ type: 'checkout.session.completed', data: { object: { id: `cs_${ref}`, payment_status: 'paid', amount_total: 5000000, currency: 'idr', metadata: { booking_ref: ref } } } });

test('before the deadline the job does nothing', async () => {
  await refOf(1);
  await setNow('2026-11-28T11:59:59+08:00');
  assert.deepEqual(await runDeadline(), { ran: false, reason: 'not_due' });
  assert.equal(await bookedCount('full-day'), 1);
});

test('after the deadline: unconfirmed released, confirmed kept, contributors skipped', async () => {
  const unconfirmed = await refOf(1);
  const confirmed = await refOf(2);
  const donor = await refOf(3, { intent: 'donate' });
  await confirmSpot(confirmed);
  await donate(donor);
  await setNow(AFTER);
  const r = await runDeadline();
  assert.deepEqual(r.released, [unconfirmed]);
  assert.deepEqual(r.skippedConfirmed, [confirmed]);
  assert.deepEqual(r.skippedContributors, [donor]);
  assert.equal(await bookedCount('full-day'), 2);
  assert.equal((await events('Anniversary Released')).length, 1);
});

test('released spots move the waitlist up and the next guest gets "You\'re in"', async () => {
  await mock.fillFullDay(1);
  await refOf(1);
  await refOf(2); // waitlisted
  await setNow(AFTER);
  await runDeadline();
  assert.equal(await bookedCount('full-day'), 50);
  const moved = await events('Anniversary Moved Up');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].email, 'guest2@example.com');
  assert.equal((await publicState()).fullDay.waiting, 0);
});

test('it acts once: a second run does nothing, and a late booking is not swept up', async () => {
  await refOf(1);
  await setNow(AFTER);
  await runDeadline();
  await refOf(2); // booked after the job
  assert.deepEqual(await runDeadline(), { ran: false, reason: 'already_done' });
  assert.equal(await bookedCount('full-day'), 1);
});

test('the scheduled function wraps the same job', async () => {
  await refOf(1);
  await setNow(AFTER);
  const r = await deadline();
  assert.equal((await r.json()).released.length, 1);
});

test('single-session bookings are never released', async () => {
  await createBooking(guest(1, { type: 'single', sessions: ['demo-a', 'demo-b'] }));
  await refOf(2);
  await setNow(AFTER);
  const r = await runDeadline();
  assert.equal(r.released.length, 1);
  assert.equal(await bookedCount('demo-a'), 1);
  assert.equal(await bookedCount('demo-b'), 1);
});

test('decision: contributors who miss the reconfirm lose the spot when config says so', async () => {
  const donor = await refOf(1, { intent: 'donate' });
  await donate(donor);
  await setNow(AFTER);
  await withOpen('amounts', { ...demoValues.amounts, contributorsKeepSpotIfNoReconfirm: false }, async () => {
    const r = await runDeadline();
    assert.deepEqual(r.released, [donor]);
  });
});

test('decision: team review only lists the guests and releases nobody', async () => {
  const a = await refOf(1); await refOf(2);
  await setNow(AFTER);
  await withOpen('reconfirm', { ...demoValues.reconfirm, release: 'team-review' }, async () => {
    const r = await runDeadline();
    assert.equal(r.released.length, 0);
    assert.deepEqual(r.review.map((x) => x.ref).includes(a), true);
    assert.equal(r.review.length, 2);
    assert.equal(await bookedCount('full-day'), 2);
  });
});

test('a failed release is retried on the next run, and nobody is released twice', async () => {
  const a = await refOf(1);
  await refOf(2);
  await setNow(AFTER);
  await mock.failNextCancels(1);
  const first = await runDeadline();
  assert.equal(first.errors.length, 1);
  assert.equal(first.released.length, 1);
  const second = await runDeadline(); // not marked done, so it runs again
  assert.equal(second.ran, true);
  assert.equal(second.errors.length, 0);
  assert.equal(await bookedCount('full-day'), 0);
  assert.equal((await events('Anniversary Released')).length, 2);
  assert.deepEqual(await runDeadline(), { ran: false, reason: 'already_done' });
  assert.ok(a);
});

test('a retry never releases a guest the waitlist moved up during the first run', async () => {
  await mock.fillFullDay(2);
  await refOf(1); await refOf(2);
  const w = await refOf(3); // waitlisted
  await setNow(AFTER);
  await mock.failNextCancels(1);
  await runDeadline();              // guest 1 fails, guest 2 is released, guest 3 moves up
  await runDeadline();              // retry releases guest 1 only
  const { reconfirmState } = await import('../netlify/functions/_lib/service.js');
  assert.equal((await reconfirmState(w)).item.status, 'booked'); // still booked
  assert.equal(await bookedCount('full-day'), 49);
});

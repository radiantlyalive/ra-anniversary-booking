import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, fullDayGuest, idemKey, post, events, momenceState } from './helpers.js';
import { createBooking } from '../netlify/functions/_lib/service.js';
import contribute from '../netlify/functions/contribute.js';
import stripeWebhook from '../netlify/functions/stripe-webhook.js';
import { verifyWebhook, signPayload, toMinorUnits, fromMinorUnits } from '../netlify/functions/_lib/stripe.js';

beforeEach(() => fresh({ seedFullDay: 13 }));

const startBooking = async (n = 1) => (await createBooking(fullDayGuest(n, { intent: 'donate' }))).body.bookingRef;
const pay = (ref, amount = 250000, id = 'cs_test_1') =>
  stripeWebhook(post('/api/stripe-webhook', {
    id: `evt_${id}`, type: 'checkout.session.completed',
    data: { object: { id, payment_status: 'paid', amount_total: toMinorUnits(amount, 'IDR'), currency: 'idr', metadata: { booking_ref: ref } } },
  }));
const contrib = async (body, key = idemKey()) => {
  const r = await contribute(post('/api/contribute', body, { 'idempotency-key': key }));
  return { status: r.status, body: await r.json() };
};

test('contribute opens a Stripe checkout linked to the booking', async () => {
  const ref = await startBooking();
  const r = await contrib({ bookingRef: ref, amount: 250000 });
  assert.equal(r.status, 200);
  assert.match(r.body.checkoutUrl, /ref=/);
  assert.ok(r.body.checkoutUrl.includes(encodeURIComponent(ref)) || r.body.checkoutUrl.includes(ref));
});

test('the minimum amount is IDR 10,000', async () => {
  const ref = await startBooking();
  assert.equal((await contrib({ bookingRef: ref, amount: 9999 })).status, 422);
  assert.equal((await contrib({ bookingRef: ref, amount: 10000 })).status, 200);
  assert.equal((await contrib({ bookingRef: ref, amount: 'abc' })).status, 422);
  assert.equal((await contrib({ bookingRef: ref, amount: 12.5 })).status, 422);
});

test('contribute needs a real booking and an Idempotency-Key', async () => {
  assert.equal((await contrib({ bookingRef: 'nope', amount: 20000 })).status, 404);
  const r = await contribute(post('/api/contribute', { bookingRef: 'x', amount: 20000 }));
  assert.equal(r.status, 400);
});

test('a double click on the payment button returns the same checkout', async () => {
  const ref = await startBooking();
  const key = idemKey();
  const a = await contrib({ bookingRef: ref, amount: 50000 }, key);
  const b = await contrib({ bookingRef: ref, amount: 50000 }, key);
  assert.deepEqual(a.body, b.body);
});

test('a guest who abandons Stripe keeps the free spot and is not tagged', async () => {
  const ref = await startBooking();
  await contrib({ bookingRef: ref, amount: 100000 });
  // nothing else happens: no webhook
  const m = await momenceState();
  assert.equal(Object.values(m.bookings).filter((b) => b.status === 'booked' && b.sessionKey === 'full-day').length, 14);
  assert.deepEqual(Object.values(m.members).find((x) => x.email === 'guest1@example.com').tags, []);
  assert.equal((await events('Anniversary Contributed')).length, 0);
});

test('Stripe paid: tags the guest Donor in Momence and sends Contributed to Klaviyo', async () => {
  const ref = await startBooking();
  const r = await pay(ref, 250000);
  assert.equal(r.status, 200);
  const m = await momenceState();
  assert.deepEqual(Object.values(m.members).find((x) => x.email === 'guest1@example.com').tags, ['Anniversary 2026 – Donor']);
  const [ev] = await events('Anniversary Contributed');
  assert.equal(ev.properties.amount, 250000);
  assert.equal(ev.properties.currency, 'IDR');
});

test('a repeated Stripe webhook does not send Contributed twice', async () => {
  const ref = await startBooking();
  await pay(ref); await pay(ref);
  assert.equal((await events('Anniversary Contributed')).length, 1);
});

test('unpaid or unrelated Stripe events are acknowledged and ignored', async () => {
  const ref = await startBooking();
  const r = await stripeWebhook(post('/api/stripe-webhook', { type: 'checkout.session.completed', data: { object: { id: 'cs_x', payment_status: 'unpaid', metadata: { booking_ref: ref } } } }));
  assert.equal(r.status, 200);
  assert.equal((await events('Anniversary Contributed')).length, 0);
  const r2 = await stripeWebhook(post('/api/stripe-webhook', { type: 'charge.refunded', data: { object: {} } }));
  assert.equal(r2.status, 200);
});

test('a paid event for an unknown booking is acknowledged, not retried forever', async () => {
  const r = await pay('does-not-exist');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).unmatched, true);
});

// ---- signature verification (the real check, used in sandbox and live) ----
const SECRET = 'whsec_test_secret';
const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });

test('Stripe signature: a correct signature passes', () => {
  const now = 1_800_000_000;
  const ev = verifyWebhook(body, signPayload(body, SECRET, now), { secret: SECRET, nowSec: now });
  assert.equal(ev.id, 'evt_1');
});
test('Stripe signature: wrong secret, tampered body, missing header and old timestamps are rejected', () => {
  const now = 1_800_000_000;
  const bad = (h, b = body) => assert.throws(() => verifyWebhook(b, h, { secret: SECRET, nowSec: now }), { code: 'bad_signature' });
  bad(signPayload(body, 'whsec_other', now));
  bad(signPayload(body, SECRET, now), body + ' ');
  bad(undefined);
  bad('garbage');
  bad(signPayload(body, SECRET, now - 301));
});
test('with a webhook secret set, an unsigned request is refused even in mock mode', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  try {
    const r = await stripeWebhook(post('/api/stripe-webhook', JSON.parse(body)));
    assert.equal(r.status, 400);
    const raw = JSON.stringify({ id: 'evt_2', type: 'charge.refunded', data: { object: {} } });
    const ok = await stripeWebhook(new Request('http://localhost/api/stripe-webhook', { method: 'POST', body: raw, headers: { 'stripe-signature': signPayload(raw, SECRET) } }));
    assert.equal(ok.status, 200);
  } finally { delete process.env.STRIPE_WEBHOOK_SECRET; }
});

test('minor units: IDR is two-decimal, JPY is whole', () => {
  assert.equal(toMinorUnits(10000, 'IDR'), 1000000);
  assert.equal(fromMinorUnits(1000000, 'idr'), 10000);
  assert.equal(toMinorUnits(500, 'JPY'), 500);
});

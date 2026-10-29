import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, setNow, guest, fullDayGuest, idemKey, post, events, bookedCount, momenceState } from './helpers.js';
import { createBooking, publicState } from '../src/lib/service.js';
import book from '../src/handlers/book.js';
import spots from '../src/handlers/spots.js';

beforeEach(() => fresh({ seedFullDay: 13 }));

const call = async (body, key = idemKey(), ip = '10.0.0.1') => {
  const r = await book(post('/api/book', body, { 'idempotency-key': key, 'x-nf-client-connection-ip': ip }));
  return { status: r.status, body: await r.json() };
};

test('spots shows the live counter from Momence', async () => {
  const r = await spots(new Request('http://localhost/api/spots'));
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.fullDay.left, 37);
  assert.equal(j.fullDay.capacity, 50);
  assert.equal(j.fullDay.full, false);
  assert.equal(j.bookingOpen, true);
});

test('Join for Free books a free Full Day spot and tells Klaviyo, with a reconfirm link', async () => {
  const r = await call(fullDayGuest(1));
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'booked');
  assert.equal(r.body.next, 'done');
  assert.equal(await bookedCount('full-day'), 14);
  const [ev] = await events('Anniversary Booked');
  assert.equal(ev.email, 'guest1@example.com');
  assert.match(ev.properties.reconfirm_url, /\/api\/reconfirm\?t=/);
});

test('Join with Donation books the free spot FIRST, then asks for an amount', async () => {
  const r = await call(fullDayGuest(1, { intent: 'donate' }));
  assert.equal(r.body.next, 'amount');
  assert.equal(await bookedCount('full-day'), 14);
});

test('Full Day needs the whole-day tick, enforced on the server', async () => {
  const r = await call(fullDayGuest(1, { wholeDay: false }));
  assert.equal(r.status, 422);
  assert.ok(r.body.fields.wholeDay);
  assert.equal(await bookedCount('full-day'), 13);
});

test('all three fields are validated on the server', async () => {
  const r = await call({ type: 'full-day', wholeDay: true, name: '', email: 'x', whatsapp: '123', intent: 'free' });
  assert.equal(r.status, 422);
  assert.deepEqual(Object.keys(r.body.fields).sort(), ['email', 'name', 'whatsapp']);
});

test('a double click never double-books: same key, one booking', async () => {
  const key = idemKey();
  const [a, b] = await Promise.all([call(fullDayGuest(1), key), call(fullDayGuest(1), key)]);
  assert.ok([a.status, b.status].includes(201));
  assert.equal(await bookedCount('full-day'), 14);
  const again = await call(fullDayGuest(1), key);
  assert.equal(again.status, 201);
  assert.equal(again.body.replay, undefined); // body is the stored result
  assert.equal(await bookedCount('full-day'), 14);
  assert.equal((await events('Anniversary Booked')).length, 1);
});

test('a second attempt with a new key and the same email does not double-book', async () => {
  await call(fullDayGuest(1));
  const r = await call(fullDayGuest(1));
  assert.equal(r.status, 200);
  assert.equal(r.body.duplicate, true);
  assert.equal(await bookedCount('full-day'), 14);
});

test('the cap holds: spot 50 is booked, guest 51 joins the waitlist', async () => {
  for (let i = 1; i <= 37; i++) assert.equal((await createBooking(fullDayGuest(i))).body.status, 'booked');
  assert.equal(await bookedCount('full-day'), 50);
  const r = await call(fullDayGuest(100));
  assert.equal(r.body.status, 'waitlisted');
  assert.equal(r.body.next, 'done');
  assert.equal(await bookedCount('full-day'), 50);
  assert.equal((await publicState()).fullDay.waiting, 1);
  const [w] = await events('Anniversary Waitlisted');
  assert.equal(w.email, 'guest100@example.com');
});

test('a waitlisted guest asking for a donation is not sent to the amount step', async () => {
  await (await import('../src/lib/momence-mock.js')).fillFullDay();
  const r = await call(fullDayGuest(5, { intent: 'donate' }));
  assert.equal(r.body.status, 'waitlisted');
  assert.equal(r.body.next, 'done');
});

test('single sessions: pick several, per-session cap, per-session waitlist', async () => {
  const sessions = ['demo-a', 'demo-b', 'demo-c']; // demo-c has a cap of 2
  assert.equal((await createBooking(guest(1, { type: 'single', sessions }))).body.status, 'booked');
  assert.equal((await createBooking(guest(2, { type: 'single', sessions }))).body.status, 'booked');
  const r = await createBooking(guest(3, { type: 'single', sessions }));
  assert.equal(r.body.status, 'partial');
  assert.deepEqual(r.body.items.map((i) => i.status), ['booked', 'booked', 'waitlisted']);
  const st = await publicState();
  assert.equal(st.sessions.find((s) => s.key === 'demo-c').full, true);
  assert.equal(st.fullDay.left, 37); // single sessions never use Full Day places
});

test('single sessions need at least one valid session', async () => {
  const r = await createBooking(guest(1, { type: 'single', sessions: ['nope'] }));
  assert.equal(r.status, 422);
  assert.ok(r.body.fields.sessions);
});

test('booking is refused before it opens', async () => {
  const { open } = await import('../config/event.config.js');
  open.bookingOpens.value = '2026-11-12T00:00:00+08:00';
  try {
    await setNow('2026-11-11T12:00:00+08:00');
    assert.equal((await call(fullDayGuest(1))).body.error, 'closed');
    await setNow('2026-11-12T00:00:01+08:00');
    assert.equal((await call(fullDayGuest(2))).status, 201);
  } finally { open.bookingOpens.value = null; }
});

test('honeypot: a filled hidden field is refused', async () => {
  const r = await call({ ...fullDayGuest(1), website: 'http://spam.example' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, 'bot');
  assert.equal(await bookedCount('full-day'), 13);
});

test('an Idempotency-Key is required', async () => {
  const r = await book(post('/api/book', fullDayGuest(1), { 'x-nf-client-connection-ip': '10.9.9.9' }));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, 'idempotency_key_required');
});

test('rate limit by IP', async () => {
  let last;
  for (let i = 0; i < 12; i++) last = await call(fullDayGuest(i + 1, { wholeDay: false }), idemKey(), '10.1.1.1');
  assert.equal(last.status, 429);
  assert.equal(last.body.error, 'rate_limited');
  assert.equal((await call(fullDayGuest(99), idemKey(), '10.2.2.2')).status, 201); // other IP unaffected
});

test('a refused booking attempt frees the key so the guest can retry', async () => {
  const key = idemKey();
  const bad = await call({ ...fullDayGuest(1), email: 'bad' }, key);
  assert.equal(bad.status, 422);
  const good = await call(fullDayGuest(1), key); // only successes are replayed
  assert.equal(good.status, 201);
});

test('Momence state matches what the widget was told', async () => {
  await call(fullDayGuest(1));
  const m = await momenceState();
  assert.equal(Object.values(m.members).filter((x) => x.email === 'guest1@example.com').length, 1);
});

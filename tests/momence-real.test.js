import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fresh, post } from './helpers.js';
import { fullDay } from '../config/event.config.js';
import * as store from '../src/lib/store.js';
import momenceWebhook from '../src/handlers/momence-webhook.js';
import {
  BASE, getSession, findOrCreateMember, book, joinWaitlist, cancelBooking, addTag, verifyWebhook, parseWebhook, keyOfMomenceId,
} from '../src/lib/momence-real.js';

process.env.MOMENCE_CLIENT_ID = 'cid'; process.env.MOMENCE_CLIENT_SECRET = 'csecret';
process.env.MOMENCE_USERNAME = 'booking-page@example.com'; process.env.MOMENCE_PASSWORD = 'pw';
const SID = 111;
const was = fullDay.momenceSessionId;
beforeEach(async () => { await fresh({ now: null }); fullDay.momenceSessionId = SID; });
afterEach(() => { fullDay.momenceSessionId = was; });

const tok = { accessToken: 'tok', accessTokenExpiresAt: new Date(Date.now() + 3600e3).toISOString(), refreshToken: 'r', refreshTokenExpiresAt: new Date(Date.now() + 7200e3).toISOString() };
// Routes a fake Momence: handlers keyed "METHOD /path". Records every call.
function momence(routes) {
  const calls = [];
  const f = async (url, init = {}) => {
    const u = new URL(url); const key = `${init.method || 'GET'} ${u.pathname}`;
    calls.push({ key, query: Object.fromEntries(u.searchParams), body: init.body && init.headers?.['content-type'] === 'application/json' ? JSON.parse(init.body) : undefined, headers: init.headers });
    if (key === 'POST /api/v2/auth/token') return { ok: true, status: 200, json: async () => tok };
    const h = routes[key];
    if (!h) throw new Error(`unexpected call ${key}`);
    const r = typeof h === 'function' ? h(calls.at(-1)) : h;
    return { ok: (r.status || 200) < 300, status: r.status || 200, json: async () => { if (r.body === undefined) throw new Error('empty'); return r.body; } };
  };
  f.calls = calls; return f;
}
const detail = (over = {}) => ({ id: SID, capacity: 2, bookingCount: 0, waitlistCapacity: 5, waitlistBookingCount: 0, ...over });
const page = (payload, totalCount = payload.length) => ({ pagination: { page: 0, pageSize: 100, totalCount }, payload });

test('getSession reads capacity, bookings and waitlist from the session detail, with a Bearer token', async () => {
  const f = momence({ [`GET /api/v2/host/sessions/${SID}`]: { body: detail({ bookingCount: 1, waitlistBookingCount: 3 }) } });
  assert.deepEqual(await getSession('full-day', { fetchImpl: f }), { capacity: 2, booked: 1, left: 1, waiting: 3 });
  assert.equal(f.calls.at(-1).headers.authorization, 'Bearer tok');
});

test('findOrCreateMember matches the exact email only, and creates when there is none', async () => {
  let f = momence({ 'GET /api/v2/host/members': { body: page([{ id: 7, email: 'ayu2@example.com' }, { id: 8, email: 'AYU@example.com' }]) } });
  assert.deepEqual(await findOrCreateMember({ name: 'Ayu L', email: 'ayu@example.com' }, { fetchImpl: f }), { id: 8 });
  f = momence({ 'GET /api/v2/host/members': { body: page([{ id: 7, email: 'ayu2@example.com' }]) }, 'POST /api/v2/host/members': { body: { memberId: 99 } } });
  assert.deepEqual(await findOrCreateMember({ name: 'Ayu Lestari Putri', email: 'Ayu@Example.com', whatsapp: '+6281' }, { fetchImpl: f }), { id: 99 });
  assert.deepEqual(f.calls.at(-1).body, { email: 'ayu@example.com', firstName: 'Ayu', lastName: 'Lestari Putri', phoneNumber: '+6281' });
});

test('book refuses at capacity without calling Momence to book', async () => {
  const f = momence({ [`GET /api/v2/host/sessions/${SID}`]: { body: detail({ bookingCount: 2 }) } });
  assert.deepEqual(await book({ memberId: 5, sessionKey: 'full-day' }, { fetchImpl: f }), { ok: false, reason: 'full' });
  assert.ok(!f.calls.some((c) => c.key.includes('/bookings/free')));
});

test('book posts the member id and returns the booking id', async () => {
  const f = momence({
    [`GET /api/v2/host/sessions/${SID}`]: { body: detail({ bookingCount: 1 }) },
    [`POST /api/v2/host/sessions/${SID}/bookings/free`]: { body: { sessionBookingId: 501 } },
    [`GET /api/v2/host/sessions/${SID}/bookings`]: { body: page([{ id: 500 }, { id: 501 }]) },
  });
  assert.deepEqual(await book({ memberId: 5, sessionKey: 'full-day' }, { fetchImpl: f }), { ok: true, bookingId: 501 });
  assert.deepEqual(f.calls.find((c) => c.key.endsWith('/bookings/free')).body, { memberId: 5 });
});

test('a booking that landed beyond capacity in a race is cancelled, and only that one', async () => {
  const f = momence({
    [`GET /api/v2/host/sessions/${SID}`]: { body: detail({ bookingCount: 1 }) },
    [`POST /api/v2/host/sessions/${SID}/bookings/free`]: { body: { sessionBookingId: 503 } },
    [`GET /api/v2/host/sessions/${SID}/bookings`]: { body: page([{ id: 500 }, { id: 502 }, { id: 503 }]) },
    'DELETE /api/v2/host/session-bookings/503': { status: 200 },
  });
  assert.deepEqual(await book({ memberId: 5, sessionKey: 'full-day' }, { fetchImpl: f }), { ok: false, reason: 'full' });
  assert.ok(f.calls.some((c) => c.key === 'DELETE /api/v2/host/session-bookings/503'));
});

test('enforceCap:false hands the decision to Momence (used by the checks script)', async () => {
  const f = momence({ [`POST /api/v2/host/sessions/${SID}/bookings/free`]: { body: { sessionBookingId: 9 } } });
  assert.deepEqual(await book({ memberId: 5, sessionKey: 'full-day', enforceCap: false }, { fetchImpl: f }), { ok: true, bookingId: 9 });
});

test('a Momence error on booking surfaces its type and nothing secret', async () => {
  const f = momence({ [`GET /api/v2/host/sessions/${SID}`]: { body: detail() }, [`POST /api/v2/host/sessions/${SID}/bookings/free`]: { status: 400, body: { type: 'err-member-not-assigned-to-host', message: 'x' } } });
  await assert.rejects(book({ memberId: 5, sessionKey: 'full-day' }, { fetchImpl: f }), (e) => e.type === 'err-member-not-assigned-to-host' && !/tok|csecret|pw/.test(e.message));
});

test('joinWaitlist returns the entry and position, and maps the documented refusals', async () => {
  const route = `POST /api/v2/host/sessions/${SID}/waitlist/bookings`;
  let f = momence({ [route]: { body: { waitlistBookingId: 31 } }, [`GET /api/v2/host/sessions/${SID}`]: { body: detail({ waitlistBookingCount: 4 }) } });
  assert.deepEqual(await joinWaitlist({ memberId: 5, sessionKey: 'full-day' }, { fetchImpl: f }), { ok: true, entryId: 31, position: 4 });
  f = momence({ [route]: { status: 400, body: { type: 'err-waitlist-full' } } });
  assert.deepEqual(await joinWaitlist({ memberId: 5, sessionKey: 'full-day' }, { fetchImpl: f }), { ok: false, reason: 'waitlist_full' });
});

test('cancelBooking sends the three required flags and returns no promoted guests', async () => {
  const f = momence({ 'DELETE /api/v2/host/session-bookings/501': { status: 200 } });
  assert.deepEqual(await cancelBooking({ bookingId: 501 }, { fetchImpl: f }), { ok: true, promoted: [] });
  assert.deepEqual(f.calls.at(-1).body, { refund: false, disableNotifications: true, isLateCancellation: false });
});

test('addTag finds the tag by exact name once, caches its id, then assigns it', async () => {
  const f = momence({
    'GET /api/v2/host/tags': { body: page([{ id: 1, name: 'Other' }, { id: 4, name: 'Anniversary 2026 – Donor' }]) },
    'POST /api/v2/host/members/5/tags/4': { status: 201 },
  });
  await addTag({ memberId: 5, tag: 'Anniversary 2026 – Donor' }, { fetchImpl: f });
  await addTag({ memberId: 5, tag: 'Anniversary 2026 – Donor' }, { fetchImpl: f });
  assert.equal(f.calls.filter((c) => c.key === 'GET /api/v2/host/tags').length, 1);
  await assert.rejects(addTag({ memberId: 5, tag: 'Missing' }, { fetchImpl: momence({ 'GET /api/v2/host/tags': { body: page([]) } }) }), /does not exist/);
});

test('a 401 drops the cached token and retries once', async () => {
  let n = 0;
  const f = momence({ [`GET /api/v2/host/sessions/${SID}`]: () => (++n === 1 ? { status: 401, body: {} } : { body: detail() }) });
  assert.equal((await getSession('full-day', { fetchImpl: f })).capacity, 2);
  assert.equal(f.calls.filter((c) => c.key === 'POST /api/v2/auth/token').length, 2);
});

// ---- webhooks ----
const SECRET = 'whsec-test';
const msg = (event, payload) => ({ payload: JSON.stringify({ timestamp: '2026-11-12T00:00:00.000Z', event, payload }) });
const hdr = (body, over = {}) => new Headers({ 'x-webhook-secret': SECRET, 'x-webhook-signature': createHmac('sha256', SECRET).update(body.payload).digest('hex'), 'x-webhook-reqeuest-id': 'req-1', ...over });

test('webhook verification: secret and HMAC must both match, hex or base64, else refused', () => {
  const b = msg('session-booked', { sessionId: SID });
  assert.equal(verifyWebhook(b, hdr(b), SECRET).event, 'session-booked');
  const b64 = createHmac('sha256', SECRET).update(b.payload).digest('base64');
  assert.equal(verifyWebhook(b, hdr(b, { 'x-webhook-signature': b64 }), SECRET).event, 'session-booked');
  const bad = (h, body = b, s = SECRET) => assert.throws(() => verifyWebhook(body, h, s), { code: 'bad_webhook' });
  bad(hdr(b, { 'x-webhook-secret': 'nope' }));
  bad(hdr(b, { 'x-webhook-signature': 'deadbeef' }));
  bad(hdr(b), { payload: b.payload + ' ' });
  bad(hdr(b), b, ''); // no secret configured: fail closed
  bad(new Headers(), b);
});

test('parseWebhook: other events and other sessions are ignored before any API call; dot spelling is not accepted', async () => {
  const noCalls = momence({});
  for (const [event, payload, want] of [
    ['member-updated', {}, 'event'],
    ['session.booked', { sessionId: SID }, 'event'],
    ['session-booked', { sessionId: 999 }, 'not_an_anniversary_session'],
  ]) {
    const b = msg(event, payload);
    process.env.MOMENCE_WEBHOOK_SECRET = SECRET;
    assert.equal((await parseWebhook(b, hdr(b), { fetchImpl: noCalls })).ignored, want);
  }
  assert.equal(noCalls.calls.length, 0);
});

test('parseWebhook turns a booked event into a normalised event using the booking list, and a cancel without any call', async () => {
  process.env.MOMENCE_WEBHOOK_SECRET = SECRET;
  const b = msg('session-booked', { sessionId: SID, sessionBookingId: 501, payingMemberId: 5, targetMemberId: 5 });
  const f = momence({ [`GET /api/v2/host/sessions/${SID}/bookings`]: { body: page([{ id: 501, member: { id: 5, firstName: 'Ayu', lastName: 'Lestari', email: 'ayu@example.com', phoneNumber: '+6281' } }]) } });
  assert.deepEqual(await parseWebhook(b, hdr(b), { fetchImpl: f }), { type: 'booked', bookingId: 501, sessionKey: 'full-day', member: { id: 5, name: 'Ayu Lestari', email: 'ayu@example.com', whatsapp: '+6281' } });
  const missing = msg('session-booked', { sessionId: SID, sessionBookingId: 777, payingMemberId: 5, targetMemberId: 5 });
  assert.equal((await parseWebhook(missing, hdr(missing), { fetchImpl: f })).ignored, 'booking_not_found');
  const c = msg('session-booking-cancelled', { sessionBookingId: 501, sessionId: SID, payingMemberId: 5, targetMemberId: 5, isLateCancellation: false, cancelledAt: 'x' });
  assert.deepEqual(await parseWebhook(c, hdr(c), { fetchImpl: noCallsFetch() }), { type: 'cancelled', bookingId: 501, sessionKey: 'full-day', member: { id: 5 } });
  delete process.env.MOMENCE_WEBHOOK_SECRET;
});
const noCallsFetch = () => momence({});

test('keyOfMomenceId maps ids back to session keys', () => {
  assert.equal(keyOfMomenceId({ fullDay: { key: 'full-day', momenceSessionId: 111 }, sessions: [{ key: 'yin', momenceSessionId: 222 }] }, '222'), 'yin');
  assert.equal(keyOfMomenceId({ fullDay: { key: 'full-day', momenceSessionId: 111 }, sessions: [] }, 5), null);
});

test('the endpoint outside mock mode: bad signature is 401, retries with the same request id are dropped', async () => {
  process.env.BOOKING_MODE = 'sandbox'; process.env.MOMENCE_WEBHOOK_SECRET = SECRET;
  try {
    const ignoredBody = msg('member-updated', {});
    const req = (h) => new Request('http://localhost/api/momence-webhook', { method: 'POST', headers: { 'content-type': 'application/json', ...Object.fromEntries(h) }, body: JSON.stringify(ignoredBody) });
    assert.equal((await momenceWebhook(req(hdr(ignoredBody, { 'x-webhook-signature': 'bad' })))).status, 401);
    const r = await momenceWebhook(req(hdr(ignoredBody)));
    assert.equal(r.status, 200); assert.equal((await r.json()).ignored, 'event');
  } finally { process.env.BOOKING_MODE = 'mock'; delete process.env.MOMENCE_WEBHOOK_SECRET; }
});

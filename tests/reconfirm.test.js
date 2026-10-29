import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh, setNow, fullDayGuest, post, events, momenceState } from './helpers.js';
import { createBooking, reconfirmUrl, reconfirmState } from '../netlify/functions/_lib/service.js';
import { getConfig } from '../netlify/functions/_lib/config.js';
import { readToken, signToken } from '../netlify/functions/_lib/signing.js';
import * as mock from '../netlify/functions/_lib/momence-mock.js';
import reconfirm from '../netlify/functions/reconfirm.js';

beforeEach(() => fresh({ seedFullDay: 13 }));

const mk = async (n = 1) => {
  const ref = (await createBooking(fullDayGuest(n))).body.bookingRef;
  const url = new URL(reconfirmUrl(getConfig(), ref));
  return { ref, token: url.searchParams.get('t'), path: url.pathname + url.search };
};
const form = (token, action) => new Request('http://localhost/api/reconfirm', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ t: token, action }).toString() });
const tags = async (email) => (await momenceState()).members[email].tags;

test('opening the link changes nothing (email scanners open links)', async () => {
  const { path, ref } = await mk();
  const before = JSON.stringify([await momenceState(), await events()]);
  for (let i = 0; i < 3; i++) {
    const r = await reconfirm(new Request(`http://localhost${path}`));
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /<form method="post"/);
    assert.match(html, /Confirm my spot/);
  }
  assert.equal(JSON.stringify([await momenceState(), await events()]), before);
  assert.equal((await reconfirmState(ref)).state, 'pending');
});

test('GET also ignores action parameters in the URL', async () => {
  const { path, ref } = await mk();
  await reconfirm(new Request(`http://localhost${path}&action=release`));
  assert.equal((await reconfirmState(ref)).state, 'pending');
});

test('a tap (POST) confirms: Momence tag Confirmed, Klaviyo Confirmed', async () => {
  const { token, ref } = await mk();
  const r = await reconfirm(form(token, 'confirm'));
  assert.equal(r.status, 200);
  assert.match(await r.text(), /See you on 1 December/);
  assert.deepEqual(await tags('guest1@example.com'), ['Anniversary 2026 – Confirmed']);
  assert.equal((await events('Anniversary Confirmed')).length, 1);
  assert.equal((await reconfirmState(ref)).state, 'confirmed');
});

test('confirming twice is harmless', async () => {
  const { token } = await mk();
  await reconfirm(form(token, 'confirm')); await reconfirm(form(token, 'confirm'));
  assert.equal((await events('Anniversary Confirmed')).length, 1);
  assert.deepEqual(await tags('guest1@example.com'), ['Anniversary 2026 – Confirmed']);
});

test('"I can\'t make it" releases the spot and moves the waitlist up', async () => {
  await mock.fillFullDay(1);
  const { token } = await mk(1);
  await createBooking(fullDayGuest(2)); // waitlisted
  const r = await reconfirm(form(token, 'release'));
  assert.match(await r.text(), /Thank you for letting us know/);
  assert.equal((await events('Anniversary Released')).length, 1);
  const moved = await events('Anniversary Moved Up');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].email, 'guest2@example.com');
});

test('a released guest opening the old link sees it is released, and cannot change it', async () => {
  const { token, path } = await mk();
  await reconfirm(form(token, 'release'));
  const html = await (await reconfirm(new Request(`http://localhost${path}`))).text();
  assert.match(html, /has been released/);
  await reconfirm(form(token, 'confirm'));
  assert.equal((await events('Anniversary Confirmed')).length, 0);
});

test('tampered, malformed and missing tokens are refused and change nothing', async () => {
  const { token } = await mk();
  const bad = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
  assert.equal(readToken(bad), null);
  assert.equal(readToken('x.y'), null);
  assert.equal(readToken(''), null);
  for (const t of [bad, 'junk', '']) {
    const r = await reconfirm(form(t, 'confirm'));
    assert.equal(r.status, 400);
  }
  assert.equal((await events()).filter((e) => e.event !== 'Anniversary Booked').length, 0);
});

test('a bad action is refused', async () => {
  const { token } = await mk();
  assert.equal((await reconfirm(form(token, 'delete'))).status, 400);
});

test('a signed token for a booking that does not exist shows the invalid page', async () => {
  const t = signToken({ ref: 'ghost', expiresAtMs: Date.now() + 1e6 });
  const html = await (await reconfirm(new Request(`http://localhost/api/reconfirm?t=${t}`))).text();
  assert.match(html, /not valid/);
});

test('after the deadline the page says so and neither action changes anything', async () => {
  const { token, path, ref } = await mk();
  await setNow('2026-11-28T12:00:01+08:00');
  assert.match(await (await reconfirm(new Request(`http://localhost${path}`))).text(), /deadline has passed/);
  await reconfirm(form(token, 'confirm'));
  assert.equal((await reconfirmState(ref)).state, 'closed');
  assert.equal((await events('Anniversary Confirmed')).length, 0);
});

test('JSON callers get JSON', async () => {
  const { token } = await mk();
  const r = await reconfirm(post('/api/reconfirm', { t: token, action: 'confirm' }, { accept: 'application/json' }));
  assert.deepEqual(await r.json(), { state: 'confirmed', changed: true });
});

test('the page escapes names and carries no personal data in the URL', async () => {
  const ref = (await createBooking(fullDayGuest(7, { name: '<b>Ayu</b>' }))).body.bookingRef;
  const url = reconfirmUrl(getConfig(), ref);
  assert.doesNotMatch(decodeURIComponent(url), /example\.com|Ayu/);
  const html = await (await reconfirm(new Request(url))).text();
  assert.doesNotMatch(html, /<b>Ayu/);
});

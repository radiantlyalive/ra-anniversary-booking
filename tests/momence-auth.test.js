import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fresh } from './helpers.js';
import { getAccessToken, BASE, MomenceDocsNeeded, findOrCreateMember, book, parseWebhook } from '../src/lib/momence-real.js';

process.env.MOMENCE_CLIENT_ID = 'cid'; process.env.MOMENCE_CLIENT_SECRET = 'csecret';
process.env.MOMENCE_USERNAME = 'booking-page@example.com'; process.env.MOMENCE_PASSWORD = 'pw';

beforeEach(() => fresh({ now: null }));

const token = (n, accessMin = 60, refreshMin = 600, now = Date.now()) => ({
  accessToken: `a${n}`, access_token: `a${n}`, accessTokenExpiresAt: new Date(now + accessMin * 60000).toISOString(),
  refreshToken: `r${n}`, refresh_token: `r${n}`, refreshTokenExpiresAt: new Date(now + refreshMin * 60000).toISOString(),
});
function fakeFetch(...responses) {
  const calls = [];
  const f = async (url, init) => { calls.push({ url, init }); const r = responses.shift(); return { ok: r.ok !== false, status: r.status || 200, json: async () => r.body }; };
  f.calls = calls; return f;
}

test('first call uses the password grant with Basic auth, form-encoded, at the documented path', async () => {
  const f = fakeFetch({ body: token(1) });
  assert.equal(await getAccessToken({ fetchImpl: f }), 'a1');
  const { url, init } = f.calls[0];
  assert.equal(url, `${BASE}/api/v2/auth/token`);
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.authorization, `Basic ${Buffer.from('cid:csecret').toString('base64')}`);
  assert.equal(init.headers['content-type'], 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(init.body);
  assert.equal(form.get('grant_type'), 'password');
  assert.equal(form.get('username'), 'booking-page@example.com');
});

test('the token is cached while valid', async () => {
  const f = fakeFetch({ body: token(1) });
  await getAccessToken({ fetchImpl: f }); await getAccessToken({ fetchImpl: f });
  assert.equal(f.calls.length, 1);
});

test('an expired access token is refreshed with the refresh token', async () => {
  const f = fakeFetch({ body: token(1, 1) }, { body: token(2) });
  await getAccessToken({ fetchImpl: f });
  assert.equal(await getAccessToken({ fetchImpl: f, now: Date.now() + 2 * 60000 }), 'a2');
  const form = new URLSearchParams(f.calls[1].init.body);
  assert.equal(form.get('grant_type'), 'refresh_token');
  assert.equal(form.get('refresh_token'), 'r1');
});

test('if the refresh fails, it falls back to the password grant', async () => {
  const f = fakeFetch({ body: token(1, 1) }, { ok: false, status: 400, body: {} }, { body: token(3) });
  await getAccessToken({ fetchImpl: f });
  assert.equal(await getAccessToken({ fetchImpl: f, now: Date.now() + 2 * 60000 }), 'a3');
  assert.equal(new URLSearchParams(f.calls[2].init.body).get('grant_type'), 'password');
});

test('a failed token request is an error, and no secret appears in it', async () => {
  const f = fakeFetch({ ok: false, status: 401, body: {} });
  await assert.rejects(getAccessToken({ fetchImpl: f }), (e) => /401/.test(e.message) && !/csecret|pw/.test(e.message));
});

test('endpoints that are not documented yet refuse instead of guessing', async () => {
  await assert.rejects(findOrCreateMember(), MomenceDocsNeeded);
  await assert.rejects(book(), MomenceDocsNeeded);
  assert.throws(() => parseWebhook(), MomenceDocsNeeded);
});

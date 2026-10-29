// Real Momence client, written against docs/momence.md (Momence OpenAPI pages read 2026-10-29).
// Not run against Momence yet: it waits for sandbox access and the three checks. Behaviour the docs
// do not state is marked UNKNOWN here and in docs/momence.md. Nothing in this file talks to a
// production session unless BOOKING_MODE is sandbox or live.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireEnv } from './env.js';
import * as store from './store.js';
import { getConfig, sessionByKey } from './config.js';

export const BASE = 'https://api.momence.com';

export class MomenceError extends Error {
  constructor(what, status, type) { super(`Momence ${what} failed: ${status}${type ? ` ${type}` : ''}`); this.status = status; this.type = type; }
}

// ---- Auth (documented) ----
// POST /api/v2/auth/token, form-urlencoded, HTTP Basic with the API client id and secret.
// grant_type=password uses the dedicated booking-page staff login.
const TOKEN_KEY = 'momence:token';
const SKEW_MS = 60_000;

async function tokenRequest(form, fetchImpl) {
  const basic = Buffer.from(`${requireEnv('MOMENCE_CLIENT_ID')}:${requireEnv('MOMENCE_CLIENT_SECRET')}`).toString('base64');
  const res = await fetchImpl(`${BASE}/api/v2/auth/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
  if (!res.ok) throw new Error(`Momence token request failed: ${res.status}`);
  return res.json();
}

const passwordGrant = (fetchImpl) =>
  tokenRequest({ grant_type: 'password', username: requireEnv('MOMENCE_USERNAME'), password: requireEnv('MOMENCE_PASSWORD') }, fetchImpl);

// Returns a valid access token: cached, else refreshed, else a new password grant.
export async function getAccessToken({ fetchImpl = fetch, now = Date.now() } = {}) {
  const cached = await store.get(TOKEN_KEY);
  if (cached && Date.parse(cached.accessTokenExpiresAt) - SKEW_MS > now) return cached.accessToken;
  let tok;
  if (cached && Date.parse(cached.refreshTokenExpiresAt) - SKEW_MS > now) {
    try { tok = await tokenRequest({ grant_type: 'refresh_token', refresh_token: cached.refreshToken }, fetchImpl); } catch { /* fall through */ }
  }
  tok ||= await passwordGrant(fetchImpl);
  await store.set(TOKEN_KEY, tok);
  return tok.accessToken;
}

// ---- Calls ----
// UNKNOWN: how the token is sent. The docs only name the OAuth2 scheme, so this uses the standard
// "Authorization: Bearer <accessToken>". The OpenAPI also lists the client Basic scheme next to it,
// which cannot share the same header. Confirm on the sandbox. A 401 drops the cached token and retries once.
async function api(method, path, { query, body, fetchImpl = fetch } = {}) {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    const token = await getAccessToken({ fetchImpl });
    const res = await fetchImpl(url.toString(), {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && attempt === 0) { await store.del(TOKEN_KEY); continue; }
    let data = null;
    try { data = await res.json(); } catch { /* empty body (cancel returns 200 with none, tag assign returns 201 with none) */ }
    return { status: res.status, ok: res.ok, data };
  }
}
const need = (r, what) => { if (!r.ok) throw new MomenceError(what, r.status, r.data?.type); return r.data; };

// ---- Mapping between our session keys and Momence session ids (config, from Studio ops) ----
function momenceIdOf(key) {
  const s = sessionByKey(getConfig(), key);
  if (!s?.momenceSessionId) throw new Error(`No momenceSessionId configured for session "${key}"`);
  return s.momenceSessionId;
}
export function keyOfMomenceId(cfg, id) {
  if (Number(cfg.fullDay.momenceSessionId) === Number(id)) return cfg.fullDay.key;
  return cfg.sessions.find((s) => Number(s.momenceSessionId) === Number(id))?.key || null;
}

// ---- Sessions ----
const detail = async (id, o) => need(await api('GET', `/api/v2/host/sessions/${id}`, o), 'getSession');
const isFull = (d) => d.capacity != null && (d.bookingCount ?? 0) >= d.capacity;

export async function getSession(key, o) {
  const d = await detail(momenceIdOf(key), o);
  const booked = d.bookingCount ?? 0;
  return { capacity: d.capacity, booked, left: d.capacity == null ? null : Math.max(d.capacity - booked, 0), waiting: d.waitlistBookingCount ?? 0 };
}

// ---- Members ----
// Search is fuzzy ("Search customers by query"), so the result is filtered to an exact email match.
// UNKNOWN: whether create fails on an existing email, whether a created member is assigned to the
// host automatically, and whether an empty lastName is accepted (a single-word name sends "-").
export async function findOrCreateMember({ name, email, whatsapp }, o) {
  const wanted = email.toLowerCase();
  const find = async () => {
    for (let page = 0; page < 5; page++) {
      const r = need(await api('GET', '/api/v2/host/members', { ...o, query: { query: wanted, page, pageSize: 100 } }), 'findMember');
      const hit = r.payload.find((m) => (m.email || '').toLowerCase() === wanted);
      if (hit) return hit.id;
      if ((page + 1) * 100 >= r.pagination.totalCount) return null;
    }
    return null;
  };
  const existing = await find();
  if (existing != null) return { id: existing };
  const [firstName, ...rest] = String(name || '').trim().split(/\s+/);
  const r = await api('POST', '/api/v2/host/members', { ...o, body: { email: wanted, firstName: firstName || '-', lastName: rest.join(' ') || '-', ...(whatsapp ? { phoneNumber: whatsapp } : {}) } });
  if (r.ok) return { id: r.data.memberId };
  const again = await find(); // lost a race with another request
  if (again != null) return { id: again };
  throw new MomenceError('createMember', r.status, r.data?.type);
}

// ---- Booking ----
// UNKNOWN (check 1): the free-booking page lists no "session full" error, so this client enforces the
// cap itself. It refuses when the count is at capacity, and after booking it lists the session by
// creation time: if this booking sits beyond the capacity (two requests raced), it cancels only this
// one. Pass enforceCap:false to see what Momence itself does (used by scripts/momence-checks.mjs).
// Assumes capacity is 100 or less (one page of 100 bookings).
// UNKNOWN: the free booking returns sessionBookingId, and the cancel call wants "the id field of the
// bookings list". Assumed the same value, confirm on the sandbox.
export async function book({ memberId, sessionKey, enforceCap = true }, o) {
  const sid = momenceIdOf(sessionKey);
  if (enforceCap && isFull(await detail(sid, o))) return { ok: false, reason: 'full' };
  const r = await api('POST', `/api/v2/host/sessions/${sid}/bookings/free`, { ...o, body: { memberId } });
  const out = need(r, 'book');
  const bookingId = out.sessionBookingId;
  if (enforceCap) {
    const d = await detail(sid, o);
    if (d.capacity != null && d.capacity <= 100) {
      const list = need(await api('GET', `/api/v2/host/sessions/${sid}/bookings`, { ...o, query: { page: 0, pageSize: 100, sortBy: 'createdAt', sortOrder: 'ASC' } }), 'listBookings');
      const place = list.payload.findIndex((b) => b.id === bookingId);
      if (place >= d.capacity) { await cancelBooking({ bookingId }, o); return { ok: false, reason: 'full' }; }
    }
  }
  return { ok: true, bookingId };
}

// Waitlist joins that Momence refuses come back as { ok:false, reason } using the documented error types.
export async function joinWaitlist({ memberId, sessionKey }, o) {
  const sid = momenceIdOf(sessionKey);
  const r = await api('POST', `/api/v2/host/sessions/${sid}/waitlist/bookings`, { ...o, body: { memberId } });
  if (r.ok) {
    const d = await detail(sid, o);
    return { ok: true, entryId: r.data.waitlistBookingId, position: d.waitlistBookingCount ?? null };
  }
  const reasons = { 'err-waitlist-full': 'waitlist_full', 'err-waitlist-not-allowed': 'waitlist_not_allowed', 'err-member-already-on-waitlist': 'already_waitlisted' };
  if (reasons[r.data?.type]) return { ok: false, reason: reasons[r.data.type] };
  throw new MomenceError('joinWaitlist', r.status, r.data?.type);
}

// UNKNOWN (check 3): whether Momence moves the waitlist up by itself. If it does, the promoted guest
// arrives later as a session-booked webhook, which handleMomenceEvent already matches to the waitlisted
// record. So promoted is always [] here.
// DECISION TO CONFIRM: disableNotifications is true, because Klaviyo sends our own "released" email and a
// Momence cancellation email on top would be a second one. refund false, isLateCancellation false: a
// release is not the guest's late cancellation.
export async function cancelBooking({ bookingId }, o) {
  const r = await api('DELETE', `/api/v2/host/session-bookings/${bookingId}`, { ...o, body: { refund: false, disableNotifications: true, isLateCancellation: false } });
  if (r.status === 404) return { ok: false, reason: 'not_booked', promoted: [] };
  need(r, 'cancelBooking');
  return { ok: true, promoted: [] };
}

// ---- Tags ----
// The tag must already exist (no create endpoint). The id is looked up once by exact name and cached.
async function tagId(name, o) {
  const k = `momence:tag:${name}`;
  const hit = await store.get(k);
  if (hit != null) return hit;
  for (let page = 0; page < 20; page++) {
    const r = need(await api('GET', '/api/v2/host/tags', { ...o, query: { page, pageSize: 100 } }), 'listTags');
    const t = r.payload.find((x) => x.name === name);
    if (t) { await store.set(k, t.id); return t.id; }
    if ((page + 1) * 100 >= r.pagination.totalCount) break;
  }
  throw new Error(`Momence tag "${name}" does not exist. Create it by hand in Momence first.`);
}
export async function addTag({ memberId, tag }, o) {
  need(await api('POST', `/api/v2/host/members/${memberId}/tags/${await tagId(tag, o)}`, o), 'addTag');
  return { ok: true };
}

// ---- Webhooks ----
// Body is { payload: "<json string>" }. Headers: x-webhook-secret, x-webhook-signature (HMAC-SHA256 of the
// payload string), x-webhook-reqeuest-id (sic).
// UNKNOWN: the HMAC key and the signature encoding. This assumes the key is the dashboard secret
// (MOMENCE_WEBHOOK_SECRET) and accepts hex or base64. It fails closed: if the assumption is wrong every
// delivery is refused (401) until the first sandbox delivery shows the right scheme.
// Event names follow the Events Reference (session-booked), as Haidar instructed. The Basics page example
// says session.booked, so that spelling is NOT accepted.
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
export const webhookRequestId = (headers) => headers.get('x-webhook-reqeuest-id') || headers.get('x-webhook-request-id') || null;

export function verifyWebhook(body, headers, secret = process.env.MOMENCE_WEBHOOK_SECRET) {
  const bad = () => Object.assign(new Error('bad_webhook'), { code: 'bad_webhook' });
  if (!secret || typeof body?.payload !== 'string') throw bad();
  if (!same(headers.get('x-webhook-secret') || '', secret)) throw bad();
  const sig = headers.get('x-webhook-signature') || '';
  const hex = createHmac('sha256', secret).update(body.payload).digest('hex');
  const b64 = createHmac('sha256', secret).update(body.payload).digest('base64');
  if (!sig || !(same(sig, hex) || same(sig, b64))) throw bad();
  try { return JSON.parse(body.payload); } catch { throw bad(); }
}

// Returns a normalised event for handleMomenceEvent, or { ignored }. Sessions that are not anniversary
// sessions are dropped before any API call. A booked event is checked against the session's booking list
// (the docs have no get-booking call), which also gives the guest's details.
export async function parseWebhook(body, headers, o) {
  const msg = verifyWebhook(body, headers);
  if (msg.event !== 'session-booked' && msg.event !== 'session-booking-cancelled') return { ignored: 'event' };
  const p = msg.payload || {};
  const sessionKey = keyOfMomenceId(getConfig(), p.sessionId);
  if (!sessionKey) return { ignored: 'not_an_anniversary_session' };
  if (msg.event === 'session-booking-cancelled') {
    return { type: 'cancelled', bookingId: p.sessionBookingId, sessionKey, member: { id: p.targetMemberId } };
  }
  const list = need(await api('GET', `/api/v2/host/sessions/${p.sessionId}/bookings`, { ...o, query: { page: 0, pageSize: 100, sortBy: 'createdAt', sortOrder: 'DESC' } }), 'listBookings');
  const b = list.payload.find((x) => x.id === p.sessionBookingId);
  if (!b) return { ignored: 'booking_not_found' };
  const m = b.member || {};
  return { type: 'booked', bookingId: b.id, sessionKey, member: { id: m.id ?? p.targetMemberId, name: [m.firstName, m.lastName].filter(Boolean).join(' '), email: m.email, whatsapp: m.phoneNumber || '' } };
}

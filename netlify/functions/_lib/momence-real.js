// Real Momence client. Base URL and auth are documented (docs/momence.md, "Auth").
// Everything else is deliberately NOT written: the sessions, bookings, members, tags and
// waitlist pages of the Momence docs have not been read yet. Each method throws
// MomenceDocsNeeded instead of guessing an endpoint.
import { requireEnv } from './env.js';
import * as store from './store.js';

export const BASE = 'https://api.momence.com';

export class MomenceDocsNeeded extends Error {
  constructor(what) { super(`Momence ${what}: endpoint not documented yet. See docs/momence.md.`); this.code = 'momence_docs_needed'; }
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

// ---- Not documented yet ----
export const getSession = async () => { throw new MomenceDocsNeeded('getSession (spots left, waitlist size)'); };
export const findOrCreateMember = async () => { throw new MomenceDocsNeeded('findOrCreateMember'); };
export const book = async () => { throw new MomenceDocsNeeded('book (free booking, respecting the cap)'); };
export const joinWaitlist = async () => { throw new MomenceDocsNeeded('joinWaitlist'); };
export const cancelBooking = async () => { throw new MomenceDocsNeeded('cancelBooking'); };
export const addTag = async () => { throw new MomenceDocsNeeded('addTag (the tag must already exist in Momence)'); };

// Webhook payload shape and signature are not documented yet. The handler works on a
// normalised event: { type: 'booked'|'cancelled', bookingId, sessionId, member: { id, name, email, whatsapp } }.
export const parseWebhook = () => { throw new MomenceDocsNeeded('webhook payload'); };

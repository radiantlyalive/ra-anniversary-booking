// Signed reconfirm links. Token = base64url(payload).base64url(HMAC-SHA256).
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isMock } from './env.js';

const secret = () => {
  const s = process.env.RECONFIRM_LINK_SECRET;
  if (s) return s;
  if (isMock()) return 'mock-secret-not-for-production';
  throw new Error('Missing env var RECONFIRM_LINK_SECRET');
};
const b64 = (b) => Buffer.from(b).toString('base64url');
const mac = (data) => createHmac('sha256', secret()).update(data).digest();

export function signToken({ ref, expiresAtMs }) {
  const body = b64(JSON.stringify({ r: ref, e: Math.floor(expiresAtMs / 1000) }));
  return `${body}.${b64(mac(body))}`;
}

// Returns { ref } or null. Expiry is NOT checked here: the page decides what to show
// after the deadline (a polite closed message beats "invalid link").
export function readToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = mac(body);
  let got;
  try { got = Buffer.from(sig, 'base64url'); } catch { return null; }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return { ref: p.r, expiresAtMs: p.e * 1000 }; } catch { return null; }
}

export const newRef = () => b64(crypto.getRandomValues(new Uint8Array(9)));

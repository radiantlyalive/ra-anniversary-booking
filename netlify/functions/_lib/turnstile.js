// Optional Cloudflare Turnstile check on book. PROPOSED, not approved: it is active only when
// TURNSTILE_SECRET_KEY is set. Without it, the honeypot and the rate limit are the spam protection.
export const enabled = () => !!process.env.TURNSTILE_SECRET_KEY;

export async function verify(token, ip) {
  if (!enabled()) return true;
  if (!token) return false;
  if (process.env.BOOKING_MODE === 'mock' && token === 'mock-ok') return true;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
  });
  const j = await res.json().catch(() => ({}));
  return !!j.success;
}

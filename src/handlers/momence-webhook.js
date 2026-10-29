// POST /api/momence-webhook   session-booked and session-booking-cancelled events
// Keeps Klaviyo complete for front-desk bookings and waitlist moves, and ignores every
// session that is not an anniversary session (the studio has other classes).
//
// Mock mode: a normalised event in the body, optional shared secret (x-ra-webhook-secret or ?secret=).
// Sandbox and live: Momence's own format. parseWebhook checks x-webhook-secret and the HMAC
// x-webhook-signature, and fails closed (401). Retries carry the same x-webhook-reqeuest-id and are dropped.
// UNKNOWN until the first sandbox delivery: the HMAC key and encoding (docs/momence.md).
import { timingSafeEqual } from 'node:crypto';
import { json, preflight, fail, readJson } from '../lib/http.js';
import { safe } from '../lib/handler.js';
import { isMock } from '../lib/env.js';
import * as store from '../lib/store.js';
import { parseWebhook, webhookRequestId } from '../lib/momence-real.js';
import { handleMomenceEvent } from '../lib/service.js';

const same = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

function authorised(req) {
  const secret = process.env.MOMENCE_WEBHOOK_SECRET;
  if (!secret) return isMock();
  const given = req.headers.get('x-ra-webhook-secret') || new URL(req.url).searchParams.get('secret') || '';
  return same(given, secret);
}

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  if (isMock()) {
    if (!authorised(req)) return fail(401, 'unauthorised');
    const r = await handleMomenceEvent(await readJson(req, 65536));
    return json(r.status, r.body);
  }
  const body = await readJson(req, 65536);
  let ev;
  try { ev = await parseWebhook(body, req.headers); }
  catch (e) { if (e?.code === 'bad_webhook') return fail(401, 'unauthorised'); throw e; }
  if (ev.ignored) return json(200, { ignored: ev.ignored });
  const reqId = webhookRequestId(req.headers);
  if (reqId && (await store.get(`mw:${reqId}`))) return json(200, { duplicate: true });
  const r = await handleMomenceEvent(ev);
  if (reqId && r.status < 300) await store.set(`mw:${reqId}`, 1); // marked after success so a failed delivery can retry
  return json(r.status, r.body);
});

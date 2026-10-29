// Mock mode only. Controls for the local demo page: reset, fill Full Day, move the clock,
// run the deadline job, make reconfirm links, read the mock Klaviyo log. 404 in sandbox and live.
import { json, preflight, fail, readJson } from '../lib/http.js';
import { safe } from '../lib/handler.js';
import { isMock } from '../lib/env.js';
import * as store from '../lib/store.js';
import * as mock from '../lib/momence-mock.js';
import * as klaviyo from '../lib/klaviyo.js';
import { getConfig } from '../lib/config.js';
import { openItems, open } from '../../config/event.config.js';
import { createBooking, runDeadline, reconfirmUrl, reconfirmState } from '../lib/service.js';
import { readToken } from '../lib/signing.js';

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (!isMock()) return fail(404, 'not_found');
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const a = url.searchParams.get('action');
    if (a === 'events') return json(200, { events: await klaviyo.sentEvents() });
    if (a === 'open') return json(200, { open: openItems(open) });
    if (a === 'state') return json(200, { momence: await mock.inspect(), review: (await store.get('deadline:review')) || null, done: (await store.get('deadline:done')) || null });
    return fail(400, 'unknown_action');
  }

  const { action, ...p } = await readJson(req);
  if (action === 'reset') { await store.clear(); await mock.reset({ seedFullDay: p.seed ?? 13 }); return json(200, { ok: true }); }
  if (action === 'fill-full-day') { await mock.fillFullDay(p.leave ?? 0); return json(200, { ok: true }); }
  if (action === 'now') { if (p.at) await store.set('dev:now', p.at); else await store.del('dev:now'); return json(200, { ok: true }); }
  if (action === 'promote') { await mock.setPromote(!!p.on); return json(200, { ok: true }); }
  if (action === 'run-deadline') { await Promise.all([store.del('deadline:done'), store.del('deadline:plan')]); return json(200, await runDeadline()); }
  if (action === 'reconfirm-sample') {
    // A fresh Full Day guest with a real signed link, for the reconfirm page states.
    const cfg = getConfig();
    const n = Date.now() % 100000;
    const r = await createBooking({ type: 'full-day', wholeDay: true, intent: 'free', name: 'Ayu Lestari', email: `ayu${n}@example.com`, whatsapp: '+6281200000000' });
    if (!r.body.bookingRef) return json(409, r.body);
    return json(200, { url: reconfirmUrl(cfg, r.body.bookingRef), state: (await reconfirmState(r.body.bookingRef)).state, ref: r.body.bookingRef });
  }
  if (action === 'token-ref') return json(200, { ref: readToken(p.t)?.ref ?? null });
  return fail(400, 'unknown_action');
});

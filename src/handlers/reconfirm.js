// GET  /api/reconfirm?t=<signed token>  -> the confirm page. Changes NOTHING: email scanners open links.
// POST /api/reconfirm  t=<token>&action=confirm|release (form) or { t, action } (JSON)
//   confirm -> Momence tag "Confirmed", Klaviyo "Anniversary Confirmed"
//   release -> Momence cancel (the waitlist moves up), Klaviyo "Anniversary Released"
// Form posts get an HTML page back; JSON posts (Accept: application/json) get JSON.
// After the deadline both actions are refused with a polite page (open question for Rafa).
import { json, html, preflight, fail, readJson } from '../lib/http.js';
import { safe } from '../lib/handler.js';
import { getConfig } from '../lib/config.js';
import { readToken } from '../lib/signing.js';
import { reconfirmState, confirmSpot, releaseSpot } from '../lib/service.js';
import { reconfirmPage } from '../lib/pages.js';
import { formatBali } from '../lib/time.js';

const wantsJson = (req) => (req.headers.get('accept') || '').includes('application/json') || (req.headers.get('content-type') || '').includes('application/json');

async function render(token, view, justDid) {
  const cfg = getConfig();
  return reconfirmPage({
    state: view.state, firstName: view.firstName, token, justDid,
    eventDate: formatBali(`${cfg.event.date}T00:00:00+08:00`, { hour: undefined, minute: undefined, year: 'numeric' }),
    deadline: formatBali(cfg.reconfirm.deadlineAt, { hour: '2-digit', minute: '2-digit' }) + ' (Bali time)',
  });
}

export default safe(async (req) => {
  const pre = preflight(req); if (pre) return pre;

  if (req.method === 'GET') {
    const token = new URL(req.url).searchParams.get('t');
    const t = readToken(token);
    const view = t ? await reconfirmState(t.ref) : { state: 'none' };
    return html(200, await render(token, view, null)); // read only
  }

  if (req.method !== 'POST') return fail(405, 'method_not_allowed');
  const asJson = wantsJson(req);
  let token, action;
  if ((req.headers.get('content-type') || '').includes('application/json')) ({ t: token, action } = await readJson(req));
  else { const f = new URLSearchParams(await req.text()); token = f.get('t'); action = f.get('action'); }

  const t = readToken(token);
  if (!t || !['confirm', 'release'].includes(action)) {
    return asJson ? fail(400, 'invalid') : html(400, await render(token, { state: 'none' }, null));
  }
  const view = action === 'confirm' ? await confirmSpot(t.ref) : await releaseSpot(t.ref);
  const didIt = (action === 'confirm' && view.state === 'confirmed') || (action === 'release' && view.state === 'released');
  if (asJson) return json(200, { state: view.state, changed: didIt });
  return html(200, await render(token, view, didIt ? action : null));
});

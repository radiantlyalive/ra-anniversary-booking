// Server-rendered reconfirm page. GET shows it and changes nothing (email scanners open links).
// Confirm and release are a <form method="post">, so they need a real tap and work without JS.
import { strings, fmt } from '../../config/strings.en.js';
import { css } from './css.generated.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = strings.reconfirm;

function shell(title, body, { track } = {}) {
  const gtm = process.env.GTM_CONTAINER_ID;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<style>${css}</style>
<script>window.dataLayer=window.dataLayer||[];${track ? `dataLayer.push({event:${JSON.stringify(track)}});` : ''}</script>
${gtm && /^GTM-[A-Z0-9]+$/.test(gtm) ? `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');</script>` : ''}
</head><body class="ra-bk-body"><main class="ra-bk ra-bk--page">${body}</main></body></html>`;
}

const panel = (title, ...lines) =>
  `<div class="ra-bk__done" role="status"><h1 class="ra-bk__h" tabindex="-1">${esc(title)}</h1>${lines.filter(Boolean).map((l) => `<p>${esc(l)}</p>`).join('')}</div>`;

// view: { state, firstName, eventDate, deadline, token, justDid }
export function reconfirmPage(view) {
  const v = { first: view.firstName, eventDate: view.eventDate, deadline: view.deadline };
  switch (view.state) {
    case 'pending':
      return shell(R.title, `<h1 class="ra-bk__h">${esc(R.title)}</h1><p>${esc(fmt(R.intro, v))}</p><p>${esc(fmt(R.deadline, v))}</p>
<form method="post" action="/api/reconfirm" class="ra-bk__btns"><input type="hidden" name="t" value="${esc(view.token)}">
<button class="ra-bk__btn ra-bk__btn--pri" type="submit" name="action" value="confirm">${esc(R.confirm)}</button>
<button class="ra-bk__btn ra-bk__btn--sec" type="submit" name="action" value="release">${esc(R.release)}</button></form>`);
    case 'confirmed':
      return shell(R.title, panel(fmt(R.confirmedTitle, v), R.confirmedBody), { track: view.justDid === 'confirm' ? 'ra_bk_reconfirm' : null });
    case 'released':
      return shell(R.title, panel(view.justDid ? R.releasedTitle : R.alreadyReleasedTitle, view.justDid ? R.releasedBody : R.alreadyReleasedBody), { track: view.justDid === 'release' ? 'ra_bk_release' : null });
    case 'closed':
      return shell(R.title, panel(R.closedTitle, R.closedBody));
    case 'error':
      return shell(R.title, panel(R.errorTitle, R.errorBody));
    default:
      return shell(R.title, panel(R.invalidTitle, R.invalidBody));
  }
}

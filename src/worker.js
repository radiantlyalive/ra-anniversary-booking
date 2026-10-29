// Cloudflare Worker entry: routes /api/* to the handlers, runs the deadline job on a Cron Trigger.
// Static files (the widget, CSS and the local demo) are served by Workers Static Assets.
import { RaStore } from './store-do.js';
import * as store from './lib/store.js';
import { json, preflight } from './lib/http.js';
import spots from './handlers/spots.js';
import book from './handlers/book.js';
import contribute from './handlers/contribute.js';
import stripeWebhook from './handlers/stripe-webhook.js';
import momenceWebhook from './handlers/momence-webhook.js';
import reconfirm from './handlers/reconfirm.js';
import dev from './handlers/dev.js';
import { runDeadline } from './lib/service.js';

export { RaStore };

const routes = {
  '/api/spots': spots,
  '/api/book': book,
  '/api/contribute': contribute,
  '/api/stripe-webhook': stripeWebhook,
  '/api/momence-webhook': momenceWebhook,
  '/api/reconfirm': reconfirm,
  '/api/dev': dev,
};

export default {
  async fetch(request, env) {
    store.useStore(store.doStore(env.STORE));
    const { pathname } = new URL(request.url);
    // Mock deploy only: the root opens the demo page. Sandbox and live have no page at /.
    if (pathname === '/' && env.BOOKING_MODE === 'mock') return Response.redirect(new URL('/demo.html', request.url).href, 302);
    const handler = routes[pathname];
    if (!handler) return preflight(request) || json(404, { error: 'not_found' });
    return handler(request);
  },

  // Cron Trigger every 15 minutes. Acts once, after the deadline in config.
  async scheduled(_event, env, ctx) {
    store.useStore(store.doStore(env.STORE));
    ctx.waitUntil(runDeadline().then((r) => console.log('deadline job:', JSON.stringify(r))));
  },
};

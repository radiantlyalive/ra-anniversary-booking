// Times are stored and compared in UTC. Only display uses Bali time (Asia/Makassar, WITA, UTC+8).
import { isMock } from './env.js';
import * as store from './store.js';

export const BALI_TZ = 'Asia/Makassar';

export const toUtcIso = (s) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Bad date: ${s}`);
  return d.toISOString();
};

// "now" can be moved in mock mode only, so the deadline job can be demonstrated.
export async function nowMs() {
  if (isMock()) {
    const o = await store.get('dev:now');
    if (o) return new Date(o).getTime();
  }
  return Date.now();
}

export function formatBali(iso, opts = {}) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BALI_TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false, ...opts,
  }).format(new Date(iso)).replace(/,/g, '');
}
export const formatBaliDate = (iso) => formatBali(iso, { weekday: undefined, hour: undefined, minute: undefined });

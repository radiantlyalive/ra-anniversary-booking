// Fixed-window rate limit by IP, kept in the store.
import * as store from './store.js';
import { nowMs } from './time.js';

export async function allow(scope, ip, { limit, windowSec }) {
  const win = Math.floor((await nowMs()) / 1000 / windowSec);
  const key = `rl:${scope}:${ip}:${win}`;
  const n = ((await store.get(key)) || 0) + 1;
  await store.set(key, n);
  return n <= limit;
}

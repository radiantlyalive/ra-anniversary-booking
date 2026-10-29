// A double click or a retried request must never book twice.
// run() takes a scope ('book'), the Idempotency-Key header and the work to do.
// Same key again: the first result is replayed. Same key while the first is still
// running: 409 in_progress. Only a success is replayed; a refusal or a thrown error frees the key.
import * as store from './store.js';

const LOCK_MS = 30_000;

export async function run(scope, key, work) {
  const k = `idem:${scope}:${key}`;
  const lock = { pending: true, at: Date.now() };
  if (!(await store.setIfNew(k, lock))) {
    const rec = await store.get(k);
    if (rec?.done) return { ...rec.result, replay: true };
    if (rec?.pending && Date.now() - rec.at < LOCK_MS) return { status: 409, body: { error: 'in_progress' } };
    await store.set(k, lock); // stale lock: take over
  }
  try {
    const result = await work();
    if (result.status >= 200 && result.status < 300) await store.set(k, { done: true, result });
    else await store.del(k); // only successes are replayed; a refusal (closed, full, invalid) can be retried
    return result;
  } catch (e) {
    await store.del(k);
    throw e;
  }
}

export const validKey = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(k);

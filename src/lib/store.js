// Small key-value store used for idempotency, rate limits, booking records and tokens.
//   memory : tests (node:test), no runtime needed
//   do     : Cloudflare Durable Object (src/store-do.js), local and deployed. One global object, so
//            every read and write is strongly consistent and setIfNew is atomic. That is what makes
//            the idempotency lock safe against a double click that lands on two Worker instances.
function memoryBackend() {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? structuredClone(m.get(k)) : undefined; },
    async set(k, v) { m.set(k, structuredClone(v)); },
    async setIfNew(k, v) { if (m.has(k)) return false; m.set(k, structuredClone(v)); return true; },
    async del(k) { m.delete(k); },
    async list(prefix) { return [...m.keys()].filter((k) => k.startsWith(prefix)); },
    async clear() { m.clear(); },
  };
}

let backend;
export function useStore(b) { backend = b; }
export function memoryStore() { return memoryBackend(); }

// Called by the Worker at the start of every request and scheduled run.
export function doStore(namespace) {
  const stub = () => namespace.get(namespace.idFromName('main'));
  return {
    get: (k) => stub().get(k),
    set: (k, v) => stub().set(k, v),
    setIfNew: (k, v) => stub().setIfNew(k, v),
    del: (k) => stub().del(k),
    list: (p) => stub().list(p),
    clear: () => stub().clear(),
  };
}
const b = () => {
  if (!backend) throw new Error('No store selected. The Worker calls useStore(doStore(env.STORE)) first; tests call useStore(memoryStore()).');
  return backend;
};

export const get = (k) => b().get(k);
export const set = (k, v) => b().set(k, v);
export const setIfNew = (k, v) => b().setIfNew(k, v);
export const del = (k) => b().del(k);
export const list = (p) => b().list(p);
export const clear = () => b().clear();

// Read, change, write. Not atomic: fine for one booking record touched by one request at a time.
export async function update(key, fn, fallback) {
  const cur = (await get(key)) ?? fallback;
  const next = (await fn(cur)) ?? cur;
  await set(key, next);
  return next;
}

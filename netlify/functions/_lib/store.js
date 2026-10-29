// Small key-value store used for idempotency, rate limits, booking records and tokens.
//   memory : tests
//   file   : mock mode, so state survives between local function calls (.mock-data/, git-ignored)
//   blobs  : sandbox and live, Netlify Blobs (UNVERIFIED until run against a real Netlify site)
// Not atomic across processes: setIfNew is the only conditional write, and is relied on
// only for the idempotency lock.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { isMock } from './env.js';

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

function fileBackend(path) {
  const load = () => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8') || '{}') : {});
  const save = (d) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(d)); };
  return {
    async get(k) { return load()[k]; },
    async set(k, v) { const d = load(); d[k] = v; save(d); },
    async setIfNew(k, v) { const d = load(); if (k in d) return false; d[k] = v; save(d); return true; },
    async del(k) { const d = load(); delete d[k]; save(d); },
    async list(prefix) { return Object.keys(load()).filter((k) => k.startsWith(prefix)); },
    async clear() { save({}); },
  };
}

function blobsBackend() {
  let storePromise;
  const store = () => (storePromise ||= import('@netlify/blobs').then((m) => m.getStore('ra-anniversary')));
  return {
    async get(k) { return (await store()).get(k, { type: 'json' }) ?? undefined; },
    async set(k, v) { await (await store()).setJSON(k, v); },
    async setIfNew(k, v) { const r = await (await store()).setJSON(k, v, { onlyIfNew: true }); return r?.modified !== false; },
    async del(k) { await (await store()).delete(k); },
    async list(prefix) { const r = await (await store()).list({ prefix }); return r.blobs.map((b) => b.key); },
    async clear() { throw new Error('clear() is not available on the blobs store'); },
  };
}

let backend;
export function useStore(b) { backend = b; }
export function memoryStore() { return memoryBackend(); }
function pick() {
  const want = process.env.RA_STORE || (isMock() ? 'file' : 'blobs');
  if (want === 'memory') return memoryBackend();
  if (want === 'file') return fileBackend(process.env.RA_MOCK_FILE || '.mock-data/state.json');
  return blobsBackend();
}
const b = () => (backend ||= pick());

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

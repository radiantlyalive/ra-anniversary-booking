// In-memory stand-in for Momence so the whole flow runs with no access.
// State lives in the store (key mock:momence), so it survives between local function calls.
//
// ASSUMPTION, NOT VERIFIED: when a booking is cancelled and a waitlist exists, Momence moves the
// next person up by itself (the brief's check 3). The mock does this so the flow can be
// exercised. Whether the real session does is exactly what scripts/momence-checks.mjs tests.
// Set promote: false in the mock state to see the flow without it.
import * as store from './store.js';
import { getConfig, sessionByKey } from './config.js';

const KEY = 'mock:momence';
const fresh = () => ({ seq: 0, members: {}, bookings: {}, waitlist: {}, promote: true });
const load = async () => (await store.get(KEY)) || fresh();
const save = (s) => store.set(KEY, s);
const nextId = (s, p) => `${p}_${++s.seq}`;

const capacityOf = (key) => sessionByKey(getConfig(), key)?.capacity ?? null;

function counts(s, key) {
  const booked = Object.values(s.bookings).filter((b) => b.sessionKey === key && b.status === 'booked').length;
  const cap = capacityOf(key);
  return { capacity: cap, booked, left: cap == null ? null : Math.max(cap - booked, 0), waiting: (s.waitlist[key] || []).length };
}

export const getSession = async (key) => counts(await load(), key);

export async function findOrCreateMember({ name, email, whatsapp }) {
  const s = await load();
  const k = email.toLowerCase();
  if (!s.members[k]) s.members[k] = { id: nextId(s, 'm'), name, email: k, whatsapp, tags: [] };
  await save(s);
  return { id: s.members[k].id };
}

export async function book({ memberId, sessionKey }) {
  const s = await load();
  const c = counts(s, sessionKey);
  if (c.capacity != null && c.left === 0) return { ok: false, reason: 'full' };
  const id = nextId(s, 'b');
  s.bookings[id] = { id, memberId, sessionKey, status: 'booked' };
  await save(s);
  return { ok: true, bookingId: id };
}

export async function joinWaitlist({ memberId, sessionKey }) {
  const s = await load();
  const q = (s.waitlist[sessionKey] ||= []);
  const id = nextId(s, 'w');
  q.push({ id, memberId });
  await save(s);
  return { ok: true, entryId: id, position: q.length };
}

export async function cancelBooking({ bookingId }) {
  const s = await load();
  if (s.failCancel > 0) { s.failCancel--; await save(s); throw new Error('mock Momence failure'); } // test hook
  const b = s.bookings[bookingId];
  if (!b || b.status !== 'booked') return { ok: false, reason: 'not_booked', promoted: [] };
  b.status = 'cancelled';
  const promoted = [];
  const q = s.waitlist[b.sessionKey] || [];
  if (s.promote && q.length) {
    const next = q.shift();
    const id = nextId(s, 'b');
    s.bookings[id] = { id, memberId: next.memberId, sessionKey: b.sessionKey, status: 'booked' };
    promoted.push({ memberId: next.memberId, bookingId: id, entryId: next.id, sessionKey: b.sessionKey });
  }
  await save(s);
  return { ok: true, promoted };
}

export async function addTag({ memberId, tag }) {
  const s = await load();
  const m = Object.values(s.members).find((x) => x.id === memberId);
  if (!m) return { ok: false };
  if (!m.tags.includes(tag)) m.tags.push(tag);
  await save(s);
  return { ok: true };
}

// ---- test and demo helpers, mock only ----
export async function inspect() { return load(); }
export async function reset({ seedFullDay = 0 } = {}) {
  const s = fresh();
  const cfg = getConfig();
  for (let i = 0; i < seedFullDay; i++) {
    const mid = nextId(s, 'm');
    s.members[`seed${i}@example.invalid`] = { id: mid, name: `Seed ${i}`, email: `seed${i}@example.invalid`, whatsapp: '', tags: [] };
    const id = nextId(s, 'b');
    s.bookings[id] = { id, memberId: mid, sessionKey: cfg.fullDay.key, status: 'booked' };
  }
  await save(s);
}
export async function failNextCancels(n) { const s = await load(); s.failCancel = n; await save(s); }
export async function setPromote(on) { const s = await load(); s.promote = !!on; await save(s); }
export async function fillFullDay(leave = 0) {
  const s = await load();
  const cfg = getConfig();
  let { booked } = counts(s, cfg.fullDay.key);
  while (booked < cfg.fullDay.capacity - leave) {
    const mid = nextId(s, 'm');
    s.members[`fill${mid}@example.invalid`] = { id: mid, name: 'Fill', email: `fill${mid}@example.invalid`, whatsapp: '', tags: [] };
    const id = nextId(s, 'b');
    s.bookings[id] = { id, memberId: mid, sessionKey: cfg.fullDay.key, status: 'booked' };
    booked++;
  }
  await save(s);
}
export async function memberTags(memberId) {
  const s = await load();
  return Object.values(s.members).find((m) => m.id === memberId)?.tags || [];
}

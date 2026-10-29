// In-memory stand-in for Momence so the whole flow runs with no access.
// Resets whenever the function process restarts. Never used in sandbox or live mode.
const state = { members: new Map(), bookings: new Map(), waitlist: [], booked: { 'full-day': 13 }, tags: new Map() };
const CAP = { 'full-day': 50 };

export const spotsLeft = (sessionId) => {
  const cap = CAP[sessionId];
  return cap == null ? { capped: false } : { capped: true, left: Math.max(cap - (state.booked[sessionId] || 0), 0), capacity: cap, waiting: state.waitlist.filter((w) => w.sessionId === sessionId).length };
};
export const findOrCreateMember = ({ name, email, whatsapp }) => {
  const key = email.toLowerCase();
  if (!state.members.has(key)) state.members.set(key, { id: `m_${state.members.size + 1}`, name, email, whatsapp });
  return state.members.get(key);
};
export const bookFree = ({ memberId, sessionId }) => {
  const s = spotsLeft(sessionId);
  if (s.capped && s.left === 0) return { ok: false, reason: 'full' };
  const id = `b_${state.bookings.size + 1}`;
  state.bookings.set(id, { id, memberId, sessionId });
  state.booked[sessionId] = (state.booked[sessionId] || 0) + 1;
  return { ok: true, bookingId: id };
};
export const joinWaitlist = ({ memberId, sessionId }) => { state.waitlist.push({ memberId, sessionId }); return { ok: true, position: state.waitlist.length }; };
export const cancelBooking = ({ bookingId }) => {
  const b = state.bookings.get(bookingId); if (!b) return { ok: false };
  state.bookings.delete(bookingId); state.booked[b.sessionId] -= 1;
  return { ok: true };
};
export const addTag = ({ memberId, tag }) => {
  const t = state.tags.get(memberId) || new Set(); t.add(tag); state.tags.set(memberId, t); return { ok: true };
};

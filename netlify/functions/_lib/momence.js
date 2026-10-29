// Momence client. DRAFT: endpoints are deliberately not written yet.
// Read Momence's current API docs first and record endpoints, auth and webhook
// payloads in docs/momence.md. Do not guess.
import { mode } from './http.js';
import * as mock from './mock-store.js';

export async function spotsLeft(sessionId) {
  if (mode() === 'mock') return mock.spotsLeft(sessionId);
  throw new Error('momence.spotsLeft: not built');
}
export async function findOrCreateMember({ name, email, whatsapp }) {
  if (mode() === 'mock') return mock.findOrCreateMember({ name, email, whatsapp });
  throw new Error('momence.findOrCreateMember: not built');
}
export async function bookFree({ memberId, sessionId }) {
  if (mode() === 'mock') return mock.bookFree({ memberId, sessionId });
  throw new Error('momence.bookFree: not built');
}
export async function joinWaitlist({ memberId, sessionId }) {
  if (mode() === 'mock') return mock.joinWaitlist({ memberId, sessionId });
  throw new Error('momence.joinWaitlist: not built');
}
export async function cancelBooking({ bookingId }) {
  if (mode() === 'mock') return mock.cancelBooking({ bookingId });
  throw new Error('momence.cancelBooking: not built');
}
export async function addTag({ memberId, tag }) {
  if (mode() === 'mock') return mock.addTag({ memberId, tag });
  throw new Error('momence.addTag: not built (the tag must already exist in Momence)');
}

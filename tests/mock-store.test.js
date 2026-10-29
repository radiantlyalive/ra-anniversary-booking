import test from 'node:test';
import assert from 'node:assert/strict';
import * as m from '../netlify/functions/_lib/mock-store.js';

test('free booking respects the Full Day cap of 50', () => {
  const member = m.findOrCreateMember({ name: 'Test Guest', email: 'test@example.com', whatsapp: '+6281200000000' });
  let last;
  for (let i = 0; i < 60; i++) last = m.bookFree({ memberId: member.id, sessionId: 'full-day' });
  assert.equal(m.spotsLeft('full-day').left, 0);
  assert.deepEqual(last, { ok: false, reason: 'full' });
});

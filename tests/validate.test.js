import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGuest, normaliseWhatsapp } from '../src/lib/validate.js';

const ok = { name: 'Ayu Lestari', email: 'Ayu@Example.com', whatsapp: '+62 812-3456-7890' };

test('valid guest is normalised', () => {
  const r = validateGuest(ok);
  assert.equal(r.ok, true);
  assert.deepEqual(r.value, { name: 'Ayu Lestari', email: 'ayu@example.com', whatsapp: '+6281234567890' });
});
test('00 prefix becomes +', () => assert.equal(normaliseWhatsapp('0062 812 3456 7890'), '+6281234567890'));
test('name, email and WhatsApp are each checked', () => {
  assert.deepEqual(validateGuest({ ...ok, name: ' ' }).errors, { name: 'name' });
  assert.deepEqual(validateGuest({ ...ok, name: '1234' }).errors, { name: 'name' });
  assert.deepEqual(validateGuest({ ...ok, email: 'nope' }).errors, { email: 'email' });
  assert.deepEqual(validateGuest({ ...ok, email: 'a@b' }).errors, { email: 'email' });
});
test('WhatsApp needs a country code', () => {
  assert.equal(validateGuest({ ...ok, whatsapp: '081234567890' }).errors.whatsapp, 'whatsapp'); // no +
  assert.equal(validateGuest({ ...ok, whatsapp: '+6212' }).errors.whatsapp, 'whatsapp');          // too short
  assert.equal(validateGuest({ ...ok, whatsapp: '+0812345678901' }).errors.whatsapp, 'whatsapp'); // country code cannot start with 0
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { open, openItems } from '../config/event.config.js';
import { resolve, ConfigError } from '../src/lib/config.js';

test('every open decision is a visible placeholder, none silently decided', () => {
  const ids = openItems(open).map((o) => o.id).join(' ');
  for (const id of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'D2-D5']) assert.match(ids, new RegExp(id));
  for (const [k, o] of Object.entries(open)) assert.equal(o.value, null, `${k} must stay null until Rafa decides`);
});

test('mock mode fills placeholders from demo values only', () => {
  const c = resolve({ mock: true });
  assert.equal(c.mock, true);
  assert.ok(c.sessions.length >= 1);
});

test('sandbox and live refuse to run while a decision is open, and say which', () => {
  assert.throws(() => resolve({ mock: false }), (e) => e instanceof ConfigError && /P1/.test(e.message) && /P2/.test(e.message) && /D2-D5/.test(e.message));
});

test('class credit and meal package are stubbed and off by default', () => {
  const c = resolve({ mock: true });
  assert.equal(c.classCredit.enabled, false);
  assert.equal(c.mealPackage.enabled, false);
});

test('the Full Day cap and the minimum amount come from the brief', () => {
  const c = resolve({ mock: true });
  assert.equal(c.fullDay.capacity, 50);
  assert.equal(c.limits.minimumOtherAmount, 10000);
  assert.equal(c.event.timezone, 'Asia/Makassar');
});

test('times are normalised to UTC', () => {
  const c = resolve({ mock: true });
  assert.equal(c.reconfirm.deadlineAt, '2026-11-28T04:00:00.000Z'); // Sat 28 Nov 12:00 WITA
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { openItems } from '../config/event.config.js';

test('open decisions are still flagged, not silently decided', () => {
  const open = openItems().map((o) => o.note).join(' ');
  for (const id of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']) assert.match(open, new RegExp(id));
});

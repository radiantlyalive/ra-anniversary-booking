import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PALETTE = ['#FFFDEB', '#F5F0E8', '#EDE5D5', '#FFFFFF', '#5A162F', '#3A0D1F', '#9B1823', '#EB9000'];
const files = ['widget/ra-booking.css', 'widget/ra-booking.js', 'config/strings.en.js'];

test('only the eight RA colours appear in the widget', () => {
  const css = readFileSync('widget/ra-booking.css', 'utf8');
  const hexes = [...css.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase());
  for (const h of hexes) assert.ok(PALETTE.includes(h), `off-palette colour ${h}`);
  assert.doesNotMatch(css, /rgba?\(|opacity\s*:\s*0?\.\d/, 'no tints or transparency');
});

test('guest copy has no em dashes, exclamation marks or "journey"', () => {
  for (const f of files.slice(1)) {
    const text = readFileSync(f, 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
    assert.doesNotMatch(text, /—/, `${f}: em dash`);
    assert.doesNotMatch(text, /journey/i, `${f}: "journey"`);
    if (f.startsWith('config/')) assert.doesNotMatch(text, /'[^'\n]*![^'\n]*'|"[^"\n]*![^"\n]*"|`[^`\n]*![^`\n]*`/, `${f}: exclamation mark in a string`);
  }
});

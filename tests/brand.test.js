import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { strings } from '../config/strings.en.js';

const PALETTE = ['#FFFDEB', '#F5F0E8', '#EDE5D5', '#FFFFFF', '#5A162F', '#3A0D1F', '#9B1823', '#EB9000'];
const read = (f) => readFileSync(f, 'utf8');
const css = read('widget/ra-booking.css');
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rules = (c) => [...stripComments(c).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const surfaces = ['widget/ra-booking.css', 'widget/demo.html', 'widget/mock-stripe.html'];

test('only the eight RA colours appear anywhere in the widget, demo or mock pages', () => {
  for (const f of surfaces) {
    for (const m of read(f).matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      assert.ok(PALETTE.includes(m[0].toUpperCase()), `${f}: off-palette colour ${m[0]}`);
    }
  }
});

test('no tints, shades or opacity tricks', () => {
  for (const f of surfaces) {
    const t = stripComments(read(f));
    assert.doesNotMatch(t, /rgba?\(|hsla?\(|color-mix|opacity\s*:|filter\s*:/i, `${f}: transparency or filter`);
  }
});

test('every widget selector is prefixed .ra-bk so nothing leaks into Squarespace', () => {
  for (const { sel } of rules(css).filter((r) => !r.sel.startsWith('@'))) {
    for (const s of sel.split(',').map((x) => x.trim())) assert.match(s, /^\.ra-bk/, `selector not scoped: ${s}`);
  }
  assert.doesNotMatch(css, /@media[^{]*\{\s*(body|html|\*)/);
});

test('no rounded corners, no shadows, no gradients', () => {
  const t = stripComments(css);
  for (const m of t.matchAll(/border-radius\s*:\s*([^;}]+)/g)) assert.match(m[1].trim(), /^0\b/, `rounded: ${m[0]}`);
  assert.doesNotMatch(t, /box-shadow\s*:\s*(?!none)/i);
  assert.doesNotMatch(t, /text-shadow|gradient/i);
});

test('buttons hold their colour on hover: no :hover rules at all', () => {
  assert.doesNotMatch(stripComments(css), /:hover/);
});

test('primary button: Crimson fill, Cream label, 54px, 14px uppercase, .14em', () => {
  const btn = rules(css).find((r) => r.sel === '.ra-bk__btn').body;
  assert.match(btn, /min-height:54px/); assert.match(btn, /height:54px/);
  assert.match(btn, /font-size:14px/); assert.match(btn, /letter-spacing:\.14em/); assert.match(btn, /text-transform:uppercase/);
  assert.match(btn, /border-radius:0/);
  const pri = rules(css).find((r) => r.sel === '.ra-bk__btn--pri').body;
  assert.match(pri, /background:var\(--crimson\)/); assert.match(pri, /color:var\(--cream\)/);
  const sec = rules(css).find((r) => r.sel === '.ra-bk__btn--sec').body;
  assert.match(sec, /background:transparent/); assert.match(sec, /color:var\(--crimson\)/); assert.match(sec, /1px solid var\(--plum\)/);
});

test('form fields: white fill, 1px Plum border, Deep Plum text, 16px or larger', () => {
  const f = rules(css).find((r) => r.sel === '.ra-bk__field input').body;
  assert.match(f, /background:var\(--white\)/); assert.match(f, /border:1px solid var\(--plum\)/); assert.match(f, /color:var\(--deep\)/);
  assert.ok(Number(/font-size:(\d+)px/.exec(f)[1]) >= 16);
});

test('White is used for form fields only, Amber never as text or button fill', () => {
  for (const { sel, body } of rules(css)) {
    const use = body.replace(/--[a-z-]+:#[0-9A-Fa-f]{6};?/g, ''); // palette variable definitions do not count as use
    if (/var\(--white\)|#FFFFFF/i.test(use)) assert.match(sel, /input/, `white outside form fields: ${sel}`);
    assert.doesNotMatch(use, /(^|;)\s*color:(var\(--amber\)|#EB9000)/i, `amber text: ${sel}`);
    if (/background:(var\(--amber\)|#EB9000)/i.test(use)) assert.equal(sel, '.ra-bk__rule', `amber background outside a rule line: ${sel}`);
  }
});

test('headings use the Agrandir-Head stack, body text inherits', () => {
  assert.match(css, /--head:"Agrandir-Head"/);
  assert.match(css, /\.ra-bk__h\{[^}]*font-family:var\(--head\)/);
  assert.match(rules(css).find((r) => r.sel === '.ra-bk').body, /font-family:inherit/);
});

test('visible focus and reduced motion are handled', () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

// ---- copy ----
const walk = (o, out = []) => { for (const v of Object.values(o)) typeof v === 'object' ? walk(v, out) : out.push(String(v)); return out; };

test('guest copy has no em dashes, en dashes, exclamation marks, emojis, hashtags or "journey"', () => {
  for (const s of walk(strings)) {
    assert.doesNotMatch(s, /[–—]/, `dash in: ${s}`);
    assert.doesNotMatch(s, /!/, `exclamation mark in: ${s}`);
    assert.doesNotMatch(s, /journey/i, `"journey" in: ${s}`);
    assert.doesNotMatch(s, /#\w/, `hashtag in: ${s}`);
    assert.doesNotMatch(s, /\p{Extended_Pictographic}/u, `emoji in: ${s}`);
    assert.doesNotMatch(s, /come for yoga, stay for family/i, `retired line in: ${s}`);
    assert.doesNotMatch(s, /move beyond your self/i, `master line used without being asked: ${s}`);
  }
});

test('the widget script and the reconfirm page carry no guest copy of their own with banned characters', () => {
  for (const f of ['widget/ra-booking.js', 'src/lib/pages.js']) {
    const t = stripComments(read(f));
    assert.doesNotMatch(t, /—/, `${f}: em dash`);
    assert.doesNotMatch(t, /journey/i, `${f}: journey`);
    assert.doesNotMatch(t, /'[^'\n]*[a-z]!['\s][^'\n]*'/, `${f}: exclamation mark in a string`);
  }
});

test('every guest-facing line in the strings file is marked "needs Rafa approval"', () => {
  const lines = read('config/strings.en.js').split('\n').filter((l) => /^\s+\w+:\s*['"`]/.test(l));
  assert.ok(lines.length > 50);
  for (const l of lines) assert.match(l, /needs Rafa approval/, `unmarked: ${l.trim()}`);
});

test('donation wording is not hard-coded in the strings: it follows the open decision', () => {
  for (const s of walk(strings)) assert.doesNotMatch(s, /\b(donat|contribut)/i, `hard-coded wording in: ${s}`);
});

test('Sari Hati and other open decisions are not hard-coded in code', () => {
  for (const f of ['widget/ra-booking.js', 'config/strings.en.js', 'src/lib/service.js']) {
    assert.doesNotMatch(read(f), /Sari Hati/i, `${f}: names the recipient`);
  }
});

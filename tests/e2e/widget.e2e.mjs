// Browser check of the real widget against the local dev server (mock mode).
// Needs Playwright with Chromium (preinstalled in the cloud session) and `npm run dev` running.
//   BASE=http://localhost:8888 SHOTS=/some/dir node tests/e2e/widget.e2e.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');

const BASE = process.env.BASE || 'http://localhost:8888';
const SHOTS = process.env.SHOTS || '.e2e-shots';
mkdirSync(SHOTS, { recursive: true });
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++; };
const dev = (page, body) => page.evaluate((b) => fetch('/api/dev', { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json()), body);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const noSideways = async (label) => {
  const [sw, iw] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  check(sw <= iw, `${label}: no sideways scroll at 390px (${sw} <= ${iw})`);
};
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

await page.goto(`${BASE}/demo.html`);
await dev(page, { action: 'reset', seed: 13 });
await dev(page, { action: 'now' });
await page.reload();
const live = page.locator('#ra-booking');
await live.getByText('37 of 50 spots left').waitFor();
await noSideways('demo page');

// Whole-day tick gates both buttons
check(await live.locator('#ra-bk-free').isDisabled(), 'Join for Free disabled until the whole-day box is ticked');
check(await live.locator('#ra-bk-donate').isDisabled(), 'Join with Donation disabled until the whole-day box is ticked');
await live.locator('#ra-bk-whole').check();
check(await live.locator('#ra-bk-free').isEnabled(), 'buttons enabled after ticking');

// Validation shows errors and focuses the first one
await live.locator('#ra-bk-free').click();
await live.getByText('Enter your name.').waitFor();
check(await page.evaluate(() => document.activeElement.id) === 'ra-bk-name', 'first invalid field is focused');
await shot('01-form-errors');

// Donation path
await live.locator('#ra-bk-name').fill('Ayu Lestari');
await live.locator('#ra-bk-email').fill('ayu@example.com');
await live.locator('#ra-bk-whatsapp').fill('+62 812 3456 7890');
await live.locator('#ra-bk-donate').click();
await live.getByText('Your spot is held, Ayu.').waitFor();
await shot('02-amount-step');
await noSideways('amount step');
await live.getByRole('button', { name: /IDR 250,000/ }).click();
await live.getByRole('button', { name: 'Continue to secure payment' }).click();
await page.waitForURL('**/mock-stripe.html**');
await shot('03-stripe-mock');
await page.getByRole('button', { name: 'Pay (test)' }).click();
await page.waitForURL('**/demo.html?ra=paid');
await page.locator('#ra-booking').getByText(/Your donation has been received/).waitFor();
await shot('04-paid');
const ev = await page.evaluate(() => fetch('/api/dev?action=events').then((r) => r.json()));
check(ev.events.some((e) => e.event === 'Anniversary Booked'), 'Klaviyo got Booked');
check(ev.events.some((e) => e.event === 'Anniversary Contributed'), 'Klaviyo got Contributed');
const ms = await page.evaluate(() => fetch('/api/dev?action=state').then((r) => r.json()));
check(Object.values(ms.momence.members).some((m) => m.tags.includes('Anniversary 2026 – Donor')), 'Momence member tagged Donor');

// Free path + skip
await page.goto(`${BASE}/demo.html`);
await live.locator('#ra-bk-whole').check();
await live.locator('#ra-bk-name').fill('Made Putra');
await live.locator('#ra-bk-email').fill('made@example.com');
await live.locator('#ra-bk-whatsapp').fill('+6281234500000');
await live.locator('#ra-bk-free').click();
await live.getByText("You're in, Made.").waitFor();
await shot('05-thanks-free');
check((await live.textContent()).includes('Before 28 November'), 'thank-you mentions the reconfirm');

// Double click books once
await dev(page, { action: 'reset', seed: 13 });
await page.goto(`${BASE}/demo.html`);
await live.locator('#ra-bk-whole').check();
await live.locator('#ra-bk-name').fill('Double Click');
await live.locator('#ra-bk-email').fill('dc@example.com');
await live.locator('#ra-bk-whatsapp').fill('+6281234500001');
await live.locator('#ra-bk-free').dblclick();
await live.getByText("You're in, Double.").waitFor();
const after = await page.evaluate(() => fetch('/api/spots').then((r) => r.json()));
check(after.fullDay.booked === 14, `double click booked once (booked=${after.fullDay.booked})`);

// Single sessions + per-session waitlist
await page.goto(`${BASE}/demo.html`);
await live.getByRole('tab', { name: 'Single sessions' }).click();
await live.getByText('Demo session A').waitFor();
await shot('06-single-sessions');
await noSideways('single sessions');
await live.getByRole('button', { name: 'Join for Free' }).click();
await live.getByText('Choose at least one session.').waitFor();
check(await page.evaluate(() => document.activeElement.type) === 'checkbox', 'focus moves to the sessions');

// Tabs by keyboard
await live.getByRole('tab', { name: 'Single sessions' }).focus();
await page.keyboard.press('ArrowLeft');
check(await live.getByRole('tab', { name: 'Full Day' }).getAttribute('aria-selected') === 'true', 'arrow keys switch tabs');

// Full Day full -> waitlist
await dev(page, { action: 'fill-full-day' });
await page.goto(`${BASE}/demo.html`);
await live.getByText('The Full Day is full.').waitFor();
await shot('07-full-day-full');
await noSideways('full day full');
await live.locator('#ra-bk-name').fill('Wait List');
await live.locator('#ra-bk-email').fill('wl@example.com');
await live.locator('#ra-bk-whatsapp').fill('+6281234500002');
await live.getByRole('button', { name: 'Join the waitlist' }).click();
await live.getByText("You're on the waitlist, Wait.").waitFor();
await shot('08-waitlisted');

// Every static state: renders, no sideways scroll
const states = await page.locator('#states button').allTextContents();
for (let i = 0; i < states.length; i++) {
  await page.locator('#states button').nth(i).click();
  await page.waitForTimeout(50);
  await noSideways(`state "${states[i]}"`);
  await page.locator('#ra-preview').screenshot({ path: `${SHOTS}/state-${String(i).padStart(2, '0')}.png` });
}

// Reconfirm page
await dev(page, { action: 'reset', seed: 13 });
await page.reload();
const frame = page.frameLocator('#rc');
await page.getByRole('button', { name: 'Reconfirm page' }).click();
await frame.getByRole('button', { name: 'Confirm my spot' }).waitFor();
await page.locator('#rc').screenshot({ path: `${SHOTS}/09-reconfirm.png` });
await page.getByRole('button', { name: 'Confirmed', exact: true }).click();
await frame.getByText(/See you on 1 December/).waitFor();
await page.locator('#rc').screenshot({ path: `${SHOTS}/10-confirmed.png` });
await page.getByRole('button', { name: 'Released', exact: true }).click();
await frame.getByText('Thank you for letting us know.').waitFor();
await page.locator('#rc').screenshot({ path: `${SHOTS}/11-released.png` });

check(errors.length === 0, `no console or page errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
await browser.close();
console.log(failed ? `\n${failed} check(s) failed` : '\nAll browser checks passed');
process.exit(failed ? 1 : 0);

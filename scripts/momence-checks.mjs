// The three Momence checks the proposal needs, run on a TEST session only. NOT RUN: it waits for
// test-session access (the real calls are written in src/lib/momence-real.js, never run against Momence).
//
//   Check 1  does a free booking respect the cap?
//   Check 2  does Momence send its own confirmation email? (a person reads the test inbox)
//   Check 3  does the waitlist move up by itself when a booking is cancelled?
//
// Needs: BOOKING_MODE=sandbox, MOMENCE_TEST_SESSION_KEY (a key in config whose Momence session is the
// test session, capacity 5 or less, waitlist on), CHECK_EMAIL_BASE (an inbox you control, e.g. you@example.com,
// used as you+ra-check-1@example.com), and --yes. It creates test members and bookings in that session.
// Self-test of this script's logic against the mock: BOOKING_MODE=mock node scripts/momence-checks.mjs --self-test
import * as momence from '../src/lib/momence.js';
import * as store from '../src/lib/store.js';

store.useStore(store.memoryStore()); // outside the Worker: token cache and mock state live in memory for this run

const self = process.argv.includes('--self-test');
if (self) process.env.BOOKING_MODE = 'mock';
if (!self && (process.env.BOOKING_MODE !== 'sandbox' || !process.env.MOMENCE_TEST_SESSION_KEY || !process.argv.includes('--yes') || !process.env.CHECK_EMAIL_BASE)) {
  console.error('Refusing to run. Set BOOKING_MODE=sandbox, MOMENCE_TEST_SESSION_KEY, CHECK_EMAIL_BASE and pass --yes. Never point this at a real session.');
  process.exit(1);
}
const key = self ? 'full-day' : process.env.MOMENCE_TEST_SESSION_KEY;
const base = self ? 'check@example.com' : process.env.CHECK_EMAIL_BASE;
const mail = (n) => base.replace('@', `+ra-check-${n}@`);
const member = (n) => momence.findOrCreateMember({ name: `RA Check ${n}`, email: mail(n), whatsapp: '+6281200000000' });
const report = { check1: null, check2: 'Needs a person: look in the inbox for Momence emails for the +ra-check addresses and note whether one arrived per booking.', check3: null };

const s = await momence.getSession(key);
if (s.capacity == null || s.capacity > (self ? 50 : 5)) { console.error(`Test session capacity is ${s.capacity}. Use a test session with capacity 5 or less.`); process.exit(1); }

// Check 1: fill the session, then try one more. A correct answer is "full", or a waitlist entry. A booking beyond capacity is a FAIL.
const booked = [];
let n = 0;
while ((await momence.getSession(key)).left > 0) { n++; const m = await member(n); const b = await momence.book({ memberId: m.id, sessionKey: key }); if (!b.ok) break; booked.push(b.bookingId); }
const over = await momence.book({ memberId: (await member(++n)).id, sessionKey: key, enforceCap: false }); // enforceCap:false so this tests Momence, not our own guard
report.check1 = over.ok ? 'FAIL: booking accepted beyond capacity' : `PASS: refused beyond capacity (${over.reason})`;

// Check 3: put a guest on the waitlist, cancel one booking, then watch for the guest to be booked by Momence.
const w = await member(++n);
await momence.joinWaitlist({ memberId: w.id, sessionKey: key });
const before = await momence.getSession(key);
const cancel = await momence.cancelBooking({ bookingId: booked[0] });
let moved = (cancel.promoted || []).length > 0;
for (let i = 0; i < (self ? 0 : 12) && !moved; i++) { await new Promise((r) => setTimeout(r, 5000)); const a = await momence.getSession(key); moved = a.left === 0 && a.waiting < before.waiting; }
report.check3 = moved ? 'PASS: the waitlist moved up by itself' : 'FAIL or slow: the waitlist did not move within 60 seconds. If it needs a manual step, the app must book the next guest itself.';

console.log(JSON.stringify(report, null, 2));
console.log('\nClean up: cancel the RA Check bookings and delete the +ra-check members in Momence.');

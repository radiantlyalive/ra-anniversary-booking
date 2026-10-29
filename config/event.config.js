// ONE config file for the anniversary booking system.
//
// Every decision still waiting on Rafa is an OPEN(...) placeholder with value: null.
// Nothing here picks a side. In sandbox and live mode the functions refuse to run
// while any placeholder is null (run `npm run check:config` to list them).
// In mock mode only, config/demo.values.js fills the gaps so the demo runs. Those
// demo values are NOT decisions.
//
// When Rafa decides: put the value here, note the date and who decided in
// docs/decisions.md, same commit.

export const OPEN = (id, note) => ({ open: true, id, note, value: null });

// ---- Fixed facts (from the brief, not open) -------------------------------------------
export const event = {
  name: 'Move Beyond Your Self: RA Anniversary',
  date: '2026-12-01',
  timezone: 'Asia/Makassar', // Bali, WITA, UTC+8. Stored in UTC, shown in Bali time.
  starts: '08:15',
  ends: '19:00',
  venue: 'Radiantly Alive, Ubud',
};

export const fullDay = {
  key: 'full-day',
  capacity: 50, // enforced by Momence, mirrored here for display and the mock
  waitlist: true,
  requireWholeDayTick: true,
  momenceSessionId: null, // from Studio ops, needed outside mock mode
};

export const momenceTags = {
  // Must already exist in Momence: the API can assign tags but not create them.
  donor: 'Anniversary 2026 – Donor',
  confirmed: 'Anniversary 2026 – Confirmed',
};

export const limits = {
  minimumOtherAmount: 10000, // IDR 10,000, from the brief. Applies to the "Other" amount.
  bookPerIp: { limit: 10, windowSec: 600 },
  contributePerIp: { limit: 10, windowSec: 600 },
  maximumAmount: 100000000, // sanity guard on a typed amount, in whole currency units. Not a decision: adjust if the currency changes.
};

// ---- Open decisions: waiting on Rafa --------------------------------------------------
export const open = {
  // 1. Booking opening date. Deck: 8 November. Proposal: 12 November.
  bookingOpens: OPEN('P1', 'Booking opening date (ISO with offset, e.g. 2026-11-08T00:00:00+08:00). Deck says 8 Nov, proposal says 12 Nov.'),

  // 2. Single sessions. Deck: named sessions with capacities (RA Vinyasa about 30, reserve
  //    ahead; Hatha 70; Inside Flow 30; Vinyasa Krama 70; Yin and Sound within capacity).
  //    Proposal: "Session 1, 2, 3", no cap.
  //    Shape: { waitlistPerSession: boolean,
  //             list: [{ key, label, time, place?, capacity: number|null, momenceSessionId }] }
  //    capacity null = no cap. With waitlistPerSession true, a full session offers its own waitlist.
  singleSessions: OPEN('P2', 'Single sessions: names, times, per-session caps (or none), waitlist per session on or off.'),

  // 3. Where donations go and the wording. Deck: all donations go to Sari Hati.
  //    Proposal: "Radiantly Alive · Anniversary 2026 contribution". "Donation" vs "contribution".
  //    Shape: { word: 'donation'|'contribution', recipientLine: string, productName: string }
  contributions: OPEN('P3', 'Donation vs contribution wording, who receives it, the label guests see, the Stripe product name.'),

  // 4. Class credit as a payment option for single sessions. Deck: yes. Proposal: absent.
  //    Stubbed path, disabled by default. Enabling it needs a Momence credits endpoint (not read yet).
  classCredit: OPEN('P4', 'Class credit for single sessions. Stub only: { enabled: false } until decided.'),

  // 5. Reconfirm schedule. Deck adds a final confirmation the morning before the day.
  //    Proposal: email 26 Nov, reminder 27 Nov, deadline Sat 28 Nov 12:00 (WITA).
  //    Shape: { emailAt, reminderAt, deadlineAt, finalConfirmAt: ISO|null,
  //             release: 'automatic'|'team-review' }
  //    The emails themselves are Klaviyo flows. emailAt, reminderAt and finalConfirmAt are
  //    kept here for the docs and the demo; the deadline job uses deadlineAt and release.
  reconfirm: OPEN('P5', 'Reconfirm dates and times, optional day-before confirmation, release automatic vs team review.'),

  // 6. Optional meal package, IDR 100,000 to 150,000 (deck). Not in the proposal.
  //    Stubbed, disabled step. Shape: { enabled: false, priceIdr: number|null }
  mealPackage: OPEN('P6', 'Meal package: include, final price, how it is paid. Stub only until decided.'),

  // 7. Currency, suggested amounts, refund wording, and who keeps a spot at the deadline.
  //    Shape: { currency, suggestedAmounts: number[], refundWording: string|null,
  //             contributorsKeepSpotIfNoReconfirm: boolean }
  amounts: OPEN('D2-D5', 'Currency, suggested amounts, refund wording, whether contributors keep their spot if they miss the reconfirm.'),

  // Where the widget lives. Slug and page architecture are Rafa's call.
  eventPageUrl: OPEN('S1', 'Public URL of the anniversary event page (Stripe returns guests here).'),
};

// Open placeholders list, for the README check, the demo banner and check:config.
export function openItems(tree = open) {
  return Object.entries(tree).map(([path, o]) => ({ path, id: o.id, note: o.note, filled: o.value !== null }));
}

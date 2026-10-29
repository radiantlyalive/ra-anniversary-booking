// Event settings. Every value marked OPEN is waiting on Rafa: do not "fix" it in code.
// Change it here once decided, and update docs/decisions.md in the same commit.

export const OPEN = (value, note) => ({ value, open: true, note });

export const event = {
  name: 'Move Beyond Your Self: RA Anniversary',
  date: '2026-12-01',
  timezone: 'Asia/Makassar', // Bali, WITA, UTC+8
  starts: '08:15',
  ends: '19:00',
  venue: 'Radiantly Alive, Ubud',

  // P1. Deck: 8 November (with the identity launch). Proposal: 12 November.
  bookingOpens: OPEN('2026-11-08T00:00:00+08:00', 'P1: 8 Nov (deck) or 12 Nov (proposal)'),
};

export const fullDay = {
  momenceSessionId: null, // from Studio ops
  capacity: 50,
  waitlist: true,
  requireWholeDayTick: true,
};

// P2. Deck names the sessions with capacities. Proposal: "Session 1, 2, 3", no cap.
// Set capacity to null for "no cap". reserveAhead mirrors the deck wording.
export const singleSessions = OPEN([
  { key: 'ra-vinyasa',   label: 'RA Vinyasa',             time: '09:00 to 10:30', place: 'Upper Shala',  capacity: 30,   reserveAhead: true,  momenceSessionId: null },
  { key: 'hatha',        label: 'Hatha',                  time: '11:00 to 12:30', place: 'River Shala',  capacity: 70,   reserveAhead: false, momenceSessionId: null },
  { key: 'inside-flow',  label: 'Inside Flow',            time: '14:30 to 15:45', place: 'Jungle Shala', capacity: 30,   reserveAhead: true,  momenceSessionId: null },
  { key: 'yin-sound',    label: 'Yin and Sound workshop', time: '15:00 to 17:30', place: 'Upper Shala',  capacity: null, reserveAhead: false, momenceSessionId: null, note: 'within capacity, to confirm' },
  { key: 'vinyasa-krama',label: 'Vinyasa Krama',          time: '16:00 to 17:15', place: 'River Shala',  capacity: 70,   reserveAhead: false, momenceSessionId: null },
], 'P2: deck sessions with caps, or proposal "Session 1, 2, 3" with no cap');

export const contributions = {
  // P3. Deck: all donations go to Sari Hati. Proposal: RA "contribution".
  recipient: OPEN('Sari Hati', 'P3: Sari Hati (deck) or Radiantly Alive (proposal)'),
  word: OPEN('donation', 'P3: "donation" or "contribution" (finance, charity status)'),
  stripeProductName: OPEN('Anniversary 2026 contribution', 'P3'),
  currency: OPEN('IDR', 'Proposal decision 2'),
  suggestedAmounts: OPEN([100000, 250000, 500000], 'Proposal decision 2: placeholders'),
  minimumOther: 10000,
  refundWording: OPEN(null, 'Proposal decision 3'),
  contributorsKeepSpotIfNoReply: OPEN(true, 'Proposal decision 5: recommended yes'),
};

// P4. Deck: single sessions by donation OR class credit. Proposal: no class credit.
export const classCredit = OPEN({ enabled: false }, 'P4: offer class credit for single sessions?');

// P6. Deck: optional meal package, IDR 100,000 to 150,000. Not in the proposal.
export const mealPackage = OPEN({ enabled: false, priceIdr: null }, 'P6: include, final price, how it is paid');

// P5. Deck adds a final confirmation the morning before. Proposal ends 28 Nov 12:00.
export const reconfirm = OPEN({
  emailAt:    '2026-11-26T09:00:00+08:00',
  reminderAt: '2026-11-27T09:00:00+08:00',
  deadlineAt: '2026-11-28T12:00:00+08:00',
  dayBeforeFinalConfirm: false,
  release: 'automatic', // or 'team-review' (proposal decision 4)
}, 'P5 and proposal decision 4');

export const momenceTags = {
  donor: 'Anniversary 2026 – Donor',       // must already exist in Momence; the API cannot create tags
  confirmed: 'Anniversary 2026 – Confirmed',
};

// Lists every OPEN value, for the README check and the demo page banner.
export function openItems() {
  const all = { event, singleSessions, contributions, classCredit, mealPackage, reconfirm };
  const out = [];
  const walk = (obj, path) => {
    if (obj && typeof obj === 'object') {
      if (obj.open) { out.push({ path, note: obj.note }); return; }
      for (const [k, v] of Object.entries(obj)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(all, '');
  return out;
}

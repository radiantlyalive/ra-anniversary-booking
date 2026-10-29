# Waiting on Rafa

Every item with an id from P1 to S2 is an `OPEN(...)` placeholder in `config/event.config.js`, with value `null`. Nothing is decided in code. In sandbox and live the app refuses to run while one is null (`npm run check:config` lists them). In mock mode only, `config/demo.values.js` fills the gaps so the demo runs; those values are not decisions.

When Rafa decides: set the value in `config/event.config.js`, add the date and decider here, same commit.

| Id | Decision | Deck says | Proposal says | Status |
|---|---|---|---|---|
| P1 | When booking opens | 8 November | 12 November | Haidar directed 12 November on 2026-10-29. Rafa has not confirmed, so the config value is still null |
| P2 | Single sessions: names, caps, waitlist per session | Named sessions with capacities (RA Vinyasa about 30, reserve ahead; Hatha 70; Inside Flow 30; Vinyasa Krama 70; Yin and Sound within capacity) | "Session 1, 2, 3", no cap | Haidar directed named sessions with caps on 2026-10-29. Rafa has not confirmed. The deck's list is incomplete (RA Vinyasa 'about 30', Yin and Sound 'within capacity'), so the config list is still null |
| P3 | Where donations go, the word, the label, the Stripe product name | All donations go to Sari Hati | RA "contribution" | Open. Wording is `{word}` in the strings |
| P4 | Class credit for single sessions | Yes | Absent | Open. Stub, disabled |
| P5 | Reconfirm schedule | Adds a final confirmation the morning before | 26 Nov email, 27 Nov reminder, 28 Nov 12:00 deadline | Open |
| P6 | Meal package, IDR 100,000 to 150,000 | Optional | Absent | Open. Stub, disabled |
| P7 | Automation layer | RA runs automation on Zapier | New service in this repo (Cloudflare Workers) | Haidar directed the Worker on 2026-10-29. Rafa has not confirmed |
| D2-D5 | Currency, suggested amounts, refund wording, whether contributors keep a spot if they miss the reconfirm | | Placeholders IDR 100K, 250K, 500K; recommended yes | Open |
| D4 | Automatic release or team review at the deadline | | Both mentioned | Open (inside P5 config) |
| D6 | Room size for single sessions, which may need caps | | Raised | Open (inside P2 config) |
| S1 | Public URL of the anniversary event page | | | Open |
| S2 | Slugs of the thank-you and manage pages | | Abe: `/anniversary/thank-you`, `/anniversary/manage` | Open. Slugs are Rafa's call |
| H1 | Hosting | | Abe's updated proposal: Cloudflare Workers. Haidar: moving from Netlify, Durable Object for storage | Ported; mock-mode demo deployed 2026-10-29 (no secrets); sandbox and live not deployed |
| C1 | All guest copy in `config/strings.en.js` | | | Needs approval |

## Questions the build raised (not in any source document)

1. After the deadline, should "I can't make it" still release a spot? Today both actions are refused after the deadline.
2. A guest the waitlist moves up after the deadline is never reconfirmed or released by the job. Intended?
3. Do contributors receive the reconfirm email, even though the job skips them?
4. Single-session guests: any reconfirm at all? The proposal says they are never released.
5. Momence tag names contain an en dash ("Anniversary 2026 – Donor"). Kept exactly, because they must match Momence. No-dash rule applies to visitor copy.
6. Button label "Join with Donation" is fixed by the proposal; the word follows P3. Confirm the label follows P3.
7. Turnstile: in Abe's updated proposal. Rafa to approve.
8. Stripe receipt or a Klaviyo thank-you email, not both.
9. The waitlist button has no whole-day tick (the brief says the tick gates the two booking buttons). If a spot frees up between page load and the click, an unticked guest could be booked. Add the tick to the waitlist too?

## Momence webhook event name

Two Momence pages disagree: Webhooks Basics shows `session.booked`, the Events Reference lists `session-booked`. Haidar chose `session-booked` on 2026-10-29. The handler accepts only that spelling (and `session-booking-cancelled`). Rafa has not reconciled it. If the first sandbox delivery uses the dot form, no booking event will arrive and the handler will answer `ignored: event`.

## Questions the Momence client raised (not in any source document)

1. A cancel sent by a release uses `disableNotifications: true`, so Momence does not send its own cancellation email on top of the Klaviyo "released" email. Confirm.
2. A guest with a one-word name is created in Momence with last name "-", because the API requires `lastName` and the docs do not say whether empty is allowed. Confirm.
3. The client enforces the Full Day cap itself, because the docs list no "session full" error. Check 1 shows whether Momence does too.

## Not verified yet

- Stripe, Klaviyo and Cloudflare code was checked against their docs on 2026-10-29. Open: Stripe `price_data` nested fields and `Idempotency-Key`, the Klaviyo auth header, Worker to Durable Object calls. Run once on sandbox keys.
- Momence: endpoints are documented in `docs/momence.md`. Open for Rafa or the test session: the `session.booked` versus `session-booked` event name conflict, whether a free booking respects the cap, and the webhook HMAC key.

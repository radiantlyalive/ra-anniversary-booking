# Waiting on Rafa

Every item with an id from P1 to S2 is an `OPEN(...)` placeholder in `config/event.config.js`, with value `null`. Nothing is decided in code. In sandbox and live the app refuses to run while one is null (`npm run check:config` lists them). In mock mode only, `config/demo.values.js` fills the gaps so the demo runs; those values are not decisions.

When Rafa decides: set the value in `config/event.config.js`, add the date and decider here, same commit.

| Id | Decision | Deck says | Proposal says | Status |
|---|---|---|---|---|
| P1 | When booking opens | 8 November | 12 November | Open |
| P2 | Single sessions: names, caps, waitlist per session | Named sessions with capacities (RA Vinyasa about 30, reserve ahead; Hatha 70; Inside Flow 30; Vinyasa Krama 70; Yin and Sound within capacity) | "Session 1, 2, 3", no cap | Open. Both shapes are supported by config |
| P3 | Where donations go, the word, the label, the Stripe product name | All donations go to Sari Hati | RA "contribution" | Open. Wording is `{word}` in the strings |
| P4 | Class credit for single sessions | Yes | Absent | Open. Stub, disabled |
| P5 | Reconfirm schedule | Adds a final confirmation the morning before | 26 Nov email, 27 Nov reminder, 28 Nov 12:00 deadline | Open |
| P6 | Meal package, IDR 100,000 to 150,000 | Optional | Absent | Open. Stub, disabled |
| P7 | Automation layer | RA runs automation on Zapier | New service in this repo (Netlify, now Cloudflare Workers) | Open |
| D2-D5 | Currency, suggested amounts, refund wording, whether contributors keep a spot if they miss the reconfirm | | Placeholders IDR 100K, 250K, 500K; recommended yes | Open |
| D4 | Automatic release or team review at the deadline | | Both mentioned | Open (inside P5 config) |
| D6 | Room size for single sessions, which may need caps | | Raised | Open (inside P2 config) |
| S1 | Public URL of the anniversary event page | | | Open |
| S2 | Slugs of the thank-you and manage pages | | Abe: `/anniversary/thank-you`, `/anniversary/manage` | Open. Slugs are Rafa's call |
| H1 | Hosting | | Abe's updated proposal: Cloudflare Workers. Haidar: moving from Netlify | Port not done yet |
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

## Not verified yet

- Stripe checkout request fields, minor units for IDR, Klaviyo events API shape and revision, and the object store calls were written from memory: their docs were not reachable from the build session. Run once on sandbox keys before trusting them.
- Every Momence call except auth (see `docs/momence.md`).

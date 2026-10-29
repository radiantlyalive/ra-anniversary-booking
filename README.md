# RA Anniversary Booking

Booking system for **Move Beyond Your Self: RA Anniversary**, Tuesday 1 December 2026, 08:15 to 19:00, at Radiantly Alive, Ubud.

Guests book on the anniversary event page (Squarespace) for free, or with a donation. Every booking still lands in Momence, so the front desk, the 50-place Full Day cap and the waitlist work as they do today.

> **Status: booking flow built and tested in mock mode.** `npm run dev` serves a local demo with every widget state, and 91 tests cover booking, donation, waitlist, reconfirm and the deadline job. Nothing is connected to Momence, Stripe or Klaviyo, nothing is deployed, and the live site is untouched.
>
> **Runs on a Cloudflare Worker with a Durable Object**, locally only. **Not done:** the real Momence calls (only auth is documented; the other API pages have not been read), a deploy (none, and none without a separate yes), and the manage and thank-you pages on Squarespace (see `docs/decisions.md`). The Cloudflare docs were not reachable, so the Worker config follows the author's knowledge of Workers and has only been run locally.

Based on the proposal by Abraham (Marketing), 29 October 2026, and the anniversary content deck. Where the two disagree, the repo does not choose: see [Waiting on Rafa](#waiting-on-rafa).

---

## How it works

```
Squarespace event page
  └─ code block: booking widget (widget/)
        │  fetch /api/...
        ▼
Cloudflare Worker (src/)  ◄── webhooks from Momence and Stripe
  ├─► Momence   bookings, Full Day cap 50, waitlist, member tags
  ├─► Stripe    donations only, on Stripe-hosted Checkout
  └─► Klaviyo   every guest email, triggered by events
```

**Booking**
- Two tabs: **Full Day** and **Single sessions**.
- Full Day:
  - shows a live "places left" counter;
  - guests must tick **"I'm joining for the whole day"** before booking;
  - when it's full, guests join the waitlist and are offered single sessions.
- Two buttons, **Join for Free** and **Join with Donation**. Both book a free place in Momence first.
- "Join with Donation" then asks for an amount and opens Stripe Checkout.
- A guest who abandons payment keeps their free place, and nobody pays for a place that's gone.

**Reconfirm (Full Day only)**
- An email asks Full Day guests to confirm their place.
- Opening the link changes nothing, because email scanners open links. Confirming or releasing needs a tap on the page.
- A reminder goes to anyone who hasn't replied.
- After the deadline, unconfirmed places are released and the waitlist moves up. Contributors are skipped if configured.
- Single-session bookings are never released.

Full step-by-step flows: [`docs/flows.md`](docs/flows.md).

---

## Repo layout

```
config/
  event.config.js      every setting; open decisions are OPEN(...) placeholders with value null
  demo.values.js       mock-mode demo values only (not decisions)
  strings.en.js        every guest-facing line, each marked "needs Rafa approval"
src/
  worker.js            Worker entry: routes /api/*, runs the deadline job on a Cron Trigger
  store-do.js          the Durable Object that holds all booking state (atomic, so no double booking)
  handlers/            spots, book, contribute, stripe-webhook, momence-webhook, reconfirm, deadline, dev
  lib/                 service.js (all booking logic), momence (mock + real), stripe, klaviyo,
                       store, idempotency, ratelimit, signing, validate, time, config
widget/
  ra-booking.js        embeddable widget, plain JavaScript
  ra-booking.css       RA-brand styles, every selector starts .ra-bk
  demo.html, demo.js, mock-stripe.html   local demo only
scripts/               build.mjs, check-config.mjs, momence-checks.mjs
tests/                 node:test (91 tests) and tests/e2e (browser check against `npm run dev`)
wrangler.jsonc         Worker config: assets, Durable Object, cron every 15 minutes
docs/                  decisions, momence, flows, tracking, embed
```

## Run it locally

Needs Node 20 or later.

```bash
npm install
cp .env.example .env      # BOOKING_MODE=mock needs no keys
npm run dev               # wrangler dev: http://localhost:8888/demo.html
npm test
```

The demo page has the live flow (mock API), a preview of every widget state (booking form, form errors, single sessions, Full Day full, booking not open, amount step, Stripe handoff, thank-you, back from Stripe paid or abandoned, waitlisted, partly waitlisted, error states), the reconfirm page with confirmed and released, the emails Klaviyo would send, and the Momence mock. Mock state lives in the local Durable Object (`.wrangler/`, git-ignored); the Reset button clears it.

Browser check (Playwright, with `npm run dev` running): `npm run test:e2e`.

### Modes

| `BOOKING_MODE` | Uses | For |
|---|---|---|
| `mock` | In-memory store, no network | Building and tests. Default |
| `sandbox` | Momence test session, Stripe test keys, Klaviyo test list | End-to-end testing on a hidden page |
| `live` | Real sessions and a restricted live Stripe key | Launch only, after sign-off |

---

## Environment variables

All secrets live in Cloudflare Workers secrets (`wrangler secret put NAME`) and never in `wrangler.jsonc`, code, commits or chat. They never go in code, commits, chat or email. Names are listed in [`.env.example`](.env.example).

| Variable | What it is | From |
|---|---|---|
| `BOOKING_MODE` | `mock`, `sandbox` or `live` | |
| `ALLOWED_ORIGIN` | `https://www.radiantlyalive.com` (CORS) | |
| `MOMENCE_CLIENT_ID`, `MOMENCE_CLIENT_SECRET` | API client | Momence admin |
| `MOMENCE_USERNAME`, `MOMENCE_PASSWORD` | Staff login used only by the booking page | Momence admin |
| `MOMENCE_HOST_ID` | RA's Momence host ID | Momence admin |
| `MOMENCE_WEBHOOK_SECRET` | If Momence supports signed webhooks | Momence admin |
| `STRIPE_SECRET_KEY` | Test key now; restricted live key (Checkout only) at launch | Stripe admin |
| `STRIPE_WEBHOOK_SECRET` | Proves webhooks come from Stripe | Stripe admin |
| `KLAVIYO_PRIVATE_KEY` | Sends the email-trigger events | Klaviyo admin |
| `RECONFIRM_LINK_SECRET` | Signs reconfirm links | Generate a long random string |
| `TURNSTILE_SECRET_KEY` | Only if Turnstile spam protection is approved | |

---

## Waiting on Rafa

The repo does not decide these. Each is an `OPEN(...)` placeholder with value `null` in [`config/event.config.js`](config/event.config.js). In sandbox and live the app refuses to run while one is null (`npm run check:config`); in mock mode demo values fill the gaps. Full table with the deck and proposal side by side, plus extra questions the build raised: [`docs/decisions.md`](docs/decisions.md).

| Id | Decision | Deck | Proposal |
|---|---|---|---|
| P1 | Booking opens | 8 November | 12 November |
| P2 | Single sessions | Named, with capacities | "Session 1, 2, 3", no cap |
| P3 | Where donations go, and the word | Sari Hati | RA "contribution" |
| P4 | Class credit for single sessions | Yes | Absent (stub, off) |
| P5 | Reconfirm schedule, release automatic or team review | Adds a morning-before confirmation | 26 Nov, 27 Nov, 28 Nov 12:00 |
| P6 | Meal package, IDR 100,000 to 150,000 | Optional | Absent (stub, off) |
| P7 | Automation layer | Zapier | New service in this repo |
| D2-D5 | Currency, amounts, refund wording, contributors keep a spot if they miss the reconfirm | | Placeholders |
| S1, S2 | Event page URL, slugs of the thank-you and manage pages | | Abe: `/anniversary/thank-you`, `/anniversary/manage` |

## Tracking (proposed)

GTM `dataLayer` events: `ra_bk_tab_change`, `ra_bk_form_submit`, `ra_bk_free_booking`, `ra_bk_donation_start`, `ra_bk_donation_paid`, `ra_bk_waitlist_join`, `ra_bk_reconfirm`, `ra_bk_release`, `ra_bk_error`. No personal data. GA4 is not configured here. Details: [`docs/tracking.md`](docs/tracking.md).

## Hosting

Cloudflare Workers, per Abe's updated proposal. Static files (widget, CSS, demo) are Workers Static Assets. All state is one Durable Object: it handles one request at a time, so the idempotency lock is atomic and a double click that reaches two Worker instances still books once (checked locally with six parallel requests). The deadline job is a Cron Trigger every 15 minutes. Nothing is deployed.

## Not verified yet

Stripe checkout fields and IDR minor units, the Klaviyo events API, and the Worker, Durable Object and Cron config (run locally only, never deployed) were written without the vendor docs, which were unreachable. Every Momence call except auth is unwritten (`docs/momence.md`). Run on sandbox keys before trusting any of it.

## Brand rules for the widget

The widget sits on radiantlyalive.com and follows RA brand law and the /home-2 components. `npm test` checks the colour and copy rules.

- **Colours:** only the eight RA colours.
  - Cream `#FFFDEB`, Editorial Cream `#F5F0E8`, Soft Linen `#EDE5D5`, White `#FFFFFF`
  - Plum `#5A162F`, Deep Plum `#3A0D1F`, Crimson `#9B1823`, Amber `#EB9000`
  - No tints, no shades, no transparency, no hover colour variants.
- **Actions:** Crimson is the only action colour.
  - Primary button: Crimson fill, Cream label, square corners, 54px tall, 14px uppercase.
  - Secondary button: transparent, Crimson label, 1px Plum border.
  - Buttons hold their colour on hover.
- **White:** only for form fields. They have a 1px Plum border and 18px text, so iPhones don't zoom in.
- **Amber:** decorative only, and never used as text on a light background.
- **Headings:** use the site's `Agrandir-Head` stack. No rounded cards and no shadows.
- **Copy:** no em dashes, no exclamation marks, no emojis, and never "journey".
  - All copy lives in [`config/strings.en.js`](config/strings.en.js) and needs Rafa's approval.
- **Scoping:** every selector is prefixed `.ra-bk`, so nothing leaks into the Squarespace page.
- **Accessibility:** works at 390px wide with no sideways scroll, shows a visible keyboard focus and respects reduced motion.

---

## Access needed before sandbox testing

**Momence** (Momence admin and Studio ops)
- [ ] API client (client ID and secret)
- [ ] Staff login used only by the booking page
- [ ] Full Day session: cap 50, waitlist on
- [ ] Single sessions set up (depends on P2), with their session IDs
- [ ] One test session
- [ ] Tags created by hand: "Anniversary 2026 – Donor" and "Anniversary 2026 – Confirmed" (the API can't create tags)
- [ ] Webhooks for "session booked" and "booking cancelled"
- [ ] Three checks run on the test session (`npm run check:momence`, written, not run until test-session access is given):
  - Does a free booking respect the cap?
  - Does Momence send its own confirmation email?
  - Does the waitlist move up by itself?

**Stripe** (Stripe admin)
- [ ] Test key
- [ ] Restricted live key limited to Checkout Sessions
- [ ] Webhook to `/api/stripe-webhook` and its signing secret
- [ ] Checkout branding
- [ ] Statement descriptor, e.g. "RADIANTLY ALIVE"
- [ ] Product "Anniversary 2026 contribution"
- [ ] Receipt choice: Stripe receipt or a Klaviyo thank-you email, not both

**Other**
- [ ] Klaviyo private API key, and the flows for the events listed in [`src/lib/klaviyo.js`](src/lib/klaviyo.js)
- [ ] Cloudflare account for the Worker, with Durable Objects (the Workers paid plan may be needed: check), linked to this repo
- [ ] **Squarespace Business plan or higher.** Without it, code-block JavaScript doesn't run and the widget can't go on the page. Confirm this first.

---

## Build plan

The dates are from the proposal. They assume Momence and Stripe access arrives by Tuesday 3 November.

| Phase | Dates | Work |
|---|---|---|
| 1. Access and setup | 30 Oct to 3 Nov | Repo and Cloudflare; Momence API client, staff login, sessions, test session, tags; keys as Worker secrets; three Momence checks; fill [`docs/momence.md`](docs/momence.md) |
| 2. Booking engine | 3 to 6 Nov | `spots`, `book`, `contribute`, both webhooks |
| 3. Booking widget | 5 to 9 Nov | Both tabs, whole-day tick, both buttons, amount step, waitlist and thank-you states, spam protection, double-click protection; embed on a hidden Squarespace test page |
| 4. Emails and reconfirm | 6 to 10 Nov | Klaviyo flows (confirmation, waitlisted, thank-you, reconfirm, reminder, "You're in"); reconfirm page; deadline job |
| 5. Test and launch | 10 to 12 Nov | Full sandbox test (free, donation, full and waitlist, cancel, reconfirm, release); front-desk walkthrough; live keys; add to the anniversary page |

Launch date depends on P1. Key dates (P5): reconfirm emails Thu 26 Nov, reminder Fri 27 Nov, deadline Sat 28 Nov 12:00 Bali time, anniversary Tue 1 Dec.

---

## Ground rules

- **Never in mock or sandbox:** no live keys, no real Momence sessions, no live Klaviyo flows.
- **Squarespace:** build as a disabled draft and snapshot any live section before replacing it. Saving and publishing are separate confirmations, and publishing needs an explicit yes.
- **Conflicts:** when two sources disagree, stop and add the point to `docs/decisions.md`. Don't pick one.
- **Time zones:** times are stored in UTC and shown in Bali time (`Asia/Makassar`, WITA, UTC+8).
- **Personal data:** none goes into tracking events (see [`docs/tracking.md`](docs/tracking.md)).

## Known limits

- Momence's API can't take session payments, which is why Stripe handles donations.
- Donations appear in Stripe, not in Momence's revenue reports. Contributors get a Momence tag, and finance takes totals from Stripe.
- Full Day guests appear only on the Full Day list, not on the single-session lists. The front desk checks both.

## Cost

- GitHub and Cloudflare: free plans are expected to cover an event of this size. Durable Objects availability on the free plan is to be checked.
- Stripe: its standard fee on each donation, nothing on free bookings.
- Momence, Klaviyo and Squarespace: existing accounts.

## Ownership

- **Build and support:** Abraham (Marketing).
- **Approvals:** Rafa (decisions and all guest-facing copy).
- **Code location:** the company GitHub account, so anyone on the team can pick it up.

Private repository. Not for redistribution.

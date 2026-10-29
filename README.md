# RA Anniversary Booking

Booking system for **Move Beyond Your Self: RA Anniversary**, Tuesday 1 December 2026, 08:15 to 19:00, at Radiantly Alive, Ubud.

Guests book on the anniversary event page (Squarespace) for free, or with a donation. Every booking still lands in Momence, so the front desk, the 50-place Full Day cap and the waitlist work as they do today.

> **Status: draft scaffold.** The structure, settings, brand styles, mock data and tests are in place. The booking, donation, webhook, reconfirm and deadline functions return `501 Not implemented` until they are built (see [Build plan](#build-plan)). Nothing here is connected to Momence, Stripe or Klaviyo yet, and nothing is on the live site.

Based on the proposal by Abraham (Marketing), 29 October 2026, and the anniversary content deck. Where the two disagree, the repo does not choose: see [Waiting on Rafa](#waiting-on-rafa).

---

## How it works

```
Squarespace event page
  └─ code block: booking widget (widget/)
        │  fetch /api/...
        ▼
Netlify functions (netlify/functions/)  ◄── webhooks from Momence and Stripe
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
  event.config.js      every event setting; open decisions are wrapped in OPEN(...)
  strings.en.js        every guest-facing line (all need Rafa's approval)
netlify/functions/
  spots.js             GET  /api/spots            live Full Day counter
  book.js              POST /api/book             free booking or waitlist
  contribute.js        POST /api/contribute       opens Stripe Checkout
  stripe-webhook.js    POST /api/stripe-webhook   payment succeeded
  momence-webhook.js   POST /api/momence-webhook  front-desk bookings, cancellations, waitlist moves
  reconfirm.js         GET/POST /api/reconfirm    confirm page (GET changes nothing)
  deadline.js          scheduled every 15 min, acts once after the deadline
  _lib/                Momence, Stripe and Klaviyo clients (mock mode built in),
                       http helpers, idempotency, in-memory mock store
widget/
  ra-booking.js        embeddable widget (skeleton: Full Day tab only)
  ra-booking.css       RA-brand styles, all scoped to .ra-bk
  demo.html            local demo page
docs/
  decisions.md         the "Waiting on Rafa" list
  momence.md           Momence endpoints and webhooks (to fill from the API docs)
  flows.md             booking and reconfirm flows
  tracking.md          proposed GTM dataLayer events
  embed.md             how to add the widget to Squarespace
scripts/
  momence-checks.mjs   the three checks on the Momence test session
tests/                 node:test, no extra dependencies
```

---

## Run it locally

Needs Node 20 or later.

```bash
npm install
cp .env.example .env      # BOOKING_MODE=mock needs no keys
npm run dev               # Netlify dev server on http://localhost:8888
npm test
```

Open `http://localhost:8888/demo.html`. In mock mode the Full Day counter reads from an in-memory store (13 of 50 booked).

### Modes

| `BOOKING_MODE` | Uses | For |
|---|---|---|
| `mock` | In-memory store, no network | Building and tests. Default |
| `sandbox` | Momence test session, Stripe test keys, Klaviyo test list | End-to-end testing on a hidden page |
| `live` | Real sessions and a restricted live Stripe key | Launch only, after sign-off |

---

## Environment variables

All secrets live in **Netlify > Site configuration > Environment variables**. They never go in code, commits, chat or email. Names are listed in [`.env.example`](.env.example).

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

The repo does not decide these. Each is an `OPEN(...)` value in [`config/event.config.js`](config/event.config.js), and a test fails if one is silently removed. Details and status: [`docs/decisions.md`](docs/decisions.md).

| # | Decision | Deck | Proposal |
|---|---|---|---|
| P1 | Booking opens | 8 November | 12 November |
| P2 | Single sessions | Named sessions with capacities | "Session 1, 2, 3", no cap |
| P3 | Where donations go, and the word | All to Sari Hati | RA "contribution" |
| P4 | Class credit for single sessions | Yes | Not offered |
| P5 | Reconfirm schedule | Adds a final confirmation the morning before | 26 Nov email, 27 Nov reminder, 28 Nov 12:00 deadline |
| P6 | Meal package, IDR 100,000 to 150,000 | Optional | Not in the flow |
| P7 | Automation layer | Zapier | Netlify functions (this repo) |
| D2 to D6 | Amounts, refund wording, automatic release or team review, contributors keep their place, room-size caps | | Proposal's own questions |

The default values in config follow the deck where it is specific. They are placeholders, not decisions.

---

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
- [ ] Three checks run on the test session (`npm run check:momence`):
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
- [ ] Klaviyo private API key, and the flows for the events listed in [`netlify/functions/_lib/klaviyo.js`](netlify/functions/_lib/klaviyo.js)
- [ ] Netlify team account linked to this repo
- [ ] **Squarespace Business plan or higher.** Without it, code-block JavaScript doesn't run and the widget can't go on the page. Confirm this first.

---

## Build plan

The dates are from the proposal. They assume Momence and Stripe access arrives by Tuesday 3 November.

| Phase | Dates | Work |
|---|---|---|
| 1. Access and setup | 30 Oct to 3 Nov | Repo and Netlify; Momence API client, staff login, sessions, test session, tags; keys in Netlify; three Momence checks; fill [`docs/momence.md`](docs/momence.md) |
| 2. Booking engine | 3 to 6 Nov | `spots`, `book`, `contribute`, both webhooks; idempotency moved to Netlify Blobs |
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

- GitHub and Netlify: the free plans are expected to cover an event of this size.
- Stripe: its standard fee on each donation, nothing on free bookings.
- Momence, Klaviyo and Squarespace: existing accounts.

## Ownership

- **Build and support:** Abraham (Marketing).
- **Approvals:** Rafa (decisions and all guest-facing copy).
- **Code location:** the company GitHub account, so anyone on the team can pick it up.

Private repository. Not for redistribution.

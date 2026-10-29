# Flows

## Booking
1. Widget loads, calls `GET /api/spots` for the Full Day counter.
2. Guest picks Full Day (tick "I'm joining for the whole day") or single sessions.
3. `POST /api/book` with an Idempotency-Key: validate, spam check, find or create the Momence member, then:
   - Full Day full: join the waitlist, Klaviyo "Anniversary Waitlisted", offer single sessions.
   - Otherwise: book FREE first, Klaviyo "Anniversary Booked".
4. "Join for Free": done. "Join with Donation": amount step, then `POST /api/contribute` opens Stripe Checkout. "Skip" keeps the free place.
5. Stripe `checkout.session.completed` hits `/api/stripe-webhook`: Momence donor tag, Klaviyo "Anniversary Contributed".

## Reconfirm (Full Day only)
1. Klaviyo sends the reconfirm email at `reconfirm.emailAt` with a signed link to `/api/reconfirm`.
2. Opening the link changes nothing. A tap (POST) confirms or releases.
3. Confirm: Momence confirmed tag, Klaviyo "Anniversary Confirmed", reminder suppressed.
4. Release: booking cancelled, waitlist moves up, next guest gets "Anniversary Moved Up".
5. Reminder at `reconfirm.reminderAt` to anyone unconfirmed.
6. `deadline` job after `reconfirm.deadlineAt`: release unconfirmed places, skipping contributors if configured, or list them for the team if `release` is `team-review`.

Single-session bookings are never released.

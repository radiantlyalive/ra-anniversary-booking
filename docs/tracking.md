# Tracking (proposed, not configured)

The widget pushes these to the GTM `dataLayer`. GA4 tags and conversions are set up in GTM by whoever owns tracking; nothing here configures GA4. Names are proposals.

| Event | When | Parameters |
|---|---|---|
| ra_bk_tab_change | Tab changed | tab (full_day, single_sessions) |
| ra_bk_form_submit | A booking button was pressed with a valid form | booking_type, intent (free, donate) |
| ra_bk_free_booking | Free booking confirmed by the server | booking_type, sessions_count |
| ra_bk_donation_start | Guest left for Stripe Checkout | amount_band (suggested_1, suggested_2, suggested_3, other) |
| ra_bk_donation_paid | Guest returned from a paid checkout (a return, not proof of payment: the Stripe webhook is the proof) | none |
| ra_bk_waitlist_join | Waitlisted for any session | booking_type |
| ra_bk_reconfirm | Confirmed the Full Day spot | none |
| ra_bk_release | Released the Full Day spot | none |
| ra_bk_error | An error state was shown | code |

No personal data (name, email, phone, booking ref) in any event. Bands, not exact amounts.

`ra_bk_reconfirm` and `ra_bk_release` fire on the reconfirm page. Today that page is served by the function and carries its own `dataLayer` push (plus GTM if `GTM_CONTAINER_ID` is set). Abe's updated proposal puts it on a hidden Squarespace page instead, where the site's GTM already loads.

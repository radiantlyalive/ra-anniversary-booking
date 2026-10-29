# Tracking (proposed, not configured)

The widget pushes these to the GTM `dataLayer`. GA4 tags and conversions are set up in GTM by whoever owns tracking. Names are proposals.

| Event | When | Parameters |
|---|---|---|
| ra_anniv_tab | Tab changed | tab |
| ra_anniv_submit | Form submitted | type, intent |
| ra_anniv_booked_free | Free booking confirmed | type, sessions |
| ra_anniv_donation_start | Stripe checkout opened | amount_band |
| ra_anniv_donation_paid | Return from a paid checkout | amount_band |
| ra_anniv_waitlist | Joined the waitlist | |
| ra_anniv_reconfirm | Confirmed the Full Day place | |
| ra_anniv_release | Released the Full Day place | |

No personal data (name, email, phone) in any event. Use amount bands, not exact amounts.

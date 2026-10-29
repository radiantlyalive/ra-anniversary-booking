# Momence integration notes

To be filled in from Momence's current API documentation BEFORE any client code is written. Do not guess endpoints.

## Auth
- API client (client ID, secret): created under API Clients in the Momence dashboard.
- Booking-page staff login (username, password), separate from any personal account.
- Token flow and expiry: TODO

## Endpoints used
| Purpose | Method and path | Notes |
|---|---|---|
| Places left in a session | TODO | |
| Find member by email | TODO | |
| Create member | TODO | |
| Book a session, free | TODO | Must respect the cap |
| Join a waitlist | TODO | |
| Cancel a booking | TODO | Should move the waitlist up |
| Assign a tag | TODO | Tags must already exist |

## Webhooks
- "Session booked": payload TODO, verification TODO
- "Booking cancelled": payload TODO, verification TODO

## The three checks on the test session (`npm run check:momence`)
1. Does a free booking respect the cap?
2. Does Momence send its own confirmation email? If yes, decide whether to switch it off so guests do not get two.
3. Does the waitlist move up by itself when a booking is cancelled?

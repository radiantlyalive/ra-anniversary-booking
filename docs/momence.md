# Momence integration notes

Source: Momence public API docs (OpenAPI, version 2.0, pages pasted by Haidar, page dates 2026-06-01). Index of all pages: https://api.docs.momence.com/llms.txt (not yet readable from the build session).

Rule: nothing below is assumed. Anything marked UNKNOWN waits for the docs or for a test on the test session. Do not write client code against an UNKNOWN row.

Base URL: `https://api.momence.com`

## Auth (documented)

Two credentials are involved:
- **API client** (client ID and secret). Sent as HTTP Basic auth on the token call: `client_id` as username, `client_secret` as password.
- **Staff login** (username and password). Used with the `password` grant.

| Purpose | Method and path | Body (form-urlencoded) | Result |
|---|---|---|---|
| Get a token (staff login) | `POST /api/v2/auth/token` | `grant_type=password`, `username`, `password` | token object |
| Refresh a token | `POST /api/v2/auth/token` | `grant_type=refresh_token`, `refresh_token` | token object |
| Get a token (authorization code) | `POST /api/v2/auth/token` | `grant_type=authorization_code`, `code`, `redirect_uri` | token object |
| Start the authorization-code flow | `GET /api/v2/auth/authorize` | query: `client_id`, `redirect_uri`, `scope=public-api-v2`, `response_type=code`, `state`, `prompt` (`login`, `sign-up`, `none`) | browser flow |
| Who is logged in | `GET /api/v2/auth/profile` | none | `{userId, memberId, email, firstName, lastName}` |
| Invalidate a token | `POST /api/v2/auth/logout` | none | 201 |

Token object: `accessToken` (also `access_token`), `accessTokenExpiresAt`, `refreshToken` (also `refresh_token`), `refreshTokenExpiresAt`. Both expiry fields are date-times.

Plan for the booking functions: use the `password` grant with the dedicated booking-page staff login (the authorization-code flow needs a browser and is not used). Cache the token, refresh it before `accessTokenExpiresAt`, and fall back to the password grant if the refresh fails. Workers are stateless between requests, so the token cache lives in the store (the Durable Object), not in memory.

### Auth: still UNKNOWN
- How the access token is sent on API calls. The docs name an OAuth2 scheme, which usually means `Authorization: Bearer <accessToken>`. Confirm on the test session.
- Token lifetimes (access and refresh). Only the expiry timestamps are returned.
- What the staff login's role allows. The booking-page login needs only what the endpoints below require.
- Rate limits.

## Endpoints used (not yet documented here)

Needed pages from the Momence API docs. Paste each page or allow the host.

| Purpose | Method and path | Status |
|---|---|---|
| Places left in a session (cap, booked count) | UNKNOWN | need the sessions page |
| Waitlist size for a session | UNKNOWN | need the sessions or waitlist page |
| Find member by email | UNKNOWN | need the members page |
| Create member | UNKNOWN | need the members page |
| Book a session, free | UNKNOWN | need the bookings page. Must respect the cap |
| Join a waitlist | UNKNOWN | need the waitlist page |
| Cancel a booking | UNKNOWN | need the bookings page. Should move the waitlist up |
| Assign a tag to a member | UNKNOWN | need the tags page. Tags must already exist |
| List sessions (to match the Full Day and single-session IDs) | UNKNOWN | need the sessions page |

## Webhooks

- "Session booked": payload UNKNOWN, verification UNKNOWN
- "Booking cancelled": payload UNKNOWN, verification UNKNOWN
- If Momence cannot sign webhooks, note it here and protect the endpoint with an unguessable path or secret query value, plus a re-read of the booking from the API before acting on it.

## The three checks on the test session (`npm run check:momence`)
Not run. Waiting for test-session access.
1. Does a free booking respect the cap?
2. Does Momence send its own confirmation email? If yes, decide whether to switch it off so guests do not get two.
3. Does the waitlist move up by itself when a booking is cancelled?

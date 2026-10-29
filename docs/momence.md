# Momence integration notes

Source: Momence public API docs (OpenAPI, version 2.0, pages pasted by Haidar, page dates 2026-06-01). Index of all pages: https://api.docs.momence.com/llms.txt (read directly on 2026-10-29).

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

## Endpoints (documented, read from the Momence OpenAPI pages on 2026-10-29)

Source pages: https://api.docs.momence.com/llms.txt and the pages it links. Page dates are 2026-04 to 2026-08. All paths are on `https://api.momence.com` and are Host API (staff login required, same permissions as the Host Dashboard). Every Host API call is marked in the OpenAPI as `OAuth2` plus `OAuth2ApiClient` (Basic, client ID and secret). All list endpoints use `page` (starts at 0) and `pageSize`, and return `{pagination: {page, pageSize, totalCount, sortBy?, sortOrder?}, payload: [...]}`.

| Purpose | Method and path |
|---|---|
| List sessions | `GET /api/v2/host/sessions` |
| Session detail (cap, waitlist counts) | `GET /api/v2/host/sessions/{sessionId}` |
| List a session's bookings | `GET /api/v2/host/sessions/{sessionId}/bookings` |
| Book a member, free | `POST /api/v2/host/sessions/{sessionId}/bookings/free` |
| Join the waitlist | `POST /api/v2/host/sessions/{sessionId}/waitlist/bookings` |
| Cancel a booking | `DELETE /api/v2/host/session-bookings/{bookingId}` |
| List or search members | `GET /api/v2/host/members` |
| Members with filters | "Get members (with filters)" page exists, path and body not read: UNKNOWN |
| Get member | `GET /api/v2/host/members/{memberId}` |
| Create member | `POST /api/v2/host/members` |
| List tags | `GET /api/v2/host/tags` |
| Assign tag to member | `POST /api/v2/host/members/{memberId}/tags/{tagId}` (no body, 201) |
| Unassign tag | listed in the index, page not read |

There is no endpoint to create a tag. The two tags are made by hand in Momence, as the README says.

### Sessions
- `GET /api/v2/host/sessions` query: `page`*, `pageSize`* (1 to 200), `sortOrder` (ASC, DESC), `sortBy` (name, startsAt, endsAt), `includeCancelled`, `types[]` (private, special-event, special-event-new, retreat, fitness, course, course-class, semester, recital), `teacherId`, `locationId`, `includeChildLocations`, `startAfter`, `startBefore`, `endAfter`, `endBefore` (strings, format UNKNOWN).
- Item (`HostSessionDto`): `id`, `name`, `type`, `semesterId`, `description`, `startsAt`, `endsAt`, `durationInMinutes`, `capacity` (nullable), `bookingCount`, `teacher`, `isRecurring`, `isCancelled`, `isInPerson`, `isDraft`, `inPersonLocation`, `onlineStreamUrl`, `onlineStreamPassword`, `bannerImageUrl`, `hostPhotoUrl`, `tags[]`.
- `GET /api/v2/host/sessions/{sessionId}` returns `HostSessionDetailDto`: `id`, `name`, `semesterId`, `startsAt`, `endsAt`, `capacity` (nullable), `bookingCount` (nullable), `waitlistCapacity` (nullable), `waitlistBookingCount` (nullable), teachers, flags, links, `tags[]`.
- Places left = `capacity - bookingCount`. Waitlist size = `waitlistBookingCount`. Use the detail call: the list call has no waitlist fields.

### Bookings
- `GET /api/v2/host/sessions/{sessionId}/bookings` query: `page`*, `pageSize`* (1 to 100), `sortOrder`, `sortBy` (createdAt, firstName, lastName), `includeCancelled`.
- Item (`HostSessionBookingDto`): `id`, `member` (`id`, `firstName`, `lastName`, `email`, `phoneNumber`, `pictureUrl`), `roomSpotId`, `checkedIn`, `ticketsBought`, `createdAt`, `isRecurring`, `recurringBookingId`, `cancelledAt`.
- `POST /api/v2/host/sessions/{sessionId}/bookings/free`
  - Body (JSON): `memberId`* (integer), `createRecurringBooking` (boolean, optional).
  - 200: `{sessionBookingId, sessionRecurringBookingId?}`.
  - 400: `{type, message}`. `type` is one of `err-member-not-found`, `err-member-not-assigned-to-host`, `err-session-not-found`, `err-session-not-provided-by-host`, `err-customer-age-prevents-from-action`, `err-missing-customer-date-of-birth`, `err-missing-date-of-birth-setting`, `err-invalid-date-of-birth-value`. The description table also lists `err-session-not-recurring`, which the response schema omits (a mismatch inside the page).
  - There is NO documented error for "session full". See UNKNOWN below.
- `DELETE /api/v2/host/session-bookings/{bookingId}`
  - Body (JSON, all three required): `refund` (boolean), `disableNotifications` (boolean), `isLateCancellation` (boolean). 200, no body.
  - Does not touch recurring bookings (separate endpoint, page not read).
  - The page says the booking ID is the `id` field of the bookings list. Whether it equals `sessionBookingId` from the booking call is not stated: confirm on the test session.

### Waitlist
- `POST /api/v2/host/sessions/{sessionId}/waitlist/bookings`
  - Body (JSON): `memberId`* (integer), `useBoughtMembershipIds` (integer array, optional).
  - 200: `{waitlistBookingId}`.
  - 400 `type`: `err-waitlist-not-allowed`, `err-waitlist-full`, `err-member-already-on-waitlist`, plus the member, session and date-of-birth errors above.
- No documented endpoint to list waitlist entries or to cancel one. Only the counts on the session detail.

### Members
- `GET /api/v2/host/members` query: `page`*, `pageSize`* (1 to 100), `sortBy` (lastSeenAt, firstSeenAt, firstName, lastName, email), `sortOrder`, `query` ("Search customers by query"), `filterPreset` (with-active-membership), `staticSegmentId`. Whether `query` matches an email exactly is UNKNOWN.
- Item (`HostMemberDto`): `id`, `firstName`, `lastName`, `email`, `phoneNumber`, `pictureUrl`, `firstSeen`, `lastSeen`, `visits`, `customerFields[]`, `customerTags[]` (each tag: `id`, `name`, `isCustomerBadge`, `badgeLabel`, `badgeColor`, `corporateTagId`).
- `POST /api/v2/host/members`: body `email`*, `firstName`*, `lastName`*, `phoneNumber`, `homeLocationId`. 200: `{memberId}`. Behaviour when the email already exists is UNKNOWN (no error list on the page).
- Booking requires the member to be assigned to the host (`err-member-not-assigned-to-host`). Whether a created member is assigned automatically is UNKNOWN.

### Tags
- `GET /api/v2/host/tags` query: `page`*, `pageSize`* (1 to 100), `sortOrder`, `sortBy` (name). Item `HostTagDto`: `id`, `name`, `isCustomerBadge`, `badgeLabel`, `badgeColor`, `corporateTagId`. Look up the tag IDs by exact `name`, do not hard-code them.
- `POST /api/v2/host/members/{memberId}/tags/{tagId}`: path params only, 201.

### Still UNKNOWN (nothing below is chosen; Rafa or the test session answers)
1. Does `bookings/free` refuse at capacity, or overbook (staff add)? The docs give no "full" error. This is check 1 and it decides whether the Worker must enforce the 50 cap itself.
2. Does Momence email the guest on a free staff booking? (check 2). The cancel call has `disableNotifications`, the free-booking call has no such flag.
3. Does a cancel move the waitlist up by itself, and does that fire `session-booked`? (check 3). The docs say `session-booked` fires for "any way, including automatic", which suggests yes. Not confirmed.
4. How the access token is sent. The docs only name the OAuth2 scheme. `Authorization: Bearer <accessToken>` is the standard but is not written anywhere.
5. Token lifetimes: the access token "expires in a few hours", refresh lifetime not stated. Rate limits: none stated for these endpoints.
6. Member lookup by exact email, and duplicate email behaviour on create.
7. Date format accepted by `startAfter` and the other date filters.
8. Whether waitlist entries can be listed or removed through the API.
9. Not read: "Get members (with filters)" and the unassign-tag page.

## Webhooks (documented)

Source: "Webhooks Basics" (2026-03-06) and "Webhooks Events Reference" (2026-08-06). Webhooks are marked experimental and are not enabled by default: ask Momence support to enable them. The endpoint is created in the Dashboard (Webhooks Configuration). The secret values are shown once only.

**Does Momence sign webhooks? Yes, but the scheme is only half specified.**
- `x-webhook-signature`: HMAC-SHA256 of the `payload` string (the raw string value inside the body, not re-serialised JSON).
- `x-webhook-secret`: the secret shown in the dashboard, to be compared with the stored value. This is a shared secret sent in a header, so it proves little alone.
- `x-webhook-reqeuest-id` (spelled with the typo in the docs): unique per event, same on retries. Use it to drop duplicates.
- UNKNOWN: the key used for the HMAC (probably the dashboard secret, the docs do not say). UNKNOWN: hex or base64 signature. UNKNOWN: whether there are two secrets ("save the secret values", plural). UNKNOWN: retry schedule.

Request: `POST`, JSON body with one property, `payload`, which is itself a JSON string:

```json
{ "payload": "{\"timestamp\":\"2025-10-03T10:11:00.462Z\",\"event\":\"session-booked\",\"payload\":{}}" }
```

Inner JSON: `timestamp` (ISO 8601), `event`, `payload` (event specific).

### CONFLICT between two Momence pages (flagged, not resolved)
The Basics page example shows the event name `session.booked` (dot). The Events Reference lists `session-booked` (hyphen) and hyphens for every event. Rafa, or the first real delivery, settles it. Until then do not match on one spelling only and do not guess.

### Events the build needs
- `session-booked`: `payload` = `sessionId`, `sessionBookingId`, `payingMemberId`, `targetMemberId` (all integers, all required). Fires for any booking, including automatic and child bookings.
- `session-booking-cancelled`: `payload` = `sessionBookingId`, `sessionId`, `payingMemberId`, `targetMemberId`, `isLateCancellation` (boolean), `cancelledAt` (string). Fires when the member or the host cancels.
- There is NO waitlist event in the reference (no joined, promoted or removed). Promotion can only be inferred from a `session-booked` after a cancellation, or by re-reading the session detail. UNKNOWN until check 3.
- Other events exist (member-assigned, member-updated, session-created, session-updated, session-booking-checked-in, session-booking-no-show, payment-transaction-*, bought-membership-*) and are not used.

Protection plan: verify `x-webhook-signature` once the HMAC key is confirmed, compare `x-webhook-secret`, de-duplicate on the request ID, and re-read the booking from the API before acting.

## The three checks on the test session (`npm run check:momence`)
Not run. Waiting for test-session access.
1. Does a free booking respect the cap?
2. Does Momence send its own confirmation email? If yes, decide whether to switch it off so guests do not get two.
3. Does the waitlist move up by itself when a booking is cancelled?

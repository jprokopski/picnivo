# Cross-Device RSVP Identity Implementation Plan

## Overview

When an organizer creates an event on one device and then opens the event link on a second device (after logging in), their attendance dialog never appears — even though their DB attendance is genuinely "Undecided." The cause is that RSVP identity is resolved **only** through a per-device `httpOnly` cookie (`pv_p_<token>`) holding a raw `Participant.Id`; the organizer's convenience `Participant` row has no addressable link to their authenticated account.

This plan gives the organizer's participant row a **cross-device identity derived from their authenticated account** — with no schema change — by resolving it server-side from the account (`event.OrganizerId == sub` + the `IsOrganizer` participant row) and backfilling the `pv_p` cookie on first authenticated visit. Once the cookie is set, every existing cookie-based flow (attendance card rendering, `set-attendance`, votes, claims, `myParticipantId`) works unchanged. A related, compounding OAuth redirect bug is fixed in the same change.

## Current State Analysis

- **Identity is cookie-only.** `pv_p_<token>` (httpOnly, 400-day, set via TanStack `setCookie` in the frontend server-fn layer) stores a raw `Participant.Id`. It is set at event creation (`create-event/functions.ts:26`) and join (`join-event/functions.ts:14`), and read by every event feature to resolve identity. See `frontend/src/lib/participant/cookie.ts`.
- **Backend resolves `you` purely by cookie.** `GetEventByToken.Handle` (`backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:85`) sets `you` only when `participantId` (an optional query param) matches a participant. On device B the cookie is absent → `participantId` is null → `you: null`. The endpoint is anonymous.
- **Frontend gate hides the dialog silently.** `event-detail-view.tsx:38,95`: `joined = !!event.you`; `showAttendanceCard = joined && (isAnnouncement || locked)`. With `you: null`, the card and its submit button never render — no error, no dialog.
- **The account identity is already present and used inconsistently.** On the very same route, `isOrganizer = context.user?.id === event.organizerId` (`$token.tsx:19`) is correctly account-derived and cross-device. Only `event.you` is cookie-derived.
- **The organizer's participant row is uniquely identifiable without a new column.** `CreateEvent.cs:47-54` creates exactly one participant per event with `IsOrganizer = true`. Combined with `event.OrganizerId`, that row is fully determined by the authenticated `sub` claim — no `Participant.OrganizerId` FK is needed.
- **Authenticated backend calls already pass `Bearer` tokens explicitly.** `create-event/functions.ts:24` shows the pattern (`Authorization: Bearer ${session?.access_token}`), backed by `authMiddleware` / `createSupabaseServerClient`. But `authMiddleware` **throws** on no session (`middleware/auth.ts:12`), so it cannot guard the public event route; the fix must read the session gracefully like `getSessionFn` (`lib/supabase/session.ts`).
- **Compounding OAuth bug.** `handleGoogleSignIn` (`auth-panel.tsx:102-105`) hardcodes `redirectTo: ${origin}/auth/callback` with no `next`. The callback route (`routes/auth/callback.tsx:21-24,43-47`) already reads and safely honors `next`, defaulting to `/events` — so Google-login users always lose their original destination.

## Desired End State

An organizer who logs in on a new device and opens their event link sees the attendance dialog immediately, can submit an RSVP (and vote / claim) successfully, because their `pv_p_<token>` cookie was silently restored from their authenticated account on that first visit. Guests and anonymous visitors are unaffected (`you` stays cookie-only for them). Google-login users who followed an event link land back on that event link, not `/events`.

**Verification:** Reproduce the original bug (create on device A, open link on freshly-logged-in device B) — the attendance card renders and RSVP submit succeeds; the `pv_p` cookie is present after the first load. A guest on a new device still gets no `you`/card. A Google sign-in initiated from `/login?redirect=/e/<token>` returns to `/e/<token>`.

### Key Discoveries:

- Organizer participant row is uniquely resolvable via `event.OrganizerId == sub && p.IsOrganizer` — no schema change needed (`CreateEvent.cs:47-54`).
- `GetEventByToken` already accepts an optional `participantId` query param (`GetEventByToken.cs:11,85`), so the resolved id can be threaded in explicitly rather than relying on re-reading a just-set cookie mid-request.
- The `pv_p` cookie is a frontend-domain cookie set by TanStack `setCookie` (`lib/participant/cookie.ts`) — the .NET backend cannot set it, so backfill **must** live in the frontend server-fn layer.
- `getSessionFn` (`lib/supabase/session.ts`) is the graceful (non-throwing) session-read pattern to mirror; `authMiddleware` throws and cannot be used on this public route.
- The OAuth callback already honors a safe `next` param — the only gap is passing it into `signInWithOAuth`.

## What We're NOT Doing

- **Not** adding a `Participant.OrganizerId` FK column, migration, or entity-config change — resolution uses existing fields.
- **Not** backfilling existing rows via a data migration — the resolution works for already-created events automatically.
- **Not** solving cross-device identity for **anonymous guest** participants — that was explicitly designed and accepted as out of scope (`context/archive/2026-07-02-participant-voting-and-claims/plan-brief.md`). Only organizers (who have accounts) are addressed.
- **Not** eagerly restoring cookies for all of an organizer's events on login — restoration is lazy, per-event, on visiting the link.
- **Not** adding a defensive frontend fallback that renders the card from `isOrganizer` when `you` is null — the cookie backfill is the single source of truth, avoiding a state where the card shows but mutations fail.

## Implementation Approach

Resolve the organizer's participant id server-side from their account, backfill the `pv_p` cookie so subsequent requests on that device are cookie-fast, and thread the resolved id into the event fetch so the first render is already correct:

1. **Backend** exposes a small authenticated endpoint that, given a token and the authenticated `sub`, returns the caller's participant id **only if** they are the event's organizer. Everyone else gets 404.
2. **Frontend** adds a graceful (non-throwing) server fn that, when the `pv_p` cookie is missing, reads the session and — if present — calls that endpoint, sets the cookie, and returns the id. The `/e/$token` loader uses this id both to backfill the cookie and to pass `participantId` explicitly into `getEventByTokenFn`, so `you` resolves on the very first render.
3. **OAuth** redirect threading is fixed so the reported end-to-end scenario also works for Google-login users.

## Critical Implementation Details

- **Cookie set mid-request is not readable mid-request.** `setCookie` writes a response header; `getCookie` reads the request. So the loader must **pass the resolved participantId explicitly** into `getEventByTokenFn` (via its existing optional `participantId` param) rather than setting the cookie and expecting `getEventByTokenFn` to re-read it in the same request. The cookie backfill benefits the *next* request (e.g., the RSVP submit POST), which the browser makes after the Set-Cookie header lands.
- **`authMiddleware` cannot guard this route.** It throws `Unauthorized` when there is no session (`middleware/auth.ts:12`), but `/e/$token` is public. The new server fn must create the Supabase server client and read the session directly, returning null for guests (mirror `getSessionFn`).

## Phase 1: Backend — organizer participant resolution endpoint

### Overview

Add an authenticated vertical slice that resolves the caller's participant id for an event **iff** they are its organizer, using existing fields only.

### Changes Required:

#### 1. New action slice: `GetMyParticipant`

**File**: `backend/Picnivo.API/Features/Events/GetMyParticipant/GetMyParticipant.cs`

**Intent**: Given the route `token` and the authenticated `sub` claim, return the organizer's participant id for that event. Return `NotFound` when the event doesn't exist, the caller isn't its organizer, or (defensively) no `IsOrganizer` participant exists. This is the account-derived counterpart to the cookie-derived `you` resolution.

**Contract**: `static Task<IResult> Handle(string token, ClaimsPrincipal user, PicnivoDbContext db, CancellationToken ct)`. Parse `sub` → `Guid organizerId` (mirror `CreateEvent.cs:17`); `Results.Unauthorized()` if unparseable. Query the event by `Token`, projecting `OrganizerId` and the participant id where `IsOrganizer`. Return `Results.Ok(new GetMyParticipantResponse(participantId))` only when `event.OrganizerId == organizerId` and that participant exists; otherwise `Results.NotFound()`.

#### 2. Response DTO

**File**: `backend/Picnivo.API/Features/Events/GetMyParticipant/GetMyParticipantDtos.cs`

**Intent**: Private response DTO for this action.

**Contract**: `record GetMyParticipantResponse(Guid ParticipantId)`.

#### 3. Endpoint registration

**File**: `backend/Picnivo.API/Features/Events/GetMyParticipant/GetMyParticipantEndpoint.cs`

**Intent**: Map the authenticated route; discovered by reflection via `IEndpoint`.

**Contract**: `class GetMyParticipantEndpoint : IEndpoint` mapping `GET /api/events/{token}/me` → `GetMyParticipant.Handle`, with `.RequireAuthorization()`, `.WithName("GetMyParticipant")`, `.Produces<GetMyParticipantResponse>()`, `.Produces(StatusCodes.Status404NotFound)`. (Unlike `GetEventByTokenEndpoint`, this one requires auth.)

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds (regenerates OpenAPI spec + client): `dotnet build` (from `backend/Picnivo.API/`)
- [ ] Integration tests pass: `dotnet test` (from `backend/`)
- [ ] New integration tests cover: organizer gets their participant id; a different authenticated user gets 404; unauthenticated request gets 401; unknown token gets 404

#### Manual Verification:

- [ ] `GET /api/events/{token}/me` with the organizer's bearer token returns their participant id (matches the row created in `CreateEvent`)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding. The endpoint change regenerates the frontend API client — Phase 2 depends on it.

---

## Phase 2: Frontend — lazy cookie backfill on event visit

### Overview

When the `pv_p` cookie is missing and the visitor is an authenticated organizer, resolve their participant id via the Phase 1 endpoint, set the cookie, and thread the id into the event fetch so `you` resolves on first render and subsequent mutations work.

### Changes Required:

#### 1. Regenerate API client

**File**: `frontend/src/api/picnivo-api.ts` (generated)

**Intent**: Pick up the new `getMyParticipant` operation from the backend spec.

**Contract**: Run `pnpm orval` (do not hand-edit). Confirms a `getMyParticipant(token, config)` function exists.

#### 2. Graceful participant-id resolver with cookie backfill

**File**: `frontend/src/features/events/get-event-by-token/functions.ts`

**Intent**: Add a server fn that returns the effective participant id for a token — the existing cookie if present, otherwise (for an authenticated organizer) the account-resolved id from the Phase 1 endpoint, which it also writes to the `pv_p` cookie. Guests and unauthenticated visitors get the cookie value or null. This replaces the cookie-only `getMyParticipantIdFn` used by the route loader.

**Contract**: New `getMyParticipantIdFn`-equivalent server fn (GET, validated by `tokenSchema`) that: (1) returns `getParticipantIdCookie(token)` if set; (2) else creates the Supabase server client (mirror `getSessionFn` — never throw for guests), reads the session; if a session exists, calls `getMyParticipant(token, { headers: { Authorization: Bearer <access_token> } })`, and on success calls `setParticipantIdCookie(token, participantId)` and returns it; (3) returns null on no session / 404 / any resolution failure. Must swallow the 404 (non-organizer) as a normal "no identity" outcome, not an error.

#### 3. Thread the resolved id into the event fetch

**File**: `frontend/src/features/events/get-event-by-token/functions.ts` and `frontend/src/routes/_app/e/$token.tsx`

**Intent**: Ensure `you` resolves on the first render by passing the resolved participant id explicitly into `getEventByTokenFn`, since a cookie set this request isn't readable this request. Restructure the loader so identity resolves before (or feeds into) the event fetch.

**Contract**: Extend `getEventByTokenFn`'s validated input to accept an optional `participantId`, using it when provided and falling back to `getParticipantIdCookie(token)` otherwise (preserving current behavior for callers that don't pass it). In the `$token` loader, resolve the participant id first (via the new resolver from change #2), then pass it as `participantId` into `getEventByTokenFn` and reuse it as `myParticipantId`. `getShareOriginFn` may still run in parallel. `isOrganizer` continues to derive from `context.user?.id === event.organizerId`.

### Success Criteria:

#### Automated Verification:

- [ ] Type check passes: `pnpm exec tsc --noEmit` (from `frontend/`)
- [ ] Lint passes: `pnpm lint` (from `frontend/`)
- [ ] Unit tests pass: `pnpm test` (from `frontend/`)
- [ ] New server-fn test covers: cookie present → returns cookie value without calling the endpoint; no cookie + authenticated organizer → calls endpoint, sets cookie, returns id; no cookie + guest/no-session → returns null; endpoint 404 → returns null (no throw)

#### Manual Verification:

- [ ] Repro is fixed: create event on device A; open link on freshly-logged-in device B → attendance card renders and RSVP submit succeeds
- [ ] After the first device-B load, the `pv_p_<token>` cookie is present (subsequent votes/claims work)
- [ ] A guest opening the link on a new device still sees no `you`/attendance card (no regression to the intentional guest tradeoff)
- [ ] Organizer with an existing cookie sees no behavior change and no extra endpoint call

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 3: Bundled fix — OAuth redirect threading

### Overview

Thread the safe `redirect` destination through Google OAuth so users who followed an event link and signed in with Google return to that link instead of `/events`.

### Changes Required:

#### 1. Pass `next` into `signInWithOAuth`

**File**: `frontend/src/features/auth/components/auth-panel.tsx`

**Intent**: Include the same safe-path `redirect` that email/password login already honors (`auth-panel.tsx:86-90`) in the OAuth `redirectTo`, so the callback route's existing `next` handling (`routes/auth/callback.tsx:43-47`) sends the user back to their original destination.

**Contract**: In `handleGoogleSignIn`, compute the safe redirect (same guard as the email path: starts with `/`, not `//`, else `/events`) and build `redirectTo: ${origin}/auth/callback?next=${encodeURIComponent(safe)}`. No change needed in `callback.tsx` — it already validates and honors `next`.

### Success Criteria:

#### Automated Verification:

- [ ] Type check passes: `pnpm exec tsc --noEmit` (from `frontend/`)
- [ ] Lint passes: `pnpm lint` (from `frontend/`)

#### Manual Verification:

- [ ] Starting from `/login?redirect=/e/<token>` and choosing "Continue with Google" lands back on `/e/<token>` after auth
- [ ] Google sign-in from `/login` with no redirect still lands on `/events` (default preserved)

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation. This completes the reported end-to-end scenario for both email and Google login.

---

## Testing Strategy

### Unit Tests:

- Frontend server fn (Phase 2): cookie hit path, account-resolve path (endpoint called + cookie set), guest/no-session path (null), and endpoint-404 path (null, no throw). Mock the generated `getMyParticipant` and the Supabase server client / cookie helpers per existing frontend test conventions.

### Integration Tests:

- Backend `GetMyParticipant` (Phase 1) via the typed `PicnivoApiClient`: organizer → their participant id; other authenticated user → 404; unauthenticated → 401; unknown token → 404. Use `ctx.AuthedApiClient(organizerId)` and `ctx.ApiClient` per `backend/CLAUDE.md`.

### Manual Testing Steps:

1. Create an event while logged in on device/browser A.
2. In a clean browser B (no cookies), open the event link → redirected to login → log in (try both email/password and Google).
3. Confirm you land back on the event link (Phase 3) and the attendance dialog is visible (Phase 2).
4. Submit an RSVP; confirm it persists and the crew/attendance UI updates.
5. Cast a date vote / claim an item to confirm the backfilled cookie drives all mutations.
6. In another clean browser as a **guest** (no account), open the link → confirm no attendance card appears (guest tradeoff preserved).

## Performance Considerations

The resolver adds at most one authenticated backend round-trip **only** on a cookie-less, authenticated visit; the common case (cookie present) short-circuits before any session read or network call. Restoration is lazy per-event, so there is no batch query cost on login.

## Migration Notes

None — no schema change, no data migration. Existing events benefit immediately because resolution derives from `event.OrganizerId` + the `IsOrganizer` participant row, both already present.

## References

- Research: `context/changes/cross-device-rsvp-identity/research.md`
- Change identity: `context/changes/cross-device-rsvp-identity/change.md`
- Optional-param / anonymous-endpoint precedent: `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:11,85`
- Bearer-token call + cookie-set precedent: `frontend/src/features/events/create-event/functions.ts:24,26`
- Graceful session read pattern: `frontend/src/lib/supabase/session.ts`
- Guest cross-device tradeoff (out of scope): `context/archive/2026-07-02-participant-voting-and-claims/plan-brief.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — organizer participant resolution endpoint

#### Automated

- [x] 1.1 Backend builds (regenerates OpenAPI spec + client): `dotnet build` — 418457d
- [x] 1.2 Integration tests pass: `dotnet test` — 418457d
- [x] 1.3 New integration tests cover organizer/other-user/unauthenticated/unknown-token cases — 418457d

#### Manual

- [x] 1.4 `GET /api/events/{token}/me` with organizer bearer returns the correct participant id — 418457d

### Phase 2: Frontend — lazy cookie backfill on event visit

#### Automated

- [x] 2.1 Type check passes: `pnpm exec tsc --noEmit`
- [x] 2.2 Lint passes: `pnpm lint`
- [x] 2.3 Unit tests pass: `pnpm test`
- [x] 2.4 New server-fn test covers cookie-hit / account-resolve / guest / 404 paths

#### Manual

- [x] 2.5 Repro fixed: device-B attendance card renders and RSVP submit succeeds
- [x] 2.6 `pv_p_<token>` cookie present after first device-B load (votes/claims work)
- [x] 2.7 Guest on a new device still sees no `you`/attendance card
- [x] 2.8 Organizer with existing cookie sees no behavior change / no extra call

### Phase 3: Bundled fix — OAuth redirect threading

#### Automated

- [ ] 3.1 Type check passes: `pnpm exec tsc --noEmit`
- [ ] 3.2 Lint passes: `pnpm lint`

#### Manual

- [ ] 3.3 Google sign-in from `/login?redirect=/e/<token>` returns to `/e/<token>`
- [ ] 3.4 Google sign-in with no redirect still lands on `/events`

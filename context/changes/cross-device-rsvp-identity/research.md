---
date: 2026-07-03T22:03:44Z
researcher: Claude
git_commit: cb554b506c3a9d448576fc984e2686e348015c2f
branch: main
repository: picnivo
topic: "Organizer attendance dialog missing after logging in on a new device"
tags: [research, codebase, rsvp, attendance, participant-identity, auth, cookies]
status: complete
last_updated: 2026-07-03
last_updated_by: Claude
---

# Research: Organizer attendance dialog missing after logging in on a new device

**Date**: 2026-07-03T22:03:44Z
**Researcher**: Claude
**Git Commit**: cb554b506c3a9d448576fc984e2686e348015c2f
**Branch**: main
**Repository**: picnivo

## Research Question

An organizer logs in, creates an event on device A. They swap to device B, click the event link (not logged in there), get redirected to log in, log in, then open the link again — the attendance dialog never appears, even though their DB attendance status is genuinely "Undecided." Why, and what's the right fix given the existing identity model?

## Summary

Root cause confirmed: RSVP identity is resolved **entirely** through a per-device `httpOnly` cookie (`pv_p_<eventToken>`) holding a raw `Participant.Id`. `Participant` has no link back to the authenticated `Organizer` account. On a new device this cookie doesn't exist, so `GetEventByToken` returns `you: null`, and the frontend's `showAttendanceCard = joined && (...)` (where `joined = !!event.you`) never renders the card at all — no error, no dialog, nothing. The failure is silent because the gating happens before the user can even interact with a submit button; `SetAttendance` itself does surface a clear toast error ("Join the event first.") when called with no participant id, but that code path is never reached since the card isn't shown.

**Important scoping finding from archived context**: cross-device identity loss for anonymous guest participants was **explicitly designed and accepted** — `context/archive/2026-07-02-participant-voting-and-claims/plan-brief.md` states switching devices "creates a new participant — accepted for friend-group scale," and lists "cross-device identity sync" as out of scope. This was a conscious tradeoff for guests, not an oversight.

The organizer's case is different in kind: unlike guests, organizers **do** have a durable, cross-device identity — their Supabase account. The bug is that the organizer's own convenience `Participant` row (auto-created at event creation so they can vote/RSVP on their own event) is *only* addressable via the same anonymous cookie mechanism as guests, even though the authenticated `sub` claim is available and already used elsewhere (`isOrganizer` check) on the very same page. The fix should be scoped to **linking the organizer's participant row to their account**, not to solving general anonymous cross-device sync (which is out of scope by design).

A separate, related bug was found in the login-redirect flow: Google OAuth sign-in never threads the `redirect` param through `/auth/callback`, so OAuth users always land on `/events` regardless of where they started (email/password login does this correctly). This compounds the reported scenario if the user used Google sign-in, but is not the root cause — the dialog would still be missing even with a correct redirect, because the cookie/account link is the real gap.

## Detailed Findings

### Cookie-based identity model

- `pv_p_<eventToken>` httpOnly cookie stores a raw `Participant.Id`, keyed per event token, 400-day expiry ([frontend/src/lib/participant/cookie.ts](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/frontend/src/lib/participant/cookie.ts)).
- Set at event creation ([frontend/src/features/events/create-event/functions.ts#L26](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/frontend/src/features/events/create-event/functions.ts#L26)) and at join time ([frontend/src/features/events/join-event/functions.ts#L14](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/frontend/src/features/events/join-event/functions.ts#L14)).
- Read in 5 features, all guarding server-side mutations/reads: `get-event-by-token/functions.ts:13,34`, `set-attendance/functions.ts:10` (returns `{error: "Join the event first."}` if missing), `vote-on-dates/functions.ts:10` (returns `{error: "Join the event before voting."}`), `claim-items/functions.ts:23,46,61,84`.
- `myParticipantId` is threaded from the route loader ([frontend/src/routes/_app/e/$token.tsx#L24](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/frontend/src/routes/_app/e/%24token.tsx#L24)) down into `attendees.tsx` (`isMe` check) and `haul.tsx` (remove-own-item check).

### Backend resolution of `event.you`

- `GetEventByToken.Handle` ([backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs#L85](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs#L85)) resolves `you` purely by `participantId is { } pid && raw.Participants.Any(p => p.Id == pid)`. No fallback to an authenticated user.
- The endpoint is **anonymous** — no `.RequireAuthorization()` — and already accepts an optional `Guid? participantId` query parameter. This is a working precedent in this codebase for **optional auth on an endpoint**: a handler can accept both an optional identifier and (as shown elsewhere) an authenticated `ClaimsPrincipal`, with no special middleware required.
- Existing authenticated endpoints (e.g. `CreateEvent.cs`) extract the Supabase user id via `ClaimsPrincipal user` → `Guid.TryParse(user.FindFirstValue("sub"), out var organizerId)`. `Program.cs` sets up JWT bearer validation against Supabase's JWKS (ES256, audience `"authenticated"`).

### Frontend organizer detection (already using auth, inconsistently)

- `routes/_app/e/$token.tsx:19`: `isOrganizer = event ? context.user?.id === event.organizerId : false` — this **is** resolved via the authenticated session, correctly, cross-device. `context.user` comes from the root route's `beforeLoad` calling `getSessionFn()` → Supabase `auth.getUser()`, giving the full Supabase `User` object (id, email, metadata, etc.) — plenty to key a lookup on.
- So on the very same page, `isOrganizer` is correctly account-derived, while `event.you` (which drives the attendance dialog) is cookie-derived only. That inconsistency is the crux of the bug.

### Attendance submit flow (why it fails silently, not loudly)

- `AttendanceCard` ([frontend/src/features/events/set-attendance/components/attendance-card.tsx](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/frontend/src/features/events/set-attendance/components/attendance-card.tsx)) only calls `setAttendanceFn({token, status})` — it never sends a participantId; identity is resolved server-side from the cookie.
- `set-attendance/functions.ts` returns a clear `{error: "Join the event first."}` if the cookie is missing, and the UI does show this via `toast.error`. **But this code path is never reached** in the bug scenario, because `EventDetailView`'s `showAttendanceCard = joined && (isAnnouncement || locked)` (`joined = !!event.you`) is `false` — the card, and its submit button, never render in the first place. The failure the user sees ("no dialog") is a rendering gate, not a submit-time error.
- Backend `SetAttendance` endpoint is also anonymous, and 404s if `participantId` doesn't belong to the event — consistent with cookie-only design, not itself broken.

### Migration & entity-config precedent for the fix

- `Participant` ([backend/Picnivo.API/Data/Models/Participant.cs](https://github.com/jprokopski/picnivo/blob/cb554b506c3a9d448576fc984e2686e348015c2f/backend/Picnivo.API/Data/Models/Participant.cs)) currently has no `OrganizerId`/account-link field.
- `EventConfiguration.cs` already shows the fluent-API shape for an FK to `Organizer`: `.HasOne(e => e.Organizer).WithMany().HasForeignKey(e => e.OrganizerId).IsRequired().OnDelete(DeleteBehavior.Cascade)` — a nullable variant (`IsRequired()` omitted, `OnDelete(ReferentialAction.SetNull)`) is the established pattern for optional FKs elsewhere (e.g. `AddedByParticipantId` on `EventItem`, added in migration `20260702124332_AddParticipantsVotesAndClaims.cs`).
- Existing single-column index precedent: `IX_Participants_EventId` (same migration). A composite `(EventId, OrganizerId)` index would follow this pattern for a fast "is this authenticated organizer already a participant on this event" lookup.
- Migration style for adding a nullable column: `20260703110358_AddParticipantIsOrganizer.cs` shows the minimal `AddColumn<bool>(..., nullable: false, defaultValue: false)` shape; a nullable `Guid` FK column follows the same call with `nullable: true` plus a follow-up `AddForeignKey()`.

### Login-redirect flow (separate, compounding bug)

- Email/password login correctly threads `?redirect=` from `/login` back through to the original page (`auth-panel.tsx:86-90`, validated as a safe same-origin path).
- Google OAuth does **not**: `auth-panel.tsx` calls `supabase.auth.signInWithOAuth()` with a hardcoded `redirectTo: "${origin}/auth/callback"`, no `next` param. `routes/auth/callback.tsx:21-24` defaults `next` to `/events` when absent — so OAuth users always land on `/events`, never back on `/e/$token`.
- This doesn't cause the reported dialog bug by itself (the dialog would still be missing after a correct redirect, since the cookie/account link is the actual gap) but it's a related, independently fixable issue worth flagging.

### Historical context — this gap was intentionally scoped, but only for guests

- `context/archive/2026-07-02-participant-voting-and-claims/plan-brief.md`, "Out of scope": *"cross-device identity sync."* "Open Risks & Assumptions": *"Browser-token identity means clearing localStorage / switching device creates a new participant — accepted for friend-group scale."*
- `plan.md`, "What We're NOT Doing": same statement, near-verbatim.
- The `Organizer`/`Participant` split was designed from the start as two non-overlapping identity systems (`context/archive/2026-06-28-event-creation-and-sharing/plan.md`: *"the link IS the access"*; `2026-07-02-participant-voting-and-claims/plan.md`: *"No organizer account required to view as participant — the link is the access; organizer controls are an inline enhancement"*). Account-linking for `Participant` was never proposed or deferred as future work — it's simply outside the model as designed.
- The organizer's own `Participant` row is a **same-event convenience row** (added mid-implementation so organizers could vote/claim on their own event, per `reviews/impl-review-phase-4.md`), explicitly documented as not carrying over across events or devices — but no document anywhere traces this through to "the organizer's own attendance dialog silently disappears after an account-based login on a new device." That specific consequence was never named or accepted; only the general guest-identity tradeoff was.
- No lesson in any of the three `lessons.md` files touches this area (checked: root, frontend, backend — zero hits for cross-device/account-link/participant-identity patterns).

## Code References

- `frontend/src/lib/participant/cookie.ts` — cookie get/set, `pv_p_<token>` naming
- `frontend/src/features/events/create-event/functions.ts:26` — cookie set at event creation
- `frontend/src/features/events/join-event/functions.ts:7-31` — reference shape for a "resolve identity → setCookie → return" server function
- `frontend/src/features/events/get-event-by-token/functions.ts:13,34` — cookie read feeding `event.you` and `myParticipantId`
- `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx:38,80-95` — `joined`/`showAttendanceCard` gating logic
- `frontend/src/features/events/set-attendance/functions.ts:10-13` — "Join the event first." error path (unreachable in this bug scenario)
- `frontend/src/features/events/set-attendance/components/attendance-card.tsx` — submit button, calls `setAttendanceFn({token, status})`
- `frontend/src/routes/_app/e/$token.tsx:19,24` — `isOrganizer` (account-derived) vs `myParticipantId` (cookie-derived)
- `frontend/src/features/auth/components/auth-panel.tsx:86-90,102-105` — redirect threading (email/password vs Google OAuth)
- `frontend/src/routes/auth/callback.tsx:21-24` — `next` param defaulting to `/events`
- `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:85` — `you` resolution, cookie-only
- `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByTokenEndpoint.cs` — anonymous endpoint, optional-param precedent
- `backend/Picnivo.API/Features/Events/CreateEvent/CreateEvent.cs` — example of `ClaimsPrincipal` → `sub` claim extraction pattern
- `backend/Picnivo.API/Data/Models/Participant.cs` — no account-link field currently
- `backend/Picnivo.API/Data/Configurations/EventConfiguration.cs` — FK-to-Organizer fluent config precedent
- `backend/Picnivo.API/Data/Migrations/20260702124332_AddParticipantsVotesAndClaims.cs` — nullable FK column + index precedent
- `backend/Picnivo.API/Data/Migrations/20260703110358_AddParticipantIsOrganizer.cs` — simple nullable/non-nullable column-add precedent

## Architecture Insights

- The codebase already has a working pattern for **optional auth** (anonymous endpoint + optional identifier), which is the shape a fix needs — no new auth middleware required.
- There's an existing asymmetry on `/e/$token` between an account-derived fact (`isOrganizer`) and a cookie-derived fact (`event.you`) computed side by side on the same route — a strong signal the fix belongs at the `GetEventByToken` resolution boundary, not purely in the frontend.
- The "resolve state server-side, then `setCookie` as a side effect" pattern is already established (Supabase's `setAll` cookie transport in `src/lib/supabase/server.ts`, and structurally in `joinEventFn`) — a fix can reuse this shape: resolve the organizer's participant id via JWT, backfill the cookie, so subsequent requests on that device stay cookie-fast.

## Historical Context (from prior changes)

- `context/archive/2026-07-02-participant-voting-and-claims/plan-brief.md` — "Out of scope: cross-device identity sync" and "accepted for friend-group scale" — establishes that **guest** cross-device loss is an intentional tradeoff, not a bug to fix here.
- `context/archive/2026-06-28-event-creation-and-sharing/plan.md` — "the link IS the access" — foundational design principle for the whole participant model; any fix should avoid weakening this for guests.
- `context/archive/2026-07-02-participant-voting-and-claims/reviews/impl-review-phase-4.md` — documents the organizer's own `Participant` row being added as a same-event convenience, which is the row this bug actually affects.

## Related Research

None found — this is the first research artifact under `context/changes/` specifically about participant/organizer identity resolution.

## Open Questions

1. Should the fix also auto-recreate the organizer's cookie for *every* event they organize on first authenticated visit (batch), or only lazily per-event on demand (as the bug is currently scoped, per-`/e/$token` visit)? Lazy/per-event seems sufficient and simpler.
2. Should `GetEventByToken` accept an *optional* `ClaimsPrincipal` (no `.RequireAuthorization()`) to check `user.id == event.OrganizerId` server-side, or should the frontend make a **separate** authenticated call after render to backfill the cookie, keeping `GetEventByToken` untouched? The former is fewer round-trips; the latter is a smaller diff to a widely-used endpoint. Worth deciding explicitly in planning.
3. Should the OAuth redirect-threading bug (`redirect`/`next` not passed through `signInWithOAuth`) be fixed in this same change, or filed/fixed separately? It's related (same login flow) but independently reproducible and fixable — recommend a quick call in planning on whether to bundle or split.
4. Do we want a DB backfill/migration-time pass to populate `OrganizerId` for existing organizer-participant rows (so the fix helps already-created events immediately), or is it acceptable that only newly-created events get the link going forward, with existing organizers' rows lazily linked on their next authenticated visit?

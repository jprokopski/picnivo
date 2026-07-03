# Cross-Device RSVP Identity — Plan Brief

> Full plan: `context/changes/cross-device-rsvp-identity/plan.md`
> Research: `context/changes/cross-device-rsvp-identity/research.md`

## What & Why

An organizer who creates an event on one device and then opens the event link on a second device (after logging in) never sees their attendance dialog — even though their DB attendance is genuinely "Undecided." RSVP identity is resolved **only** via a per-device `httpOnly` cookie (`pv_p_<token>`) holding a raw `Participant.Id`, with no link back to the authenticated account. This change gives the organizer's participant row a cross-device identity derived from their account, so the dialog appears and RSVP/vote/claim all work on any device.

## Starting Point

Every event feature resolves "who am I" from the `pv_p_<token>` cookie. On a new device that cookie doesn't exist, so `GetEventByToken` returns `you: null` and the frontend gate `showAttendanceCard = !!event.you && …` silently hides the card. Meanwhile the same route already computes `isOrganizer` correctly from the authenticated account (`context.user?.id === event.organizerId`) — the account identity is present but unused for `you`.

## Desired End State

An organizer logging in on a new device and opening their event link sees the attendance dialog immediately and can submit an RSVP, because their `pv_p` cookie is silently restored from their account on first visit. Guests are unaffected. Google-login users who followed an event link return to that link instead of `/events`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Organizer→participant link | Resolve via existing `event.OrganizerId == sub && p.IsOrganizer` — no schema change | The organizer's row is already uniquely determined; a new FK column adds a migration and backfill for a link that existing fields imply | Plan |
| Where backfill lives | Frontend server-fn layer sets the `pv_p` cookie | The cookie is a frontend-domain cookie set via TanStack `setCookie`; the .NET backend cannot set it | Plan |
| Restore timing | Lazy, per-event on visiting the link | Fixes exactly the reported scenario with no extra queries on unrelated pages | Plan |
| First-render correctness | Thread the resolved id into `getEventByTokenFn`'s optional `participantId` param | A cookie set this request isn't readable this request, so the id must be passed explicitly | Plan |
| OAuth redirect bug | Bundle the fix | ~1 line; completes the reported repro for Google-login users who'd otherwise land on `/events` | Research |
| Test coverage | Backend integration + frontend server-fn tests | Covers the identity boundary where the bug lives and the cookie-backfill glue | Plan |

## Scope

**In scope:**
- New authenticated backend endpoint resolving the organizer's participant id by token.
- Frontend graceful resolver that backfills the `pv_p` cookie on first authenticated visit and threads the id into the event fetch.
- Bundled OAuth redirect threading fix.

**Out of scope:**
- Cross-device identity for anonymous **guests** (intentionally accepted tradeoff).
- Any schema change, migration, or data backfill.
- Eager/batch cookie restoration for all of an organizer's events.
- A frontend fallback that renders the card from `isOrganizer` when `you` is null.

## Architecture / Approach

Backend adds a small authenticated endpoint (`GET /api/events/{token}/me`) returning the caller's participant id **iff** they're the event's organizer (else 404). Frontend adds a non-throwing server fn that, when the `pv_p` cookie is missing, reads the session and — if authenticated — calls that endpoint, sets the cookie, and returns the id. The `/e/$token` loader resolves the id first, passes it explicitly into `getEventByTokenFn` (so `you` resolves on first render), and reuses it as `myParticipantId`. The Set-Cookie header makes every subsequent mutation (RSVP, vote, claim) cookie-fast.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Backend resolve endpoint | Authenticated `GET /api/events/{token}/me` + integration tests | Correctly scoping to organizer-only (guests/other users must 404) |
| 2. Frontend lazy backfill | Cookie restore on first authenticated visit; id threaded into event fetch | Mid-request cookie set isn't readable mid-request — handled by passing the id explicitly |
| 3. OAuth redirect fix | Google login returns to the original event link | Ensuring the `next` param survives the OAuth round-trip (callback already honors it) |

**Prerequisites:** None beyond the existing auth stack; Phase 2 depends on Phase 1's regenerated API client.
**Estimated effort:** ~1–2 sessions across 3 small phases.

## Open Risks & Assumptions

- Assumes exactly one `IsOrganizer` participant per event (guaranteed by `CreateEvent`) — resolution matches that row.
- Assumes the OAuth `redirectTo` query string survives the provider round-trip back to `/auth/callback` (Supabase preserves it and appends `code`).
- The resolver must treat a 404 (non-organizer) as a normal "no identity" outcome, not an error, to avoid breaking guest views.

## Success Criteria (Summary)

- Organizer sees the attendance dialog and can RSVP on a new device after login (email or Google).
- The `pv_p` cookie is restored on first visit, so votes/claims also work.
- Guests on a new device are unchanged — no dialog, no regression to the accepted guest tradeoff.

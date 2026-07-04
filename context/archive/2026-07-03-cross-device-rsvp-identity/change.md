---
change_id: cross-device-rsvp-identity
title: Fix attendance dialog missing after organizer logs in on a new device
status: archived
created: 2026-07-03
updated: 2026-07-04
archived_at: 2026-07-04T02:26:29Z
---

## Notes

Fix organizer's attendance dialog not showing after logging in on a new device, since RSVP identity is tracked by a per-device cookie with no link to the authenticated account.

Repro: log in, create an event on device A. Swap to device B, click the event link (not logged in there), log in, then open the link again and click submit — no attendance dialog appears, even though the organizer's status is "Undecided" in the database.

Root cause (diagnosed pre-flow, see conversation): RSVP/attendance identity is resolved entirely via a per-device `httpOnly` cookie (`pv_p_<eventToken>` storing a raw `Participant.Id`) — never via the authenticated account. `Participant` has no `OrganizerId`/`UserId` link back to the `Organizer` (Supabase account) that created it.

- `backend/Picnivo.API/Data/Models/Participant.cs` — no account-link field.
- `backend/Picnivo.API/Features/Events/CreateEvent/CreateEvent.cs` — organizer's `Participant` row created without any link to their authenticated organizer id.
- `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:85` — resolves `you` (attendance/votes/claims) purely by matching cookie's `participantId` against `Participants`; no fallback to the authenticated user.
- `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx:38,95` — `joined = !!event.you`; `showAttendanceCard` never renders if `event.you` is null, regardless of true DB attendance status.
- `frontend/src/routes/_app/e/$token.tsx:19` — `isOrganizer` IS correctly derived from `context.user?.id === event.organizerId`, but this isn't used to resolve `event.you`.

Candidate direction (to validate in research/plan): add `Participant.OrganizerId` (nullable), set at organizer-participant creation time, and have `GetEventByToken` resolve `you` by authenticated user id OR cookie `participantId`, then backfill the cookie server-side once resolved via account match.

Scope note: this only fixes organizers (the only participants with an authenticated account per current schema). Anonymous guest participants have no account link and are out of scope.

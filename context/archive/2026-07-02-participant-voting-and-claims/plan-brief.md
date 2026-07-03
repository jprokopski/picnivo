# Participant Voting and Item Claims (S-02) — Plan Brief

> Full plan: `context/changes/participant-voting-and-claims/plan.md`
> Design references (fidelity target): `frontend/context/foundation/design/picnivo-web-event.jsx`, `.../picnivo-web-events.jsx`, `.../picnivo.css`, `.../picnivo-web.css`

## What & Why

S-02 is the **north-star slice** — the first end-to-end proof of the product
hypothesis: that combining date voting, item claiming, and attendance into one
shared page eliminates the organizer's coordination friction. It makes both the
public event hub **and** the organizer dashboard live, matching the reference
designs.

## Starting Point

S-01 shipped the organizer side: create an event, get a `/e/{token}` share link,
a **read-only** public page, and a basic events dashboard (title, location, date
count, item count — no participant/vote/claim data, no status chips). The backend
has `Event`, `DateOption`, `EventItem`, `Organizer` but **no participant, vote, or
claim** concept. Those two surfaces are exactly what S-02 turns live.

## Desired End State

Opening the link shows the event hub (summary layout): join by name, vote with
reaction controls (🙌/🤔/🙅), a best-date hero, a checklist haul gated until the
organizer "locks the date", confirm-to-claim, add/claim/release items, a crew
split into Coming / Can't-make-it, and count-me-out recovery (freed items become
orphans others can cover). The organizer (detected inline) locks the date and
removes items. The dashboard cards show real status, "N going", "X / Y claimed",
and a crew stack. Every action refetches canonical server state.

## Key Decisions Made

| Decision                         | Choice                                                              | Why (1 sentence)                                                                 | Source |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| Participant identity             | Browser participant token (id in localStorage per event)            | Enforces one-vote-per-person and lets participants edit without accounts.        | Plan   |
| Duplicate display name           | Warn but allow as a distinct participant                            | Satisfies FR-007 without blocking two friends with the same name.                | Plan   |
| Vote / claim mutability          | Votes editable (upsert); claims releasable                          | Matches how consensus converges over hours; no data-loss surprises.              | Plan   |
| Final date                       | **Organizer locks the date** ("Lock in this date"); best shown too  | Full FR-009/FR-011 fidelity — organizer picks; claims gate on it.                | Plan   |
| Attendance model                 | Separate Coming/Out state + **count-me-out orphans claims**         | Design fidelity; handles "voted yes but can't come" and "voted no but coming".   | Plan   |
| Attendance-anyway path (FR-013)  | Explicit confirm-to-claim ("I'm in")                                | Clean gate exactly as FR-009/FR-013 describe.                                     | Plan   |
| Participant-added items (FR-005) | Participants add; adder removes own; organizer removes any          | Delivers FR-005 on the public page with no auth for participant actions.         | Plan   |
| Summary presentation             | Per-date Yes/Maybe/No tallies + best-date highlight                 | Satisfies FR-010 + FR-011; matches the design's stacked-bar date rows.           | Plan   |
| Update model                     | Invalidate & refetch the loader after each action                   | Honors FR-010 page-load semantics; canonical server state.                       | Plan   |
| Organizer surface                | Inline on `/e/{token}` when viewer is the organizer                 | One URL to share and manage; reuses the loaded session.                          | Plan   |
| Claim race                       | DB uniqueness; loser sees "already claimed" + refetch               | Correct first-come-first-served with no lost updates.                            | Plan   |
| 1-date event (FR-004)            | Announcement — no voting; RSVP; claiming via attendance             | Honors FR-004 while keeping logistics working (`AnnounceHero`).                  | Plan   |
| Events dashboard                 | Extend `ListEvents` + card: status, going, claimed, crew            | User-requested; the design's `EventCard`/`EvStatus` need this data.              | Plan   |
| UI look                          | **Reaction voting + summary layout + checklist claiming**           | Chosen shipping combination from the design's demo variants.                     | Plan   |
| Design fidelity                  | Match `frontend/context/foundation/design/` exactly                 | Hard requirement — reuse `pv-*`/`web-*` classes, tokens, `VOTE_META` helpers.    | Plan   |
| Testing                          | Full pyramid on integrity + gate rules                              | Locks the invariants most likely to break silently on the milestone.            | Plan   |

## Scope

**In scope:** participant join (name + browser token) with dupe warning;
Yes/Maybe/No reaction voting with one-per-person integrity; stacked-bar tallies +
best-date hero; organizer lock-date; confirm-to-claim; checklist item
claim/release/add; count-me-out recovery with orphan items; Coming/Can't-make-it
crew split; 1-date announcement; **extended events dashboard** (status, going,
claimed, crew); design fidelity to the reference files.

**Out of scope:** real-time updates; per-person vote matrix; the other two demo
layouts/vote styles; a "trying to make it" attendance sub-state; cross-device
identity sync; email/notifications/chat/calendar; event title/date editing.

## Architecture / Approach

Backend-first. Three new entities — `Participant` (with an `Attendance` state
distinct from votes), `DateVote` (unique `(ParticipantId, DateOptionId)`),
`ItemClaim` (unique `EventItemId`) — plus `Event.ChosenDateOptionId`,
`EventItem.AddedByParticipantId`, and `EventItem.OrphanedFromParticipantId`. New
public vertical-slice endpoints (join, vote, attendance, claim/release, add/remove
item) and one authenticated organizer lock-date endpoint; the existing
`GetEventByToken` and `ListEvents` are extended into the shared hub and dashboard
read models. Four frontend phases build the UI to match the design: identity/join,
voting hub (summary layout, reaction control, best-date hero), items + attendance
recovery, then the organizer dashboard. Participant identity is a GUID token in
localStorage sent on every mutating call; attendance is separate from the immutable
vote record; the claim gate is enforced server-side.

## Phases at a Glance

| Phase                                                | What it delivers                                              | Key risk                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 1. Data model & migration                            | Entities (attendance + orphan) + constraints + migration     | Postgres multiple-cascade-path errors on new FKs               |
| 2. Backend — join, voting & read models              | Join + vote upsert + enriched GET **and** ListEvents         | Vote integrity + correct tally/best-date/dashboard aggregation |
| 3. Backend — claims, attendance, items, lock date    | Claim/release, count-me-out orphaning, items, lock-date      | Gate logic + orphan release + claim-race 409                   |
| 4. Frontend — join & identity                        | JoinBar + localStorage token + loader wiring                 | SSR-safe token; Orval regen after spec change                  |
| 5. Frontend — voting hub                             | Summary layout, reaction voting, best-date hero, lock        | Design fidelity; upsert reflected without duplicate votes      |
| 6. Frontend — items, attendance & recovery           | Gated→confirm→checklist claim, count-me-out, orphans, RSVP   | Attendance/orphan UI matching design behavior                  |
| 7. Frontend — organizer dashboard                    | Card status, going, claimed counter, crew stack              | Correct status derivation from chosen date + now               |

**Prerequisites:** S-01 merged (done); local Supabase Postgres for
migrations/tests; `pnpm orval` regen after the backend spec updates; design tokens/
classes from `picnivo.css` / `picnivo-web.css` available (port any missing ones).
**Estimated effort:** ~6–8 after-hours sessions across 7 phases (3 backend, 4
frontend).

## Open Risks & Assumptions

- Browser-token identity means clearing localStorage / switching device creates a
  new participant — accepted for friend-group scale.
- The claim gate depends on the organizer having locked a date (for >1-date
  events); until then the haul is gated read-only with a clear message.
- Best date (auto) vs locked date (organizer) are distinct — the UI must not
  conflate them.
- Design fidelity assumes the `pv-*` / `web-*` classes and tokens can be ported
  into the Tailwind v4 setup; gaps between current frontend tokens and the design
  vocabulary must be closed as part of the frontend phases.

## Success Criteria (Summary)

- The 9-step MVP flow works end to end: create → share → join → vote → lock date →
  confirm → claim → dashboard reflects state.
- Vote integrity holds: one Yes/Maybe/No per person per date; re-voting updates,
  never duplicates.
- Item claiming is first-come-first-served and gated on attendance; count-me-out
  frees an orphan another guest can cover.
- The event hub and dashboard cards visually match the design references.

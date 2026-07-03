# Participant Voting and Item Claims (S-02) Implementation Plan

## Overview

S-02 is the north-star slice: the first end-to-end proof that combining date
voting, item claiming, and attendance into one shared page eliminates the
organizer's coordination friction. S-01 built the organizer side — create an
event, get a `/e/{token}` share link, and a **read-only** public page — plus a
basic organizer events list. S-02 makes both surfaces live:

- **Public event hub (`/e/{token}`)** becomes interactive: a participant joins
  by name, votes Yes/Maybe/No on dates, sees the best-date hero, confirms
  attendance (or counts themselves out), claims/adds items, and everyone sees
  per-date tallies, item assignments, and who's coming.
- **Organizer picks the final date** ("Lock in this date") inline on the hub;
  once locked, claiming opens for attendees.
- **Organizer events dashboard** gains real, vote/claim-derived data on each
  card: status (voting / date set / wrapped), "N going", an "X / Y claimed"
  counter, and a crew avatar stack.

**Design fidelity is a hard requirement.** The event hub and event cards must
match the reference designs in `frontend/context/foundation/design/`
(`picnivo-web-event.jsx`, `picnivo-web-events.jsx`) using the established design
tokens and `pv-*` / `web-*` class vocabulary (`picnivo.css`, `picnivo-web.css`).
Shipping combination: **reaction vote control** (emoji 🙌 / 🤔 / 🙅), **summary
layout** (two-column: main hero + dates + haul, aside crew + share), and
**checklist** item-claiming style.

## Current State Analysis

**Backend** (`backend/Picnivo.API/`) — clean vertical-slice architecture:

- Entities: `Event`, `DateOption`, `EventItem`, `Organizer` (`Data/Models/`).
  **No `Participant`, `DateVote`, or `ItemClaim` yet** — S-01 deferred the
  participant flow and `ClaimedBy` to S-02.
- `Event.Token` (unique-indexed public share token), `OrganizerId`;
  `DateOption.StartsAt` (timestamptz); `EventItem.Label`.
- EF Core 10 + Npgsql → Supabase Postgres. Configs are
  `IEntityTypeConfiguration<T>`; migrations in `Data/Migrations/`.
- Endpoints self-register via `IEndpoint` reflection
  (`EndpointExtensions.MapEndpoints`). Validation via FluentValidation +
  `ValidationEndpointFilter` (field-keyed `Results.ValidationProblem`).
- Auth: Supabase JWT bearer; authed endpoints use `.RequireAuthorization()` and
  read `user.FindFirstValue("sub")` as `OrganizerId`. Public endpoints (e.g.
  `GET /api/events/{token}`) omit it — token is the gate.
- `ListEvents` returns `EventSummaryResponse(Id, Title, Location, Token,
  CreatedAt, DateOptionCount, ItemCount, SoonestDate)` — **no participant, vote,
  claim, or status data** yet.
- Tests: xUnit + Shouldly, Testcontainers Postgres via `ApiFixture`, plus
  `TestDb` (SQLite) for handler tests. NSwag typed client. Tests mirror
  `Features/<Feature>/<Action>/`.

**Frontend** (`frontend/`) — TanStack Start (React 19) + Tailwind v4:

- Public page `/e/$token` (`routes/_app/e/$token.tsx`) → `event-detail-view.tsx`
  renders dates and items **read-only**. `EventDetailResponse` has only
  `{ title, description, location, organizerName, dateOptions[{id,startsAt}],
  items[{id,label}] }`.
- Organizer dashboard `list-events`: `event-card.tsx` shows title, location,
  dates summary, item count; `events-list.tsx` has All/Ongoing/Past filter tabs.
  **No status chip, "going" count, claimed counter, or crew stack.**
- API: Orval generates `src/api/picnivo-api.ts` from the backend OpenAPI spec;
  per-feature server functions wrap the calls. Public functions send no auth
  header; authed ones forward the Supabase JWT via `authMiddleware`.
- Root `beforeLoad` loads `context.user` — available on the public page, so the
  organizer can be detected inline (`user.id === event.organizerId`).
- Forms: raw React state + Zod schemas (validated in the server function's
  `.inputValidator`). Tests: Vitest + Testing Library, co-located. All UI strings
  use Lingui.

**Design reference** (`frontend/context/foundation/design/`):

- `picnivo-web-event.jsx` — the full event hub: `JoinBar` (name + dupe warning),
  `BestHero` / `AnnounceHero` (best/locked date, organizer "Lock in this date"),
  `WebDateRow` (stacked bar + tallies + yes-voter avatars + Leading/✓Locked
  chip), reaction `WebVoteControl`, `WebItems` (checklist), `WebHaulGated`
  (pre-lock read-only), `WebConfirmClaim` (confirm-to-claim), `WebGuestExit`
  (count-me-out recovery), `WebAttendees` (Coming / Can't make it split),
  `ShareAside`, and the `web-eventband` header with "N going" / "X/Y items" stats.
- `picnivo-web-events.jsx` — dashboard cards with `EvStatus` chips (Voting open /
  Date set / Wrapped), "N going", "X / Y claimed", crew `AvatarStack`.
- Helpers to mirror: `pvTally(ev, dateId)` and `pvBestDate(ev)` (most Yes, ties
  fewest No); `VOTE_META` (yes/maybe/no → color, tint, emoji).

### Key Discoveries:

- Vote integrity ("one vote per person per date option", PRD Guardrail) is
  enforced by a browser-held **participant token**: on join the backend creates
  a `Participant` and returns its id; the browser persists it in localStorage
  (keyed by event token) and sends it with every mutating call. DB unique index
  on `(ParticipantId, DateOptionId)` is the integrity mechanism.
- **Attendance is tracked separately from votes.** A guest can vote No but
  confirm attendance, or vote Yes then count themselves out — and their recorded
  vote (the date tallies) must never be rewritten. Participant carries an
  `Attendance` state (Coming / Out / Undecided) distinct from `DateVote` rows.
- **Count-me-out orphans claims.** When a participant opts out, their item claims
  are released and the freed items are marked "orphan" (needs a new owner) so
  others can re-cover them — distinct from a plain voluntary unclaim.
- Organizer detection on the public page: `context.user.id === event.organizerId`.
  Organizer endpoints still enforce auth server-side regardless of UI.
- Claim races resolve via a unique index on `ItemClaim.EventItemId`; the loser
  gets a friendly "already claimed" result and the list refetches.
- FR-004: a 1-date event is an "announcement" — no vote UI (`AnnounceHero`); that
  date is the de-facto locked date; guests RSVP (I'm in / can't make it) and
  claiming stays active gated on attendance.

## Desired End State

Opening `/e/{token}` shows the event hub (summary layout, matching the design).
Logged out, a `JoinBar` invites a name (with a duplicate warning). After joining:
a best-date hero, per-date reaction voting with stacked-bar tallies, a checklist
haul that's gated until the date is locked, an "I'm in" confirm-to-claim step, a
crew list split into Coming / Can't-make-it, and a share aside. The organizer
(detected inline) sees "Lock in this date" and can remove any item; locking opens
claiming. A guest who bows out frees their items as orphans others can cover. The
organizer's events dashboard shows each card's status, going count, claimed
counter, and crew. Every action refetches canonical server state.

**Verification:** the 9-step MVP flow works end to end (create → share → join →
vote → lock date → confirm → claim → dashboard reflects state). The event hub and
cards visually match the design references.

## What We're NOT Doing

- **No real-time updates** — page-load / after-action refetch only (FR-010;
  WebSockets parked to v2).
- **No organizer account required to view as participant** — the link is the
  access; organizer controls are an inline enhancement.
- **No email/notifications, chat, or calendar export** (PRD Non-Goals).
- **No editing of event title/description/date-options after creation** beyond
  final-date locking and item add/remove.
- **No per-person vote matrix (Doodle grid)** — aggregate tallies + a separate
  crew list, per the design.
- **Not building all three demo layouts/vote styles** — only summary layout +
  reaction control + checklist ship; cards/timeline and segmented/buttons
  variants are demo toggles, not deliverables.
- **No "trying to make it" attendance sub-state** — attendance is Coming / Out /
  Undecided only (the design's "trying" nuance is out of scope for MVP).
- **No cross-device participant identity sync** — clearing localStorage /
  switching device creates a new participant (accepted for friend-group scale).

## Implementation Approach

Backend-first (mirrors S-01): land the data model + integrity constraints, then
the read/write endpoints (including the extended `ListEvents` and
`GetEventByToken` read models), each with full tests — then build the UI to match
the design across four frontend phases (identity/join, voting hub, items +
attendance recovery, organizer dashboard). The two read-model endpoints are the
shared contracts every frontend phase consumes.

## Critical Implementation Details

- **Participant token entropy** — the browser-held identifier must be
  unguessable. Use the `Participant.Id` GUID (v7, 122 random bits) as the token,
  or a dedicated random token column. The client sends it on mutating calls and
  it is matched server-side; a display name is never identity.
- **Attendance vs vote separation** — `DateVote` rows are the immutable voting
  record (they drive tallies and the best date). `Participant.Attendance`
  (Coming / Out / Undecided) is a separate intent for the locked/chosen date.
  Effective "coming" for the chosen date = `Attendance == Coming` OR
  (`Attendance == Undecided` AND the participant voted `Yes` on the chosen date).
  Effective "out" = `Attendance == Out` OR (`Undecided` AND voted `No`). Never
  mutate a `DateVote` when attendance changes.
- **Claim gate ordering** — a claim is allowed only when the participant is
  effectively "coming" for the chosen date. If `Event.ChosenDateOptionId` is null
  and the event has >1 date, the haul is **gated read-only** (`WebHaulGated`) with
  "Claiming opens once the date's locked." For a 1-date event, the lone date is
  the chosen one from the start. The gate is enforced server-side in the claim
  handler, not just the UI.
- **Count-me-out orphaning** — setting `Attendance = Out` releases the
  participant's `ItemClaim`s and stamps each freed `EventItem` with an
  `OrphanedFromParticipantId`. A plain voluntary release (still coming) just
  deletes the claim without orphaning. Re-claiming an item clears its orphan
  stamp.
- **Best date vs locked date** — best date is computed (`pvBestDate`: most Yes,
  ties fewest No; `Maybe` doesn't count) and shown as "Best date so far / Leading".
  The organizer's "Lock in this date" sets `ChosenDateOptionId` (the design's
  primary CTA locks the leading date; the endpoint accepts any valid dateOptionId
  for flexibility). Locked date shows "✓ It's official / Locked".
- **Vote upsert** — casting a vote for an existing `(participant, dateOption)`
  updates the choice; never creates a second row (upsert deliberately; the unique
  index is the backstop).

## Phase 1: Data Model & Migration

### Overview

Add participant/vote/claim entities (with the attendance state and orphan field)
and the new fields on existing entities, with integrity constraints; generate and
apply the migration.

### Changes Required:

#### 1. Participant entity

**File**: `backend/Picnivo.API/Data/Models/Participant.cs`

**Intent**: Account-less participant scoped to one event; holds display name and
the attendance intent used by the claim gate and the crew Coming/Out split.

**Contract**: `Id` (Guid PK, v7), `EventId` (FK → `Event.Id`, cascade),
`DisplayName` (string, required, max ~100), `Attendance` (enum
`AttendanceStatus { Undecided, Coming, Out }`, default `Undecided`), `CreatedAt`.
Navigations: `Event`, `ICollection<DateVote> Votes`, `ICollection<ItemClaim>
Claims`. Add `ICollection<Participant> Participants` to `Event`.

#### 2. DateVote entity

**File**: `backend/Picnivo.API/Data/Models/DateVote.cs`

**Intent**: One participant's Yes/Maybe/No for one date option; the immutable
voting record. The unique index enforces the PRD vote-integrity guardrail.

**Contract**: `Id` (Guid PK), `ParticipantId` (FK, cascade), `DateOptionId`
(FK → `DateOption.Id`, cascade), `Choice` (enum `VoteChoice { Yes, Maybe, No }`).
Unique index `(ParticipantId, DateOptionId)`. Enums live in `Data/Models/`.

#### 3. ItemClaim entity

**File**: `backend/Picnivo.API/Data/Models/ItemClaim.cs`

**Intent**: Records that a participant is bringing an item; one claim per item =
first-come-first-served.

**Contract**: `Id` (Guid PK), `EventItemId` (FK → `EventItem.Id`, cascade),
`ParticipantId` (FK, cascade), `ClaimedAt`. **Unique index on `EventItemId`**.
Add navigation `ItemClaim? Claim` on `EventItem`.

#### 4. Extend Event and EventItem

**File**: `backend/Picnivo.API/Data/Models/Event.cs`,
`backend/Picnivo.API/Data/Models/EventItem.cs`

**Intent**: Give the organizer a locked/final date, track participant-added items
(so the adder can remove their own), and track orphaned items (freed by a
count-me-out) so the UI can show "needs a new owner".

**Contract**: `Event.ChosenDateOptionId` (Guid?, nullable FK → `DateOption.Id`).
`EventItem.AddedByParticipantId` (Guid?, nullable FK → `Participant.Id`; null =
organizer-added). `EventItem.OrphanedFromParticipantId` (Guid?, nullable FK →
`Participant.Id`; set on count-me-out release, cleared on re-claim). Configure
these FKs with `OnDelete(NoAction)` / `SetNull` to avoid Postgres multiple-
cascade-path errors.

#### 5. EF configurations + DbContext

**File**: `backend/Picnivo.API/Data/Configurations/{Participant,DateVote,ItemClaim}Configuration.cs`,
`backend/Picnivo.API/Data/PicnivoDbContext.cs`

**Intent**: Configure keys, FKs, max lengths, the two unique indexes, enum
conversions; register the new `DbSet`s.

**Contract**: New `IEntityTypeConfiguration<T>` per entity. Unique indexes
`IX_DateVotes_Participant_DateOption`, `IX_ItemClaims_EventItem`. DbSets
`Participants`, `DateVotes`, `ItemClaims`. Update `Event`/`EventItem` configs for
the three new FKs.

#### 6. Migration

**File**: `backend/Picnivo.API/Data/Migrations/<timestamp>_AddParticipantsVotesAndClaims.cs`
(generated)

**Intent**: Create the three tables and the new columns with constraints/indexes.

**Contract**: `dotnet ef migrations add AddParticipantsVotesAndClaims --project
Picnivo.API --output-dir Data/Migrations`, then `dotnet ef database update
--project Picnivo.API`. Tables are empty pre-launch; nullable FKs are safe on
existing rows.

### Success Criteria:

#### Automated Verification:

- Build passes: `dotnet build`
- Migration applies cleanly: `dotnet ef database update --project Picnivo.API`
- Migration reverts cleanly: `dotnet ef database update <Previous> --project Picnivo.API`
- Existing tests still pass: `dotnet test`

#### Manual Verification:

- DB shows three new tables, both unique indexes, and the new columns with
  correct FK/nullability.

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Backend — Join, Voting & Read Models

### Overview

Public join + vote endpoints, plus extending **both** read models: the public
`GetEventByToken` (hub data) and the authenticated `ListEvents` (dashboard data).

### Changes Required:

#### 1. Join event (create participant)

**File**: `backend/Picnivo.API/Features/Participants/JoinEvent/`

**Intent**: Public endpoint that creates a `Participant` and returns its id (the
browser token); flags a duplicate name so the client can warn without blocking.

**Contract**: `POST /api/events/{token}/participants`, no auth. Request
`{ displayName }`; response `{ participantId, duplicateName: bool }`. 404 if
token unknown. Validator: name non-empty, max length. `duplicateName` is a
case-insensitive match against existing participants; never blocks.

#### 2. Cast/update votes

**File**: `backend/Picnivo.API/Features/Votes/CastVotes/`

**Intent**: Upsert a participant's votes across date options in one call; existing
`(participant, date)` votes update, never duplicate.

**Contract**: `PUT /api/events/{token}/participants/{participantId}/votes`, public.
Request `{ votes: [{ dateOptionId, choice }] }`, `choice ∈ {Yes,Maybe,No}`.
Validators: participant belongs to the event; every `dateOptionId` belongs to the
event; valid enum. Reject voting on a 1-date announcement (FR-004). Upsert against
the unique index.

#### 3. Extend GetEventByToken read model

**File**: `backend/Picnivo.API/Features/Events/GetEventByToken/`

**Intent**: Return everything the hub needs: per-date tallies, best date, chosen
date, item claim + orphan state, the crew with attendance, and the caller's own
state.

**Contract**: `GET /api/events/{token}?participantId={id?}`. Response adds:
`dateOptions[]` gain `{ yesCount, maybeCount, noCount }` and top-level
`bestDateOptionId` + `chosenDateOptionId`; `items[]` gain `{ claimedByParticipantId?,
claimedByName?, addedByParticipantId?, orphanedFromName? }`; `participants[]`
(`{ id, displayName, attendance }`); and `you` (`{ votes, claimedItemIds,
attendance }` or null). Best date computed in-handler (`pvBestDate` rule).

**Addendum (revised in Phase 5, 2026-07-02)**: `participants[]` gained a
`votes: [{ dateOptionId, choice }]` field (`ParticipantVoteDto[]`), giving
every participant's own per-date vote — not just the caller's (`you.votes`
already had this, but only for the caller). This is a small, necessary
extension to an already-closed phase, uncovered while implementing Phase 5:
the design's `BestHero`/`WebDateRow` yes-voter avatar stack needs to know
*who* voted Yes on a date, which aggregate `yesCount`/`maybeCount`/`noCount`
alone can't answer. It also unblocks Phase 6, whose "effective coming"
crew-split rule (`Attendance == Undecided AND voted Yes on the chosen date`)
must be evaluated per participant, not just for the caller. Implementation:
`GetEventByToken.cs` now fetches all votes for the event's date options in
one query and reuses that in-memory list both for tally counts and for each
participant's `Votes`, replacing the previous grouped-count query with an
equivalent (and simpler) one — no added round trips. Covered by
`GetEventByTokenHandlerTests.ReturnsEachParticipantsOwnVotes`.

**Addendum (bug fix, 2026-07-02)**: The response's `chosenDateOptionId` was
returning the raw (nullable) `Event.ChosenDateOptionId` instead of applying
FR-004's "1-date event = de-facto chosen" rule — a rule Phase 3's `ClaimItem`
already implemented for the claim gate (`@event.ChosenDateOptionId ?? (single
date option ? that id : null)`), but the read model didn't mirror it. Effect:
the hub UI's `locked` flag stayed `false` for announcement events, so
`BestHero` kept showing the organizer a "Lock in this date" button for an
event with only one date — a no-op action that shouldn't exist, since
claiming was already open server-side. Fix: extracted the fallback into
`Event.ResolveEffectiveChosenDateOptionId(chosenDateOptionId, dateOptionIds)`
on the `Event` entity, used by both `ClaimItem` and `GetEventByToken`. No
frontend change needed — `event-detail-view.tsx`'s `locked = !!event.
chosenDateOptionId` now naturally reflects the rule once the API returns it.
Covered by `GetEventByTokenHandlerTests.WithSingleDateEvent_
TreatsLoneDateAsChosen` and `...WithMultipleDatesAndNoLock_
ChosenDateOptionIdIsNull`. `ListEvents` (dashboard) does **not** yet apply
this fallback — Phase 7 hasn't started; revisit there so a fresh announcement
event's card doesn't derive a "voting" status incorrectly.

**Addendum (revised in Phase 5, 2026-07-02)**: For a single-date
("announcement") event, `CountFor` now adds +1 to `YesCount` for the lone
date, treating the organizer as an implicit yes-voter. Rationale: FR-004
announcement events show no vote UI at all, so the organizer who set the
date has no way to cast an actual `DateVote` — without this, `BestHero`'s
"N of M can make it" would always undercount by one relative to the
frontend's parallel `yesVoterNamesFor` logic
(`event-detail-view.tsx`), which already lists the organizer as an implicit
yes-voter in its avatar stack for the same reason. This keeps the backend
tally and the frontend's avatar-stack membership consistent for the same
date. Covered by `GetEventByTokenHandlerTests.
WithSingleDateEvent_YesCountIncludesOrganizerAsImplicitYes` and
`...WithMultipleDates_YesCountDoesNotIncludeOrganizer`.

**Addendum (superseded in Phase 6, 2026-07-03)**: The implicit-yes rule above
is removed. Phase 6 gave every participant — including the organizer, via the
auto-created `IsOrganizer` participant row — an explicit `Attendance` RSVP
(`AttendanceCard`/`AnnounceHero`'s "I'm in" / "Can't make it"). Once that
mechanism exists, hardcoding the organizer as an always-yes voter is no
longer a stand-in for "they have no way to express attendance" — it actively
fights the RSVP the organizer can now cast, and double-counts them (they
already appear in `event.participants`). `CountFor` no longer special-cases
`isAnnouncement`; `YesCount` for a fresh single-date event is now `0` until
someone actually votes (never, for announcements — no vote UI) and is
otherwise unused by announcement rendering, which reads `Attendance`
directly via `isEffectivelyComing`/`isEffectivelyOut`. Frontend
`comingNamesForAnnouncement`/`yesVoterNamesFor` dropped their matching
`[organizerName, ...]` prepend for the same reason. `AnnounceHero` dropped
its `isOrganizer` prop and no-voting-needed message; the organizer now sees
the same RSVP buttons as any guest. Renamed/updated:
`WithSingleDateEvent_YesCountIncludesOrganizerAsImplicitYes` →
`...YesCountHasNoImplicitOrganizerVote` (asserts `0`, not `1`).

#### 4. Extend ListEvents read model (dashboard)

**File**: `backend/Picnivo.API/Features/Events/ListEvents/`

**Intent**: Give each dashboard card the vote/claim-derived data the design shows:
going count, claimed counter, crew, and enough to derive status.

**Contract**: `EventSummaryResponse` gains `ParticipantCount`, `ParticipantNames`
(capped list for the avatar stack, e.g. first ~6), `ClaimedCount` (items with a
claim), `ChosenDateOptionId` + its `StartsAt` (nullable). Existing `ItemCount`,
`DateOptionCount`, `SoonestDate` stay. Status (voting / date-set / past) is
derived on the client from `ChosenDateOptionId` + dates + now. Keep the projection
efficient (grouped counts, no N+1).

### Success Criteria:

#### Automated Verification:

- Build passes: `dotnet build`; tests pass: `dotnet test`
- Handler tests: join creates participant; duplicate name flagged not blocked;
  vote upsert changes choice without adding rows; invalid dateOptionId rejected.
- Endpoint tests (Testcontainers): join returns id; votes → GET returns correct
  tallies + `bestDateOptionId`; GET with `participantId` returns `you`; GET
  unknown token → 404.
- Integrity test: two vote calls for the same `(participant, dateOption)` never
  yield two rows.
- ListEvents test: response includes participant count, crew names, claimed
  count, chosen-date fields; counts correct after join/vote/claim fixtures.

#### Manual Verification:

- Via HTTP client: join, cast votes, GET hub and list — tallies, best date, and
  dashboard counts match by hand.

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Backend — Claims, Attendance Recovery, Items & Lock Date

### Overview

The write side of the gate: attendance (coming / out with orphaning), item
claim/release with gate + race safety, participant add/remove item, and the
authenticated organizer lock-date.

### Changes Required:

#### 1. Set attendance (coming / out + orphaning)

**File**: `backend/Picnivo.API/Features/Participants/SetAttendance/`

**Intent**: Set the participant's attendance intent. Confirming ("I'm in") unlocks
claiming; counting out releases their claims and orphans those items.

**Contract**: `PUT /api/events/{token}/participants/{participantId}/attendance`,
public. Request `{ status: 'coming' | 'out' }` (clearing to undecided optional).
On `out`: set `Attendance = Out`, delete the participant's `ItemClaim`s, stamp
each freed `EventItem.OrphanedFromParticipantId = participantId`. On `coming`: set
`Attendance = Coming` (do not auto-restore released claims). Participant must
belong to the event.

#### 2. Claim / release item

**File**: `backend/Picnivo.API/Features/Claims/ClaimItem/`,
`backend/Picnivo.API/Features/Claims/ReleaseClaim/`

**Intent**: Claim an item (gated on effective-coming) and release one's own claim.
Unique index enforces first-come-first-served; a race loser is distinguishable.

**Contract**: `POST /api/events/{token}/items/{itemId}/claim` and
`DELETE /api/events/{token}/items/{itemId}/claim`, public. Claim gate: allowed iff
the participant is effectively coming for the chosen date (`Attendance == Coming`,
or `Undecided` + voted `Yes` on `ChosenDateOptionId`; for a 1-date event the lone
date is chosen). Gate failure → 403 with a clear code. Already-claimed → 409
"already claimed" (catch the unique violation scoped to `IX_ItemClaims_EventItem`,
mirroring S-01's token-retry constraint-name check). Claiming clears any orphan
stamp. Release removes only the caller's own claim (plain release, no orphaning).

#### 3. Participant add item / remove own item

**File**: `backend/Picnivo.API/Features/Items/AddItem/`,
`backend/Picnivo.API/Features/Items/RemoveItem/`

**Intent**: Participant adds an item (FR-005 participant half), stamped with
`AddedByParticipantId`; removal by the adder OR the event's organizer.

**Contract**: `POST /api/events/{token}/items` (public, participant token; records
adder) — `{ label }`, case-insensitive dedupe, cap total (reuse S-01's ≤50).
`DELETE /api/events/{token}/items/{itemId}` authorizes **either** an authenticated
organizer of the event **or** the participant matching `AddedByParticipantId`;
else 403. Removing a claimed item cascades its claim.

#### 4. Organizer locks final date

**File**: `backend/Picnivo.API/Features/Events/SelectFinalDate/`

**Intent**: Authenticated organizer sets `Event.ChosenDateOptionId` ("Lock in this
date"), which opens the claim gate.

**Contract**: `PUT /api/events/{token}/chosen-date`, `.RequireAuthorization()`.
Verify caller (`sub`) is the event's `OrganizerId` (else 403). Request
`{ dateOptionId }` (or null to unlock); the option must belong to the event.

### Success Criteria:

#### Automated Verification:

- Build passes: `dotnet build`; tests pass: `dotnet test`
- Claim gate tests: rejected (403) when not coming and no Yes on chosen date;
  allowed after `coming`; allowed when voted Yes on chosen date; 1-date event
  allows claim after confirm.
- Attendance/orphan tests: counting out releases the participant's claims and
  stamps `OrphanedFromParticipantId`; re-claiming an orphan clears the stamp;
  a plain release does not orphan.
- Claim race test: two concurrent claims on one item → one succeeds, one 409;
  release frees the item.
- Item tests: participant add stamps adder + dedupes; adder deletes own; non-adder
  non-organizer → 403; organizer deletes any (authed).
- Lock-date tests: organizer 200; non-organizer authed → 403; unauthenticated →
  401; invalid dateOptionId rejected.

#### Manual Verification:

- Full backend flow via HTTP client: join → vote → lock date → confirm → claim →
  count out (orphan appears) → another claims the orphan.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Frontend — Join & Participant Identity

### Overview

Participant identity layer and the design's `JoinBar`: name entry with a duplicate
warning, a localStorage token per event, and wiring the enriched hub loader +
organizer detection.

### Changes Required:

#### 1. Participant token storage

**File**: `frontend/src/lib/participant/token.ts` (+ `token.test.ts`)

**Intent**: Read/write the participant id in localStorage keyed by event token, so
a returning visitor resumes their identity.

**Contract**: `getParticipantId(eventToken)`, `setParticipantId(eventToken, id)`,
`clearParticipantId(eventToken)`. Namespaced key; SSR-safe (guard `window`).

**Addendum (implemented as of Phase 4, 2026-07-02)**: Built as
`frontend/src/lib/participant/cookie.ts` — an **httpOnly server-side cookie**
(`getParticipantIdCookie`/`setParticipantIdCookie` via
`@tanstack/react-start/server`) instead of client-side localStorage. This is a
deliberate upgrade over the original design: httpOnly defeats XSS-based token
theft and needs no `window`/SSR guard (it never touches client JS), and it
reuses the existing `getCookie`/`setCookie` pattern already established in
`lib/supabase/server.ts`. Consequence: every mutating server function
(`joinEventFn`, `castVotesFn`, `setAttendanceFn`, `claimItemFn`, etc.) must read
the participant id server-side from this cookie rather than accept it from the
client — and must stay POST/PUT (never GET), since `sameSite: lax` is the only
CSRF mitigation in place. `clearParticipantId` has **no equivalent** — dropped,
not yet needed by any built feature; revisit if a future "reset identity" flow
requires it.

#### 2. Join bar

**File**: `frontend/src/features/events/join-event/` (`schema.ts`, `functions.ts`,
`components/join-bar.tsx` + tests)

**Intent**: The design's `JoinBar` — name input with a live duplicate-name warning
("Someone's already using that name — add a last initial?"), calling join and
persisting the token.

**Contract**: `joinEventFn` (public server function) wraps generated `joinEvent`;
returns `{ participantId, duplicateName }`. `join-bar.tsx` matches the `web-joinbar`
design; on submit, join → persist token → `router.invalidate()`. Non-blocking
warning on duplicate. Zod `joinSchema` (name required, min length per design's
`valid = length > 1`).

#### 3. Hub loader wiring + organizer detection

**File**: `frontend/src/routes/_app/e/$token.tsx`,
`frontend/src/features/events/get-event-by-token/{functions.ts,schema.ts}`

**Intent**: Pass the stored participant id into the loader for the caller's own
state, and expose `context.user` for organizer detection.

**Contract**: `getEventByTokenFn` accepts optional `participantId`; the loader
reads it from localStorage and passes it through. Extend the response schema to
Phase 2's enriched DTO (`you`, tallies, best/chosen date, participants with
attendance, claim/orphan fields). Provide `isOrganizer = user?.id ===
event.organizerId`. Regenerate the Orval client (`pnpm orval`) after the backend
spec updates.

**Addendum (implemented as of Phase 4, 2026-07-02)**: `isOrganizer` detection
required exposing `OrganizerId` on `GetEventByToken`'s response (added to
`GetEventByToken.cs`/`GetEventByTokenDtos.cs`) — a small, necessary backend
change not called out above. More significantly, `CreateEvent` (Phase 1,
already closed) was revised to auto-create a `Participant` row for the
organizer at event-creation time and return `ParticipantId`, so the organizer
has a participant identity to vote/claim on their own event. This means
**every event has `ParticipantCount ≥ 1` and the organizer's display name in
`participants[]`/`ParticipantNames` from the moment it's created** — before any
guest joins. **Phase 6 (crew Coming/Can't-make-it split) and Phase 7 (dashboard
"N going" + crew avatar stack) must design for this explicitly**: decide
whether the organizer is filtered out of crew/dashboard participant lists or
shown deliberately, rather than treating their presence as an oversight. The
design references (`picnivo-web-event.jsx`, `picnivo-web-events.jsx`) show the
organizer only in a "hosted by" kicker, never in the crew list — reconcile this
before Phase 6/7 implementation.

### Success Criteria:

#### Automated Verification:

- Type check: `pnpm typecheck`; lint: `pnpm lint`; tests: `pnpm test`
- Token util tests: set/get/clear round-trip; SSR-safe returns null.
- Join bar tests: submits + calls `joinEventFn`; duplicate warning renders; short
  name blocked.
- i18n: `pnpm extract && pnpm compile` succeeds; new strings use Lingui.

#### Manual Verification:

- Logged-out `/e/{token}` shows the join bar; identity persists across reload.
- Duplicate name warns but still joins.

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Frontend — Voting Hub (Summary Layout, Reaction Voting, Best-Date Hero)

### Overview

Build the summary-layout hub matching the design: event band with stats, best-date
hero (with organizer "Lock in this date"), per-date reaction voting rows with
stacked-bar tallies, the crew aside, and the share aside.

### Changes Required:

#### 1. Event band + summary layout shell

**File**: `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx`
(reworked) + `event-band.tsx`, `section-card.tsx`

**Intent**: Replace the read-only view with the design's `web-eventband` header
(cover, host·location kicker, title, note, "N going" / "X/Y items" stats) and the
two-column `web-hub web-hub--summary` layout (main + aside).

**Contract**: Matches `picnivo-web-event.jsx` band + summary layout using
`web-*`/`pv-*` classes and design tokens. Presentational; reads the loader data.

#### 2. Reaction vote control + date rows

**File**: `frontend/src/features/events/vote-on-dates/` (`schema.ts`, `functions.ts`,
`components/vote-control.tsx`, `components/date-row.tsx` + tests)

**Intent**: The reaction `WebVoteControl` (emoji 🙌/🤔/🙅 from `VOTE_META`,
collapsing to a compact segmented bar on mobile) and the `WebDateRow` (stacked bar
`StackBarW`, Yes/Maybe/No counts, yes-voter avatar stack, Leading/✓Locked chip).

**Contract**: `castVotesFn` (public) → generated `castVotes` with participant id.
`vote-control.tsx` reproduces the reactions style + narrow segmented fallback;
seeded from `you.votes`; on change → mutation → `router.invalidate()`. `date-row.tsx`
reproduces `web-daterow` / `web-daterow--best` with tallies from the loader. Hidden
for 1-date announcements (handled by the hero in Phase 6). Zod `voteSchema`.

#### 3. Best-date hero + lock control + crew/share asides

**File**: `frontend/src/features/events/get-event-by-token/components/best-hero.tsx`,
`crew-list.tsx`, `share-aside.tsx`; `frontend/src/features/events/select-final-date/`
(`functions.ts`, wired into the hero) + tests

**Intent**: The `BestHero` (best/locked date, yes-voter stack, "N of M can make
it", "Best date so far" vs "✓ It's official" chip) with the organizer-only "Lock
in this date" button; the crew `SectionCard` and `ShareAside`.

**Contract**: `selectFinalDateFn` (authenticated server function, forwards JWT) →
generated lock-date call; the "Lock in this date" button renders only when
`isOrganizer`, locks the leading date, then `router.invalidate()`. `crew-list.tsx`
renders participants (Coming/Can't-make-it split comes in Phase 6). `share-aside.tsx`
reproduces the copy-invite-link card. Non-organizers see "{host} picks the final
date once everyone's voted."

### Success Criteria:

#### Automated Verification:

- Type check: `pnpm typecheck`; lint: `pnpm lint`; tests: `pnpm test`
- Vote control tests: renders reactions; pre-selects `you.votes`; calls
  `castVotesFn`; narrow-mode segmented fallback renders.
- Date row tests: tallies + stacked bar from counts; Leading chip on best date;
  ✓Locked chip when chosen.
- Hero tests: renders best date; "Lock in this date" only when `isOrganizer`;
  calls `selectFinalDateFn`; shows locked chip after chosen.
- i18n extract/compile succeeds.

#### Manual Verification:

- Hub visually matches the design (band, hero, reaction voting, date rows, crew +
  share aside) on desktop and mobile.
- Two profiles vote; tallies + best date update after refetch; changing a vote
  updates, not duplicates.
- Organizer locks the date; hero flips to "It's official".

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: Frontend — Items, Attendance & Recovery

### Overview

Complete the hub: the gated checklist haul, confirm-to-claim, claim/unclaim/add,
the Coming / Can't-make-it crew split, the count-me-out recovery + orphan items,
and the single-date announcement variant.

**Note (from Phase 4 review, 2026-07-02)**: The organizer is auto-created as a
`Participant` on their own event (see Phase 4 addendum). Decide explicitly
whether the Coming/Can't-make-it crew split filters the organizer out or shows
them deliberately — don't let their presence in `participants[]` fall through
as an accident.

**Addendum (impl-review fix, 2026-07-03)**: Decision — the organizer **is**
shown in the crew split (in whichever of Coming/Can't-make-it bucket they
effectively fall into) and tagged "HOST", rather than filtered out. This
diverges from the design reference (`picnivo-web-event.jsx`), which only
surfaces the organizer via a "hosted by" kicker and never in the crew list —
accepted as a deliberate deviation so the crew list stays a complete roster of
everyone the read model returns, matching the "N invited" count in the
`SectionCard` header above it. Identifying the organizer required a new
signal: `ParticipantDto` gained `IsOrganizer` (backend `Participant.IsOrganizer`
bool, set `true` only on the auto-created organizer participant in
`CreateEvent.cs`; migration `AddParticipantIsOrganizer`), replacing an earlier
`displayName === organizerName` heuristic that had no dedicated field to key
off and would mistag a guest who happened to share the organizer's display
name. `attendees.tsx`'s `PersonRow` now reads `participant.isOrganizer`
directly; the `organizerName` prop was removed from `Attendees` since nothing
else needed it. Phase 7's dashboard crew stack should reuse `IsOrganizer`
rather than reintroducing a name-based heuristic, since it carries the same
"is this the organizer" question the Phase 4 review raised for `ListEvents`.

### Changes Required:

#### 1. Gated haul → confirm → checklist claiming

**File**: `frontend/src/features/events/claim-items/` (`functions.ts`,
`components/haul.tsx`, `components/haul-gated.tsx`, `components/confirm-claim.tsx`,
`components/add-item.tsx` + tests)

**Intent**: Reproduce `WebHaulGated` (pre-lock read-only chips + lock notice),
`WebConfirmClaim` ("Confirm you're coming to claim" with reason by vote), the
checklist `WebItems` (claim/unclaim with claimant name, orphan "needs a new owner /
I'll cover it"), and the add-item input.

**Contract**: `claimItemFn`, `releaseClaimFn`, `addItemFn`, `removeItemFn` (public
server functions). Haul is `WebHaulGated` until `chosenDateOptionId` is set; once
locked, if the caller isn't coming show `WebConfirmClaim` (calls `setAttendanceFn`
'coming'), else the checklist. Claim disabled unless the gate is satisfied; own
claim shows unclaim; orphan items styled per design and re-claimable. On 409
"already claimed", show a toast "already taken" (matching the `toast.error`
convention already used by `VoteControl`/`ConfirmClaim`/`AddItem`) +
`router.invalidate()`. Add-item mirrors S-01 `items-editor` dedupe/max via
`addItemFn`.

#### 2. Attendance toggle + Coming/Can't-make-it crew split

**File**: `frontend/src/features/events/set-attendance/` (`functions.ts`,
`components/attendees.tsx`, `components/guest-exit.tsx` + tests)

**Intent**: Reproduce `WebAttendees` (locked → Coming · N / Can't make it · N with
per-person status) and `WebGuestExit` (a guest who voted No on the locked date, or
counted out, gets "I'll make it" / "Count me out").

**Contract**: `setAttendanceFn` (public) → generated attendance call ('coming' |
'out'); on change → `router.invalidate()`. `attendees.tsx` splits participants by
`attendance`/derived state. `guest-exit.tsx` renders the recovery card; "Count me
out" releases claims (orphaned server-side) and "I'll make it" sets coming.

#### 3. Announcement variant (single date)

**File**: `frontend/src/features/events/get-event-by-token/components/announce-hero.tsx`
(+ wired into `event-detail-view.tsx`)

**Intent**: Reproduce `AnnounceHero` — 1-date events show no voting; guests RSVP
"I'm in" / "Can't make it"; claiming stays active gated on attendance.

**Contract**: When `dateOptions.length === 1`, render `AnnounceHero` instead of
`BestHero` + date rows; the lone date is treated as chosen; RSVP maps to
`setAttendanceFn`.

### Success Criteria:

#### Automated Verification:

- Type check: `pnpm typecheck`; lint: `pnpm lint`; tests: `pnpm test`
- Haul tests: gated read-only before lock; confirm-claim shown when not coming;
  claim disabled until gate satisfied; own unclaim; 409 → "already taken"; orphan
  item renders "needs a new owner" and is re-claimable; add-item dedupe/max.
- Attendance tests: toggle sets coming/out and calls the mutation; crew splits
  Coming/Can't-make-it when locked; count-me-out shows recovery card.
- Announcement tests: single-date renders `AnnounceHero`, no vote UI, RSVP works.
- i18n extract/compile succeeds.

#### Manual Verification:

- Locked event: confirm-to-claim → claim checklist matches design; count-me-out
  frees an orphan another guest can cover; crew splits correctly.
- Single-date announcement matches design; RSVP + claiming work.

**Implementation Note**: Pause for manual confirmation before Phase 7.

---

## Phase 7: Frontend — Organizer Events Dashboard

### Overview

Bring the dashboard cards up to the design: real status chips, "N going", "X / Y
claimed", and the crew avatar stack — from the extended `ListEvents` data.

**Note (from Phase 4 review, 2026-07-02)**: `ListEvents`' `ParticipantCount`/
`ParticipantNames` include the auto-created organizer participant (see Phase 4
addendum), so a brand-new event with zero real guests will already show "1
going" and the organizer in the crew avatar stack. Decide explicitly whether
the card excludes the organizer from these counts, or whether "1 going" on a
fresh event is acceptable/intended.

**Note (from Phase 5 review, 2026-07-03)**: `event-card.tsx`'s `<Link>` to
`/e/$token` dropped `target="_blank"` (added back in S-01) as part of the
Phase 5 diff, ahead of this phase's own start. Reason: the hub now mutates
state via `router.invalidate()` after votes/locks/claims; opening it in a
new tab would strand that SPA navigation/state instead of using it. Keep
the dashboard card's event link same-tab in this phase — don't reintroduce
`target="_blank"`.

**Addendum (impl-review fix, 2026-07-03)**: Decision — the Phase 4 note above
is resolved: the dashboard **excludes** the organizer from `ParticipantCount`/
`ParticipantNames`, unlike Phase 6's hub crew list (which shows the organizer
tagged "HOST"). Rationale: the design reference's live dashboard card
(`liveCard.crew = event.participants` in `picnivo-web-events.jsx`) never
includes the host in the "going"/crew data at all — there's no design-fidelity
argument for showing them here the way there was for the hub's "complete
roster" crew list. Implementation: `ListEvents.cs` now selects
`Participant.IsOrganizer` and filters it out of both `ParticipantCount` and
`Participants` before projecting to `EventSummaryResponse`, reusing the same
field Phase 6 introduced (as that phase's own addendum recommended). No
frontend change needed — `event-card.tsx` already just renders whatever
count/names the API returns. Covered by
`ListEventsHandlerTests.ExcludesOrganizerFromParticipantCountAndNames`.

**Addendum (impl-review fix, 2026-07-03)**: `deriveEventStatus`
(`frontend/src/features/events/list-events/schema.ts`) computes a 4th status,
`"now"`, in addition to the three specified above (`voting` / `date-set` /
`past`) — a 5-hour window (`HAPPENING_NOW_WINDOW_MS`) from the chosen date's
`startsAt`, during which the card shows a pulsing "Today · happening now"
chip instead of the formatted date. Rationale: the design reference's static
dashboard fixture includes a `status: 'now'` card with a dedicated
`web-datechip--now` style and pulse keyframes — a real, styled state in the
design system, just one the mockup's *live* card never computes dynamically
(no elapsed-time concept in the demo data). Since no end time is recorded for
an event, "happening now" is necessarily a heuristic window rather than an
exact span; 5 hours was chosen as long enough to cover a typical picnic/
hangout without lingering as "now" indefinitely. Covered by `deriveEventStatus`
tests in `schema.test.ts` and the "happening now" cases in `event-card.test.tsx`.

### Changes Required:

#### 1. Event card enrichment

**File**: `frontend/src/features/events/list-events/components/event-card.tsx`
(+ `ev-status.tsx`) + tests

**Intent**: Reproduce the design's `EventCard` + `EvStatus`: status chip (Voting
open / Date set / Wrapped), the when-line, "N going" with a crew `AvatarStack`, and
the "X / Y claimed" (or "Wrapped") items line.

**Contract**: Consume the extended `EventSummaryResponse` (participant count +
names, claimed count, chosen-date fields). Derive status client-side: `past` if the
chosen/soonest date < now; `date-set` if `chosenDateOptionId` set (or single date);
`voting` otherwise. Render with `web-evcard` / `web-evstatus` classes and design
tokens.

#### 2. List wiring

**File**: `frontend/src/features/events/list-events/components/events-list.tsx`,
`frontend/src/features/events/list-events/functions.ts`

**Intent**: Feed the enriched data through; keep the existing All/Ongoing/Past
filter but base "past" on the derived status.

**Contract**: `listEventsFn` returns the extended shape; filter tabs use the
derived status. Empty state unchanged.

### Success Criteria:

#### Automated Verification:

- Type check: `pnpm typecheck`; lint: `pnpm lint`; tests: `pnpm test`
- Card tests: status chip reflects voting/date-set/past; "N going" from participant
  count; "X / Y claimed" from claimed/total; crew stack renders capped names.
- List tests: Ongoing/Past filter uses derived status; counts correct.
- i18n extract/compile succeeds; `pnpm build` succeeds.

#### Manual Verification:

- Dashboard cards match the design; a live event's status, going, claimed, and crew
  reflect real participant/vote/claim state end to end.

**Implementation Note**: After automated verification passes, pause for final
manual confirmation.

---

## Testing Strategy

### Unit Tests:

- Backend handlers (SQLite `TestDb`): vote upsert, best-date inputs, effective-
  coming gate decision, count-me-out orphaning, add-item dedupe, ListEvents
  aggregation.
- Backend validators: name bounds, valid vote choice, dateOptionId/itemId
  membership, chosen-date belongs to event.
- Frontend: participant-token util; Zod schemas (join, vote); component logic
  (gate enabling, tally rendering, orphan rendering, organizer-only visibility,
  status derivation).

### Integration Tests:

- Backend endpoint tests (Testcontainers): join → vote → GET tallies; vote
  integrity (no duplicate rows); claim gate across states; claim race (one winner,
  409 loser); count-me-out orphan + re-claim; participant add + adder/organizer
  remove authorization; organizer lock-date auth (401/403/200); ListEvents counts.

### Manual Testing Steps:

1. Two participant profiles + organizer session on one event.
2. Both vote; verify tallies/best date after refetch; change a vote (updates, not
   duplicates).
3. Organizer "Lock in this date"; hero flips to official; haul opens.
4. Confirm-to-claim on one profile; claim; on the other, count out → orphan
   appears → first profile covers the orphan.
5. Race a claim from both profiles; one wins, the other sees "already taken".
6. Add an item as a participant; remove it as the adder; add another; remove it as
   the organizer.
7. Single-date event: no voting, RSVP + claiming after confirm.
8. Dashboard: verify the live card's status, going, claimed, crew reflect state.

## Performance Considerations

Friend-group scale (low QPS, small data). Both read models must aggregate
votes/claims/participants in a small number of queries (no N+1 across date
options/items/events). Page-load / after-action refetch is the update model; no
caching.

## Migration Notes

Tables are empty pre-launch, so new NOT NULL columns and constraints apply without
backfill. The nullable FKs (`ChosenDateOptionId`, `AddedByParticipantId`,
`OrphanedFromParticipantId`) are null on existing S-01 rows. Configure the
`EventItem → Participant` and `Event → DateOption` FKs with `NoAction`/`SetNull` to
avoid Postgres multiple-cascade-path errors.

## References

- Roadmap slice: `context/foundation/roadmap.md` (S-02)
- PRD: `context/foundation/prd.md` (US-02, FR-005, FR-007–FR-013, FR-010–FR-012)
- **Design references (fidelity target)**:
  `frontend/context/foundation/design/picnivo-web-event.jsx`,
  `.../picnivo-web-events.jsx`, `.../picnivo.css`, `.../picnivo-web.css`;
  helpers `pvTally` / `pvBestDate` and `VOTE_META` in `.../picnivo-kit.jsx`
- S-01 patterns: `context/archive/2026-06-28-event-creation-and-sharing/plan.md`
- Backend endpoint pattern: `backend/Picnivo.API/Features/Events/CreateEvent/`,
  `.../GetEventByToken/`, `.../ListEvents/`
- Frontend feature pattern: `frontend/src/features/events/create-event/`,
  `.../list-events/`, public page `frontend/src/routes/_app/e/$token.tsx`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Data Model & Migration

#### Automated

- [x] 1.1 Build passes: `dotnet build` — 934ff75
- [x] 1.2 Migration applies cleanly: `dotnet ef database update` — 934ff75
- [x] 1.3 Migration reverts cleanly to previous migration — 934ff75
- [x] 1.4 Existing tests still pass: `dotnet test` — 934ff75

#### Manual

- [x] 1.5 DB shows three new tables, both unique indexes, new columns with correct FK/nullability — 934ff75

### Phase 2: Backend — Join, Voting & Read Models

#### Automated

- [x] 2.1 Build passes: `dotnet build` — d7dae5a
- [x] 2.2 Tests pass: `dotnet test` — d7dae5a
- [x] 2.3 Handler tests: join, duplicate-name flag, vote upsert, invalid dateOptionId — d7dae5a
- [x] 2.4 Endpoint tests: join id, GET tallies + bestDateOptionId, GET with participantId returns `you`, 404 unknown token — d7dae5a
- [x] 2.5 Integrity test: duplicate `(participant, dateOption)` never yields two rows — d7dae5a
- [x] 2.6 ListEvents test: participant count, crew names, claimed count, chosen-date fields correct — d7dae5a

#### Manual

- [x] 2.7 HTTP client: join, vote, GET hub + list — tallies, best date, dashboard counts correct — d7dae5a

### Phase 3: Backend — Claims, Attendance Recovery, Items & Lock Date

#### Automated

- [x] 3.1 Build passes: `dotnet build` — 2106b9e
- [x] 3.2 Tests pass: `dotnet test` — 2106b9e
- [x] 3.3 Claim gate tests across states (not-coming 403, coming allowed, Yes-on-chosen allowed, 1-date after confirm) — 2106b9e
- [x] 3.4 Attendance/orphan tests: count-out releases + orphans claims; re-claim clears orphan; plain release doesn't orphan — 2106b9e
- [x] 3.5 Claim race test: one winner, 409 loser; release frees item — 2106b9e
- [x] 3.6 Item tests: add stamps adder + dedupe; adder delete; non-adder 403; organizer delete any — 2106b9e
- [x] 3.7 Lock-date tests: organizer 200, non-organizer 403, unauthenticated 401, invalid dateOptionId rejected — 2106b9e

#### Manual

- [x] 3.8 HTTP flow: join → vote → lock → confirm → claim → count out (orphan) → other claims orphan — 2106b9e

### Phase 4: Frontend — Join & Participant Identity

#### Automated

- [x] 4.1 Type check passes: `pnpm typecheck` — dd63474
- [x] 4.2 Lint passes: `pnpm lint` — dd63474
- [x] 4.3 Tests pass: `pnpm test` — dd63474
- [x] 4.4 Token util tests: set/get/clear round-trip; SSR-safe returns null — dd63474
- [x] 4.5 Join bar tests: submits + calls `joinEventFn`; duplicate warning; short name blocked — dd63474
- [x] 4.6 i18n extract/compile succeeds; new strings use Lingui — dd63474

#### Manual

- [x] 4.7 Logged-out `/e/{token}` shows join bar; identity persists across reload — dd63474
- [x] 4.8 Duplicate name warns but still joins — dd63474

### Phase 5: Frontend — Voting Hub (Summary Layout, Reaction Voting, Best-Date Hero)

#### Automated

- [x] 5.1 Type check passes: `pnpm typecheck` — 610d650
- [x] 5.2 Lint passes: `pnpm lint` — 610d650
- [x] 5.3 Tests pass: `pnpm test` — 610d650
- [x] 5.4 Vote control tests: renders reactions, pre-selects `you.votes`, calls `castVotesFn`, narrow segmented fallback — 610d650
- [x] 5.5 Date row tests: tallies + stacked bar; Leading chip on best; ✓Locked chip when chosen — 610d650
- [x] 5.6 Hero tests: renders best date; lock button only when organizer; calls `selectFinalDateFn`; locked chip after chosen — 610d650
- [x] 5.7 i18n extract/compile succeeds — 610d650

#### Manual

- [x] 5.8 Hub matches design (band, hero, reaction voting, date rows, crew + share aside) desktop + mobile — 610d650
- [x] 5.9 Two profiles vote; tallies + best date update; changing a vote updates not duplicates — 610d650
- [x] 5.10 Organizer locks date; hero flips to "It's official" — 610d650

### Phase 6: Frontend — Items, Attendance & Recovery

#### Automated

- [x] 6.1 Type check passes: `pnpm typecheck` — b7fc237
- [x] 6.2 Lint passes: `pnpm lint` — b7fc237
- [x] 6.3 Tests pass: `pnpm test` — b7fc237
- [x] 6.4 Haul tests: gated before lock; confirm-claim when not coming; claim gated; own unclaim; 409 "already taken"; orphan renders + re-claimable; add-item dedupe/max — b7fc237
- [x] 6.5 Attendance tests: toggle coming/out + mutation; crew splits Coming/Can't-make-it when locked; count-me-out recovery card — b7fc237
- [x] 6.6 Announcement tests: single-date renders AnnounceHero, no vote UI, RSVP works — b7fc237
- [x] 6.7 i18n extract/compile succeeds — b7fc237

#### Manual

- [x] 6.8 Locked event: confirm → checklist claim matches design; count-me-out frees orphan another covers; crew split correct — b7fc237
- [x] 6.9 Single-date announcement matches design; RSVP + claiming work — b7fc237

### Phase 7: Frontend — Organizer Events Dashboard

#### Automated

- [x] 7.1 Type check passes: `pnpm typecheck`
- [x] 7.2 Lint passes: `pnpm lint`
- [x] 7.3 Tests pass: `pnpm test`
- [x] 7.4 Card tests: status chip voting/date-set/past; "N going" from count; "X / Y claimed"; crew stack capped
- [x] 7.5 List tests: Ongoing/Past filter uses derived status; counts correct
- [x] 7.6 i18n extract/compile succeeds; `pnpm build` succeeds

#### Manual

- [x] 7.7 Dashboard cards match design; live event status/going/claimed/crew reflect real state end to end

---
date: 2026-07-05T01:17:46+02:00
researcher: Jakub Prokopski
git_commit: d8631a4396f910bb36095b737b9cb263bfce8106
branch: main
repository: picnivo
topic: "Best-date aggregation correctness — ranking, tie-break, and attendance inclusion (test-plan risk #5)"
tags: [research, codebase, aggregation, best-date, voting, attendance, GetEventByToken, testing]
status: complete
last_updated: 2026-07-05
last_updated_by: Jakub Prokopski
---

# Research: Best-date aggregation correctness (risk #5)

**Date**: 2026-07-05T01:17:46+02:00
**Researcher**: Jakub Prokopski
**Git Commit**: d8631a4396f910bb36095b737b9cb263bfce8106
**Branch**: main
**Repository**: picnivo

## Research Question

Phase 3 of the phased test rollout (`context/foundation/test-plan.md` §3) covers risk #5:
"Best-date aggregation miscounts — the wrong 'best' date is shown (Yes tally, tie-break by
fewest No, inclusion of attendance-confirmed participants)." Pin the exact ranking rule,
tie-break, and attendance-inclusion behavior so tests can be written against a rule-derived
oracle (never against the implementation output). Cited anchor: commit `49244ca`, "count RSVP
attendance in best-date tally."

## Summary

**Risk #5 is split across two layers, and the split is the single most important finding.**

1. **Backend (`GetEventByToken` handler)** owns the *ranking* and the *per-date vote tallies*.
   Best date = most `Yes` (desc) → fewest `No` (asc) → earliest `StartsAt` (asc). Per-date
   `YesCount/MaybeCount/NoCount` are **raw vote counts only**. The backend tally is
   **completely independent of `Participant.Attendance`** — a participant marked "Coming" adds
   nothing to any date's tally or to best-date selection.

2. **Frontend (`get-event-by-token` view + `set-attendance/schema.ts`)** owns the
   *attendance-inclusive "X of N can make it" tally*. It does **not** rank dates — it reads the
   winner straight from the backend's `bestDateOptionId`. The "who's coming" count is computed
   client-side from `isEffectivelyComing(attendance, votes, chosenDateOptionId)`.

**The cited anchor commit `49244ca` is entirely a frontend change** (`best-hero.tsx`,
`event-detail-view.tsx`). It fixed the "X of N can make it" number to count RSVP attendance —
not just `DateVote` yes-counts — by reusing `isEffectivelyComing`. There is **no attendance
logic in the backend tally**, so the "attendance inclusion" clause of risk #5 must be tested on
the frontend, and the "ranking + tie-break" clause on the backend. Anyone who reads risk #5 as
"the backend tally should include attendance" is mis-framing it.

**Coverage state:** the frontend predicate and attendance tally are already well tested
(`schema.test.ts` pure-function coverage of every `isEffectivelyComing`/`isEffectivelyOut`
branch; `event-detail-view.test.tsx` has the direct `49244ca` regression). The backend has a
happy-path best-date test but **does not pin the tie-break chain** (equal-Yes → fewest-No, and
the equal-Yes-and-No → earliest-`StartsAt` fallback), nor that `Maybe` is inert. Those are the
real gaps Phase 3 should close.

## Detailed Findings

### Backend — ranking rule & tie-break (the oracle to pin)

The entire aggregation runs **in memory (LINQ-to-Objects)** after two `ToList`/`ToListAsync`
round-trips — not in SQL. This matters: tie-break ordering uses .NET's *stable*
`OrderBy`/`ThenBy` and `DateTimeOffset` comparison, with no SQL collation or NULL-ordering
quirks in play.

`backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:77-82`:

```csharp
var bestDateOptionId = raw
    .DateOptions.OrderByDescending(d => CountFor(d.Id, VoteChoice.Yes))
    .ThenBy(d => CountFor(d.Id, VoteChoice.No))
    .ThenBy(d => d.StartsAt)
    .Select(d => (Guid?)d.Id)
    .FirstOrDefault();
```

Local counter (`GetEventByToken.cs:74-75`):

```csharp
int CountFor(Guid dateOptionId, VoteChoice choice) =>
    allVotes.Count(v => v.DateOptionId == dateOptionId && v.Choice == choice);
```

The ranking oracle, in order:

1. **Winner = most `Yes` votes** (`OrderByDescending`).
2. **Tie → fewest `No` votes** (`ThenBy`, ascending). *Implemented exactly as risk #5 states.*
3. **Still tied → earliest `StartsAt`** (`ThenBy`, ascending). A further tie does **not** fall
   back to insertion order — it falls back to the scheduled date/time.
4. **Exact triple-tie** (equal Yes, equal No, equal `StartsAt`) → stable-sort fallback to EF's
   returned source order (unordered; **avoid relying on it** — give fixtures distinct `StartsAt`).
5. `Maybe` **never** affects ranking (only Yes and No feed the sort); attendance status **never**
   affects tallies or ranking. Only persisted `DateVote` rows count, at most one per
   (participant, date option) — enforced by unique index `IX_DateVotes_Participant_DateOption`
   (`Data/Configurations/DateVoteConfiguration.cs:15-18`).
6. Zero date options → `FirstOrDefault()` returns `null` → `BestDateOptionId` is null.

`BestDateOptionId` (the *suggestion*) is distinct from `ChosenDateOptionId` (the organizer's
*lock*, or the lone option auto-resolved for a single-date event via
`Event.ResolveEffectiveChosenDateOptionId`, `Data/Models/Event.cs:24-27`, called at
`GetEventByToken.cs:60-63`).

The per-date DTO list is separately ordered by `StartsAt` (independent of ranking),
`GetEventByToken.cs:109-118`.

### Backend — state space (enums)

- `Data/Models/VoteChoice.cs:3-9` — `{ Invalid = 0, Yes = 1, Maybe = 2, No = 3 }`. Per
  (participant, date option). `Choice` is required/non-null.
- `Data/Models/AttendanceStatus.cs:3-9` — `{ Invalid = 0, Undecided = 1, Coming = 2, Out = 3 }`.
  Per participant, event-wide. Default `Undecided` (`Participant.cs:8`). **Surfaced but never
  aggregated into any date tally.**

### Backend — response DTO shape

`backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByTokenDtos.cs`:

- `EventDetailResponse` (`:40-52`): top-level `Guid? BestDateOptionId`, `Guid? ChosenDateOptionId`,
  plus `DateOptions`, `Items`, `Participants`, `You`.
- `DateOptionDto` (`:5-11`): `Id`, `StartsAt`, `int YesCount`, `int MaybeCount`, `int NoCount`.

### Frontend — attendance-inclusive tally (the `49244ca` layer)

The predicate risk #5's attendance clause hinges on lives in
`frontend/src/features/events/set-attendance/schema.ts` (imported cross-feature — **not** in
`get-event-by-token/schema.ts`, which is only Zod input schemas).

Numeric codes mirror the backend enums as bare `number`s:
- `set-attendance/schema.ts:7-11` — `ATTENDANCE_VALUES = { undecided: 1, coming: 2, out: 3 }`.
- `vote-on-dates/schema.ts:8-12` — `VOTE_CHOICE_VALUES = { yes: 1, maybe: 2, no: 3 }`.

`set-attendance/schema.ts:21-35`:

```ts
export function isEffectivelyComing(
  attendance: AttendanceStatus,
  votes: ParticipantVoteDto[],
  chosenDateOptionId: string | null,
): boolean {
  if (attendance === ATTENDANCE_VALUES.coming) return true;
  if (attendance !== ATTENDANCE_VALUES.undecided || !chosenDateOptionId) {
    return false;
  }
  return votes.some(
    (v) =>
      v.dateOptionId === chosenDateOptionId &&
      v.choice === VOTE_CHOICE_VALUES.yes,
  );
}
```

Semantics: explicit `coming` (2) → always coming; `out` (3) or null chosen date → not coming;
only `undecided` (1) **with a chosen date** falls back to "voted Yes on that date". The
null-chosen-date guard means before a date is locked, only an *explicit* RSVP counts.
`isEffectivelyOut` (`:37-51`) is the mirror (explicit out, or undecided + No vote on the date).

### Frontend — best-date selection is NOT computed client-side

`frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx:46-48`:

```ts
const heroDateId = event.chosenDateOptionId ?? event.bestDateOptionId;
const heroDate =
  event.dateOptions.find((d) => d.id === heroDateId) ?? event.dateOptions[0];
```

No client sort, no tie-break — the winner is the backend's `bestDateOptionId` (falling back to
the first date option). The three name-list helpers (`event-detail-view.tsx:50-78`):
- `yesVoterNamesFor` — raw `choice === yes` voters (feeds each `DateRow`).
- `comingNamesFor` — `isEffectivelyComing`, passing the row's own `dateOptionId` as the
  "chosen" arg, so the hero card treats the best date as chosen for tally purposes.
- `outNamesFor` — mirror via `isEffectivelyOut`.

`best-hero.tsx:97-101` and `announce-hero.tsx:57-61` are pure display — they render
`comingNames.length` of `totalParticipants` (= `event.participants.length`); they compute nothing.

## Existing Test Coverage & Gaps

### Backend (`backend/Picnivo.Tests/Features/Events/GetEventByToken/`)

Two files, file-per-concern:

- `GetEventByTokenHandlerTests.cs` (SQLite in-memory via `TestDb.Create()`, calls static
  `Handle` directly — the richest tally reference):
  - `ReturnsTalliesAndBestDateOptionId:70` — 2×Yes on winner, 1×No on loser; asserts
    `BestDateOptionId`, `YesCount`, `NoCount`. **Happy path only.**
  - `WithSingleDateEvent_YesCountHasNoImplicitOrganizerVote:267`,
    `WithMultipleDates_YesCountDoesNotIncludeOrganizer:300` — organizer not auto-counted.
  - `WithSingleDateEvent_TreatsLoneDateAsChosen:233`,
    `WithMultipleDatesAndNoLock_ChosenDateOptionIdIsNull:331` — chosen-date resolution.
  - `ReturnsEachParticipantsOwnVotes:151`, `WithParticipantId_ReturnsYou:362`.
- `GetEventByTokenEndpointTests.cs` (Postgres Testcontainer via `ApiFixture`):
  - `JoinVoteThenGet_ReturnsTalliesBestDateAndYou:44` — full round-trip through the typed
    client; asserts `BestDateOptionId`, `YesCount == 1`.

**Backend gaps (Phase 3 targets):**
- No test pins the **fewest-No tie-break** (two dates with equal Yes, different No).
- No test pins the **`StartsAt` tie-break** (equal Yes and equal No).
- No test asserts **`Maybe` is inert** to ranking.
- No explicit test that **attendance does not move the tally** (a characterization test guarding
  the backend/frontend boundary — cheap and worth it given how risk #5 is worded).

### Frontend (`frontend/src/features/events/`)

- `set-attendance/schema.test.ts` — **pure-function coverage of every `isEffectivelyComing` /
  `isEffectivelyOut` branch** (explicit coming/out, undecided+Yes/No on chosen date,
  explicit-out-overrides-vote, null chosen date). This is the canonical oracle test.
- `get-event-by-token/components/event-detail-view.test.tsx` (integration tally):
  - `"counts an RSVP'd guest toward the locked date's tally even without a matching vote":455`
    — the **direct `49244ca` regression** (Bob `attendance: 2, votes: []` → `2 of 2 can make it`).
  - `0 of 1 coming` when organizer undecided; `1 of 1` once confirmed; `0 of 2` for undecided guests.
- `best-hero.test.tsx`, `announce-hero.test.tsx` — render with props passed directly; assert the
  tally *string* but do not exercise aggregation.

**Frontend gaps (smaller):**
- The `chosenDateOptionId ?? bestDateOptionId ?? dateOptions[0]` fallback chain
  (`event-detail-view.tsx:46-48`) has no dedicated test — fixtures always set `bestDateOptionId`.
  Low value; the predicate and tally (the actual risk) are covered.

## Test Infrastructure (how to add Phase 3 tests)

Two parallel backend harnesses, chosen by test type (mirrors the two completed sibling phases):

- **Unit (handler logic)** — `TestDb.Create()` (isolated named in-memory SQLite,
  `EnsureCreated()`, no migrations). Seed `DateOption`/`Participant`/`DateVote` directly via the
  `DbContext`, then call the static `Handle` with an alias to dodge the type-name clash:
  ```csharp
  using GetEventByTokenHandler = Picnivo.API.Features.Events.GetEventByToken.GetEventByToken;
  var result = await GetEventByTokenHandler.Handle(token, null, db, CancellationToken.None);
  var ok = result.ShouldBeOfType<Ok<EventDetailResponse>>();
  ```
  `DateVote` fixture model: `new DateVote { Id = Guid.CreateVersion7(), ParticipantId,
  DateOptionId, Choice = VoteChoice.Yes }` then `AddRange` + `SaveChangesAsync` +
  `ChangeTracker.Clear()` (`GetEventByTokenHandlerTests.cs:111-133`). **This is where the
  tie-break unit tests belong** — cheap, deterministic, no container.
- **Integration (HTTP)** — `[Collection("Api")]` + `await fixture.CheckOutAsync()` leases one of
  a pool of 10 pre-migrated Postgres DBs; seed via `ctx.Services` scope DbContext, drive via the
  NSwag-generated `ctx.ApiClient` (`.JoinEventAsync` → `.CastVotesAsync` → `.GetEventByTokenAsync`),
  assert on the response DTO (`GetEventByTokenEndpointTests.cs:44`). Errors via
  `Should.ThrowAsync<ApiException>()` + `.StatusCode`.

Assertions: **Shouldly** (globally imported via csproj). Lessons rules that bind here: separate
handler/endpoint/validator test files; each test seeds its own data via `DbContext`; strict
Arrange-Act-Assert (`backend/context/foundation/lessons.md`).

Frontend: **Vitest + Testing Library + jsdom**, `Wrapper` provides `<I18nProvider>`,
`afterEach(cleanup)`, `@tanstack/react-router` mocked. Pure predicate tests go in
`set-attendance/schema.test.ts`; tally integration in `event-detail-view.test.tsx`
(`frontend/context/foundation/lessons.md`, test-plan §6.1).

## Oracle Hygiene (test-plan §2 risk #5, principle #3)

The plan's explicit anti-pattern: *"Expected values copied from the implementation under test."*
Derive every expected best-date from the **rule**, not from running `Handle`:
- Fewest-No tie-break: two dates each 2×Yes; date A 0×No, date B 1×No → **A wins** because the
  rule says fewest-No, independent of what the handler returns.
- `StartsAt` tie-break: two dates each 2×Yes / 0×No, A earlier than B → **A wins**.
- `Maybe` inert: a date with 3×Maybe loses to a date with 1×Yes.
- Attendance-doesn't-move-backend-tally: seed a `Coming` participant with no `DateVote` → the
  date's `YesCount` is unchanged. (Frontend oracle is FR-011 + `isEffectivelyComing` semantics,
  derived from PRD, not from the component output.)

## Code References

- `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:74-82` — ranking + tie-break chain (in-memory).
- `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:109-118` — per-date DTO tallies.
- `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByTokenDtos.cs:5-11,40-52` — DTO shapes.
- `backend/Picnivo.API/Data/Models/VoteChoice.cs:3-9`, `AttendanceStatus.cs:3-9` — enums.
- `backend/Picnivo.API/Data/Models/Event.cs:24-27` — `ResolveEffectiveChosenDateOptionId`.
- `backend/Picnivo.API/Data/Configurations/DateVoteConfiguration.cs:15-18` — unique index.
- `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs:70,111-133` — tally unit reference + `DateVote` seeding.
- `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenEndpointTests.cs:44` — HTTP round-trip reference.
- `backend/Picnivo.Tests/ApiFixture.cs`, `TestDb.cs` — the two harnesses.
- `frontend/src/features/events/set-attendance/schema.ts:7-51` — `ATTENDANCE_VALUES`, `isEffectivelyComing`, `isEffectivelyOut`.
- `frontend/src/features/events/vote-on-dates/schema.ts:8-12` — `VOTE_CHOICE_VALUES`.
- `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx:46-78` — hero selection + name helpers.
- `frontend/src/features/events/set-attendance/schema.test.ts` — predicate oracle tests.
- `frontend/src/features/events/get-event-by-token/components/event-detail-view.test.tsx:455-482` — `49244ca` regression.

## Architecture Insights

- **Clean layer boundary that risk #5's wording obscures**: backend = deterministic ranking over
  persisted votes; frontend = attendance-aware "who's coming" display. The two never mix. Tests
  should respect the boundary rather than trying to assert attendance-in-tally on the backend.
- **In-memory aggregation** makes the backend tie-break fully deterministic and unit-testable on
  SQLite — no Postgres container needed for the ranking logic; the container is only for the HTTP
  round-trip smoke.
- **Handlers are pure `static Handle(...)` functions** taking `PicnivoDbContext` as a parameter —
  ideal for fast unit oracles (no DI, no host).
- **`Guid.CreateVersion7()`** for seeded ids keeps insertion order roughly monotonic, but the
  ranking never depends on id order — `StartsAt` is the final discriminator, so fixtures must set
  distinct `StartsAt` to stay off the unspecified stable-sort fallback.

## Historical Context (from prior changes)

- **PRD FR-011** (`context/foundation/prd.md`): "Any event visitor can see the current best date
  option (most Yes votes; ties broken by fewest No votes). This is a suggestion, not a decision —
  the organizer still picks the final date." — The product-level oracle; note it does **not**
  mention the `StartsAt` third tie-break (that's an implementation detail to pin as a
  characterization test) and does **not** tie best-date ranking to attendance.
- **Commit `49244ca`** ("fix(get-event-by-token): count RSVP attendance in best-date tally") —
  **frontend-only**. `BestHero` previously showed only `DateVote` yes-counts, so clicking "I'm
  coming" never moved "X of N can make it" once a date was locked. Fix reused `isEffectivelyComing`.
- **Phase 1** (`context/archive/2026-07-04-testing-claim-path-integrity/`) — established the
  `[Collection("Api")]` + `ApiFixture.CheckOutAsync()` pattern, SQLite-vs-Postgres split, and the
  explicit oracle-hygiene discipline ("derive expected outcomes from FRs and enum semantics, not
  from re-running the handler").
- **Phase 2** (`context/archive/2026-07-04-testing-authorization-boundaries/`) — error-code
  precision and characterization tests for accepted-by-design behavior (the model for a
  "attendance doesn't move the backend tally" characterization test here).

## Related Research

- `context/archive/2026-07-04-testing-claim-path-integrity/research.md`
- `context/archive/2026-07-04-testing-authorization-boundaries/research.md`
- `context/foundation/test-plan.md` §2 (risk #5 row), §3 (Phase 3), §6.5 (best-date cookbook — TBD, to be filled by this phase).

## Open Questions

1. **Does Phase 3 want to pin the `StartsAt` third tie-break as behavior, or treat it as an
   incidental detail?** FR-011 only specifies Yes-then-No. Recommendation: pin it as a
   *characterization* test (clearly named) so a future refactor can't silently reorder ties,
   without elevating it to a product guarantee.
2. **Is a backend "attendance is inert to the tally" characterization test in scope?** It directly
   answers the most likely misreading of risk #5 and is nearly free. Recommendation: yes.
3. **Frontend fallback-chain test (`bestDateOptionId ?? dateOptions[0]`)** — worth one small test,
   or out of scope given the predicate + tally are already covered? Low priority.

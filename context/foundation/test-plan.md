# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-07-04

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic check that already catches the
   regression.
2. **User concerns are first-class evidence.** Risks anchored in "the team
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is
   produced by `/10x-research` during each rollout phase. If the plan and
   research disagree about where the failure lives, research is the
   ground truth.

Hot-spot scope used for likelihood weighting: `frontend/src`, `backend/Picnivo.API`.

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|---|---|---|---|
| 1 | Two participants claim the same item concurrently; both appear to succeed, first-come-first-served silently fails, and one claim is lost on reload | High | Medium | interview Q1 + Q4; hot-spot dir `backend/Picnivo.API/Features/Claims` (9 commits/30d); hot-spot dir `frontend/src/features/events` (113 commits/30d) |
| 2 | The attendance/claim gate admits an ineligible participant or blocks an eligible one — the eligibility rule is server-enforced; cross-participant identity trust is a separate, accepted friend-group model (see §3 Phase 2) | High | Medium-High | interview Q3; PRD FR-009; PRD FR-013; abuse lens: untrusted input / server-side validation parity |
| 3 | Authorization / IDOR — an organizer-only action (remove item, select final date) is accepted from a non-organizer, or a participant action is spoofed onto another participant or event via id/token tampering | High | Medium | abuse lens: authorization/ownership; PRD Access Control; PRD FR-005; hot-spot dirs `backend/Picnivo.API/Features/Events` (46/30d), `Features/Items` (11/30d) |
| 4 | Vote integrity — a participant records more than one vote per date option, or votes as an identity they do not own, violating the PRD guardrail | Medium | Medium | PRD Guardrail (one vote per person per date); roadmap S-02 flagged enforcement as an open unknown; abuse lens: resource abuse / authorization |
| 5 | Best-date aggregation miscounts — the wrong "best" date is shown (Yes tally, tie-break by fewest No, inclusion of attendance-confirmed participants) | Medium-High | Medium-High | PRD FR-011; hot-spot file churn on the read/aggregation slice `Features/Events/GetEventByToken` (7 commits/30d); live regression recently fixed (commit `49244ca`, "count RSVP attendance in best-date tally") |

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | Two concurrent claims on one item → exactly one succeeds, the other receives a clean rejection; the persisted state shows a single claimant | "A passing happy-path claim test proves FCFS holds" | Where the claim is written; whether a DB uniqueness constraint, transaction, or optimistic-concurrency token guards it; whether SQLite-in-memory can reproduce contention or a real Postgres container is required | Backend integration/concurrency test under contention | Single-threaded claim test that never exercises simultaneity |
| #2 | An ineligible participant (no Yes vote, no attendance confirmation) is rejected over a direct API call, proving the rule is server-enforced; each eligible path is allowed | "The UI hides the claim button, so the gate holds" | Where the gate is enforced (handler/validator vs. client only); the exact two eligibility paths (Yes vote on chosen date, explicit confirmation) in code | Backend integration: eligibility matrix + direct-API call over the real HTTP boundary | Testing only the UI disabled state, not the server enforcement |
| #3 | A non-organizer is rejected on organizer-only endpoints; a participant/event id belonging to another owner is refused | "A valid token implies authorization for every action" | Which endpoints are organizer-gated; how ownership is derived (from the authenticated principal vs. trusted from the request body) | Backend endpoint tests: wrong/absent auth, cross-event ids | Happy-path-only token tests |
| #4 | Re-voting updates the single vote (no duplicate row); voting as an identity you do not own is refused | "A second vote row for the same person and date is acceptable" | How participant identity is asserted on the cast-votes path; whether the write is upsert or insert; any unique constraint on (participant, date option) | Backend integration on the cast-votes path | Oracle lifted from current handler behavior (tautological assertion) |
| #5 | The tally selects the most-Yes date; ties break by fewest-No; attendance-confirmed participants are counted per the just-fixed rule | "The tally is obviously right and needs no fixtures" | The exact ranking rule, tie-break, and which attendance states count toward a date (per commit `49244ca`) | Unit/integration on the tally with tie and mixed-vote fixtures | Expected values copied from the implementation under test (oracle problem) |

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|---|---|---|---|---|---|
| 1 | Claim-path integrity | Prove FCFS holds under contention and the eligibility gate is server-enforced and unbypassable | #1, #2 | integration + concurrency | complete | context/archive/2026-07-04-testing-claim-path-integrity |
| 2 | Authorization boundaries | Prove only owners act on owned resources and ballots cannot be stuffed | #3, #4 | endpoint + integration | complete | context/archive/2026-07-04-testing-authorization-boundaries |
| 3 | Aggregation correctness | Pin the best-date ranking, tie-break, and attendance inclusion | #5 | unit + integration | complete | context/archive/2026-07-05-testing-aggregation-correctness |
| 4 | Quality-gates wiring | Fire scoped tests on claim/auth/tally risk files per-edit and pre-commit | cross-cutting (locks #1–#5) | gates (per-edit hook + pre-commit) | complete | context/archive/2026-07-05-testing-quality-gates-wiring |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened` → `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.
Recommendations in this section are grounded in local manifests/configs plus
the MCP/tools actually exposed in the current session.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| unit + integration (frontend) | Vitest | ^4.1.5 | `pnpm test` (vitest run); colocated `*.test.ts(x)` next to source |
| component (frontend) | @testing-library/react + jsdom | ^16.3.0 / ^28.1.0 | jsdom environment; user-event for interaction |
| API mocking (frontend) | none installed | — | No MSW; server functions tested directly. Add only if an integration phase needs the network edge mocked |
| unit + integration (backend) | xUnit | 2.9.3 | `dotnet test`; tests mirror `Features/<Area>/<Action>/` with separate handler/endpoint/validator files |
| endpoint/integration host (backend) | Microsoft.AspNetCore.Mvc.Testing (WebApplicationFactory) | 10.0.* | Spins the API in-process for endpoint round-trips |
| integration DB (backend) | Microsoft.EntityFrameworkCore.Sqlite + Testcontainers.PostgreSql | 10.0.5 / 4.* | SQLite in-memory for fast handler tests; **real Postgres container available** — required where contention/constraints must match prod (see §3 Phase 1) |
| e2e | none yet | — | No browser MCP in session; e2e would need its own setup and is out of scope for the current rollout |

**Stack grounding tools (current session):**
- Docs: Context7 MCP — available; will ground xUnit/WebApplicationFactory concurrency-test setup and EF Core constraint/transaction behavior during per-phase research; checked: 2026-07-04
- Search: Exa MCP — available; for current tool status only, then prefer official docs; checked: 2026-07-04
- Runtime/browser: none — no Playwright/browser MCP exposed; e2e not used this rollout; checked: 2026-07-04
- Provider/platform: none — Supabase/Fly/Cloudflare are deploy targets with no MCP connected; not used; checked: 2026-07-04

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | required | syntactic / type drift (`pnpm lint`, `pnpm typecheck`, `dotnet build`) |
| unit + integration | local + CI | required after §3 Phase 1 | logic regressions on the claim/auth/tally paths |
| scoped tests per-edit | local (agent loop) | recommended after §3 Phase 4 | regressions at edit time on risk-area files |
| scoped tests pre-commit | local (git hook) | recommended after §3 Phase 4 | what slipped past per-edit, on staged risk files (extends existing husky/lint-staged) |
| e2e on critical flows | CI on PR | optional | broken end-to-end participant flow; deferred (no browser tooling yet) |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, the sub-section names the
future pattern and points at §3.

### 6.1 Adding a unit test (frontend)

- **Location**: colocated `*.test.ts(x)` next to the unit under test in `frontend/src/**`.
- **Reference test**: `frontend/src/features/events/get-event-by-token/functions.test.ts`.
- **Run locally**: `pnpm --dir frontend test` (or `pnpm --dir frontend exec vitest related <file> --run` for scoped).

### 6.2 Adding an integration test (backend)

- **Location**: `backend/Picnivo.Tests/Features/<Area>/<Action>/<Action>EndpointTests.cs`, mirroring the API slice.
- **Mocking policy**: seed each test's own data via `DbContext` (backend lessons rule); use the real API via `WebApplicationFactory`. Use a Postgres container where the test depends on real constraint/transaction behavior; SQLite in-memory otherwise.
- **Reference test**: `backend/Picnivo.Tests/Features/Participants/SetAttendance/SetAttendanceEndpointTests.cs`.
- **Run locally**: `dotnet test backend/Picnivo.Tests`.

### 6.3 Adding a concurrency test for a race condition

- **Test type**: integration on the real Postgres fixture (`fixture.CheckOutAsync()` — SQLite in-memory does not reproduce contention). `Task.WhenAll` two simultaneous requests through a `Safe*Async` wrapper that catches `ApiException` and returns the status code, then assert on persisted row count, not just status codes.
- **Exclusive-resource shape** (only one caller should win, e.g. claiming an item): assert exactly one 204, one 409, one persisted row. **Reference test**: `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs` (`RaceForSameItem_OneWinsOneGetsConflict`).
- **Idempotent-upsert shape** (both callers legitimately want the same outcome, e.g. a first vote): assert both calls return 204 and exactly one row persists — do not assert which caller's value won (oracle problem). **Reference test**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs` (`ConcurrentFirstVotes_BothSucceedIdempotently`); the production fix is in `backend/Picnivo.API/Features/Votes/CastVotes/CastVotes.cs` (catches `UniqueConstraintException`, detaches the losing `Added` row, re-queries, retries as an update).

### 6.4 Adding a test for a new API endpoint

- **Test type**: integration via `WebApplicationFactory`; assert request → response shape AND persisted side-effects.
- **Also cover**: the authorization boundary — wrong/absent auth, and a cross-owner/cross-event id (404 via the event-scoped FK filter) vs. a foreign-but-referenced id used in a valid request (400 via membership validation). **Reference tests**: `backend/Picnivo.Tests/Features/Items/RemoveItem/RemoveItemEndpointTests.cs` (`CrossEventItemId_Returns404`); `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesEndpointTests.cs` (`CrossEventParticipantId_Returns404`, `ForeignDateOptionId_Returns400`).
- **Accepted-by-design note**: within-event GUID-based impersonation (a caller holding the event token plus another participant's id can act as them) is the intended friend-group trust model, not an IDOR gap — pin it with a clearly named characterization test rather than "fixing" it. **Reference test**: `CastVotesEndpointTests.cs` (`AnyCallerWithParticipantGuid_CanVoteAsThem_AcceptedFriendGroupTrust`).
- **Reference test** (base request/response + side-effect pattern): `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenEndpointTests.cs`.

### 6.5 Adding a test for the best-date aggregation

- **Layer split**: the backend owns *ranking* and *raw per-date vote tallies*; the frontend owns the *attendance-inclusive "X of N can make it"* display and hero-selection fallback. Never write a backend test asserting attendance moves the tally, or a frontend test asserting the client re-ranks dates — it doesn't.
- **Backend test type**: SQLite in-memory unit test on the static `Handle`, seeding `DateOption`/`Participant`/`DateVote` directly via `DbContext`. No Postgres container — ranking is in-memory LINQ, fully deterministic. **Reference tests**: `backend/Picnivo.Tests/Features/Events/GetEventByToken/GetEventByTokenHandlerTests.cs` — `WithEqualYesCounts_TieBreaksByFewestNo` (fewest-No tie-break), `EqualYesAndNo_TieBreaksByEarliestStartsAt_Characterization` (StartsAt tie-break, named as a characterization test since FR-011 doesn't specify it), `MaybeVotes_AreInertToRanking` (Maybe never feeds the sort), `AttendanceStatus_DoesNotMoveBackendTally_Characterization` (attendance-blind by design).
- **Frontend test type**: Testing Library render test for the attendance-inclusive predicate (`set-attendance/schema.test.ts`) and the hero-selection fallback chain (`event-detail-view.test.tsx`). **Reference tests**: `set-attendance/schema.test.ts` (every `isEffectivelyComing`/`isEffectivelyOut` branch); `event-detail-view.test.tsx` — `"counts an RSVP'd guest toward the locked date's tally even without a matching vote"` (the `49244ca` regression), `"falls back to the first date option when neither chosenDateOptionId nor bestDateOptionId is set"` (the `chosenDateOptionId ?? bestDateOptionId ?? dateOptions[0]` fallback).
- **Anti-pattern to avoid**: deriving the expected best-date from running `Handle` (or the component) and asserting the observed output — always derive it from the ranking rule text (most Yes → fewest No → earliest StartsAt) or the PRD/predicate semantics first, then write the fixture to match.

### 6.6 Adding a vote-integrity / uniqueness-guardrail test

- **Test type**: two layers. (1) In-request FluentValidation rule via `TestValidateAsync` for request-shape duplicates. (2) A direct-`DbContext` forced-insert test on the real Postgres fixture that bypasses the handler entirely, proving the DB unique index itself rejects a duplicate row — the happy-path upsert never reaches it.
- **Anti-pattern to avoid**: asserting only the handler's upsert convenience behavior (re-voting updates one row) — that proves convenience logic, not the actual DB guardrail.
- **Reference tests**: `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesValidatorTests.cs` (`WithDuplicateDateOptionId_IsInvalid`); `backend/Picnivo.Tests/Features/Votes/CastVotes/CastVotesConstraintTests.cs` (`DuplicateParticipantAndDateOption_ThrowsUniqueConstraintException`).

### 6.7 Per-rollout-phase notes

- Phase 1 (Claim-path integrity): the 409-vs-500 exception-translation path only fires correctly when the test fixture's exception-processor registration (`ApiFixture.cs`) matches `Program.cs` prod wiring exactly — a mismatch silently drops the 409 mapping instead of failing loudly.
- Phase 2 (Authorization boundaries): two error codes encode two distinct boundaries on the same endpoint — a foreign *entity* id is a 404 (event-scoped FK filter), a foreign-but-referenced id used in an otherwise valid request is a 400 (membership validation). Tests must distinguish these precisely, not collapse both to "some 4xx".

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5). Future
contributors should respect these unless the underlying assumption changes.

- **Generated orval API client** (`frontend/src/**` generated output) — the generator is the test; testing its output is redundant. Re-evaluate if the client is hand-edited or the generator config diverges from the backend contract. (Source: Phase 2 interview Q5.)
- **Lingui i18n catalogs / translation strings** — churn constantly, break nothing that affects behavior. Re-evaluate if a locale switch becomes a functional gate rather than a display concern. (Source: Phase 2 interview Q5.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-07-04
- Stack versions last verified: 2026-07-04
- AI-native tool references last verified: 2026-07-04

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.

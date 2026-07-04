---
date: 2026-07-04T04:48:57+0200
researcher: Jakub Prokopski
git_commit: b5bf0ef579ac79702fdeadeebcc4dd02b83b05ed
branch: main
repository: picnivo
topic: "Claim-path integrity: FCFS concurrency (Risk #1) and server-enforced, unbypassable eligibility gate (Risk #2)"
tags: [research, codebase, claims, concurrency, eligibility, authorization, testing]
status: complete
last_updated: 2026-07-04
last_updated_by: Jakub Prokopski
---

# Research: Claim-path integrity (Test Plan Phase 1 — Risks #1 & #2)

**Date**: 2026-07-04T04:48:57+0200
**Researcher**: Jakub Prokopski
**Git Commit**: b5bf0ef579ac79702fdeadeebcc4dd02b83b05ed
**Branch**: main
**Repository**: picnivo

## Research Question

Ground the two failure scenarios that Phase 1 of the test plan must protect against:

- **Risk #1 (FCFS under contention)**: two participants claim the same item concurrently; both appear to succeed and one claim is silently lost. Where is the claim written? What guards it (DB constraint, concurrency token, transaction)? Can SQLite-in-memory reproduce contention, or is a real Postgres container required?
- **Risk #2 (eligibility gate)**: does the claim gate admit an ineligible participant or block an eligible one, and is it bypassable by calling the API directly (UI-only enforcement)? Where is the gate enforced? What are the exact two eligibility paths? How is participant identity asserted?

## Summary

**Risk #1 is already structurally mitigated and already has one concurrency test.** A claim is an INSERT of an `ItemClaim` row (not a mutation on the item), and a **unique index on `ItemClaim.EventItemId`** enforces one-claim-per-item at the DB layer. The losing racer's `SaveChangesAsync` throws a unique-violation, which is mapped to **409 Conflict** — so a claim is *not* silently lost. An endpoint-level race test already exists — `ClaimItemEndpointTests.RaceForSameItem_OneWinsOneGetsConflict` — firing two parallel claims and asserting exactly one 204, one 409, and one persisted row, running against a real Postgres Testcontainer. The remaining Phase 1 work for Risk #1 is therefore mostly *hardening and widening* (N-way races, claim-vs-release, claim-vs-count-me-out, and resolving one open discrepancy about the 409-vs-500 mapping in the test factory), not building from zero.

**Risk #2 is more nuanced than "UI-only or not."** The eligibility gate **is genuinely server-enforced** in the claim handler (`ClaimItem.cs:57-76`), returning 403 for an ineligible participant before any INSERT — it is *not* a UI-only check. It correctly implements the two PRD paths (attendance `Coming`, or a Yes vote on the chosen date). **However**, the gate is *trivially satisfiable* by a scripted caller because the prerequisite endpoints (`SetAttendance`, `CastVotes`) are unauthenticated with no ownership binding, and the claiming participant's identity is a plain route parameter (`participantId`) that is never checked against an authenticated principal. This is the accepted "friend-group-scale" trust model recorded in the archived S-02 and cross-device-identity changes — so the *testable* assertions here are about the gate's correctness (eligibility matrix + the 403 path holding server-side), not about treating identity spoofing as a vuln to close. That distinction should be settled in framing/planning before tests are written.

## Detailed Findings

### Risk #1 — Claim write path & concurrency guard

**The write is an INSERT of a separate `ItemClaim` row.** `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs:78-89` does `db.ItemClaims.Add(new ItemClaim { … EventItemId = itemId, ParticipantId = participantId … })`, sets `item.OrphanedFromParticipantId = null` (`:87`), and persists at `await db.SaveChangesAsync(ct)` (`:89`), returning `204 NoContent` (`:91`). Release removes the row: `ReleaseClaim.cs:46` `db.ItemClaims.Remove(claim)` → `SaveChangesAsync` (`:47`).

**Data model — separate claims table, DB-level 1:1.** A claim is its own entity `ItemClaim` (`Data/Models/ItemClaim.cs`, PK `Id`, FKs `EventItemId`/`ParticipantId`), registered as `DbSet<ItemClaim> ItemClaims` (`Data/PicnivoDbContext.cs:17`). `EventItem` holds only a nav reference `ItemClaim? Claim` (`Data/Models/EventItem.cs:14`) — **there is no `ClaimedByParticipantId` column on the item**.

**The guard is a DB unique index (and only that):**
- `Data/Configurations/ItemClaimConfiguration.cs:15` — `builder.HasIndex(c => c.EventItemId).IsUnique().HasDatabaseName("IX_ItemClaims_EventItem")`, plus a 1:1 `HasOne(c => c.EventItem).WithOne(i => i.Claim)` (`:17-21`).
- Migration `Data/Migrations/20260702124332_AddParticipantsVotesAndClaims.cs:159-164` — `CreateIndex(… "IX_ItemClaims_EventItem", "ItemClaims", "EventItemId", unique: true)`.
- **No optimistic-concurrency token, no rowversion/xmin, no `IsConcurrencyToken`, no explicit transaction, no `SELECT … FOR UPDATE`** — a grep for those across `Data/` and `Features/` returned nothing.

**There is no read-check-write TOCTOU gap on the claim itself.** The handler never runs an `AnyAsync`/`FirstOrDefault` on `ItemClaims` before inserting — it relies entirely on the unique index to reject a duplicate at commit time. (Contrast `ReleaseClaim.cs:36-39`, which *does* read the claim before deleting.) So concurrent claims do not both succeed; the loser's INSERT is rejected.

**How a losing race becomes 409 rather than a silent loss (prod path):** `Program.cs:16-17` registers `AddDbContext(… UseNpgsql(connectionString).UseExceptionProcessor())` (EntityFramework.Exceptions.PostgreSQL), which translates Npgsql `23505` into a typed `UniqueConstraintException`; `ExceptionHandling/GlobalExceptionHandler.cs` maps it via `IExceptionProblemDetails`, and `ExceptionHandling/ProblemDetails/UniqueConstraintProblemDetails.cs:7` returns **409 Conflict**. The endpoint declares `.Produces(StatusCodes.Status409Conflict)` (`ClaimItemEndpoint.cs:13`).

**Provider & reproducibility:** prod/dev is **Postgres** (`Program.cs:16-17`; `appsettings.Development.json` → local Supabase Postgres at `127.0.0.1:54322`). A genuine race (two transactions contending on the unique index) requires the real Postgres Testcontainer (`ApiFixture`); the in-memory shared-cache SQLite harness (`TestDb.cs`) *can* enforce the unique index for a **sequential** duplicate-insert test but serializes writers and cannot reproduce true simultaneity.

### Risk #2 — Eligibility gate (server-side) and identity

**The gate is server-enforced in the handler** (there is no FluentValidation validator in the folder — only `ClaimItem.cs` and `ClaimItemEndpoint.cs`). `ClaimItem.cs:57-76`:

```csharp
var isComing = participant.Attendance == AttendanceStatus.Coming;
if (!isComing
    && participant.Attendance == AttendanceStatus.Undecided
    && chosenDateOptionId is { } chosenId)
{
    isComing = await db.DateVotes.AnyAsync(
        v => v.ParticipantId == participantId
            && v.DateOptionId == chosenId
            && v.Choice == VoteChoice.Yes, ct);
}
if (!isComing) { return Results.StatusCode(StatusCodes.Status403Forbidden); }
```

This returns 403 **before** the INSERT at `:78`. It is not UI-only.

**The two eligibility paths, in code:**
- **(a) explicit attendance confirmation** — `participant.Attendance == AttendanceStatus.Coming` (`ClaimItem.cs:57`). Enum `AttendanceStatus { Invalid=0, Undecided=1, Coming=2, Out=3 }` (`Data/Models/AttendanceStatus.cs`); set via `Features/Participants/SetAttendance/SetAttendance.cs:37`.
- **(b) Yes vote on the chosen date** — a `DateVote` with `DateOptionId == chosenId && Choice == VoteChoice.Yes` (`ClaimItem.cs:64-68`). Enum `VoteChoice { Invalid=0, Yes=1, Maybe=2, No=3 }` (`Data/Models/VoteChoice.cs`).
- Matches PRD FR-009 / FR-013 (`context/foundation/prd.md:89-93`).

**"Chosen date" resolution:** `Event.ResolveEffectiveChosenDateOptionId(ChosenDateOptionId, DateOptionIds)` (`ClaimItem.cs:52-55`; `Data/Models/Event.cs:24-27`) = `chosenDateOptionId ?? (dateOptionIds.Count == 1 ? dateOptionIds.Single() : null)`. `Event.ChosenDateOptionId` is set only by the auth-gated organizer endpoint `SelectFinalDate` (`.RequireAuthorization()`). A single-date event treats its lone date as chosen (FR-004 fallback).

**Two logic subtleties worth pinning with fixtures (candidate oracles):**
1. Path (b) is only evaluated when `Attendance == Undecided` (`ClaimItem.cs:60`). A participant who voted Yes but later set attendance to `Out` is **blocked** — arguably correct (explicit opt-out wins), but it means a Yes vote alone is not sufficient if attendance later became `Out`. Confirm intended.
2. On a **multi-date** event with no final date chosen, `chosenDateOptionId` is `null`, so path (b) is skipped and path (a) (`Coming`) is the *only* way to claim — meaning claiming is **not** strictly gated on a final date existing. Confirm intended.

**Identity is a route parameter, not an authenticated principal (the real Risk-#2 subtlety):**
- `ClaimItem.cs:9-15` — `Handle(string token, Guid itemId, Guid participantId, …)`; `participantId` comes straight from the URL (`ClaimItemEndpoint.cs:8`: `/api/events/{token}/items/{itemId}/claim`). The endpoint is anonymous (no `.RequireAuthorization()`).
- The only identity check is that the participant belongs to the event (`ClaimItem.cs:42-45`). There is **no** check that the caller *is* that participant.
- `SetAttendance` and `CastVotes` endpoints are likewise unauthenticated with no ownership check (`SetAttendanceEndpoint.cs:7-15`; `CastVotesEndpoint.cs`). Only organizer endpoints (`CreateEvent`, `ListEvents`, `SelectFinalDate`, `GetMyParticipant`) call `.RequireAuthorization()`. `Program.cs:64` `app.UseAuthorization()` has no fallback policy.
- **Consequence:** a scripted caller who knows the public event token + a participantId can self-elevate to `Coming` via `SetAttendance` and then pass the gate — and can claim *as* any participant. Per the archived changes (below), this cross-participant trust is an **accepted friend-group-scale decision**, not a known-open bug. Framing should decide whether Phase 1 tests assert the current (accepted) behavior or flag a hardening item; §2 of the test plan frames the gate as the target, not the identity model.

### Frontend enforcement (confirms parity, not UI-only)

- Claim UI gate: `frontend/src/features/events/claim-items/components/haul.tsx:53-55` — `canClaim = you ? isEffectivelyComing(you.attendance, you.votes, chosenDateOptionId) : false;`; `active = joined && canClaim` (`:62`) enables the claim/unclaim button (`ItemRow`, `:180`).
- `isEffectivelyComing` (`frontend/src/features/events/set-attendance/schema.ts:21-35`) mirrors the backend rule exactly (Coming, or Undecided + Yes vote on chosen date).
- The claim call: `claimItemFn` (`frontend/src/features/events/claim-items/functions.ts:20-41`) → `claimItem(token, itemId, { participantId })` (Orval-generated client) → backend `/api/events/{token}/items/{itemId}/claim`. The frontend passes the participantId from the per-event cookie (see identity model below). **The frontend applies no eligibility rule the backend skips.**

### Existing tests & harness (Phase 1 starts from a real baseline)

**Existing ClaimItem coverage:**
- `ClaimItemEndpointTests.cs` (Postgres, HTTP): `WithUnknownToken_Returns404` (`:13`); **`RaceForSameItem_OneWinsOneGetsConflict` (`:28`)** — two participants claim via `Task.WhenAll` (`:37-40`), asserts exactly one 204 + one 409 (`:43-44`) and exactly one persisted `ItemClaim` (`:48`), using a local `SafeClaimAsync` wrapper (`:70`); `ReleaseAfterClaim_FreesTheItem` (`:51`).
- `ClaimItemHandlerTests.cs` (SQLite, sequential): forbidden-when-ineligible (`:13`), allow-when-Coming (`:33`), allow-when-YesVote (`:59`), single-date allow (`:96`), claim clears orphan stamp (`:120`), **sequential** already-claimed → `UniqueConstraintException` (`:159`), unknown item → NotFound (`:199`). Seed helper `SeedEventAsync` (`:222`).
- `ReleaseClaimHandlerTests.cs` / `ReleaseClaimEndpointTests.cs`: single-threaded happy/sad paths only.

**Harness:**
- **Endpoint tests → real Postgres 16 via Testcontainers.** `ApiFixture.cs:21-23` (`PostgreSqlBuilder("postgres:16-alpine")`), `InitializeAsync` provisions a **pool of 10 DBs** (`PoolSize=10`, `:19`); `CreateDatabaseAsync` (`:40`) creates a uniquely-named DB, an `auth.users` stub, a `CustomWebApplicationFactory` (`:169`) bound to that DB, runs real `MigrateAsync` (`:77` — so the real unique index exists), drops the `auth.users` FK (`:80-85`); `CheckOutAsync` (`:90`) rents a context, TRUNCATEs on dispose (`:134`). `[Collection("Api")]` + `ApiFixture fixture` is the standard.
- **Handler tests → in-memory SQLite** via `TestDb.Create()` (`TestDb.cs:13-24`, shared-cache in-memory, `.UseExceptionProcessor()` with EntityFrameworkCore.Exceptions.Sqlite, nested `SqlitePicnivoDbContext` strips SQL date defaults).
- **Auth in tests:** `TestAuthHandler.cs` scheme via `X-Test-Organizer-Id` header; `ctx.AuthedApiClient(organizerId)` vs unauthenticated `ctx.ApiClient`.
- Package refs (`Picnivo.Tests.csproj:39-51`): xunit 2.9.3, Microsoft.AspNetCore.Mvc.Testing 10.0.*, EFCore(.Relational/.Sqlite) 10.0.5, EntityFrameworkCore.Exceptions.Sqlite 10.0.1, Testcontainers.PostgreSql 4.*, Shouldly 4.*.

**Canonical endpoint-test skeleton** (from the race test + `SetAttendanceEndpointTests.cs:31`):
```csharp
[Collection("Api")]
public class XEndpointTests(ApiFixture fixture)
{
    [Fact]
    public async Task Scenario()
    {
        await using var ctx = await fixture.CheckOutAsync();
        var (token, itemId, aliceId, bobId) = await SeedEventWithTwoComingParticipantsAsync(ctx.Services);
        var results = await Task.WhenAll(
            SafeClaimAsync(ctx.ApiClient, token, itemId, aliceId),
            SafeClaimAsync(ctx.ApiClient, token, itemId, bobId));
        using var scope = ctx.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PicnivoDbContext>();
        (await db.ItemClaims.CountAsync(c => c.EventItemId == itemId)).ShouldBe(1);
    }
}
```

**Gaps for Phase 1 (no infra blockers):**
- No reusable parallel-request helper — `SafeClaimAsync` + `Task.WhenAll` is copy-pasted per file. Widening to N-way or claim-vs-release/claim-vs-count-me-out races means generalizing this idiom.
- True concurrency must live at the **endpoint layer (Postgres)**; SQLite handler tests can only do sequential conflict.
- No isolation-level / release-then-reclaim-under-contention precedent exists (`SetAttendanceEndpointTests.CountingOut_ReleasesAndOrphansClaim:31` is the sequential orphaning case).

## Code References

- `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs:57-76` — server-side eligibility gate (403 path)
- `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItem.cs:78-89` — claim INSERT + SaveChanges (the write)
- `backend/Picnivo.API/Features/Claims/ClaimItem/ClaimItemEndpoint.cs:8,13` — anonymous route; `.Produces(409)`
- `backend/Picnivo.API/Features/Claims/ReleaseClaim/ReleaseClaim.cs:36-47` — read-then-remove claim
- `backend/Picnivo.API/Data/Models/ItemClaim.cs`, `EventItem.cs:14` — claim is a separate table; item has only a nav ref
- `backend/Picnivo.API/Data/Configurations/ItemClaimConfiguration.cs:15` — **unique index `IX_ItemClaims_EventItem` (the FCFS guard)**
- `backend/Picnivo.API/Data/Migrations/20260702124332_AddParticipantsVotesAndClaims.cs:159-164` — the unique index in SQL
- `backend/Picnivo.API/Program.cs:16-17,64` — Npgsql + `UseExceptionProcessor`; `UseAuthorization` with no fallback policy
- `backend/Picnivo.API/ExceptionHandling/ProblemDetails/UniqueConstraintProblemDetails.cs:7` — unique violation → 409
- `backend/Picnivo.API/Features/Participants/SetAttendance/SetAttendance.cs:37` + `SetAttendanceEndpoint.cs:7-15` — unauthenticated attendance write (self-elevation vector)
- `backend/Picnivo.API/Data/Models/Event.cs:24-27` — effective-chosen-date resolution
- `backend/Picnivo.Tests/ApiFixture.cs:19-23,40,77,90,169,181` — Postgres Testcontainer fixture, DB pool, factory
- `backend/Picnivo.Tests/TestDb.cs:13-24` — SQLite in-memory handler harness
- `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemEndpointTests.cs:28-48` — existing 2-way race test
- `backend/Picnivo.Tests/Features/Claims/ClaimItem/ClaimItemHandlerTests.cs:159-193` — sequential already-claimed test
- `frontend/src/features/events/claim-items/components/haul.tsx:53-62` — UI eligibility gate
- `frontend/src/features/events/set-attendance/schema.ts:21-35` — `isEffectivelyComing` (mirrors backend)
- `frontend/src/features/events/claim-items/functions.ts:20-41` — `claimItemFn` → Orval client

## Architecture Insights

- **Constraint-as-concurrency-control.** The project's consistent pattern is *no application-level locking or optimistic tokens* — correctness under contention is delegated to DB unique indexes plus the exception-processor→ProblemDetails mapping. The same pattern already backstops item de-duplication (`IX_EventItems_Event_NormalizedLabel`, from S-02 Phase 3 impl-review F3). Tests should assert the *constraint's observable contract* (one winner, clean 409), not internal locking.
- **Two-layer test strategy is deliberate.** SQLite handler tests for fast logic (eligibility matrix, orphan-stamp clearing); real Postgres endpoint tests for anything that depends on true constraint/transaction/concurrency behavior. Risk #1's genuine race belongs to the Postgres layer; Risk #2's eligibility matrix can largely live at the SQLite handler layer, with a direct-API bypass check at the endpoint layer.
- **Trust model is token-scoped, not principal-scoped.** Participant identity = a per-event httpOnly cookie carrying `Participant.Id`; the API trusts the `participantId` in the path. This is an intentional friend-group-scale decision, so Risk #2's "bypassable by direct API call" needs framing: the *eligibility rule* is server-enforced, but *identity* is not authenticated. Decide which of these Phase 1 asserts.
- **Oracle hygiene (per test-plan §2).** For the eligibility matrix and the two subtle branches, derive expected outcomes from FR-009/FR-013 and the enum semantics — not from re-running the handler — to avoid the tautological-oracle anti-pattern the plan calls out.

## Historical Context (from prior changes)

- `context/archive/2026-07-02-participant-voting-and-claims/plan-brief.md:32-50` & `plan.md:476-482` — original design: claim race handled by DB uniqueness (loser sees "already claimed" + refetch); eligibility gate = "effectively coming for chosen date," 403 on failure; explicit "I'm in" confirm-to-claim; count-me-out (`Attendance = Out`) releases claims and stamps `OrphanedFromParticipantId`.
- `context/archive/2026-07-02-participant-voting-and-claims/reviews/impl-review-phase-3.md:29-42,54-69` — F1: `ClaimItem` was changed from catching generic `DbUpdateException` to typed `UniqueConstraintException`; exception processor wired for both Postgres and SQLite for parity. F3: `AddItem` TOCTOU race closed with a unique index backstop (same pattern as claims).
- `context/archive/2026-07-03-cross-device-rsvp-identity/research.md:27-43` & `plan.md:41-47` — identity is a per-event cookie `pv_p_<eventToken>` holding `Participant.Id`; **guest cross-device identity loss was explicitly accepted for friend-group scale**; only the organizer got account-linked identity (new `GET /api/events/{token}/me`). This is the source of the "identity is trusted from the token, not authenticated" property observed on the claim path.

## Related Research

- `context/archive/2026-07-02-participant-voting-and-claims/` (S-02) — the change that built claims/attendance/voting; its plan and phase-3 review are the design-intent record for both risks.
- `context/archive/2026-07-03-cross-device-rsvp-identity/research.md` — the identity-model record relevant to Risk #2.
- `context/foundation/test-plan.md` §2 (Risk #1/#2 response guidance), §3 Phase 1, §4 Stack, §6.2–6.4 cookbook — the spec this research grounds.

## Open Questions

1. **409 vs 500 in the test factory (must verify before writing more race tests).** `ApiFixture`'s `CustomWebApplicationFactory` re-registers the DbContext with `UseNpgsql(connectionString)` **without** `.UseExceptionProcessor()` (`ApiFixture.cs:181`), which would surface a unique violation as a raw `DbUpdateException` → 500, *not* 409. Yet the existing `RaceForSameItem_OneWinsOneGetsConflict` asserts a 409 and is presumably green. Resolve the contradiction by **running the existing test**: either the exception processor survives the options swap (then the factory is fine as-is) or the race test is currently asserting something that no longer holds. This determines whether new tests expect 409 or the factory needs `.UseExceptionProcessor()` added for prod parity.
2. **Intended eligibility semantics for the two subtle branches** (Yes-vote-then-Out; claim-before-final-date on multi-date events). Confirm both are intended so the tests pin behavior rather than accidentally blessing a bug.
3. **Risk #2 scope: gate vs identity.** Does Phase 1 assert only the server-enforced eligibility *rule* (recommended, matches test-plan §2), or also treat cross-participant identity spoofing / self-elevation via unauthenticated `SetAttendance` as a boundary to test? The latter overlaps Phase 2 (Authorization boundaries) and the accepted friend-group trust model — a framing decision, not a code fact.
4. **N-way and cross-operation races.** Beyond the existing 2-way claim race: is a claim-vs-release race and a claim-vs-count-me-out (orphaning) race in Phase 1 scope, or deferred? These need a generalized parallel-request helper that does not yet exist.
</content>
</invoke>

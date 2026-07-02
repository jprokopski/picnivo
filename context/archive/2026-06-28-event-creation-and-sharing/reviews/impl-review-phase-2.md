<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Event Creation and Sharing — Phase 2

- **Plan**: context/changes/event-creation-and-sharing/plan.md
- **Scope**: Phase 2 of 6
- **Date**: 2026-06-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 1 critical · 3 warnings · 4 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | FAIL |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Notes on non-findings

- **DTOs location**: Plan said `Dtos/EventDtos.cs` (shared). Implementation uses `Features/*/Dtos.cs` (per-action). CLAUDE.md confirms this is the established project convention — correct call.
- **`public partial class Program {}`**: Plan required it for WebApplicationFactory. Omitted, yet 21 tests compile and pass — .NET 10 makes the implicit Program class visible to test assemblies without the declaration.

## Findings

### F1 — ValidationEndpointFilter returns wrong shape for 400 responses

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: ValidationEndpointFilter.cs:24 / CreateEventEndpoint.cs:12
- **Detail**: `ValidationEndpointFilter` returns `Results.BadRequest(new { errors = string[] })` — a flat array. `CreateEventEndpoint` declares `.ProducesValidationProblem()`, which means the NSwag-generated `PicnivoApiClient` expects `HttpValidationProblemDetails` (errors as `IDictionary<string,string[]>`). Deserializing a JSON array into a dictionary will throw `JsonSerializationException` at runtime. Invisible to CI because no endpoint test sends an invalid payload (see F3).
- **Fix A ⭐ Recommended**: Change `ValidationEndpointFilter` to use `Results.ValidationProblem(fieldErrors)` — group `result.Errors` by `PropertyName`, return `Results.ValidationProblem(dict)`. Matches OpenAPI declaration, gives field-level attribution.
  - Strength: Aligns runtime, spec, and generated client in one change.
  - Tradeoff: Minor extra grouping code; cross-field rules need `""` as the key.
  - Confidence: HIGH — standard Minimal API pattern.
  - Blind spot: Other endpoints using `.ProducesValidationProblem()` are also fixed automatically (positive side-effect).
- **Fix B**: Keep flat shape, replace `.ProducesValidationProblem()` with `.Produces<ValidationErrorResponse>(400)` everywhere.
  - Strength: Less code change; flat list may be simpler for frontend.
  - Tradeoff: Loses field-level attribution; must touch every endpoint declaration.
  - Confidence: MED — depends on frontend form requirements.
  - Blind spot: Generated client typed exception may need updating.
- **Decision**: FIXED via Fix A — ValidationEndpointFilter now returns Results.ValidationProblem() with field-keyed errors.

### F2 — Blank item labels silently dropped instead of rejected

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: CreateEvent.cs:27-30
- **Detail**: Plan said item labels should be validated (non-empty/deduped → 400). Implementation silently filters out blank/whitespace labels before persisting. A client sending `["Drinks", "", "Food"]` gets 201 with only `["Drinks", "Food"]` — no error.
- **Fix**: Add `RuleForEach(x => x.Items).NotEmpty()` in `CreateEventValidator.cs` and remove the silent-filter lines from `CreateEvent.cs:27-30`.
- **Decision**: FIXED — Added RuleForEach(x => x.Items).NotEmpty() to validator; removed silent blank-filter from CreateEvent.cs.

### F3 — No endpoint-level test for 400 validation path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: CreateEventEndpointTests.cs
- **Detail**: Plan required endpoint-level coverage of 400 validation rejections. Only 401 and 201 are tested at the endpoint level. Because of F1, any naively-written 400 endpoint test would throw `JsonSerializationException` instead of asserting the expected shape — making F1 invisible to CI.
- **Fix**: After fixing F1, add one endpoint test sending an invalid payload (e.g. empty title) and asserting `ApiException<HttpValidationProblemDetails>` with status 400.
- **Decision**: FIXED — Added WithInvalidData_Returns400WithValidationErrors endpoint test. 22/22 tests pass.

### F4 — Items list created once outside the retry loop; inconsistent with DateOptions

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: CreateEvent.cs:27-62
- **Detail**: `DateOption` objects are created fresh inside the retry loop (new GUIDs per attempt). `EventItem` objects are created once before the loop and reused across retries. Works correctly in practice today (single unique constraint on Events), but is internally inconsistent and the retry path is untested.
- **Fix**: Move item construction inside the retry loop alongside `DateOptions`.
- **Decision**: FIXED — Items construction moved inside the retry loop alongside DateOptions.

### F5 — SoonestDate computed in memory; all StartsAt values fetched unnecessarily

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Performance)
- **Location**: ListEvents.cs:30-31, 43
- **Detail**: `StartsAts = e.DateOptions.Select(d => d.StartsAt).ToList()` fetches all timestamp values into memory, then calls `.Min()` in application code. EF Core can translate `e.DateOptions.Min(d => (DateTimeOffset?)d.StartsAt)` to SQL `MIN()` directly.
- **Fix**: Replace `StartsAts` intermediary with inline `SoonestDate = e.DateOptions.Any() ? e.DateOptions.Min(d => (DateTimeOffset?)d.StartsAt) : null` in the EF projection.
- **Decision**: SKIPPED — SQLite EF Core provider cannot aggregate DateTimeOffset with MIN. The original approach (fetch StartsAts list, compute Min in C# after ToListAsync) is the correct cross-provider pattern. Original code preserved.

### F6 — List ordering uses absolute Min, not "soonest upcoming"

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: ListEvents.cs:43
- **Detail**: Plan said "order by soonest upcoming date." Implementation uses absolute minimum including past dates. Once all date options age past, stale events drift to the top. No observable impact at MVP, but degrades over time.
- **Fix**: Filter to future dates when computing `SoonestDate`: `e.DateOptions.Where(d => d.StartsAt >= DateTimeOffset.UtcNow).Min(...)`.
- **Decision**: FIXED — ListEvents.cs now uses Where(d => d > now) before computing Min, so SoonestDate reflects only future dates.

### F7 — No upper bound on Items count

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: CreateEventValidator.cs
- **Detail**: `DateOptions` is capped at 10. `Items` has no row count limit — only label length is bounded at the DB level. Currently authed organizers only, so low risk.
- **Fix**: Add `RuleFor(x => x.Items).Must(i => i.Count <= 50)` or chosen product limit.
- **Decision**: FIXED — Added RuleFor(x => x.Items).Must(i => i.Count <= 50) with error message.

### F8 — Unique-violation retry not scoped to Token constraint name

- **Severity**: 🔵 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Reliability
- **Location**: CreateEvent.cs:67-68
- **Detail**: `IsUniqueViolation` checks `SqlState == "23505"` but not which constraint fired. A future unique constraint added to Events would silently retry 5 times on its violations. Not a live bug today.
- **Fix**: Also check `pgEx.ConstraintName == "ix_events_token"` to scope the retry to the Token index.
- **Decision**: FIXED — IsUniqueViolation now also checks pgEx.ConstraintName == "IX_Events_Token".

---
date: 2026-07-04T15:59:20Z
researcher: Jakub Prokopski
git_commit: 5522673609946609930fddfe6d4408b50eddf8b7
branch: main
repository: picnivo
topic: "Organizer-only delete for Event with cascading cleanup (DELETE /api/events/{token})"
tags: [research, codebase, events, delete, cascade, authorization, vertical-slice, frontend]
status: complete
last_updated: 2026-07-04
last_updated_by: Jakub Prokopski
---

# Research: Organizer-only delete for Event with cascading cleanup

**Date**: 2026-07-04T15:59:20Z
**Researcher**: Jakub Prokopski
**Git Commit**: 5522673609946609930fddfe6d4408b50eddf8b7
**Branch**: main
**Repository**: picnivo

## Research Question

How to implement `DELETE /api/events/{token}` — organizer-only, hard delete, cascading to Participants / EventItems / DateVotes / ItemClaims — following the existing vertical-slice pattern, plus the frontend UI to trigger it. Closes the CRUD gap identified in `context/mvp-check-report.md` (Event has Create/Read/Update but no Delete).

**Scope** (confirmed with user): full stack — backend endpoint + cascade *and* frontend delete UI. **Cascade approach**: investigate current FK behavior first.

## Summary

The change is small and follows patterns already in the repo. Key conclusions:

1. **Backend template = `SelectFinalDate` (auth) + `RemoveItem` (delete).** An organizer-only mutation that resolves the Event by `Token`, reads `organizerId` from the JWT `sub` claim, checks ownership, and returns 204. No DTO and no validator are needed (token is the only input, bound from the route). The endpoint auto-registers via reflection — no edits to `Program.cs`/`EndpointExtensions.cs`.

2. **Cascade is already fully configured — no explicit child removal needed.** Every FK that transitively points into the Event subtree is `ON DELETE CASCADE` at both the EF Core and Postgres-migration level. `db.Events.Remove(event)` + `SaveChangesAsync()` deletes DateOptions, Participants, EventItems, DateVotes, and ItemClaims in a single statement. The one non-cascade FK (`Event.ChosenDateOptionId`, NoAction) does not block, and the two `SetNull` back-refs are inside the subtree. Multiple cascade paths converge on `ItemClaims` and `DateVotes` — safe on Postgres (unlike SQL Server).

3. **Authorization conventions are frozen** by the archived `testing-authorization-boundaries` change: **401** no JWT → **403** wrong organizer → **404** unknown token. Ownership is explicit (403), not hidden as 404. This is Test-Plan Risk #3 (IDOR/authorization).

4. **Hard delete is correct** — the PRD/roadmap have zero mention of soft-delete, retention, or audit trails for events; no `SaveChanges` override or query filter exists.

5. **Frontend**: the delete UI belongs in `event-detail-view.tsx`, gated on the existing `isOrganizer` prop (computed in the `$token` route loader, not a DTO flag). Server fn mirrors `selectFinalDateFn` (auth middleware + Bearer token + `{ error }` return). Components call the server fn directly then `navigate({ to: "/events" })` — the codebase does **not** use react-query `useMutation` in components. A confirm step (new shadcn `AlertDialog`) is warranted; all strings must use Lingui; errors via `toast.error()`.

**Blocking sequence**: backend ships the endpoint → build regenerates `Picnivo.API.json` → `pnpm orval` emits `deleteEvent` → frontend `deleteEventFn` can import it.

## Detailed Findings

### Backend — vertical-slice template

Canonical analog for organizer-only mutation on an Event: **`SelectFinalDate`**.

- **Handler signature & JWT `sub` → organizerId** — `backend/Picnivo.API/Features/Events/SelectFinalDate/SelectFinalDate.cs:7-20`: static class, static `Handle` returning `Task<IResult>`; `Guid.TryParse(user.FindFirstValue("sub"), out var organizerId)` → `Results.Unauthorized()` on failure.
- **Token lookup + ownership, 404-before-403 ordering** — `SelectFinalDate.cs:22-40`: project by `e.Token == token` via `Select(...).FirstOrDefaultAsync(ct)`; `if (@event is null) return Results.NotFound();` then `if (@event.OrganizerId != organizerId) return Results.StatusCode(StatusCodes.Status403Forbidden);`.
- **Delete mechanics** — `backend/Picnivo.API/Features/Items/RemoveItem/RemoveItem.cs:48-51`: `db.EventItems.Remove(item); await db.SaveChangesAsync(ct); return Results.NoContent();`. `ReleaseClaim.cs:16-44` shows the double token-scoped 404 guard (event-by-token, then child-belongs-to-event) — the IDOR defense.
- **Endpoint registration** — `IEndpoint.cs` (`void Map(IEndpointRouteBuilder app)`); `EndpointExtensions.cs:7-24` reflects over the assembly and auto-discovers every `IEndpoint`, attaching `ValidationEndpointFilter`. Delete endpoints use `MapDelete(...).RequireAuthorization().Produces(204/403/404)` with no `.Produces<T>()` body (see `RemoveItemEndpoint.cs:8-12`).
- **Validation** — `ValidationEndpointFilter.cs:12-40` resolves `IValidator<T>` from DI per argument; a body-less delete-by-token needs **no validator**.

### Backend — data model & cascade (ground truth)

**Verdict: `db.Events.Remove(event)` + `SaveChangesAsync()` cleanly cascades to ALL children on Postgres. No explicit child removals required.**

Object graph (date options are a *separate* `DateOption` entity, not embedded):
```
Event
 ├─ DateOptions ──────── DateVotes (via DateOptionId)
 ├─ Participants ─┬───── DateVotes (via ParticipantId)
 │                └───── ItemClaims (via ParticipantId)
 └─ Items (EventItem) ── ItemClaims (via EventItemId, 1:1)
```

EF Core `OnDelete` config:
- `EventConfiguration.cs`: Organizer→Event Cascade (`:30`); Event→DateOptions Cascade (`:36`); Event→Items Cascade (`:42`); Event→Participants Cascade (`:48`); Event→ChosenDateOption **NoAction** (`:54`).
- `ParticipantConfiguration.cs`: Participant→Votes Cascade (`:25`); Participant→Claims Cascade (`:31`).
- `DateVoteConfiguration.cs`: DateVote→DateOption Cascade (`:24`).
- `ItemClaimConfiguration.cs`: ItemClaim→EventItem Cascade (`:21`).
- `EventItemConfiguration.cs`: EventItem→AddedByParticipant **SetNull** (`:28`); →OrphanedFromParticipant **SetNull** (`:34`).

DB-level FK constraints (migration ground truth) — all `ReferentialAction.Cascade`:
- `AddParticipantsVotesAndClaims.cs`: `FK_Participants_Events_EventId` (`:61`), `FK_DateVotes_DateOptions_DateOptionId` (`:83`), `FK_DateVotes_Participants_ParticipantId` (`:90`), `FK_ItemClaims_EventItems_EventItemId` (`:116`), `FK_ItemClaims_Participants_ParticipantId` (`:123`); SetNull on `FK_EventItems_Participants_AddedByParticipantId` (`:184`) / `_OrphanedFromParticipantId` (`:193`); `FK_Events_DateOptions_ChosenDateOptionId` has **no `onDelete:` clause** → Postgres default NO ACTION (`:196-202`).
- `AddEventDetailsDateOptionsAndItems.cs`: `FK_DateOptions_Events_EventId` (`:73`), `FK_EventItems_Events_EventId` (`:98`), `FK_Events_Organizers_OrganizerId` (`:134`).

Why the NoAction FK doesn't block: `ChosenDateOptionId` is the Event's *outgoing* ref to a DateOption in the same subtree; both rows are deleted in one statement and Postgres checks NO ACTION at statement end. Provider is Npgsql (`PicnivoDbContextModelSnapshot.cs:6`), which permits multiple cascade paths to the same table.

`PicnivoDbContext.cs:11-21`: DbSets `Events, Organizers, DateOptions, EventItems, Participants, DateVotes, ItemClaims`; `OnModelCreating` only calls `ApplyConfigurationsFromAssembly` — **no global query filter, no SaveChanges override, no soft-delete interceptor** (deletes are hard deletes).

### Backend — tests

Two separate files per action, mirroring `Features/` (per backend lessons: separate handler/endpoint/validator test files, seed own data via DbContext, Arrange-Act-Assert):

- **`DeleteEventHandlerTests.cs`** — plain xUnit; calls static `Handle` directly; uses `UserWith(Guid)` (`new(new ClaimsIdentity([new Claim("sub", id.ToString())]))`) and `AnonymousUser()`; asserts `IResult` subtypes via Shouldly: `ShouldBeOfType<NoContent>()`, `ShouldBeOfType<StatusCodeHttpResult>().StatusCode.ShouldBe(403)`, `ShouldBeOfType<NotFound>()`. Namespace/class clash → alias `using DeleteEventHandler = Picnivo.API.Features.Events.DeleteEvent.DeleteEvent;`. Cases: `Organizer_DeletesEvent` (assert `NoContent` + children gone, proving cascade), `NonOrganizer_ReturnsForbidden`, `UnknownToken_ReturnsNotFound`.
- **`DeleteEventEndpointTests.cs`** — `[Collection("Api")]` + `(ApiFixture fixture)`, real pooled Postgres; `ctx.ApiClient` (unauth → 401) vs `ctx.AuthedApiClient(organizerId)`; errors surface as `ApiException` (`await Should.ThrowAsync<ApiException>(...)` then `ex.StatusCode.ShouldBe(...)`). Cases: `WithoutAuth_Returns401`, `NonOrganizer_Returns403` (assert event still exists), `Organizer_Returns204AndDeletesEvent`, `WithUnknownToken_Returns404`. Client call: `ctx.AuthedApiClient(organizerId).DeleteEventAsync(token)` after the build regenerates the NSwag client.

Reference tests to model on: `SelectFinalDateHandlerTests.cs` / `SelectFinalDateEndpointTests.cs` and `RemoveItemEndpointTests.cs` (`CrossEventItemId_Returns404`).

### Frontend — delete UI

- **Organizer identity**: no `isOrganizer` flag on `EventDetailResponse` (`src/api/picnivo-api.ts:93-105` exposes `organizerId`/`organizerName`). It's computed in the route loader: `src/routes/_app/e/$token.tsx:29` → `const isOrganizer = event ? context.user?.id === event.organizerId : false;`, passed as a prop and already threaded into `event-detail-view.tsx:26` (and onward to `BestHero`/`Haul`).
- **Placement**: `src/features/events/get-event-by-token/components/event-detail-view.tsx` — render `<DeleteEvent token={token} title={event.title} />` gated on `isOrganizer`, in the `<aside>` after `<ShareAside>` (`:231`) as a "danger zone", or in the `EventBand` header. (List view `event-card.tsx:59-64` is a secondary option but its full-card `<Link>` overlay makes control layering fiddly.)
- **Server fn** — mirror `src/features/events/select-final-date/functions.ts:12-33`: `createServerFn({ method: "POST" })` (server fn is always POST/GET RPC even though the backend verb is DELETE) `.middleware([authMiddleware])` `.validator(schema)` `.handler(...)`; read `context.supabase.auth.getSession()`, pass `Authorization: Bearer ${session?.access_token}` to the Orval client, return `{ error: null }` or the unwrapped `err.response?.data?.detail`. Auth middleware: `src/middleware/auth.ts:4-17`.
- **Component wiring** — no react-query `useMutation` in components. Call the server fn directly then invalidate/navigate. Pattern from `best-hero.tsx:38-49`: pending `useState`, `const result = await deleteEventFn(...)`, `if (result.error) toast.error(...)` else navigate. Post-delete: `useNavigate()` → `navigate({ to: "/events" })` (see `auth-panel.tsx:54,83`; route `src/routes/_app/_authenticated/events.tsx`).
- **Confirm dialog** — no `AlertDialog` in `src/components/ui/` yet (only `dialog.tsx`). Existing `removeItem` deletes without confirm (`haul.tsx:146-157`); a delete-event confirm is net-new — add shadcn `AlertDialog` (`pnpm dlx shadcn@latest add alert-dialog`).
- **Toast** — `toast.error()` from `sonner`, never inline error state (project lesson). Fallback: `toast.error(result.error || t\`Something went wrong. Please try again.\`)` (`add-item.tsx:34`, `best-hero.tsx:44`).
- **i18n** — all new strings via Lingui `<Trans>` / `t` macro (`import { Trans, useLingui } from "@lingui/react/macro"`).

### Orval client regeneration

`orval.config.ts`: input `../backend/Picnivo.API/Picnivo.API.json`, output `src/api/picnivo-api.ts`, `client: "react-query"`, mutator `axiosInstance`; script `pnpm orval`. No `deleteEvent` exists yet. After the backend ships the endpoint and regenerates its OpenAPI JSON, `pnpm orval` emits `deleteEvent(token, options?) => axiosInstance<void>({ url: \`/api/events/${token}\`, method: "DELETE" }, options)`, mirroring the existing DELETE `removeItem` (`picnivo-api.ts:784-794`).

## Code References

- `backend/Picnivo.API/Features/Events/SelectFinalDate/SelectFinalDate.cs:7-40` — organizer auth + token lookup + 404/403 ordering (primary handler template)
- `backend/Picnivo.API/Features/Items/RemoveItem/RemoveItem.cs:48-51` — `Remove` + `SaveChangesAsync` + `NoContent` delete mechanics
- `backend/Picnivo.API/Features/Claims/ReleaseClaim/ReleaseClaim.cs:16-44` — token-scoped double 404 IDOR guard
- `backend/Picnivo.API/IEndpoint.cs`, `EndpointExtensions.cs:7-24` — reflection-based endpoint auto-discovery
- `backend/Picnivo.API/Data/Configurations/EventConfiguration.cs:30-54` — Event cascade config (children Cascade; ChosenDateOption NoAction)
- `backend/Picnivo.API/Data/Configurations/{Participant,DateVote,ItemClaim,EventItem}Configuration.cs` — child cascade / SetNull config
- `backend/Picnivo.API/Data/Migrations/AddParticipantsVotesAndClaims.cs:61,83,90,116,123,196-202` — DB FK `onDelete` ground truth
- `backend/Picnivo.API/Data/PicnivoDbContext.cs:11-21` — DbSets; no query filter / SaveChanges override
- `frontend/src/routes/_app/e/$token.tsx:29` — `isOrganizer` computed in loader
- `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx:26,231` — delete-button placement + `isOrganizer` in scope
- `frontend/src/features/events/select-final-date/functions.ts:12-33` — server-fn template (auth middleware + Bearer + `{ error }`)
- `frontend/src/features/events/get-event-by-token/components/best-hero.tsx:38-49` — component mutation-call + toast + invalidate pattern
- `frontend/src/features/events/claim-items/functions.ts:81-107` — `removeItem` DELETE + conditional Bearer analog
- `frontend/orval.config.ts`, `frontend/src/api/picnivo-api.ts:784-794` — Orval config + `removeItem` DELETE shape

## Architecture Insights

- **Body-less delete = no DTO, no validator.** The token is a route param bound by name; the vertical slice is just `DeleteEvent.cs` + `DeleteEventEndpoint.cs` on the backend (no `*Dtos.cs`).
- **Cascade is a data-layer concern, already solved.** The handler stays trivial (load Event, `Remove`, save); correctness of child cleanup lives entirely in the FK config verified above. A handler test asserting children are gone doubles as a regression test that the cascade config never silently changes.
- **Two-boundary error model** (frozen by prior change): 401 (no JWT) / 403 (wrong organizer, existence *not* hidden) / 404 (unknown token). Event is a top-level aggregate, so there's no cross-event child-id IDOR vector here — only the organizer-ownership boundary.
- **Frontend mutation idiom**: server fn returns `{ error }` (never throws to the component); component owns pending state and calls `router.invalidate()` or `navigate(...)`. react-query `useMutation` exports are generated but unused — do not introduce them.
- **Verb mismatch is expected**: TanStack server fns are POST/GET RPC; the *backend* HTTP verb is DELETE. The server fn stays `method: "POST"`.

## Historical Context (from prior changes)

- `context/archive/2026-07-04-testing-authorization-boundaries/plan.md:52-55` — "Two error codes encode two boundaries. Cross-event *entity* id → 404 ...; wrong-organizer → 403; no JWT on a gated endpoint → 401." (research.md:116-144 documents the `SelectFinalDate.Handle` ownership pattern.) These conventions are now frozen; the delete endpoint should reuse them, not invent new ones.
- `context/archive/2026-07-02-participant-voting-and-claims/plan.md:200-243` — established the cascade FK model for Participant/DateVote/EventItem/ItemClaim, explicitly using `OnDelete(NoAction)/SetNull` to avoid Postgres multiple-cascade-path errors. This is why `db.Events.Remove(...)` cascades cleanly today.
- `context/mvp-check-report.md:35,97` — the motivating gap: "Adding e.g. `DELETE /api/events/{token}` (organizer-only, cascades to children) would satisfy the criterion cleanly." Hard delete is the stated approach.
- **No soft-delete / retention constraint**: PRD non-goals (`context/foundation/prd.md:130-135`) and `roadmap.md` never mention data retention, archival, or audit trails for events.

## Test-Plan Alignment

- **Risk #3 (Authorization / IDOR)** — `context/foundation/test-plan.md:32-57` directly covers organizer-only actions accepted from non-organizers. The delete endpoint's 401/403/404 tests fall under this risk and belong in the authorization-boundaries suite, not a new phase.
- **Quality gate (§4/§5)** — unit + integration, local + CI; assert both HTTP status *and* persisted state (deletion + cascade verified via a fresh `DbContext` query). Reference: `RemoveItemEndpointTests.cs` (`CrossEventItemId_Returns404`).

## Related Research

- `context/archive/2026-07-04-testing-authorization-boundaries/research.md` — authorization boundary catalog (401/403/404 across existing endpoints)
- `context/archive/2026-07-02-participant-voting-and-claims/plan.md` — data model + cascade design

## Open Questions

1. **Confirmation UX**: add a new shadcn `AlertDialog` (recommended, since destructive) vs. reuse the existing `Dialog` primitive — a plan/implement decision, not a blocker.
2. **List-view delete**: is a delete control on `event-card.tsx` wanted in addition to the detail view, or detail-view only? (Detail view is the clean primary target; card overlay layering is fiddly.)
3. **Empty-state after deleting the currently-viewed event**: confirmed approach is `navigate({ to: "/events" })` on success — no `router.invalidate()` needed since the list loader refetches on arrival.
</content>
</invoke>

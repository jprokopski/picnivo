# Organizer-only Delete for Event with Cascading Cleanup — Implementation Plan

## Overview

Add `DELETE /api/events/{token}` — organizer-only, hard delete, cascading to all children (Participants, EventItems, DateVotes, ItemClaims, DateOptions) — plus a confirm-gated delete UI in the event detail view. Closes the CRUD gap identified in `context/mvp-check-report.md`: Event has Create/Read/Update but no Delete.

## Current State Analysis

- **Backend has no delete slice for Event.** `Features/Events/` contains Create/Read/Update-style slices (`SelectFinalDate`, etc.) but nothing that removes an Event. The vertical-slice + reflection-based endpoint discovery (`EndpointExtensions.cs:7-24`) means a new slice auto-registers with no edits to `Program.cs`.
- **Cascade is already fully configured** at both EF Core and Postgres-migration level. Every FK transitively pointing into the Event subtree is `ON DELETE CASCADE`; the one NoAction FK (`Event.ChosenDateOptionId`) and two `SetNull` back-refs are inside the subtree and do not block. `db.Events.Remove(event)` + `SaveChangesAsync()` deletes the whole subtree in one statement on Npgsql (which permits multiple cascade paths to the same table). See `EventConfiguration.cs:30-54` and `AddParticipantsVotesAndClaims.cs:61-202`.
- **Authorization model is frozen** by the archived `testing-authorization-boundaries` change: **401** (no JWT) → **403** (wrong organizer, existence not hidden) → **404** (unknown token). Ownership is explicit 403, not disguised as 404. This is Test-Plan Risk #3.
- **No soft-delete infrastructure.** `PicnivoDbContext.cs:11-21` has no global query filter, no `SaveChanges` override, no soft-delete interceptor — deletes are hard. PRD non-goals and roadmap never mention retention/audit for events.
- **Frontend has `isOrganizer` computed in the route loader** (`src/routes/_app/e/$token.tsx:29`) and already threaded as a prop into `event-detail-view.tsx:26`. There is **no `AlertDialog`** in `src/components/ui/` yet (only `dialog.tsx`). The mutation idiom is: server fn returns `{ error }` (never throws), component owns pending state and calls `navigate(...)` — react-query `useMutation` exports exist but are unused.
- **No `deleteEvent` in the Orval client** (`src/api/picnivo-api.ts`). It appears only after the backend ships the endpoint and the build regenerates `Picnivo.API.json`, then `pnpm orval` runs.

## Desired End State

An organizer, viewing an event they own, sees a "danger zone" delete control in the detail view. Activating it opens an `AlertDialog` confirming destruction; confirming issues `DELETE /api/events/{token}`, the backend hard-deletes the Event and all children in one cascade, returns 204, and the organizer is navigated to `/events` showing a fresh list without the deleted event. A non-organizer never sees the control, and a direct API call from a non-organizer is rejected 403; an unauthenticated call is 401; an unknown token is 404.

**Verification**: backend handler + endpoint tests green (204/403/404/401 + cascade-children-gone); `pnpm orval` emits `deleteEvent`; frontend type-check + tests pass; manual: organizer deletes and lands on `/events`, non-organizer sees no control.

### Key Discoveries:

- Handler template: `SelectFinalDate.cs:7-40` (JWT `sub` → organizerId, 404-before-403 ordering).
- Delete mechanics: `RemoveItem.cs:48-51` (`Remove` + `SaveChangesAsync` + `NoContent`).
- Endpoint shape: `RemoveItemEndpoint.cs:8-12` (`MapDelete(...).RequireAuthorization().Produces(204/403/404)`, no `.Produces<T>()` body).
- Body-less delete-by-token → **no DTO, no validator** (token bound from route).
- Server-fn template: `select-final-date/functions.ts:12-33` (auth middleware + Bearer + `{ error }` return); server fn stays `method: "POST"` even though backend verb is DELETE.
- Component mutation pattern: `best-hero.tsx:38-49` (pending `useState`, call fn, `toast.error` on failure, else navigate/invalidate).

## What We're NOT Doing

- **No soft delete, retention, archival, or audit trail** — hard delete only.
- **No list-view (`event-card.tsx`) delete control** — detail view only. Card overlay layering is out of scope.
- **No `EventBand` header delete button** — the control lives in the detail-view danger zone.
- **No explicit child-removal code** — the cascade config handles it; we rely on and regression-test it.
- **No new authorization convention** — reuse the frozen 401/403/404 model.
- **No react-query `useMutation`** in components — call the server fn directly.
- **No new backend authorization-boundary test phase** — the 401/403/404 tests belong to this slice's own test files under the existing Risk #3 umbrella.

## Implementation Approach

Two phases with a hard ordering dependency. Phase 1 ships the backend slice; the .NET build regenerates `Picnivo.API.json` (the OpenAPI contract). Phase 2 begins by running `pnpm orval` to emit the `deleteEvent` client function, then builds the UI on top of it. The backend handler stays trivial (load Event by token, ownership check, `Remove`, save); correctness of child cleanup lives in the already-verified FK config, and a handler test asserting children are gone locks that behavior in.

## Critical Implementation Details

- **Blocking sequence between phases**: the frontend `deleteEventFn` cannot import `deleteEvent` until (a) the backend endpoint is built and (b) `pnpm orval` has regenerated `src/api/picnivo-api.ts`. Phase 2 must start with the orval regen step, not the component code.
- **404-before-403 ordering**: the handler must check "event exists" before "caller owns it" — return 404 for an unknown token, 403 for a known event owned by someone else. Do not collapse the wrong-organizer case into 404. (Frozen convention.)
- **Namespace/class alias in the handler test**: the nested `DeleteEvent.DeleteEvent` class clashes; alias it (`using DeleteEventHandler = Picnivo.API.Features.Events.DeleteEvent.DeleteEvent;`) per the backend "avoid double-name references" lesson.

## Phase 1: Backend — delete endpoint + cascade verification

### Overview

Add the `DeleteEvent` vertical slice (handler + endpoint, no DTO/validator) and its handler + endpoint tests. Building the API regenerates the OpenAPI JSON consumed by Phase 2.

### Changes Required:

#### 1. DeleteEvent handler

**File**: `backend/Picnivo.API/Features/Events/DeleteEvent/DeleteEvent.cs`

**Intent**: Organizer-only mutation that resolves the Event by `Token`, reads `organizerId` from the JWT `sub` claim, enforces ownership, hard-deletes the Event (cascade handles children), and returns 204.

**Contract**: Static class `DeleteEvent` with `static async Task<IResult> Handle(string token, ClaimsPrincipal user, PicnivoDbContext db, CancellationToken ct)`. Flow mirrors `SelectFinalDate.cs:7-40`: `Guid.TryParse(user.FindFirstValue("sub"), out var organizerId)` → `Results.Unauthorized()` on failure; load the Event by `e.Token == token` (materialize the entity for removal, not a projection); `null` → `Results.NotFound()`; `OrganizerId != organizerId` → `Results.StatusCode(StatusCodes.Status403Forbidden)`; else `db.Events.Remove(@event); await db.SaveChangesAsync(ct); return Results.NoContent();`. Braces on all control-flow bodies (backend lesson).

#### 2. DeleteEvent endpoint

**File**: `backend/Picnivo.API/Features/Events/DeleteEvent/DeleteEventEndpoint.cs`

**Intent**: Register the DELETE route and wire it to the handler; auto-discovered by reflection.

**Contract**: Class implementing `IEndpoint` with `void Map(IEndpointRouteBuilder app)`. Modeled on `RemoveItemEndpoint.cs:8-12`: `app.MapDelete("/api/events/{token}", DeleteEvent.Handle).RequireAuthorization().Produces(StatusCodes.Status204NoContent).Produces(StatusCodes.Status403Forbidden).Produces(StatusCodes.Status404NotFound);`. No `.Produces<T>()` body, no validator filter needed.

#### 3. Handler tests

**File**: `backend/Picnivo.Tests/Features/Events/DeleteEvent/DeleteEventHandlerTests.cs`

**Intent**: Prove the handler's authorization branches and that a successful delete cascades children away — the latter doubling as a regression guard on the FK config.

**Contract**: Plain xUnit calling static `Handle` directly, Arrange-Act-Assert, each test seeding its own data via DbContext. Alias `using DeleteEventHandler = Picnivo.API.Features.Events.DeleteEvent.DeleteEvent;`. Helpers `UserWith(Guid)` / `AnonymousUser()` (see `SelectFinalDateHandlerTests.cs`). Cases: `Organizer_DeletesEvent` (assert `ShouldBeOfType<NoContent>()` **and** that Participants/EventItems/DateVotes/ItemClaims/DateOptions for that event are gone via a fresh query — cascade proof); `NonOrganizer_ReturnsForbidden` (`StatusCodeHttpResult.StatusCode.ShouldBe(403)`); `UnknownToken_ReturnsNotFound` (`ShouldBeOfType<NotFound>()`); `Anonymous_ReturnsUnauthorized` (`ShouldBeOfType<UnauthorizedHttpResult>()`).

#### 4. Endpoint tests

**File**: `backend/Picnivo.Tests/Features/Events/DeleteEvent/DeleteEventEndpointTests.cs`

**Intent**: Exercise the full HTTP path over real Postgres, including the auth boundary status codes and persisted-state effects.

**Contract**: `[Collection("Api")]` with `(ApiFixture fixture)`, pooled Postgres. Use `ctx.ApiClient` (unauth) and `ctx.AuthedApiClient(organizerId)`; errors surface as `ApiException` (`await Should.ThrowAsync<ApiException>(...)`, then `ex.StatusCode.ShouldBe(...)`). Cases: `WithoutAuth_Returns401`; `NonOrganizer_Returns403` (assert the event still exists afterward via a fresh DbContext); `Organizer_Returns204AndDeletesEvent`; `WithUnknownToken_Returns404`. Client call: `ctx.AuthedApiClient(organizerId).DeleteEventAsync(token)` (available after the build regenerates the NSwag client). Reference: `RemoveItemEndpointTests.cs` (`CrossEventItemId_Returns404`), `SelectFinalDateEndpointTests.cs`.

### Success Criteria:

#### Automated Verification:

- [ ] Backend builds and regenerates OpenAPI JSON: `dotnet build backend/Picnivo.API`
- [ ] Handler tests pass: `dotnet test backend/Picnivo.Tests --filter DeleteEventHandlerTests`
- [ ] Endpoint tests pass: `dotnet test backend/Picnivo.Tests --filter DeleteEventEndpointTests`
- [ ] Full backend test suite green: `dotnet test backend/Picnivo.Tests`
- [ ] `Picnivo.API.json` contains a `delete` operation under `/api/events/{token}`

#### Manual Verification:

- [ ] Deleting an event via an authed HTTP client (e.g. `.http` file or curl with a valid Bearer) returns 204 and the event + all children are gone from the DB
- [ ] A non-organizer's authed DELETE returns 403 and the event remains
- [ ] An unauthenticated DELETE returns 401

**Implementation Note**: After Phase 1's automated verification passes, pause for manual confirmation before starting Phase 2 — Phase 2 depends on the regenerated OpenAPI contract.

---

## Phase 2: Frontend — delete UI

### Overview

Regenerate the Orval client, add the shadcn `AlertDialog` primitive, build the `DeleteEvent` component and `deleteEventFn` server fn, and wire the control into the detail view's danger zone gated on `isOrganizer`.

### Changes Required:

#### 1. Regenerate Orval client

**File**: `frontend/src/api/picnivo-api.ts` (generated)

**Intent**: Emit the `deleteEvent` client function from the updated OpenAPI JSON so the server fn can import it.

**Contract**: Run `pnpm orval` (from `frontend/`). Expect a generated `deleteEvent(token, options?) => axiosInstance<void>({ url: \`/api/events/${token}\`, method: "DELETE" }, options)`, mirroring the existing `removeItem` (`picnivo-api.ts:784-794`). No hand edits to the generated file.

#### 2. AlertDialog primitive

**File**: `frontend/src/components/ui/alert-dialog.tsx` (new)

**Intent**: Provide the destructive-confirm primitive the delete flow uses.

**Contract**: Add via `pnpm dlx shadcn@latest add alert-dialog`. Filename is kebab-case (frontend lesson) — rename if the generator emits otherwise. Verify Tailwind v4 canonical classes (no arbitrary bracket values) and `cn()` usage after generation.

#### 3. deleteEventFn server fn

**File**: `frontend/src/features/events/delete-event/functions.ts` (new)

**Intent**: Server-side RPC that forwards the authed DELETE to the backend and returns a `{ error }` result the component can branch on.

**Contract**: Mirror `select-final-date/functions.ts:12-33`. `createServerFn({ method: "POST" })` (server fn stays POST even though backend verb is DELETE) `.middleware([authMiddleware])` `.validator(schema)` where schema validates `{ token: string }`; `.handler(...)` reads `context.supabase.auth.getSession()`, calls the Orval `deleteEvent(token, { headers: { Authorization: \`Bearer ${session?.access_token}\` } })`, returns `{ error: null }` on success or `{ error: err.response?.data?.detail ?? null }` on failure. Auth middleware: `src/middleware/auth.ts:4-17`. Feature-folder layout mirrors backend slice (`src/features/events/delete-event/`).

#### 4. DeleteEvent component

**File**: `frontend/src/features/events/delete-event/components/delete-event.tsx` (new)

**Intent**: Render the danger-zone trigger + confirm `AlertDialog`, own pending state, call `deleteEventFn`, and navigate away on success.

**Contract**: `function DeleteEvent({ token, title }: { token: string; title: string })`. Uses `AlertDialog` for the destructive confirm; pending `useState`; on confirm `const result = await deleteEventFn({ data: { token } })`; `if (result.error) toast.error(result.error || t\`Something went wrong. Please try again.\`)` else `navigate({ to: "/events" })` via `useNavigate()`. All strings via Lingui (`<Trans>` / `t` from `@lingui/react/macro`); errors via `toast.error()` from sonner (never inline). Model pending/toast/navigate flow on `best-hero.tsx:38-49` and `auth-panel.tsx:54,83`.

#### 5. Wire into detail view

**File**: `frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx`

**Intent**: Render the delete control in the danger zone, visible only to the organizer.

**Contract**: In the `<aside>` after `<ShareAside>` (`:231`), render `{isOrganizer && <DeleteEvent token={token} title={event.title} />}`. `isOrganizer` is already in scope (`:26`). No new prop threading required.

### Success Criteria:

#### Automated Verification:

- [ ] Orval regen succeeds and `deleteEvent` exists: `pnpm orval`
- [ ] Type-check passes: `pnpm typecheck` (frontend)
- [ ] Lint passes: `pnpm lint` (frontend)
- [ ] Lingui extraction finds new strings with no untranslated bare literals: `pnpm lingui extract`
- [ ] Frontend tests pass: `pnpm test`

#### Manual Verification:

- [ ] As the organizer, the danger-zone delete control is visible in the detail view; as a non-organizer it is absent
- [ ] Clicking delete opens the `AlertDialog` confirm; cancelling leaves the event intact
- [ ] Confirming deletes the event and navigates to `/events`, where the list no longer shows it
- [ ] A simulated failure surfaces via `toast.error`, not inline text
- [ ] Deleting while viewing an event you don't own is not possible from the UI (control hidden)

**Implementation Note**: After Phase 2's automated verification passes, pause for manual confirmation of the full delete flow before closing the change.

---

## Testing Strategy

### Unit Tests:

- Handler authorization branches: 204 (organizer), 403 (non-organizer), 404 (unknown token), 401 (anonymous).
- Cascade regression: after a successful delete, Participants / EventItems / DateVotes / ItemClaims / DateOptions for that event are gone (fresh query).

### Integration Tests:

- Full HTTP path over pooled Postgres via NSwag client: 401 / 403 (event survives) / 204 (event + children gone) / 404.

### Manual Testing Steps:

1. As organizer, open an owned event with participants/votes/items, delete it, confirm, land on `/events` — event absent.
2. As a different authed user, confirm no delete control appears; via direct API call confirm 403 and the event survives.
3. Unauthenticated DELETE → 401.
4. Trigger a failure path and confirm the error appears as a toast.

## Performance Considerations

Single-statement cascade delete; no N+1 or bulk concern at MVP scale. No projection needed on the delete path (entity is materialized only to be removed).

## Migration Notes

No schema change — the cascade FKs already exist. No data migration.

## References

- Research: `context/changes/delete-event/research.md`
- Handler template: `backend/Picnivo.API/Features/Events/SelectFinalDate/SelectFinalDate.cs:7-40`
- Delete mechanics: `backend/Picnivo.API/Features/Items/RemoveItem/RemoveItem.cs:48-51`
- Endpoint shape: `backend/Picnivo.API/Features/Items/RemoveItem/RemoveItemEndpoint.cs:8-12`
- Cascade config: `backend/Picnivo.API/Data/Configurations/EventConfiguration.cs:30-54`
- Server-fn template: `frontend/src/features/events/select-final-date/functions.ts:12-33`
- Component pattern: `frontend/src/features/events/get-event-by-token/components/best-hero.tsx:38-49`
- Orval `removeItem` DELETE shape: `frontend/src/api/picnivo-api.ts:784-794`
- Motivating gap: `context/mvp-check-report.md:35,97`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — delete endpoint + cascade verification

#### Automated

- [x] 1.1 Backend builds and regenerates OpenAPI JSON: `dotnet build backend/Picnivo.API`
- [x] 1.2 Handler tests pass: `dotnet test backend/Picnivo.Tests --filter DeleteEventHandlerTests`
- [x] 1.3 Endpoint tests pass: `dotnet test backend/Picnivo.Tests --filter DeleteEventEndpointTests`
- [x] 1.4 Full backend test suite green: `dotnet test backend/Picnivo.Tests`
- [x] 1.5 `Picnivo.API.json` contains a `delete` operation under `/api/events/{token}`

#### Manual

- [x] 1.6 Authed DELETE returns 204 and event + children are gone from the DB
- [x] 1.7 Non-organizer authed DELETE returns 403 and the event remains
- [x] 1.8 Unauthenticated DELETE returns 401

### Phase 2: Frontend — delete UI

#### Automated

- [ ] 2.1 Orval regen succeeds and `deleteEvent` exists: `pnpm orval`
- [ ] 2.2 Type-check passes: `pnpm typecheck`
- [ ] 2.3 Lint passes: `pnpm lint`
- [ ] 2.4 Lingui extraction finds new strings, no untranslated bare literals: `pnpm lingui extract`
- [ ] 2.5 Frontend tests pass: `pnpm test`

#### Manual

- [ ] 2.6 Danger-zone delete control visible to organizer, absent for non-organizer
- [ ] 2.7 AlertDialog confirm opens; cancel leaves event intact
- [ ] 2.8 Confirm deletes event and navigates to `/events` with the event removed from the list
- [ ] 2.9 Simulated failure surfaces via `toast.error`, not inline text
- [ ] 2.10 Delete not possible from UI for non-owned event (control hidden)

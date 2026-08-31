# Live Voting & Item Claiming via Server-Sent Events Implementation Plan

## Overview

Make the event page update **live** as votes, claims, attendance, items, and the final-date
selection change — so no watcher (especially the organizer) ever acts on stale data. A single
long-lived SSE connection per watcher carries a lightweight "changed" signal stamped with a
monotonic revision; the client refetches the full event through its existing loader. A
confirm-if-changed guard on the organizer's lock action closes the sub-second race that live
updates alone can't.

This pulls PRD **FR-010** ("updates on page load are sufficient for MVP … Real-time is v2")
forward, using SSE instead of WebSockets (one-directional, lighter, native in .NET 10).

## Current State Analysis

- **Event page is an SSR route loader, not a live subscription.** `frontend/src/routes/_app/e/$token.tsx`
  loads via `getEventByTokenFn` → backend `GET /api/events/{token}`. Mutations call a server
  function then `router.invalidate()` to re-run the loader (`haul.tsx:142`, `best-hero.tsx:46`,
  vote flow). There is no push channel — the "stale best date" bug is the direct consequence.
- **"Best date" is computed server-side**, inline in `GetEventByToken.cs:77-82` (most Yes → fewest
  No → earliest `StartsAt`). It is **not** stored, so any live path must flow through the read
  model — favoring signal-and-refetch over pushing DB rows.
- **The `you` projection is per-participant** (`GetEventByToken.cs:84-97`), so a broadcast stream
  cannot carry it — another reason the refetch (which runs through each client's own cookie'd
  loader) is the right shape.
- **Backend is SSE-ready.** .NET 10 minimal API; `System.Net.ServerSentEvents` is already on the
  dependency graph; `TypedResults.ServerSentEvents(IAsyncEnumerable<SseItem<T>>, eventType)` is the
  native API, with `SseItem<T>` carrying an optional event **id** (our revision). Endpoints
  auto-discover via `IEndpoint` reflection (`EndpointExtensions.cs`).
- **All mutation handlers end in `SaveChangesAsync`** — clean publish points: `CastVotes`,
  `ClaimItem`, `ReleaseClaim`, `AddItem`, `RemoveItem`, `SetAttendance`, `SelectFinalDate`,
  `JoinEvent`.
- **Browser can reach the backend directly.** `VITE_API_URL` is client-exposed (`env.ts`,
  `axios-instance.ts`), so `EventSource` can connect to `${VITE_API_URL}/api/events/{token}/stream`,
  bypassing the CF Worker (which must not hold long-lived streams). CORS already allows the
  frontend origin with credentials (`Program.cs`).
- **Fly.io runs scale-to-zero** (`auto_stop_machines = "stop"`, `min_machines_running = 0`, one
  `shared-cpu-1x` VM). A held SSE request keeps the machine awake; when all watchers leave, it
  sleeps. In-process fan-out is the natural fit but is **single-instance only**, and the machine
  can restart between sessions — the revision counter must survive that.
- **The organizer locks the best date** via the `BestHero` "Lock in this date" button
  (`best-hero.tsx:103-110`), which sends `heroDate.id` = `chosenDateOptionId ?? bestDateOptionId`.
  `SelectFinalDate.cs` currently just writes `ChosenDateOptionId` with no staleness check.

### Key Discoveries

- Signal-and-refetch reuses **all** existing read-model logic untouched — zero divergence risk.
- The revision must be **monotonic across machine restarts** (scale-to-zero), so seed each token's
  counter from `UnixTimeMilliseconds` rather than starting at 0.
- Best-date ranking must be **extracted to a shared domain helper** (alongside
  `Event.ResolveEffectiveChosenDateOptionId`) so `GetEventByToken` and the new `SelectFinalDate`
  guard rank identically.
- Publishing is **explicit per handler** (8 one-line calls), not a `SaveChanges` interceptor —
  resolving the affected event id from arbitrary changed child entities (DateVote, ItemClaim, …)
  is fragile and un-vertical-slice; explicit calls are clearer and testable.

## Desired End State

Two people open the same event. One votes / claims / adds an item / RSVPs / locks the date; within
~2 seconds the other's page reflects it with a seamless in-place re-render — no manual refresh. When
the organizer clicks "Lock in this date" on a leader that shifted since their page loaded, they get a
confirm dialog naming the new leader instead of silently locking the stale one. If the stream can't
connect (blocked proxy, `Streaming:Enabled=false`), the page behaves exactly as it does today.

**Verification:** open the event in two browsers; mutate in one; observe the other update without
interaction. Toggle `Streaming:Enabled=false`; confirm the page still works on own-action refresh.
Force a stale lock (vote from a 2nd browser after the organizer's page rendered, without letting it
update) and confirm the guard prompts.

## What We're NOT Doing

- **No WebSockets, no Supabase Realtime** — SSE only, per the request; the browser never talks to the
  DB directly.
- **No full-snapshot or delta push** over SSE — only a revision signal; clients refetch.
- **No multi-instance fan-out** (no Postgres LISTEN/NOTIFY, no Redis). Single-instance in-memory
  broker; the scaling limit is documented, not solved.
- **No polling fallback** — graceful degrade to today's on-action refresh is the only fallback.
- **No hard optimistic-concurrency lock** on `SelectFinalDate` — a confirm prompt, not a hard reject.
- **No Playwright SSE E2E** — the streaming path is verified manually; CI covers broker, handler
  publishes, and the hook.
- **No new actor/name data in the stream** — the signal is anonymous ("something changed"); no
  "Maya voted" toasts.

## Implementation Approach

The backend gains an in-process **broker** and a public **SSE endpoint**; every mutation handler
publishes a revision bump for its token after saving. The frontend gains a **hook** that opens an
`EventSource`, gates on the revision, and debounces `router.invalidate()`. The read model returns the
current revision so a client that just mutated has a precise baseline and won't double-refetch on its
own echo. Finally, the organizer's lock action carries the date it intends to lock; the backend
compares it to the freshly-ranked best date and returns `409 + currentBestDateOptionId` when they
differ, driving a confirm dialog.

Everything is gated by `Streaming:Enabled` (default `true`); the client treats any failed/closed
stream as the graceful-degrade case, so the feature is a pure enhancement over existing behavior.

## Critical Implementation Details

- **Revision monotonicity across restarts.** The broker keeps a per-token `long` counter seeded to
  `DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()` the first time a token is touched, then
  `Interlocked.Increment`ed on each publish. This guarantees a post-restart revision exceeds any
  pre-restart one (clock-forward), so a client that reconnects after the machine slept never
  wrongly discards new signals as "stale". Within a single connection the counter is trivially
  monotonic (a restart drops the connection). Client also refetches once on every (re)connect, so
  cross-restart correctness never depends on the counter alone.
- **Connection lifecycle & heartbeat.** The endpoint streams until `HttpContext.RequestAborted`
  fires (client disconnect), then unsubscribes; a token whose last subscriber leaves has its slot
  removed to avoid leaks. Interleave a heartbeat SSE comment/event every ~20s so Fly's proxy does
  not close the idle connection (its idle window is ~60s).
- **Self-echo dedup.** A client's own mutation runs `router.invalidate()`, and the loader returns the
  now-current `revision`; the echoed SSE signal carries the same (or equal) revision and is skipped
  by the `> lastApplied` gate. A short (~300ms) debounce on refetch further coalesces bursts.

## Phase 1: Backend — Streaming Core (broker + SSE endpoint + toggle)

### Overview

Stand up the fan-out infrastructure and the public stream endpoint, testable in isolation via a
manual publish — no mutation wiring yet.

### Changes Required

#### 1. In-process broker

**File**: `backend/Picnivo.API/Features/Streaming/EventStreamBroker.cs` (+ `IEventStreamBroker.cs`)

**Intent**: A singleton pub/sub keyed by event token that lets the SSE endpoint subscribe to change
signals and lets mutation handlers publish them, tracking a monotonic per-token revision.

**Contract**: `IEventStreamBroker` with:
- `long Publish(string token)` — increments the token's revision and pushes it to all current
  subscribers; returns the new revision.
- `IAsyncEnumerable<long> Subscribe(string token, CancellationToken ct)` — yields revisions until
  `ct` fires; removes the subscriber (and the token slot if now empty) on completion.
- `long CurrentRevision(string token)` — current revision without publishing (for the read model).

Backed by a `ConcurrentDictionary<string, TokenChannel>`; each subscriber gets its own
`System.Threading.Channels.Channel<long>` (bounded, `FullMode = DropOldest` — a lagging client only
needs the latest revision). Per-token counter seeded from `UnixTimeMilliseconds` (see Critical
Implementation Details), advanced with `Interlocked.Increment`.

#### 2. SSE endpoint

**File**: `backend/Picnivo.API/Features/Streaming/StreamEvent/StreamEvent.cs` + `StreamEventEndpoint.cs`

**Intent**: Public endpoint that streams change signals for a token to a browser `EventSource`,
plus periodic heartbeats, until the client disconnects.

**Contract**: `GET /api/events/{token}/stream`, `Content-Type: text/event-stream`. Returns 404 if the
token doesn't exist and 404 (or immediate close) when `Streaming:Enabled` is false. Implemented with
`TypedResults.ServerSentEvents(stream, eventType: "changed")` where `stream` is an
`IAsyncEnumerable<SseItem<long>>` merging `broker.Subscribe(token, ct)` (data = revision, `SseItem.EventId`
= revision) with a ~20s heartbeat. On connect, emit the current revision once so the client has an
immediate baseline. No auth — the token in the URL is the access grant (consistent with the public
`GetEventByToken`). `ct` = `HttpContext.RequestAborted`.

#### 3. Config toggle + DI registration

**File**: `backend/Picnivo.API/Program.cs`, `appsettings.json`

**Intent**: Register the broker as a singleton and expose the kill switch.

**Contract**: `builder.Services.AddSingleton<IEventStreamBroker, EventStreamBroker>();`. Add
`"Streaming": { "Enabled": true }` to `appsettings.json`; overridable in production via
`Streaming__Enabled=false` (Fly secret/env). The endpoint reads `IConfiguration`/an options type to
gate.

#### 4. Tests

**File**: `backend/Picnivo.Tests/Features/Streaming/EventStreamBrokerTests.cs`,
`backend/Picnivo.Tests/Features/Streaming/StreamEvent/StreamEventEndpointTests.cs`

**Intent**: Prove the broker's subscribe/publish/cleanup/revision semantics and that the endpoint
streams a signal end-to-end.

**Contract**: Broker unit tests — a subscriber receives a published revision; revisions strictly
increase; a second token is isolated; an unsubscribed/cancelled subscriber is removed. Endpoint
integration test — connect, `broker.Publish` (or trigger via test hook), assert a `changed` event
arrives within a timeout; assert 404 for an unknown token; assert closed/404 when disabled. (Separate
files per the backend "separate test files per handler/endpoint" lesson.)

### Success Criteria

#### Automated Verification

- [ ] Backend builds: `dotnet build` (from `Picnivo.API/`)
- [ ] Broker + endpoint tests pass: `dotnet test` (from `backend/`)
- [ ] OpenAPI spec regenerates without error (build step)

#### Manual Verification

- [ ] `curl -N ${API}/api/events/{token}/stream` holds the connection, emits an initial revision and
      periodic heartbeats, and emits a `changed` event when a manual publish is triggered
- [ ] Setting `Streaming__Enabled=false` makes the endpoint return 404 / close immediately
- [ ] Disconnecting the curl client frees the subscriber (no leak under repeated connect/disconnect)

**Implementation Note**: After automated verification passes, pause for manual confirmation before
Phase 2.

---

## Phase 2: Backend — Wire Mutations & Expose Revision

### Overview

Make every state-changing handler publish, and surface the current revision in the read model so
clients get a precise baseline.

### Changes Required

#### 1. Publish after save in all mutation handlers

**File**: `CastVotes.cs`, `ClaimItem.cs`, `ReleaseClaim.cs`, `AddItem.cs`, `RemoveItem.cs`,
`SetAttendance.cs`, `SelectFinalDate.cs`, `JoinEvent.cs` (their `Features/**/<Action>.cs`)

**Intent**: Signal watchers whenever shared event state changes.

**Contract**: Inject `IEventStreamBroker` into each `Handle` (minimal-API DI parameter) and call
`broker.Publish(token)` immediately after the successful `SaveChangesAsync`. Publish only on success
paths (not on early `NotFound`/`BadRequest`/`Forbidden` returns). For `CastVotes`, publish once after
the final save (including the unique-constraint retry branch).

#### 2. Revision in the read model

**File**: `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs` +
`GetEventByTokenDtos.cs`

**Intent**: Give the client the current revision alongside event data so it can set `lastApplied`
exactly after any (re)fetch, including self-triggered ones.

**Contract**: Add `long Revision` to `EventDetailResponse` (last field). Populate from
`broker.CurrentRevision(token)` (inject the broker into the handler). No other read-model changes.

#### 3. Tests

**File**: mirror under `backend/Picnivo.Tests/Features/**/<Action>/` and
`.../Events/GetEventByToken/`

**Intent**: Guard that handlers publish and the read model exposes revision.

**Contract**: For a representative set of handlers (at minimum `CastVotes`, `ClaimItem`,
`SelectFinalDate`), assert `Publish` is invoked once on the success path (fake/spy `IEventStreamBroker`)
and not on a rejected request. `GetEventByToken` test asserts the response carries the broker's current
revision.

### Success Criteria

#### Automated Verification

- [ ] Backend builds: `dotnet build`
- [ ] Handler-publish + read-model tests pass: `dotnet test`
- [ ] Regenerated OpenAPI spec includes `revision` on the event response

#### Manual Verification

- [ ] With one `curl -N` stream open, performing each action type (vote, claim, release, add item,
      remove item, set attendance, join, select date) emits a `changed` event with a higher revision
- [ ] `GET /api/events/{token}` returns a `revision` that matches the latest streamed id

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Frontend — Live Subscription

### Overview

Subscribe the event page to the stream and refetch on new revisions, with graceful degradation and
no refetch storms.

### Changes Required

#### 1. Regenerate the typed client

**File**: `frontend/src/api/picnivo-api.ts` (generated)

**Intent**: Pick up `revision` on `EventDetailResponse` from the Phase 2 spec change.

**Contract**: Run `pnpm orval`. `EventDetailResponse` type now includes `revision: number`. Do not
hand-edit the generated file.

#### 2. Live-subscription hook

**File**: `frontend/src/features/events/get-event-by-token/use-event-stream.ts` (+ co-located
`use-event-stream.test.ts`)

**Intent**: Open an `EventSource` to the backend stream and refetch the loader when a newer revision
arrives, deduping self-echoes and recovering after reconnects.

**Contract**: `useEventStream(token: string, revision: number): void`.
- Opens `new EventSource(`${env.VITE_API_URL}/api/events/${token}/stream`)` in an effect keyed by
  `token`; closes it on unmount.
- Tracks `lastApplied` in a ref, initialized from `revision` and updated whenever the loader's
  `revision` prop changes (so a self-triggered `router.invalidate()` advances the baseline).
- On a `changed` message: parse the revision from the SSE id/data; if `> lastApplied`, schedule a
  **debounced** (~300ms) `router.invalidate()`.
- On `open` (initial connect and each auto-reconnect): run one `router.invalidate()` to catch up on
  anything missed while disconnected.
- On `error`: do nothing beyond letting `EventSource` auto-retry — a permanently blocked/disabled
  stream simply never fires, and the page keeps working on own-action refreshes (graceful degrade).

Runs browser-only (guard for SSR: no `EventSource` on the server; the effect is client-side by
nature, but ensure no module-scope `EventSource` access).

#### 3. Thread revision + mount the hook

**File**: `frontend/src/routes/_app/e/$token.tsx`,
`frontend/src/features/events/get-event-by-token/components/event-detail-view.tsx`

**Intent**: Pass the revision from loader data to the view and activate the subscription.

**Contract**: The loader already returns `event`; expose `event.revision` to `EventDetailView`
(via existing props) and call `useEventStream(token, event.revision)` there (or in the route
component). No layout/markup changes — updates arrive through the existing `router.invalidate()` →
loader → re-render path, which already has the fade animation.

#### 4. Tests

**File**: `use-event-stream.test.ts`

**Intent**: Lock in the gating and resilience behavior.

**Contract**: With a mocked `EventSource` and a spied `router.invalidate`: a newer revision triggers a
(debounced) invalidate; an equal/older revision does not; `open` triggers a catch-up invalidate;
unmount closes the source. (Vitest + Testing Library, per frontend conventions.)

### Success Criteria

#### Automated Verification

- [ ] Type check passes: `pnpm exec tsc --noEmit`
- [ ] Lint passes: `pnpm lint`
- [ ] Unit tests pass: `pnpm test`
- [ ] Generated client contains `revision` (post-`pnpm orval`)

#### Manual Verification

- [ ] Two browsers on the same event: a vote/claim/add-item/RSVP in one appears in the other within
      ~2s with no manual refresh
- [ ] The acting user's own page does not double-refetch (single update, no flicker) on their own action
- [ ] Killing the backend / setting `Streaming__Enabled=false` leaves the page fully usable on
      own-action refresh (graceful degrade); restoring it resumes live updates on reconnect
- [ ] Backgrounding then re-focusing a tab (reconnect) refetches once and shows current state

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Stale-Lock Confirm Guard (backend + frontend)

### Overview

Prevent the organizer from silently locking a best date that shifted since their page loaded — the
original trigger — by confirming when the leader moved.

### Changes Required

#### 1. Extract best-date ranking to a shared domain helper

**File**: `backend/Picnivo.API/Data/Models/Event.cs`; refactor
`backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs`

**Intent**: One authoritative ranking used by both the read model and the lock guard, so they never
disagree.

**Contract**: Add a static pure helper on `Event` (beside `ResolveEffectiveChosenDateOptionId`) that
ranks date options by most Yes → fewest No → earliest `StartsAt` and returns the best `Guid?`. Refactor
`GetEventByToken` to call it (no behavior change — same ordering as `GetEventByToken.cs:77-82`).

#### 2. `SelectFinalDate` staleness check

**File**: `backend/Picnivo.API/Features/Events/SelectFinalDate/SelectFinalDate.cs` +
`SelectFinalDateDtos.cs` + `SelectFinalDateEndpoint.cs`

**Intent**: Reject a stale lock unless the organizer explicitly forces it.

**Contract**: Add `bool Force` to `SelectFinalDateRequest` (default `false`). When `req.DateOptionId`
is set and `!req.Force`, load the date options + votes, compute the current best via the shared helper,
and if `req.DateOptionId != currentBest`, return `409 Conflict` with a small body
`{ currentBestDateOptionId }`. Otherwise proceed as today. Add `.Produces(StatusCodes.Status409Conflict)`
to the endpoint. (Guard applies only to picking a concrete date, not to clearing it with `null`.)

#### 3. Frontend confirm flow

**File**: `frontend/src/features/events/select-final-date/functions.ts`;
`frontend/src/features/events/get-event-by-token/components/best-hero.tsx` (+ confirm dialog);
regenerate `picnivo-api.ts`

**Intent**: Surface the shifted-leader case as a confirm dialog and resend with force on confirm.

**Contract**: `selectFinalDateFn` maps a 409 to a distinct result (e.g. `{ changed: true,
currentBestDateOptionId }`) rather than a generic error. `pnpm orval` picks up `force` + the 409 shape.
In `best-hero.tsx`, `handleLock` first calls without force; on a `changed` result, open a confirm
dialog ("The leading date changed since you loaded — lock <clicked date> anyway?") using the existing
dialog/confirm pattern (cf. `confirm-claim.tsx`); on confirm, resend with `force: true` then
`router.invalidate()`. Because live updates already refresh the hero, the new leader is typically
visible before the click — the guard catches the sub-second race. All copy via Lingui `<Trans>`/`t`.

#### 4. Tests

**File**: `backend/Picnivo.Tests/Features/Events/SelectFinalDate/SelectFinalDateHandlerTests.cs`
(+ ranking helper test); `best-hero.test.tsx`

**Intent**: Cover the guard's branches and the confirm UX.

**Contract**: Handler — locking the current best returns 204; locking a now-stale date without force
returns 409 with `currentBestDateOptionId`; the same with `force: true` returns 204; clearing with
`null` is unaffected. Ranking helper — unit tests for Yes/No/earliest tie-breaks (mirrors former
inline logic). `best-hero` — a `changed` result opens the dialog; confirming resends with force.

### Success Criteria

#### Automated Verification

- [ ] Backend builds and tests pass: `dotnet build` && `dotnet test`
- [ ] Frontend type/lint/tests pass: `pnpm exec tsc --noEmit` && `pnpm lint` && `pnpm test`
- [ ] `GetEventByToken` behavior unchanged by the ranking extraction (existing read-model tests green)

#### Manual Verification

- [ ] Organizer loads the page; a 2nd browser votes to flip the leader; without letting the organizer
      page update, clicking "Lock in this date" shows the confirm dialog naming the new leader
- [ ] Confirming locks the originally-clicked date; the page reflects the lock live in both browsers
- [ ] Locking when the leader has not moved locks immediately with no dialog (no false alarm)

**Implementation Note**: Final phase — confirm the full two-browser live experience end to end.

---

## Testing Strategy

### Unit Tests

- Broker: subscribe receives publishes; revisions strictly increase and are per-token isolated;
  subscriber cleanup on cancel; revision seed is time-based (monotonic across a simulated reset).
- Ranking helper: Yes-count ordering, No-count tie-break, earliest-`StartsAt` tie-break.
- Frontend hook: revision gating (newer refetches, equal/older doesn't), debounce coalescing,
  reconnect catch-up, unmount cleanup.

### Integration Tests

- Stream endpoint: connect → publish → receive `changed`; unknown token → 404; disabled → 404/close.
- Mutation handlers: publish once on success, not on rejection (spied broker).
- `SelectFinalDate`: stale → 409, force → 204, still-best → 204, clear(null) → 204.

### Manual Testing Steps

1. Two browsers on one event; vote/claim/add/RSVP/join/lock in one; confirm the other updates ≤2s.
2. Confirm the acting browser shows a single update (no double-refetch flicker).
3. Toggle `Streaming__Enabled=false`; confirm graceful degrade; re-enable; confirm reconnect resumes.
4. Reproduce the stale-lock race; confirm the guard dialog; confirm no false alarm when unchanged.
5. Repeated connect/disconnect (reload loop) to watch for subscriber leaks in backend logs.

## Performance Considerations

- Signal-and-refetch adds one `GET /api/events/{token}` per applied change per watcher — trivial at
  MVP scale (small groups, low QPS). Debounce + revision gating prevent bursts from stacking refetches.
- Held SSE connections count against Fly's `http_service.concurrency` (`soft_limit = 200`) — far above
  realistic friend-group watcher counts. Heartbeats (~20s) are negligible traffic.
- Bounded per-subscriber channel with `DropOldest` means a slow client never blocks publishers; it
  just gets the latest revision, which is all it needs.

## Migration Notes

- Adding `revision` to `EventDetailResponse` and `force`/409 to `SelectFinalDate` are additive spec
  changes; regenerate the orval client (`pnpm orval`) after the backend build updates
  `Picnivo.API.json`. No DB migration — nothing new is persisted.
- **Scaling limit (documented, not solved):** the in-memory broker is single-instance. If Fly ever
  runs >1 machine, watchers on machine A won't see mutations handled by machine B. Revisit with
  Postgres LISTEN/NOTIFY or Redis pub/sub before horizontal scaling. Keep `min_machines_running` such
  that a single instance serves all stream + mutation traffic while this holds.

## References

- Change identity: `context/changes/live-event-updates-sse/change.md`
- PRD FR-010 (real-time deferral being pulled forward): `context/foundation/prd.md:96-97`
- Best-date ranking (to extract): `backend/Picnivo.API/Features/Events/GetEventByToken/GetEventByToken.cs:77-82`
- Existing invalidate pattern: `frontend/src/features/events/claim-items/components/haul.tsx:142`
- Lock action: `frontend/src/features/events/get-event-by-token/components/best-hero.tsx:38-49`
- .NET 10 SSE: `TypedResults.ServerSentEvents(IAsyncEnumerable<SseItem<T>>, eventType)` (verified via
  Context7 / dotnet aspnetcore.docs)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend — Streaming Core

#### Automated

- [x] 1.1 Backend builds: `dotnet build` — 3741fad
- [x] 1.2 Broker + endpoint tests pass: `dotnet test` — 3741fad
- [x] 1.3 OpenAPI spec regenerates without error — 3741fad

#### Manual

- [x] 1.4 `curl -N` holds connection, emits initial revision + heartbeats + `changed` on manual publish — 3741fad
- [x] 1.5 `Streaming__Enabled=false` returns 404 / immediate close — 3741fad
- [x] 1.6 Client disconnect frees the subscriber (no leak under connect/disconnect loop) — 3741fad

### Phase 2: Backend — Wire Mutations & Expose Revision

#### Automated

- [x] 2.1 Backend builds: `dotnet build` — 5d09542
- [x] 2.2 Handler-publish + read-model tests pass: `dotnet test` — 5d09542
- [x] 2.3 Regenerated OpenAPI spec includes `revision` on the event response — 5d09542

#### Manual

- [x] 2.4 Each action type emits a `changed` event with a higher revision on an open stream — 5d09542
- [x] 2.5 `GET /api/events/{token}` returns a `revision` matching the latest streamed id — 5d09542

### Phase 3: Frontend — Live Subscription

#### Automated

- [x] 3.1 Type check passes: `pnpm exec tsc --noEmit` — 4133603
- [x] 3.2 Lint passes: `pnpm lint` — 4133603
- [x] 3.3 Unit tests pass: `pnpm test` — 4133603
- [x] 3.4 Generated client contains `revision` (post-`pnpm orval`) — 4133603

#### Manual

- [x] 3.5 Two browsers: mutation in one appears in the other within ~2s, no manual refresh — 4133603
- [x] 3.6 Acting user's own page does not double-refetch (single update, no flicker) — 4133603
- [x] 3.7 Backend down / disabled → page usable on own-action refresh; reconnect resumes live — 4133603
- [x] 3.8 Tab reconnect refetches once and shows current state — 4133603

### Phase 4: Stale-Lock Confirm Guard

#### Automated

- [x] 4.1 Backend builds and tests pass: `dotnet build` && `dotnet test` — 43a8320
- [x] 4.2 Frontend type/lint/tests pass: `tsc --noEmit` && `pnpm lint` && `pnpm test` — 43a8320
- [x] 4.3 `GetEventByToken` behavior unchanged by ranking extraction (existing tests green) — 43a8320

#### Manual

- [ ] 4.4 Flipping the leader from a 2nd browser makes the organizer's lock show the confirm dialog
- [ ] 4.5 Confirming locks the clicked date; both browsers reflect the lock live
- [ ] 4.6 Locking an unchanged leader locks immediately with no dialog (no false alarm)

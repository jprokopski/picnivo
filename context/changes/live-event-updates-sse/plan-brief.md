# Live Voting & Item Claiming via Server-Sent Events — Plan Brief

> Full plan: `context/changes/live-event-updates-sse/plan.md`

## What & Why

Make the event page update live as votes, claims, attendance, items, and the final-date pick change,
so no watcher acts on stale data. Trigger: an organizer picked the "best date" on screen, but a vote
had landed since their last page load — the leading date had actually shifted, and they locked a stale
choice. Same staleness hits item claiming. Uses **Server-Sent Events** (lighter than WebSockets),
pulling PRD FR-010's deferred "real-time is v2" forward.

## Starting Point

The event page is an SSR **route loader** (not a live subscription): it fetches
`GET /api/events/{token}` and re-runs via `router.invalidate()` only after the user's own action. The
"best date" is computed server-side in `GetEventByToken`; the per-participant `you` view is
request-specific. Backend is .NET 10 (native SSE available); browser can reach the backend directly via
the client-exposed `VITE_API_URL`. Fly runs a single scale-to-zero VM.

## Desired End State

Two people on the same event see each other's votes/claims/RSVPs/items/lock reflected within ~2s via a
seamless in-place re-render — no manual refresh. When an organizer tries to lock a leader that shifted
since load, they get a confirm dialog instead of silently locking stale. If the stream can't connect
(blocked proxy or `Streaming:Enabled=false`), the page behaves exactly as today.

## Key Decisions Made

| Decision              | Choice                                                    | Why                                                                 | Source |
| --------------------- | --------------------------------------------------------- | ------------------------------------------------------------------- | ------ |
| Fan-out mechanism     | In-process broker (in-memory, per-token)                  | Zero new infra; fits single Fly VM. Single-instance limit documented | Plan  |
| SSE payload           | Lightweight "changed" signal + revision → client refetch  | Reuses server best-date + per-participant `you`; no divergence risk  | Plan  |
| Broadcast scope       | All state-changing actions                                | Consistent live page; same one-line publish per handler             | Plan  |
| Live UX               | Seamless silent re-render                                 | Zero friction; matches today's post-action refresh                  | Plan  |
| Sync / dedup          | Revision-gated + refetch on (re)connect                   | No double-refetch on own action; reconnect catches missed changes   | Plan  |
| Fallback              | Graceful degrade to today's behavior (no polling)         | Live is a pure enhancement; no new failure modes                    | Plan  |
| Lock guard            | Confirm-if-changed on `SelectFinalDate` (409 + new best)  | Closes the sub-second race live updates alone can't                 | Plan  |
| Rollout               | `Streaming:Enabled` config toggle                         | One-setting kill switch given scale-to-zero/proxy unknowns          | Plan  |
| Testing               | Broker + handler-publish + hook; no SSE E2E               | Covers real logic without flaky streaming E2E                       | Plan  |
| Latency target        | Under ~2s propagation                                     | Matches event-page 2s NFR; easy with in-process fan-out             | Plan  |

## Scope

**In scope:** in-process broker with monotonic (restart-safe) revision; public `GET /…/stream` SSE
endpoint; publish from all 8 mutation handlers; `revision` in the read model; frontend `useEventStream`
hook; stale-lock confirm guard; `Streaming:Enabled` toggle.

**Out of scope:** WebSockets / Supabase Realtime; full-snapshot or delta push; multi-instance fan-out
(LISTEN/NOTIFY, Redis); polling fallback; hard optimistic-concurrency lock; Playwright SSE E2E;
actor-name data / "Maya voted" toasts.

## Architecture / Approach

Browser `EventSource` → backend `GET /api/events/{token}/stream` (direct, bypassing the CF Worker).
Mutation handlers call `broker.Publish(token)` after `SaveChanges`; the broker bumps a per-token
revision and pushes it to that token's subscribers; the endpoint streams it as an SSE event (id =
revision) plus ~20s heartbeats. The client gates on the revision and, when it advances, runs a debounced
`router.invalidate()` — refetching the full event through its existing cookie'd loader. The read model
returns the current revision so a client's own action doesn't double-refetch. The lock guard compares the
organizer's intended date to the freshly-ranked best date (shared `Event` helper) and returns 409 when
they differ, driving a confirm dialog.

## Phases at a Glance

| Phase                                    | What it delivers                                              | Key risk                                                       |
| ---------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| 1. Backend — streaming core              | Broker + public SSE endpoint + `Streaming:Enabled` toggle    | SSE/heartbeat behavior under Fly scale-to-zero & proxy timeout |
| 2. Backend — wire mutations + revision   | Publish from 8 handlers; `revision` in read model            | Forgetting a handler; publishing on a failure path            |
| 3. Frontend — live subscription          | `useEventStream` hook; revision threading; orval regen       | Double-refetch / storms; reconnect correctness                |
| 4. Stale-lock confirm guard              | Shared ranking helper; 409 guard; confirm dialog             | False alarms; ranking drift from read model                   |

**Prerequisites:** none beyond the running app; each phase regenerates the orval client after backend
spec changes.
**Estimated effort:** ~3–4 focused sessions, one per phase.

## Open Risks & Assumptions

- **Single-instance only.** In-memory broker breaks if Fly runs >1 machine; documented as the scaling
  limit, revisit with LISTEN/NOTIFY before horizontal scaling.
- **Scale-to-zero restarts** reset the counter → revision is seeded from `UnixTimeMilliseconds` and the
  client refetches on every reconnect, so correctness never depends on the counter surviving a sleep.
- **Proxy idle timeouts** (Fly ~60s) → mitigated by ~20s heartbeats; verify in manual testing on Fly.
- Assumes EventSource can reach the backend origin cross-site (CORS already configured); the stream is
  public per-token (no cookie needed — refetch carries identity).

## Success Criteria (Summary)

- A vote/claim/RSVP/item/lock in one browser appears in another watcher's page within ~2s, no refresh.
- The organizer is prompted before locking a best date that shifted since their page loaded.
- With streaming disabled or blocked, the page works exactly as it does today.

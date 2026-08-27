---
change_id: live-event-updates-sse
title: Live voting & item claiming via Server-Sent Events (with stale-lock guard)
status: implementing
created: 2026-08-27
updated: 2026-08-27
---

## Notes

Cross-cutting change (frontend + backend). Pulls PRD FR-010's deferred "real-time is v2"
forward using SSE (lighter than WebSockets).

Trigger: an organizer picked the "best date" on screen, but a vote had landed after their
last page load, so the leading date had actually shifted — they locked a stale choice. The
same staleness affects item claiming.

Design decided via /10x-plan questioning:
- In-process broker (in-memory pub/sub keyed by token); single-instance only, documented caveat.
- SSE carries a lightweight "changed" signal + monotonic revision; client refetches through
  its existing loader (reuses server-side best-date + per-participant `you`).
- All state-changing actions broadcast (not just votes/claims).
- Seamless silent re-render; revision-gated + refetch-on-reconnect; graceful degrade if the
  stream is blocked; `Streaming:Enabled` config toggle.
- Extra: confirm-if-changed guard on the organizer's lock action (user chose this over
  live-updates-only).

See plan-brief.md then plan.md.

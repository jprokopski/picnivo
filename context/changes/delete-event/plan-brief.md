# Organizer-only Delete for Event — Plan Brief

> Full plan: `context/changes/delete-event/plan.md`
> Research: `context/changes/delete-event/research.md`

## What & Why

Add `DELETE /api/events/{token}` — organizer-only, hard delete, cascading to all children — plus a confirm-gated delete UI in the event detail view. Closes the CRUD gap flagged in `context/mvp-check-report.md`: Event has Create/Read/Update but no Delete.

## Starting Point

The backend has a mature vertical-slice pattern (`SelectFinalDate` for auth, `RemoveItem` for delete) with reflection-based endpoint discovery, and the FK cascade for the whole Event subtree is **already fully configured** at both EF Core and Postgres level. The frontend already computes `isOrganizer` in the `$token` route loader and threads it into `event-detail-view.tsx`. Nothing deletes an Event yet, and there's no `deleteEvent` in the Orval client or `AlertDialog` primitive.

## Desired End State

An organizer viewing an owned event sees a danger-zone delete control; confirming through an `AlertDialog` issues the DELETE, the backend hard-deletes the Event and all children in one cascade (204), and the organizer lands on a fresh `/events` list without the deleted event. Non-organizers never see the control and are rejected 403 at the API; unauthenticated calls get 401; unknown tokens get 404.

## Key Decisions Made

| Decision                | Choice                                   | Why (1 sentence)                                                              | Source   |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Delete semantics        | Hard delete                              | No retention/audit requirement in PRD or roadmap; no soft-delete infra exists | Research |
| Child cleanup           | Rely on existing FK cascade              | Cascade verified correct on Postgres; handler stays trivial                   | Research |
| Auth error model        | 401 / 403 / 404 (403 for wrong organizer) | Frozen convention from `testing-authorization-boundaries`                     | Research |
| Backend shape           | Handler + endpoint, no DTO/validator     | Body-less delete-by-token; token bound from route                            | Research |
| Confirm UX              | New shadcn `AlertDialog`                  | Destructive action deserves proper confirm semantics & a11y                   | Plan     |
| Control placement       | Detail-view danger zone only             | `isOrganizer` already in scope; avoids fiddly card-overlay layering           | Plan     |
| Post-delete navigation  | `navigate({ to: "/events" })`            | List loader refetches on arrival; no redundant invalidate                     | Plan     |

## Scope

**In scope:** DELETE endpoint + handler/endpoint tests (incl. cascade regression); Orval regen; `AlertDialog` primitive; `deleteEventFn` server fn; `DeleteEvent` component wired into the detail view danger zone.

**Out of scope:** Soft delete / retention / audit; list-view (`event-card`) delete control; `EventBand` header button; explicit child-removal code; new auth conventions; react-query `useMutation`.

## Architecture / Approach

Backend: a trivial vertical slice (`DeleteEvent.cs` + `DeleteEventEndpoint.cs`) that loads the Event by token, checks JWT `sub` ownership (404-before-403), `Remove`s it, saves — cascade does the rest. Building the API regenerates `Picnivo.API.json`. Frontend: `pnpm orval` emits `deleteEvent`, then a server fn (`{ error }` contract, auth-middleware + Bearer) and a component (pending state → `toast.error` or navigate) wired into the detail view. **Hard ordering: backend must ship and OpenAPI must regenerate before the frontend can import `deleteEvent`.**

## Phases at a Glance

| Phase                        | What it delivers                                        | Key risk                                          |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| 1. Backend + cascade         | DELETE endpoint, auth boundaries, cascade regression test | Cascade silently misconfigured — test guards this |
| 2. Frontend delete UI        | Orval client, AlertDialog, server fn, wired control     | Orval regen must precede component code            |

**Prerequisites:** Phase 2 depends on Phase 1's regenerated OpenAPI JSON. `pnpm dlx shadcn add alert-dialog` requires network.
**Estimated effort:** ~1–2 sessions across 2 phases; the change is small and pattern-following.

## Open Risks & Assumptions

- Assumes the Npgsql multiple-cascade-path behavior verified in research holds at runtime — the cascade regression test confirms it.
- Assumes `pnpm orval` cleanly emits `deleteEvent` from the regenerated JSON (mirrors existing `removeItem`).

## Success Criteria (Summary)

- Organizer can delete an owned event and lands on `/events` with the event and all its data gone.
- Non-organizer cannot delete (control hidden; API returns 403); unauthenticated → 401; unknown token → 404.
- Backend + frontend automated checks (tests, type-check, lint, Lingui extract) all pass.

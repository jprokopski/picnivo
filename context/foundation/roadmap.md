---
project: "Picnivo"
version: 1
status: draft
created: 2026-06-02
updated: 2026-07-03
prd_version: 1
main_goal: speed
top_blocker: time
---

# Roadmap: Picnivo

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

Organizing small group events (grills, picnics, trips) is broken by coordination overhead — the organizer bears all the friction of herding date preferences, tracking logistics in scattered tools, and reminding people of commitments that get buried. Existing tools are either too heavy for a casual hangout (Eventbrite, Meetup) or too narrow and disconnected (Doodle, Google Sheets, WhatsApp). Picnivo replaces this with a single shareable page where friends vote on dates, claim items to bring, and see who's coming — each interaction reducing uncertainty until the event is ready to go.

## North star

**S-02: Participant opens an event link, votes on dates, claims an item, and sees the results** — the first moment where the core product hypothesis (that combining date voting, item claiming, and attendance into one shared page eliminates coordination friction for the organizer) becomes testable. This is the validation milestone; everything before it exists to enable this slice.

> The "north star" is the smallest end-to-end slice whose successful delivery would prove the product works — placed as early as Prerequisites allow because everything else only matters if this slice delivers value.

## At a glance

| ID   | Change ID                     | Outcome (user can …)                                                                             | Prerequisites | PRD refs                                                      | Status   |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------- | -------- |
| F-01 | data-persistence-scaffold     | (foundation) Backend persists and retrieves structured data; schema management in place           | —             | Business Logic, NFR (2s load)                                 | done     |
| F-02 | organizer-auth-scaffold       | (foundation) Organizer registration and login flows exist; protected-vs-public route distinction  | F-01          | FR-001, FR-002, Access Control                                | done     |
| S-01 | event-creation-and-sharing    | Create event with title, dates, item list, get shareable link, and see their events               | F-01, F-02    | US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006         | done     |
| S-02 | participant-voting-and-claims | Open event link, enter name, vote on dates, claim item, see vote summary, best date, assignments | S-01          | US-02, FR-005, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012 | done |

## Baseline

What's already in place in the codebase as of 2026-06-02 (auto-researched + user-confirmed). Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — React 19 + TanStack Start + Tailwind v4, file-based routing, design tokens, 3 routes (root, index, about). Deploys to Cloudflare Workers via `wrangler.jsonc`.
- **Backend / API:** partial — ASP.NET Core 10 Minimal API scaffold with `/healthz` and `/weatherforecast` (sample). No real business endpoints. Deploys to Fly.io via `fly.toml` + GitHub Actions.
- **Data:** absent — no ORM, schema, migrations, or connection strings.
- **Auth:** absent — no auth provider, session/token handling, or route-level middleware.
- **Deploy / infra:** present — Backend: `Dockerfile` + `fly.toml` + `.github/workflows/deploy-backend.yml`. Frontend: `wrangler.jsonc` + Cloudflare Workers Builds.
- **Observability:** partial — ASP.NET default logging + `/healthz` endpoint. No structured logging, error tracking, or metrics.

## Foundations

### F-01: Data persistence scaffold

- **Outcome:** (foundation) Backend can persist and retrieve structured data; schema management and local-dev workflow are in place.
- **Change ID:** data-persistence-scaffold
- **PRD refs:** Business Logic (shared state needs persistence), NFR (2s page load implies efficient data access)
- **Unlocks:** S-01 (events need storage), S-02 (votes and claims need storage)
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced first because every downstream slice needs persistence. Schema design decisions here constrain all later slices — a wrong data model is expensive to refactor.
- **Status:** done

### F-02: Organizer auth scaffold

- **Outcome:** (foundation) Organizer registration and login flows exist on backend and frontend; protected-vs-public route distinction is in place so organizer endpoints require auth while participant endpoints remain open.
- **Change ID:** organizer-auth-scaffold
- **PRD refs:** FR-001, FR-002, Access Control
- **Unlocks:** S-01 (event creation requires a logged-in organizer per US-01)
- **Prerequisites:** F-01 (user accounts need a data store)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Sequenced after F-01 because most auth approaches store user accounts in the database. Complexity could expand scope if the chosen approach is heavyweight — keep it minimal for speed.
- **Status:** done

## Slices

### S-01: Event creation and sharing

- **Outcome:** Organizer can create an event with a title, optional description and location, 1–10 date/time options, and an item list; receives a shareable link with an unguessable token; can view a list of their created events.
- **Change ID:** event-creation-and-sharing
- **PRD refs:** US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006
- **Prerequisites:** F-01 (event data persistence), F-02 (organizer must be logged in)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Event creation UX must be fast — PRD's secondary Success Criterion is "under 2 minutes to shareable link." Scope creep on the form (rich text, image uploads, advanced scheduling) would delay the north star.
- **Status:** done

### S-02: Participant voting and item claims

- **Outcome:** Participant can open an event link, enter a display name (with duplicate-name warning), vote Yes/Maybe/No on each proposed date, claim an item from the logistics list (first-come-first-served), and see the vote summary, current best date (most Yes votes, ties broken by fewest No votes), item assignments, and participant list — all updated on page load.
- **Change ID:** participant-voting-and-claims
- **PRD refs:** US-02, FR-005, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012
- **Prerequisites:** S-01 (events must exist for participants to interact with)
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - How to enforce "one vote per person per date option" (PRD Guardrail) when participants are identified by display name, not by account — the enforcement mechanism needs care to prevent duplicate voting without adding auth friction. Owner: team. Block: no.
- **Risk:** North star slice — everything before it exists to enable this. The vote integrity constraint adds complexity to a name-based identity flow; the enforcement mechanism must balance correctness against participant friction.
- **Status:** done

## Backlog Handoff

| Roadmap ID | Change ID                     | Suggested issue title                                     | Ready for `/10x-plan` | Notes                                     |
| ---------- | ----------------------------- | --------------------------------------------------------- | --------------------- | ----------------------------------------- |
| F-01       | data-persistence-scaffold     | Set up data persistence layer for backend                 | yes                   | Run `/10x-plan data-persistence-scaffold` |
| F-02       | organizer-auth-scaffold       | Add organizer registration and login                      | no                    | Depends on F-01                           |
| S-01       | event-creation-and-sharing    | Organizer creates event with dates, items, shareable link | no                    | Depends on F-01, F-02                     |
| S-02       | participant-voting-and-claims | Participant votes on dates, claims items, views results   | no                    | Depends on S-01; north star               |

## Open Roadmap Questions

No open roadmap questions. The PRD has zero unresolved open questions, and no cross-cutting unknowns surfaced during framing.

## Parked

- **Email reminders and notifications** — Why parked: PRD §Non-Goals; deferred to v2. Core value is the shared event page, not push notifications.
- **Chat or messaging between participants** — Why parked: PRD §Non-Goals; friends already have WhatsApp/Signal/iMessage for discussion.
- **Calendar integrations (Google Calendar, iCal)** — Why parked: PRD §Non-Goals; event page is the single source of truth for now.
- **Mobile native app** — Why parked: PRD §Non-Goals; responsive web app only.
- **Real-time updates (WebSockets)** — Why parked: PRD FR-010 resolution; updates on page load sufficient for MVP. Friends vote over hours, not seconds.

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change is archived.)

- **F-01: (foundation) Backend can persist and retrieve structured data; schema management and local-dev workflow are in place.** — Archived 2026-06-04 → `context/archive/2026-06-02-data-persistence-scaffold/`. Lesson: —.
- **F-02: (foundation) Organizer registration and login flows exist on backend and frontend; protected-vs-public route distinction is in place so organizer endpoints require auth while participant endpoints remain open.** — Archived 2026-06-04 → `context/archive/2026-06-04-organizer-auth-scaffold/`. Lesson: —.
- **S-01: Organizer can create an event with a title, optional description and location, 1–10 date/time options, and an item list; receives a shareable link with an unguessable token; can view a list of their created events.** — Archived 2026-07-02 → `context/archive/2026-06-28-event-creation-and-sharing/`. Lesson: —.
- **S-02: Participant can open an event link, enter a display name (with duplicate-name warning), vote Yes/Maybe/No on each proposed date, claim an item from the logistics list (first-come-first-served), and see the vote summary, current best date (most Yes votes, ties broken by fewest No votes), item assignments, and participant list — all updated on page load.** — Archived 2026-07-03 → `context/archive/2026-07-02-participant-voting-and-claims/`. Lesson: —.

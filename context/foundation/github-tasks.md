---
project: "Picnivo"
source: context/foundation/roadmap.md
created: 2026-06-02
repo: jprokopski/picnivo
---

# GitHub Issues — Roadmap Tracker

> Canonical issue list derived from `context/foundation/roadmap.md`.
> Update this file when issues are created, closed, or restructured.

## Labels

### Type

| Label | Color | Purpose |
|-------|-------|---------|
| `type:foundation` | #1D76DB | Horizontal enabler work |
| `type:slice` | #0E8A16 | Vertical user-visible slice |

### Status

| Label | Color | Purpose |
|-------|-------|---------|
| `status:ready` | #C2E0C6 | Ready to pick up |
| `status:in-progress` | #FEF2C0 | Actively being worked on |
| `status:blocked` | #E99695 | Blocked by a prerequisite or decision |

### Marker

| Label | Color | Purpose |
|-------|-------|---------|
| `north-star` | #FBCA04 | North star milestone |

## Issues

| Issue | Roadmap ID | Change ID | Title | Type | Status | Prerequisites |
|-------|------------|-----------|-------|------|--------|---------------|
| [#5](https://github.com/jprokopski/picnivo/issues/5) | F-01 | `data-persistence-scaffold` | Set up data persistence layer for backend | `type:foundation` | `status:ready` | — |
| [#6](https://github.com/jprokopski/picnivo/issues/6) | F-02 | `organizer-auth-scaffold` | Add organizer registration and login | `type:foundation` | `status:blocked` | [#5](https://github.com/jprokopski/picnivo/issues/5) |
| [#7](https://github.com/jprokopski/picnivo/issues/7) | S-01 | `event-creation-and-sharing` | Organizer creates event with dates, items, shareable link | `type:slice` | `status:blocked` | [#5](https://github.com/jprokopski/picnivo/issues/5), [#6](https://github.com/jprokopski/picnivo/issues/6) |
| [#8](https://github.com/jprokopski/picnivo/issues/8) | S-02 | `participant-voting-and-claims` | Participant votes on dates, claims items, views results | `type:slice` | `status:blocked` | [#7](https://github.com/jprokopski/picnivo/issues/7) |

## Dependency Graph

F-01 ([#5](https://github.com/jprokopski/picnivo/issues/5))
 ├── F-02 ([#6](https://github.com/jprokopski/picnivo/issues/6))
 │    └── S-01 ([#7](https://github.com/jprokopski/picnivo/issues/7))
 │         └── S-02 ([#8](https://github.com/jprokopski/picnivo/issues/8)) ← north star
 └── S-01 ([#7](https://github.com/jprokopski/picnivo/issues/7))

## Implementation Workflow

Each issue includes an "Implementation entry point" section. To start work on an issue:

1. Pick the next issue whose prerequisites are all closed
2. Run `/10x-plan <change-id>` to generate the implementation plan
3. Create a feature branch, implement, and open a PR referencing the issue
4. Close the issue when the PR merges

## Issue Formatting Rules

- Use bare `#N` references to cross-link issues — no brackets, no descriptions next to the link
- GitHub auto-links `#N` and shows the issue title on hover — additional context is redundant
- Labels use prefixes: `type:`, `status:`, plus standalone markers like `north-star`
- In this local doc, use full URL hyperlinks since `#N` doesn't auto-link outside GitHub

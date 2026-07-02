---
change_id: event-creation-and-sharing
title: Organizer creates event with dates, items, shareable link
status: archived
archived_at: 2026-07-02T08:29:52Z
created: 2026-06-28
updated: 2026-07-02
roadmap_id: S-01
prd_refs: [US-01, FR-001, FR-002, FR-003, FR-004, FR-005, FR-006]
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

Roadmap slice S-01, built on F-01 (data persistence) and F-02 (organizer auth), both archived/done.

UI decision (added during planning): adopt **shadcn/ui** for the new screens, with shadcn's semantic theme tokens mapped onto the existing Picnivo palette (`--lagoon`/`--sand`/`--sea-ink`, Manrope/Fraunces) so new screens match the shipped auth UI. Existing auth pages are NOT retrofitted in this slice.

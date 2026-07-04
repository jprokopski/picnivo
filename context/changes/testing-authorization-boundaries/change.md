---
change_id: testing-authorization-boundaries
title: Authorization boundaries
status: impl_reviewed
created: 2026-07-04
updated: 2026-07-04
archived_at: null
---

## Notes

<!-- Free-form notes for this change: links, ad-hoc context, decisions that don't belong in research/frame/plan. -->

- Phase 2 manual check 2.3's premise doesn't hold as literally stated: `TestDb.cs` also
  wires `EntityFramework.Exceptions.Sqlite` + `.UseExceptionProcessor()`, so a forced
  duplicate insert against the SQLite in-memory fixture throws the same
  `UniqueConstraintException` as Postgres — confirmed via a throwaway scratch test (not
  committed). The Phase 2 constraint test is still correct: it targets the real Postgres
  fixture directly (matching the plan's contract), which is what actually backs the
  production `IX_DateVotes_Participant_DateOption` index. The "wouldn't throw on SQLite"
  reasoning in the plan's manual step is simply inaccurate for this codebase.

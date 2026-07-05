---
change_id: testing-aggregation-correctness
title: Pin the best-date ranking, tie-break, and attendance inclusion (risk #5)
status: archived
created: 2026-07-05
updated: 2026-07-05
archived_at: 2026-07-05T09:31:47Z
---

## Notes

Phase 3 of the test-plan.md phased rollout (context/foundation/test-plan.md §3). Covers risk #5: the tally selects the most-Yes date; ties break by fewest-No; attendance-confirmed participants are counted per the just-fixed rule (commit `49244ca`). Test types: unit + integration.

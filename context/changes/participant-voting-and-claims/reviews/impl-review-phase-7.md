<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 7 of 7 — Frontend: Organizer Events Dashboard
- **Date**: 2026-07-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

Automated verification re-run and confirmed: `pnpm typecheck`, `pnpm lint` (0 errors),
`pnpm test` (155/155), `pnpm extract && pnpm compile` (clean), `pnpm build` (succeeds),
`dotnet build` (succeeds), `dotnet test` (104/104). Manual criterion 7.7 remains
correctly unchecked (pending, not a failure).

## Findings

### F1 — Organizer still counted in dashboard "N going" / crew stack

- **Severity**: WARNING
- **Impact**: HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: `backend/Picnivo.API/Features/Events/ListEvents/ListEvents.cs:33`; `frontend/src/features/events/list-events/components/event-card.tsx:124-134`
- **Detail**: plan.md's Phase 6 addendum explicitly directs: "Phase 7's dashboard crew stack should reuse `IsOrganizer` rather than reintroducing a name-based heuristic." Phase 4's addendum also flagged this as a decision Phase 7 "must design for... explicitly." Neither happened: `IsOrganizer` isn't selected in ListEvents' LINQ projection (`e.Participants.Select(p => new { p.DisplayName, p.CreatedAt })`), `ParticipantCount`/`ParticipantNames` include the organizer unconditionally, and no Phase 7 addendum documents a deliberate choice (contrast Phase 6, which added a full addendum justifying its own organizer-inclusion decision for the hub crew list). Effect: every fresh event shows "1 going" and the organizer in the avatar stack from creation, before any guest joins. The design reference's live dashboard card (`liveCard.crew = event.participants` in picnivo-web-events.jsx) never includes the host in that list at all, unlike Phase 6's hub decision — so there's no design-fidelity counter-argument here for keeping it as-is.
- **Fix A ⭐ Recommended**: Exclude the organizer from `ParticipantCount`/`ParticipantNames` on the dashboard card — select `p.IsOrganizer` in the ListEvents projection and filter it out before counting/capping names.
  - Strength: Matches the design's dashboard semantics; avoids the misleading "1 going" cold-start state; reuses the already-built `IsOrganizer` field exactly as the Phase 6 addendum recommended, proven via `GetEventByToken.cs`'s identical use case.
  - Tradeoff: Small new diff (2 files) in an otherwise "closed" phase.
  - Confidence: HIGH — field already exists and works elsewhere.
  - Blind spot: Haven't checked whether other UI assumes `ParticipantCount ≥ 1`.
- **Fix B**: Keep the organizer included, but add a plan.md addendum (Phase 6-style) documenting this as the deliberate choice, with rationale.
  - Strength: Zero code risk, closes the process gap immediately.
  - Tradeoff: Still diverges from the design reference's dashboard semantics with no equivalent justification to Phase 6's.
  - Confidence: MEDIUM — fixes documentation, not the design-fidelity gap.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — `ListEvents.cs` now filters `IsOrganizer` participants from `ParticipantCount`/`Participants`; added `ExcludesOrganizerFromParticipantCountAndNames` test.

### F2 — Undocumented 4th dashboard status ("now") beyond the plan's 3-state contract

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: `frontend/src/features/events/list-events/schema.ts:3-26`; `frontend/src/features/events/list-events/components/event-card.tsx:41-42,105-114`; `frontend/src/styles.css:181-190`
- **Detail**: Plan's Phase 7 Contract specifies exactly three derived states — `past` / `date-set` / `voting` — and the success criteria say "status chip reflects voting/date-set/past." The implementation adds a 4th, `"now"` (a 5-hour `HAPPENING_NOW_WINDOW_MS` window from the chosen date's start), with its own pulsing chip and dedicated tests. It's visually grounded in the design's static demo fixture (`status: 'now'`, `web-datechip--now` keyframes), but the design's own *live*, dynamically computed card only ever derives `locked`/`voting` — never `now`/`past`. So this is a genuine, un-planned extension of derived behavior (not just styling), added without a plan addendum — unlike every other judgment call in this feature's history (Phases 4-6 all recorded addenda for comparable deviations).
- **Fix**: Add a Phase 7 addendum to plan.md (mirroring Phases 4-6's style) documenting the "now" state's rationale and the 5-hour window choice. The code itself is well-tested and design-aligned — the gap is process, not the decision.
- **Decision**: FIXED — added a Phase 7 addendum to plan.md documenting the "now" state's design rationale and the 5-hour window heuristic.

### F3 — Unrelated AGENTS.md change bundled into this diff

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `AGENTS.md:24`
- **Detail**: Adds a paragraph about reading all three lessons.md files across skills/agents — pure tooling documentation, unrelated to Phase 7's dashboard feature. Harmless, but not explained by the plan.
- **Fix**: Split into its own commit separate from the Phase 7 feature commit when landing this work.
- **Decision**: ACKNOWLEDGED — commit `AGENTS.md` separately from the Phase 7 feature commit when landing.

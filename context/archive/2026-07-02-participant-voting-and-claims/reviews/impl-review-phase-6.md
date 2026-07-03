<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Participant Voting and Item Claims (S-02)

- **Plan**: context/changes/participant-voting-and-claims/plan.md
- **Scope**: Phase 6 of 7
- **Date**: 2026-07-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | PASS |

## Findings

### F1 — Organizer's crew-split inclusion decided but not documented, and matched by name not id

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: frontend/src/features/events/set-attendance/components/attendees.tsx:103
- **Detail**: The Phase 4 review carried forward an explicit requirement into Phase 6: "decide explicitly whether the Coming/Can't-make-it crew split filters the organizer out or shows them deliberately — don't let their presence fall through as an accident." A decision was made (organizer included in both buckets, tagged "HOST"), but never recorded — no plan.md addendum, no code comment. The mechanism is also a proxy, not a real signal: `const isHost = participant.displayName === organizerName;` (line 103). `ParticipantDto` has no `isOrganizer`/`organizerParticipantId` field, so a guest who names themselves identically to the organizer gets mistagged HOST. It also puts the organizer in the crew list at all, which the cited design reference (`picnivo-web-event.jsx`) never does — it only shows a "hosted by" kicker.
- **Fix A ⭐ Recommended**: Add an explicit organizer signal to the read model (e.g. `ParticipantDto.isOrganizer`, computed server-side from the auto-created organizer participant vs. `Event.OrganizerId`) and switch `attendees.tsx` to use it instead of name-matching; record the "organizer shown in crew, tagged HOST" decision as a Phase 6 addendum in plan.md.
  - Strength: Removes the name-collision bug permanently and gives Phase 7's dashboard crew stack (identical open note) a reusable, correct signal instead of reinventing the same heuristic.
  - Tradeoff: Requires a small backend DTO change + Orval regeneration, touching a closed phase's contract (already done twice via Phase 2 addenda).
  - Confidence: HIGH — `OrganizerId` is already exposed at the top level; adding one more field is small and precedented.
  - Blind spot: Haven't confirmed Phase 7 needs the identical flag, though its carried-over note strongly suggests yes.
- **Fix B**: Keep the display-name heuristic, but record the decision (included, tagged HOST, matched by name, collision risk accepted at friend-group scale) as a Phase 6 addendum in plan.md.
  - Strength: Zero code risk, ships immediately.
  - Tradeoff: Name-collision bug stays latent; Phase 7 will likely reinvent the same heuristic.
  - Confidence: MED — collision unlikely at friend-group scale but real.
  - Blind spot: None significant.
- **Decision**: FIXED via Fix A — added `Participant.IsOrganizer` (backend + migration `AddParticipantIsOrganizer`), exposed on `ParticipantDto`, `attendees.tsx` now keys off `participant.isOrganizer`; decision documented as a Phase 6 addendum in plan.md.

### F2 — Organizer has no UI path to remove any item, contradicting the plan's Desired End State

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/features/events/claim-items/components/haul.tsx:120-134
- **Detail**: The plan's Desired End State states "the organizer ... can remove any item." Phase 3's backend `RemoveItem.cs` already authorizes organizer-or-adder and is tested for it. But `haul.tsx`'s `canRemove` is `!!myParticipantId && item.addedByParticipantId === myParticipantId` — it never consults `isOrganizer`, and `ItemRow` doesn't even receive that prop. Organizer-added items carry `addedByParticipantId: null`, so no one (including the organizer) gets a remove affordance for them, and the organizer can't remove guest-added items either.
- **Fix**: Pass `isOrganizer` into `ItemRow` and change `canRemove` to `isOrganizer || (!!myParticipantId && item.addedByParticipantId === myParticipantId)` in `haul.tsx`.
- **Decision**: FIXED — `canRemove` now includes `isOrganizer ||`; added two haul.test.tsx cases (organizer can remove an item they didn't add; non-adder non-organizer guest cannot).

### F3 — `removeItemFn` missing the participant-id guard its siblings all have

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/events/claim-items/functions.ts:80-90
- **Detail**: `claimItemFn`, `releaseClaimFn`, and `addItemFn` all guard with `if (!participantId) return { error: "Join the event first." }` before calling the API. `removeItemFn` skips this and passes `participantId: undefined` straight through. Not a security hole — the backend independently enforces organizer-or-adder ownership and returns 403 regardless — but produces an inconsistent, less-friendly error for an unjoined caller.
- **Fix**: Add the same participant-id guard to `removeItemFn` for consistency with its sibling functions.
- **Decision**: FIXED — added the guard. While fixing F2, also discovered `removeItemFn` never forwarded the organizer's Supabase JWT at all (unlike `selectFinalDateFn`), so the backend's `isOrganizer` check in `RemoveItem.cs` was unreachable and F2's UI fix would have 403'd for the organizer. Fixed in the same edit: `removeItemFn` now attaches `Authorization: Bearer <access_token>` when a session exists (soft-auth — guests without a session still succeed via `participantId`).

### F4 — Plan says "inline" already-taken message; implementation uses a toast

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: frontend/src/features/events/claim-items/components/haul.tsx:158-171
- **Detail**: The plan's contract text says a 409 shows "inline 'already taken'". The implementation uses `toast.error(result.error)` (a global toast), matching the convention already used by `VoteControl`, `ConfirmClaim`, and `AddItem` elsewhere in this codebase — likely an intentional, consistent choice rather than a miss.
- **Fix**: No code change needed; optionally update the plan's Phase 6 wording from "inline" to "toast" to reflect the actual convention.
- **Decision**: FIXED — plan.md wording updated from "inline" to "toast", noting the `toast.error` convention it matches.

### F5 — `isEffectivelyComing`/`isEffectivelyOut` lack direct unit tests

- **Severity**: 🔎 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: frontend/src/features/events/set-attendance/schema.ts
- **Detail**: These two pure functions implement the plan's non-trivial "effective coming/out" rule and are relied on across `haul.tsx`, `attendees.tsx`, and `guest-exit.tsx`, but have no dedicated `schema.test.ts` — only indirect coverage via component tests. A precedent for direct schema unit tests exists at `create-event/schema.test.ts`.
- **Fix**: Add a `schema.test.ts` covering the Coming/Undecided+Yes and Out/Undecided+No branches directly.
- **Decision**: PENDING

## Automated Verification (independently re-run)

- `pnpm typecheck` — pass
- `pnpm lint` — pass (0 errors, pre-existing warnings only)
- `pnpm test` — 114/114 tests pass across 18 files
- `pnpm extract && pnpm compile` — reproducible, byte-identical to working tree

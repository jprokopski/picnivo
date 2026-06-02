---
bootstrapped_at: 2026-06-01T22:25:37Z
starter_id: tanstack-start
starter_name: "TanStack Start"
project_name: picnivo
language_family: js
package_manager: npm
cwd_strategy: subdir (CLI created picnivo/ subdirectory in frontend/)
bootstrapper_confidence: best-effort
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

```yaml
starter_id: tanstack-start
package_manager: npm
project_name: picnivo
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: best-effort
  path_taken: custom
  quality_override: true
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: false
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

A solo developer building a frontend SPA for a small-group event coordination web app (Picnivo) consuming a separate .NET backend API. Custom path chosen because the recommended full-stack defaults (10x Astro Starter, T3) bundle their own backends, redundant with the existing .NET API. TanStack Start was selected over registry options (React Router, Next.js) for its deeply type-safe routing and loader patterns — the user prioritized type safety as a core value. TanStack Start is not in the starter registry, so bootstrapper confidence is best-effort; the project will be scaffolded manually via `npx create-start@latest`. The self-check passed on 4 of 5 points — the gap is agent-mistake detection, expected given TanStack Start's smaller training corpus. Auth UI is the only technology-forcing feature on the frontend. Deployment targets Cloudflare Pages; CI runs on GitHub Actions with auto-deploy-on-merge.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | @tanstack/cli v0.68.0 | fresh | resolved from npx @tanstack/cli@latest create |
| GitHub repo | not checked | n/a | not in starter registry; no docs_url to resolve |

## Scaffold log

**Resolved invocation**: `npx @tanstack/cli@latest create picnivo` (run from `frontend/`)
**Strategy**: CLI created `picnivo/` subdirectory in `frontend/`; nested `.git/` removed post-scaffold
**Exit code**: 0
**Files created**: 14 source files + node_modules + package-lock.json
**Conflicts (.scaffold siblings)**: none
**context/ preservation**: `frontend/context/` preserved untouched (outside scaffold directory)
**Notable**: TanStack CLI generated AGENTS.md and README.md with TanStack Intent skill mappings

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Dependencies**: 302 total (143 prod, 113 dev, 65 optional, 2 peer)

Clean dependency tree.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | best-effort |
| quality_override | true |
| path_taken | custom |
| self_check_answers | typed: true, from_official_starter: true, conventions: true, docs_current: true, can_judge_agent: false |
| team_size | solo |
| deployment_target | cloudflare-pages |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Note: TanStack CLI already generated an AGENTS.md with TanStack Intent skill mappings. Review it to see what agent context was auto-configured.

Useful manual steps in the meantime:
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.

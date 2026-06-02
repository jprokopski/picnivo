---
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
---

## Why this stack

A solo developer building a frontend SPA for a small-group event coordination web app (Picnivo) consuming a separate .NET backend API. Custom path chosen because the recommended full-stack defaults (10x Astro Starter, T3) bundle their own backends, redundant with the existing .NET API. TanStack Start was selected over registry options (React Router, Next.js) for its deeply type-safe routing and loader patterns — the user prioritized type safety as a core value. TanStack Start is not in the starter registry, so bootstrapper confidence is best-effort; the project will be scaffolded manually via `npx create-start@latest`. The self-check passed on 4 of 5 points — the gap is agent-mistake detection, expected given TanStack Start's smaller training corpus. Auth UI is the only technology-forcing feature on the frontend. Deployment targets Cloudflare Pages; CI runs on GitHub Actions with auto-deploy-on-merge.

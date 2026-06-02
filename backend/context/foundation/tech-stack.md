---
starter_id: dotnet
package_manager: dotnet
project_name: picnivo
hints:
  language_family: dotnet
  team_size: solo
  deployment_target: azure-app-service
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---

## Why this stack

A solo developer building a backend API for a small-group event coordination web app (Picnivo) with auth in a 3-week after-hours timeline. ASP.NET Core webapi is the recommended default for `(api, dotnet)` and clears all four agent-friendly gates — strong typing via C#, convention-based project structure, popular in .NET training data, and well-documented with Microsoft's versioned reference manual. Bootstrapper confidence is verified, so scaffolding will be smooth. Auth is the only technology-forcing feature in scope; ASP.NET Core Identity handles it natively. Deployment defaults to Azure App Service; CI runs on GitHub Actions with auto-deploy-on-merge.

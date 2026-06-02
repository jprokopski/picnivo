---
bootstrapped_at: 2026-06-01T22:20:05Z
starter_id: dotnet
starter_name: ".NET (ASP.NET Core webapi)"
project_name: Picnivo.API
language_family: dotnet
package_manager: dotnet
cwd_strategy: custom (sln + webapi project)
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: "dotnet list package --vulnerable --include-transitive"
---

## Hand-off

```yaml
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
```

A solo developer building a backend API for a small-group event coordination web app (Picnivo) with auth in a 3-week after-hours timeline. ASP.NET Core webapi is the recommended default for `(api, dotnet)` and clears all four agent-friendly gates — strong typing via C#, convention-based project structure, popular in .NET training data, and well-documented with Microsoft's versioned reference manual. Bootstrapper confidence is verified, so scaffolding will be smooth. Auth is the only technology-forcing feature in scope; ASP.NET Core Identity handles it natively. Deployment defaults to Azure App Service; CI runs on GitHub Actions with auto-deploy-on-merge.

## Pre-scaffold verification

| Signal | Value | Severity | Notes |
| --- | --- | --- | --- |
| npm package | not run | n/a | non-JS starter; no npm package to check |
| GitHub repo | not run | n/a | docs_url (learn.microsoft.com) is not a GitHub repo URL |

No recency signal available. .NET SDK 10.0.201 is installed and current.

## Scaffold log

**Resolved invocations**:
1. `dotnet new sln -n Picnivo` — created `Picnivo.slnx` in `backend/`
2. `dotnet new webapi -n Picnivo.API -o Picnivo.API --no-restore` — created project in `backend/Picnivo.API/`
3. `dotnet sln Picnivo.slnx add Picnivo.API/Picnivo.API.csproj` — added project to solution
4. `dotnet restore Picnivo.slnx` — restored NuGet packages

**Strategy**: custom — .NET solution + project scaffolded directly into `backend/` (user requested `Picnivo.sln` solution with `Picnivo.API` project naming)
**Exit code**: 0 (all steps)
**Files created**: 6 source files + solution + restore artifacts
**Conflicts (.scaffold siblings)**: none
**context/ preservation**: `backend/context/` preserved untouched

Note: .NET 10 SDK creates `.slnx` (new XML-based solution format) by default instead of `.sln`.

## Post-scaffold audit

**Tool**: `dotnet list package --vulnerable --include-transitive`
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: no vulnerable packages found in either category

Clean dependency tree.

## Hints recorded but not acted on

| Hint | Value |
| --- | --- |
| bootstrapper_confidence | verified |
| quality_override | false |
| path_taken | standard |
| self_check_answers | null |
| team_size | solo |
| deployment_target | azure-app-service |
| ci_provider | github-actions |
| ci_default_flow | auto-deploy-on-merge |
| has_auth | true |
| has_payments | false |
| has_realtime | false |
| has_ai | false |
| has_background_jobs | false |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.

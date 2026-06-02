---
project: picnivo
researched_at: 2026-06-02
recommended_platform: fly-io
runner_up: azure-container-apps
context_type: mvp
tech_stack:
  language: csharp
  framework: aspnet-core-webapi
  runtime: dotnet-10
---

## Recommendation

**Deploy on Fly.io.**

Fly.io scored highest on CLI-first operations and managed infrastructure among platforms that support .NET via Docker containers. The `flyctl` CLI covers the full deploy/logs/secrets/scale lifecycle in single commands — critical for agent-driven and solo-developer workflows. While Azure Container Apps offered a generous free tier with scale-to-zero, Fly.io's simpler operational model (no resource groups, no subscription management, no IAM) wins on iteration speed for a 3-week after-hours MVP. The cost difference is small (~$4-6/mo vs. Azure's free grants), and the developer accepted this tradeoff after reviewing the cross-check risks.

## Platform Comparison

Three platforms from the standard evaluation pool (Cloudflare Workers, Vercel, Netlify) were dropped immediately — none support the .NET runtime. AWS App Runner was also eliminated: it entered maintenance mode on April 30, 2026 and no longer accepts new customers.

| Platform | CLI-first | Managed | Docs | Deploy API | MCP | Notes |
|---|---|---|---|---|---|---|
| **Fly.io** | Pass | Pass | Partial | Pass | Partial | `flyctl` covers full lifecycle; `fly mcp server` experimental |
| **Azure Container Apps** | Pass | Pass | Pass | Pass | Pass | Azure MCP Server 2.0 GA; scale-to-zero free grants |
| **Azure App Service** | Pass | Pass | Pass | Pass | Partial | Native .NET; free F1 tier has 60 CPU-min/day cap |
| Railway | Pass | Pass | Pass | Partial | Partial | MCP work-in-progress; no CLI rollback; 15-min WebSocket limit |
| Render | Partial | Pass | Pass | Partial | Pass | CLI exists (v2.19) but no CLI rollback; MCP GA |
| AWS App Runner | — | — | — | — | — | **Sunset** — maintenance mode since Apr 30, 2026 |

### Shortlisted Platforms

#### 1. Fly.io (Recommended)

Fly.io runs .NET via Docker on Firecracker micro-VMs with a CLI (`flyctl`) that covers deploy, logs, secrets, scaling, and SSH in single commands. The managed-infrastructure layer handles TLS, routing, and health checks. Cost at MVP scale is ~$4-6/month for a single shared-cpu-1x VM with dedicated IPv4. The platform lacks a free tier for new signups (deprecated 2024), but the low absolute cost is acceptable for an MVP. Docs are open-source MDX on GitHub but no `llms.txt` is published. The `fly mcp server` is experimental — agent operations will primarily go through CLI.

#### 2. Azure Container Apps

Azure Container Apps runs containerized .NET with scale-to-zero on a consumption plan. Monthly free grants (180k vCPU-seconds, 360k GiB-seconds, 2M requests) would likely cover MVP traffic entirely. The Azure MCP Server 2.0 reached GA in April 2026 with 276 tools across 50+ services. Docs are markdown on GitHub. The gap vs. Fly.io: more operational complexity (resource groups, subscriptions, Azure CLI verbosity) and revision-based traffic splitting adds cognitive overhead for a solo developer on a tight timeline.

#### 3. Azure App Service

Azure App Service is Microsoft's flagship .NET PaaS with native runtime support (no Docker required). The free F1 tier costs $0/month but caps at 60 CPU-minutes/day — a hard ceiling that stops the app entirely when exceeded. Cold starts without "Always On" (Basic tier, ~$13/mo) are 5-10 seconds. Deployment slots for zero-downtime deploys require Standard tier (~$70/mo). The native .NET support and zero-Docker path are significant advantages, but the aggressive free-tier limits and steep cost jumps between tiers work against the "minimize cost" priority.

## Anti-Bias Cross-Check: Fly.io

### Devil's Advocate — Weaknesses

1. **No free tier for new signups.** Deprecated in 2024. New accounts get a minimal trial (2 VM-hours or 7 days). Cost starts at ~$4-6/mo from day one.
2. **.NET memory misdetection on Firecracker VMs.** The .NET runtime may not read cgroup memory limits correctly, causing the GC to over-allocate and trigger OOM kills. Requires manual `DOTNET_GCHeapHardLimit` or disabling server GC.
3. **Managed Postgres starts at $38/month.** If a co-located database is needed, the cheapest Fly Postgres option is ~10x the VM cost. External providers (Neon, Supabase) are cheaper but add latency.
4. **MCP server is experimental.** `fly mcp server` exists but is marked experimental, and Fly.io has publicly questioned the MCP pattern. Agent operations rely on CLI output parsing.
5. **Docker image maintenance burden.** No .NET buildpack means maintaining a Dockerfile. .NET images are 200MB+, leading to 2-4 minute deploys and requiring multi-stage build optimization.

### Pre-Mortem — How This Could Fail

The developer deployed the .NET 10 API on Fly.io with a shared-cpu-1x / 256MB VM. The first deploy worked, but the API crashed under light load — the .NET runtime allocated memory as if it had gigabytes available, because Fly's Firecracker VMs didn't expose cgroup limits correctly. After adding `DOTNET_GCHeapHardLimit`, the API stabilized but ran tight on memory. When the database question arose, Fly's managed Postgres at $38/month was too expensive for MVP. The developer chose Neon's free tier, adding cross-network latency that occasionally spiked event page loads above the 2-second NFR target. The Dockerfile needed tweaking with each dependency change, and deploys took 3-4 minutes due to the large .NET image. Six months in, the developer was spending $6/mo on Fly + $0 on Neon but investing significant time on Docker optimization, health check tuning, and PID 1 signal handling — time that could have been spent on product features.

### Unknown Unknowns

- **Dedicated IPv4 costs $2/month on top of VM costs.** Using IPv6-only (free) can lock out users behind IPv4-only networks. The $2/mo is small but easy to miss in estimates.
- **Ephemeral filesystem loses all writes on restart.** ASP.NET Data Protection keys, temp uploads, and SQLite databases vanish on deploy. Persistent Fly Volumes or external storage must be configured for Data Protection keys.
- **Health check grace periods must be tuned for .NET cold starts.** .NET takes 3-8 seconds to start; the default health check window may be too tight, causing Fly to kill the VM before the app is ready.
- **Fly's remote builder doesn't persist Docker layer caches between deploys by default.** NuGet package restore re-downloads everything after a cache eviction, adding minutes to deploys.
- **PID 1 behavior requires an exec-form ENTRYPOINT.** The .NET process runs as PID 1 in the container; without proper signal handling (using `exec` in the entrypoint or `ENTRYPOINT ["dotnet", ...]`), graceful shutdown doesn't work.

## Operational Story

- **Preview deploys**: Not built-in. Use `fly deploy --app <preview-app>` to a separate Fly app created for the PR. Automate via GitHub Actions with `superfly/flyctl-actions`. No branch-preview URL generation out of the box.
- **Secrets**: `fly secrets set KEY=VALUE` stores encrypted env vars per app. Secrets are injected at runtime, not at build time. List with `fly secrets list`. Rotation: set the new value (old is replaced immediately, triggers redeploy). No secret versioning or audit log.
- **Rollback**: `fly releases list --image` to find previous image refs, then `fly deploy --image <registry-uri> --strategy immediate`. No dedicated rollback command. Database migrations are not reversed — rollback is code-only.
- **Approval**: All `flyctl` operations can run unattended (deploy, secrets, scale). Billing changes and app deletion require dashboard access or CLI confirmation. An agent can deploy and manage secrets without human intervention.
- **Logs**: `fly logs` streams real-time logs. Filter by region (`--region iad`) or instance (`--instance <id>`). No persistent log storage — integrate with an external log drain (Logflare, Datadog, etc.) for retention.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| .NET GC over-allocates memory, causing OOM kills | Devil's advocate | High | High | Set `DOTNET_GCHeapHardLimit` env var or `ServerGarbageCollection=false` in csproj. Test with `fly ssh console` to verify memory behavior. |
| No free tier — costs start from day one | Devil's advocate | Certain | Low | ~$4-6/mo is acceptable for MVP. Budget explicitly. |
| Managed Postgres at $38/mo is too expensive for MVP | Devil's advocate | High | Medium | Use Neon or Supabase free tier for MVP database. Accept cross-network latency (~10-30ms). |
| Docker image maintenance overhead for solo dev | Devil's advocate | Medium | Medium | Use a well-optimized multi-stage Dockerfile from day one. Pin base image versions. Keep the Dockerfile simple. |
| Health check kills VM before .NET cold start completes | Unknown unknowns | Medium | High | Add explicit `/healthz` endpoint. Configure `min_machines_running = 1` in fly.toml to avoid cold starts, or increase health check grace period. |
| Data Protection keys lost on deploy (ephemeral FS) | Unknown unknowns | High | High | Configure ASP.NET Data Protection to store keys externally (database or Fly Volume). Set up before first deploy with auth. |
| Docker layer cache eviction slows deploys | Unknown unknowns | Medium | Low | Structure Dockerfile so NuGet restore layer is cached separately from code copy. Use `--build-arg` for cache busting only when needed. |
| Fly MCP server is experimental — may break or be removed | Devil's advocate | Medium | Low | Don't depend on MCP for critical operations. Use `flyctl` CLI directly. |
| Cross-network DB latency exceeds 2s page load NFR | Pre-mortem | Low | Medium | Choose a database provider with a region close to the Fly VM region (e.g., Neon in `us-east-1` with Fly in `iad`). |

## Getting Started

1. **Install flyctl:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. **Authenticate:**
   ```bash
   fly auth signup   # or fly auth login
   ```

3. **Create a Dockerfile** in `backend/Picnivo.API/`:
   ```dockerfile
   FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
   WORKDIR /src
   COPY *.csproj .
   RUN dotnet restore
   COPY . .
   RUN dotnet publish -c Release -o /app

   FROM mcr.microsoft.com/dotnet/aspnet:10.0
   WORKDIR /app
   COPY --from=build /app .
   ENV ASPNETCORE_URLS=http://+:8080
   ENV DOTNET_GCHeapHardLimit=0x10000000
   EXPOSE 8080
   ENTRYPOINT ["dotnet", "Picnivo.API.dll"]
   ```

4. **Launch on Fly.io:**
   ```bash
   cd backend/Picnivo.API
   fly launch --name picnivo-api --region iad --vm-size shared-cpu-1x --vm-memory 512
   ```
   Review the generated `fly.toml`. Ensure `internal_port = 8080` and add a health check:
   ```toml
   [[services.http_checks]]
     interval = 10000
     grace_period = "10s"
     method = "get"
     path = "/healthz"
     protocol = "http"
     timeout = 2000
   ```

5. **Deploy:**
   ```bash
   fly deploy
   ```

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration (beyond the starter Dockerfile in Getting Started)
- CI/CD pipeline setup (GitHub Actions workflow for Fly.io)
- Production-scale architecture (multi-region, HA, DR)

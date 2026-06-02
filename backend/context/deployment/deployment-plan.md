# Fly.io Integration Plan

## Context

The Picnivo backend is a freshly scaffolded .NET 10 minimal API at `backend/Picnivo.API/` with a single placeholder endpoint, HTTPS redirection, and OpenAPI. There is no Dockerfile, no `fly.toml`, no health check, no CI/CD, and no Git remote. The frontend already deploys to Cloudflare Workers separately.

The infrastructure research at `backend/context/foundation/infrastructure.md` specifies Fly.io with shared-cpu-1x / 512MB RAM, a `/healthz` endpoint, and specific .NET tuning (`DOTNET_GCHeapHardLimit`). Fly.io has **no free tier** — expect ~$4-6/month with auto-stop enabled.

**Auto-deploy research conclusion:** Fly.io's built-in GitHub auto-deploy exists but is immature (originally NodeJS-only, poor monorepo support, no build logs, described by Fly staff as "waaay early"). **GitHub Actions with `superfly/flyctl-actions` is the recommended and battle-tested approach.**

---

## Phase 1: Program.cs Adjustments

**File:** `backend/Picnivo.API/Program.cs`

- [x] **Remove `app.UseHttpsRedirection();`** — Fly.io terminates TLS at its proxy and connects to the app over HTTP on port 8080. Leaving this causes an infinite redirect loop.
- [x] **Add health check endpoint** before `app.Run()`:
  ```csharp
  app.MapGet("/healthz", () => Results.Ok("healthy"));
  ```
- [x] **Verify:** `dotnet run` from `Picnivo.API/`, then `curl http://localhost:5230/healthz` returns 200

**Edge case — HTTPS in dev:** Removing `UseHttpsRedirection()` is fine. The `launchSettings.json` has both http/https profiles; dev can use the http profile (port 5230). If HTTPS is needed in dev later, gate it with `if (!app.Environment.IsProduction())`.

---

## Phase 2: Dockerfile

**File to create:** `backend/Dockerfile`

Placed at `backend/` (not `backend/Picnivo.API/`) so the build context is the solution root — standard for .NET monorepos and forward-compatible with test projects added later.

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Picnivo.API/Picnivo.API.csproj Picnivo.API/
RUN dotnet restore Picnivo.API/Picnivo.API.csproj

COPY Picnivo.API/ Picnivo.API/
RUN dotnet publish Picnivo.API/Picnivo.API.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Picnivo.API.dll"]
```

- [x] Create `backend/Dockerfile`
- [ ] **Verify local build:** `docker build -t picnivo-api backend/` *(skipped — Docker not installed locally; will verify via Fly.io remote build)*
- [ ] **Verify local run:** `docker run --rm -p 8080:8080 picnivo-api`, then `curl http://localhost:8080/healthz` *(skipped — no Docker)*

**Key decisions:**
- **Separate restore layer:** `.csproj` copied first — source-only changes skip NuGet restore
- **ENTRYPOINT exec form** (JSON array): dotnet runs as PID 1, receives SIGTERM for graceful shutdown
- **`ASPNETCORE_URLS=http://+:8080`**: Binds all interfaces on port 8080, matching `fly.toml`
- **No `DOTNET_GCHeapHardLimit` here** — set only in `fly.toml` `[env]` to keep the Dockerfile generic for local use

**Edge case — .NET 10 images:** If `mcr.microsoft.com/dotnet/sdk:10.0` doesn't exist yet (preview), use `10.0-preview` tags.

---

## Phase 3: .dockerignore

**File to create:** `backend/.dockerignore`

```
**/bin/
**/obj/
.git/
.gitignore
context/
**/*.md
**/*.http
**/Properties/launchSettings.json
fly.toml
```

- [x] Create `backend/.dockerignore`

**Note:** `appsettings.json` must NOT be excluded — it's needed at runtime. `appsettings.Development.json` is harmless (only loaded when `ASPNETCORE_ENVIRONMENT=Development`).

---

## Phase 4: fly.toml

**File to create:** `backend/fly.toml`

```toml
app = "picnivo-api"
primary_region = "waw"

[build]
  dockerfile = "Dockerfile"

[env]
  ASPNETCORE_ENVIRONMENT = "Production"
  ASPNETCORE_URLS = "http://+:8080"
  DOTNET_GCHeapHardLimit = "0x10000000"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

  [http_service.concurrency]
    type = "requests"
    soft_limit = 200
    hard_limit = 250

[[http_service.checks]]
  grace_period = "10s"
  interval = "15s"
  method = "GET"
  timeout = "5s"
  path = "/healthz"

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"
```

- [x] Create `backend/fly.toml`
- [x] Validate after app creation: `fly config validate` from `backend/`

**Key decisions:**
- **`primary_region = "arn"`** (Stockholm) — closest Fly.io region for EU-based developer
- **`auto_stop_machines = "stop"` / `min_machines_running = 0`** — machine stops when idle, reducing costs. Tradeoff: 3-8s cold start on first request after idle
- **`DOTNET_GCHeapHardLimit = "0x10000000"`** (256MB) — .NET GC may not read cgroup limits on Firecracker VMs; this cap prevents OOM on the 512MB VM
- **`force_https = true`** — Fly.io proxy handles TLS termination and redirects HTTP->HTTPS at the edge
- **Health check grace period 10s** — accounts for .NET cold start (3-8s on shared CPU)

**Edge case — app name conflict:** `picnivo-api` is globally unique on Fly.io. If taken, use `picnivo-api-prod` or similar and update this file.

---

## Phase 5: Backend .gitignore

**File to create:** `backend/.gitignore`

```
bin/
obj/
*.user
*.suo
.vs/
*.DotSettings.user
```

- [x] Create `backend/.gitignore`

---

## Phase 6: Fly.io App Setup (Manual / Interactive Steps)

These are one-time steps requiring interactive auth and billing.

- [x] **Install flyctl:** `brew install flyctl` (or `curl -L https://fly.io/install.sh | sh`)
- [x] **Authenticate:** `fly auth login` (opens browser OAuth; requires Fly.io account with payment method)
- [x] **Create app without deploying:** `fly apps create picnivo`
- [x] **First deploy:** `fly deploy` (from `backend/`, region changed from `waw` to `arn` — Warsaw deprecated)
- [x] **Verify deployment:** `/healthz` returns 200, `/weatherforecast` returns JSON at `https://picnivo.fly.dev/`
- [x] **Create deploy token for CI:**
  ```bash
  fly tokens create deploy -x 999999h --app picnivo-api
  ```
  Save this token — it goes into GitHub Secrets in Phase 7.

**Edge case — billing:** Fly.io requires a credit card. Shared-cpu-1x + 512MB costs ~$4-6/month. With auto-stop, costs drop during idle periods (stopped machines are not billed for CPU).

---

## Phase 7: GitHub Actions Workflow

**Prerequisites:** GitHub remote must exist and the deploy token from Phase 6 must be stored as a secret.

- [x] **Create GitHub repo:** `gh repo create picnivo --private --source=. --push` → https://github.com/jprokopski/picnivo
- [x] **Add secret:** `gh secret set FLY_API_TOKEN`

**File to create:** `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - "backend/**"

concurrency:
  group: deploy-backend
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy to Fly.io
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - run: flyctl deploy --remote-only
        working-directory: backend
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [x] Create `.github/workflows/deploy-backend.yml`
- [ ] **Verify:** Push a backend change to `main`, check GitHub Actions tab

**Key decisions:**
- **Path filter `backend/**`** — only backend changes trigger deploy; frontend-only changes are ignored
- **`--remote-only`** — builds on Fly.io's builders, no Docker needed in CI
- **`working-directory: backend`** — resolves `fly.toml` naturally from `backend/`
- **`cancel-in-progress: false`** — queues deploys instead of canceling mid-build (safer)
- **No test step yet** — no tests exist. When added, insert `dotnet test` before deploy, gated on success

**Edge case — `superfly/flyctl-actions@master`:** Uses latest. Pin to a specific SHA for supply-chain security if desired.

**Edge case — first deploy via CI:** The first deploy must be manual (Phase 6). CI deploys only work after the app exists on Fly.io.

---

## Phase 8: Update AGENTS.md

**File:** `backend/AGENTS.md`

Add deployment commands and Fly.io conventions to the existing content:

- [x] Add to Commands section:
  - `Deploy (manual): fly deploy` (from `backend/`)
  - `Logs: fly logs --app picnivo-api`
  - `SSH: fly ssh console --app picnivo-api`
- [x] Add to Conventions section:
  - No HTTPS redirection in app code — Fly.io terminates TLS at proxy
  - Health check at `/healthz` — keep it fast, no heavy dependencies
  - Secrets via `fly secrets set KEY=VALUE` — never in `fly.toml` or `appsettings`

---

## Phase 9: End-to-End Verification

- [ ] `dotnet build` from `backend/Picnivo.API/` — succeeds
- [ ] `dotnet run` + `curl http://localhost:5230/healthz` — returns 200
- [ ] `docker build -t picnivo-api backend/` — succeeds
- [ ] `docker run --rm -p 8080:8080 picnivo-api` + `curl http://localhost:8080/healthz` — returns 200
- [ ] `fly deploy` from `backend/` — succeeds
- [ ] `curl https://picnivo-api.fly.dev/healthz` — returns 200
- [ ] `curl https://picnivo-api.fly.dev/weatherforecast` — returns JSON
- [ ] `fly status --app picnivo-api` — machine running
- [ ] Wait ~5min idle, `fly status` — machine stopped (auto-stop working)
- [ ] `curl https://picnivo-api.fly.dev/healthz` — machine wakes (expect 3-8s cold start)
- [ ] Push backend change to `main` — GitHub Actions triggers and deploys

---

## Known Limitations (Document Now, Solve Later)

### Data Protection Keys on Ephemeral Storage
.NET stores encryption keys at `/root/.aspnet/DataProtection-Keys/` — wiped on every deploy. **Current impact: zero** (no auth, no cookies). When auth is added, solve with `PersistKeysToDbContext()` once a database exists.

### .NET Cold Start Latency
3-8 seconds on shared-cpu-1x after auto-stop. The health check grace period (10s) covers Fly's checker, but real users experience the delay. Accept for MVP; set `min_machines_running = 1` later if needed (~$4-6/month continuous).

### No Tests in CI
The workflow deploys without tests because none exist. When test projects are added, insert a `dotnet test` step before deploy.

---

## Files Changed Summary

| File | Action | Lines |
|---|---|---|
| `backend/Picnivo.API/Program.cs` | Modify | -1 (HTTPS redirect), +1 (healthz) |
| `backend/Dockerfile` | **Create** | ~16 lines |
| `backend/.dockerignore` | **Create** | ~9 lines |
| `backend/fly.toml` | **Create** | ~30 lines |
| `backend/.gitignore` | **Create** | ~6 lines |
| `.github/workflows/deploy-backend.yml` | **Create** | ~22 lines |
| `backend/AGENTS.md` | Modify | +6 lines |

**Manual steps (no files):** flyctl install, auth, app creation, first deploy, deploy token, GitHub secret.

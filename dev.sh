#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
API_DIR="$ROOT/backend/Picnivo.API"
FRONTEND_DIR="$ROOT/frontend"

# ── colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[dev]${NC} $*"; }
ok()   { echo -e "${GREEN}[dev]${NC} $*"; }
warn() { echo -e "${YELLOW}[dev]${NC} $*"; }
err()  { echo -e "${RED}[dev]${NC} $*" >&2; }

# ── pids for cleanup ───────────────────────────────────────────────────────────
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  log "Shutting down…"
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
  log "Stopping Supabase…"
  (cd "$ROOT" && supabase stop) 2>/dev/null || true
  ok "Done."
}
trap cleanup EXIT INT TERM

# ── prerequisite check ─────────────────────────────────────────────────────────
check() {
  command -v "$1" &>/dev/null || { err "Required tool not found: $1"; exit 1; }
}
check supabase
check dotnet
check pnpm

# ── 1. Supabase (Postgres + Auth) ──────────────────────────────────────────────
log "Starting Supabase (Postgres + Auth)…"
cd "$ROOT"
supabase start \
  -x realtime,storage-api,imgproxy,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor \
  2>&1 | grep -v "^$" | sed "s/^/${CYAN}[supabase]${NC} /" || true

ok "Supabase running  →  DB: localhost:54322  |  Auth: localhost:54321"

# ── 2. DB migrations ───────────────────────────────────────────────────────────
log "Applying EF Core migrations…"
(cd "$BACKEND_DIR" && dotnet ef database update --project Picnivo.API 2>&1 \
  | sed "s/^/${CYAN}[migrate]${NC} /")
ok "Migrations applied."

# ── 3. .NET backend ────────────────────────────────────────────────────────────
log "Starting .NET backend on http://localhost:5000…"
(cd "$API_DIR" && ASPNETCORE_ENVIRONMENT=Development \
  dotnet run --urls "http://localhost:5000" 2>&1 \
  | sed "s/^/${CYAN}[backend]${NC} /") &
BACKEND_PID=$!

# wait until the backend health check responds
log "Waiting for backend to be ready…"
for i in $(seq 1 30); do
  if curl -sf http://localhost:5000/healthz &>/dev/null; then
    ok "Backend ready  →  http://localhost:5000"
    break
  fi
  sleep 1
  if [[ $i -eq 30 ]]; then
    err "Backend did not start within 30 s — check logs above"
    exit 1
  fi
done

# ── 4. Frontend ────────────────────────────────────────────────────────────────
log "Starting frontend on http://localhost:3000…"
(cd "$FRONTEND_DIR" && pnpm dev 2>&1 \
  | sed "s/^/${CYAN}[frontend]${NC} /") &
FRONTEND_PID=$!

# ── 5. Summary ─────────────────────────────────────────────────────────────────
echo ""
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "  Frontend  →  http://localhost:3000"
ok "  Backend   →  http://localhost:5000"
ok "  Auth      →  http://localhost:54321"
ok "  Database  →  localhost:54322"
ok "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ok "Press Ctrl+C to stop everything."
echo ""

# keep the script alive until a child exits unexpectedly
wait $BACKEND_PID $FRONTEND_PID

---
name: verify
description: Run all checks across the monorepo — frontend tests + type check, backend build. Use after making changes to confirm nothing is broken.
---

Run the following checks in order, stopping on first failure:

1. **Frontend type check**: `cd frontend && pnpm exec tsc --noEmit`
2. **Frontend tests**: `cd frontend && pnpm test`
3. **Backend build**: `cd backend/Picnivo.API && dotnet build --nologo -v q`

Report results as a checklist:
- [ ] or [x] Frontend types
- [ ] or [x] Frontend tests
- [ ] or [x] Backend build

If any check fails, diagnose the issue and suggest a fix.

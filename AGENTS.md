# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## Project Structure

Monorepo with two independent projects:

- `frontend/` — TanStack Start (React 19) + Tailwind CSS v4, managed with pnpm
- `backend/Picnivo.API/` — .NET 10 ASP.NET Core Web API

## Testing

Write tests for all new features.

## Git Workflow

Feature branches off main, merged via pull request.

## Context Organization

Root `context/` holds the global product vision and cross-cutting decisions. Frontend- and backend-specific context (architecture, conventions, local decisions) belongs in `frontend/context/` and `backend/context/` respectively.

`lessons.md` exists in three places — `context/foundation/lessons.md` (cross-cutting), `frontend/context/foundation/lessons.md`, and `backend/context/foundation/lessons.md`. Any skill or agent that uses lessons as review/planning priors (e.g. `/10x-plan`, `/10x-plan-review`, `/10x-implement`, `/10x-impl-review`) must read every lessons file relevant to the files under review — not just the root one. A change touching both `frontend/` and `backend/` needs all three.

## Product Context

MVP event coordinator for small groups — see `@context/foundation/prd.md` for full requirements.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 4 (E2E Tests)

**For E2E tests, use the `/10x-e2e` skill.** See `context/foundation/test-plan.md`
§6.7 for the full workflow, hard rules, and the DOM-vs-vision / healer
boundaries — kept there alongside the rest of the test strategy instead of
duplicated here.

<!-- END @przeprogramowani/10x-cli -->

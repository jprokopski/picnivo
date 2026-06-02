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

## Product Context

MVP event coordinator for small groups — see `@context/foundation/prd.md` for full requirements.

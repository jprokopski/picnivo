# Layout & Auth Design Alignment — Plan Brief

> Full plan: `context/changes/layout-auth-design-alignment/plan.md`
> Frame brief: `context/changes/layout-auth-design-alignment/frame.md`

## What & Why

The global layout and auth pages are *not missing* — they exist but diverge from the design in
three concrete ways, so the work is **alignment + prune, not build-from-scratch**: (a) a layout
split so auth/public pages render chrome-free while app pages keep nav + footer; (b) rebuild
`/login` to the design's `WebAuth` split-panel on the current token set (the current forms
reference a *removed* token set — 0 matches in `styles.css`); (c) delete `/dashboard` and
repoint the app's landing surface to `/events`.

## Starting Point

`__root.tsx` wraps every route in Header + Footer (including chrome-free auth). Header/Footer,
Supabase auth functions, and both auth routes already exist and work — but `/login`,
`/register`, and part of `/auth/callback` are styled against a dead token set, and `/dashboard`
(off-design) is the redirect target of four different routes.

## Desired End State

Auth pages render chrome-free; app pages keep the full chrome; the public `/e/$token` page
shows full nav to logged-in users and a logo-only bar to guests. `/login` matches the design's
split-panel with a unified signin/signup toggle and show/hide password; `/register` redirects
into it. `/dashboard` is gone, `/` → `/events`, and no dead tokens remain anywhere.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Problem framing | Alignment + prune, not build | Layout/auth exist but diverge (token drift + composition + inventory) | Frame |
| Chrome split mechanism | Pathless `_app` layout route | Idiomatic TanStack way to share chrome across guarded + public routes | Plan |
| Auth route structure | Collapse to one `/login`, redirect `/register` | Closest 1:1 to the design's single-component toggle | Plan |
| Public page chrome | Conditional: full nav for users, logo-only bar for guests | Guest can't use auth-only nav actions | Plan |
| Auth affordances | Show/hide password only | Remember-me/agree/forgot need flows that don't exist yet | Plan |
| Brand scene | Port `AuthScene` faithfully | "Match the design before improvising" (CLAUDE.md) | Plan |
| Styling approach | Tailwind utilities on current tokens | Matches the established header/footer port convention | Plan |

## Scope

**In scope:** chrome/no-chrome route split; logo-only guest header; delete `/dashboard`;
repoint 4 redirects to `/events`; rebuild `/login` as the design split-panel; collapse
`/register`; port `AuthScene` + `AvatarStack`; show/hide password; remove all dead tokens.

**Out of scope:** password reset, Terms/Privacy pages, Apple sign-in, remember-me,
agree-to-terms; any change to auth server functions; a new landing/marketing page; content
redesign of `/events` / `/create` / `/e/$token`.

## Architecture / Approach

New pathless `routes/_app.tsx` renders `Header` + `<Outlet />` + `Footer`; `_authenticated`
and `e/$token` move under it while `login`/`register`/`callback`/`index` stay at the root
(chrome-free). `__root` drops its Header/Footer. Auth UI is a single `AuthPanel` (mode-driven
signin/signup) + ported `AuthScene`/`AvatarStack` under `src/features/auth/`, styled with
Tailwind on current CSS tokens. `/login` carries the mode in a search param so the toggle and
`/register` redirect deep-link correctly.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Layout split & route pruning | Correct chrome per surface; `/dashboard` gone; all redirects → `/events` | Deleting `/dashboard` type-errors 4 redirect sites unless all repoint together |
| 2. Auth redesign to WebAuth | Design-matched `/login` split-panel; `/register` redirect; zero dead tokens | Faithful pixel-art `AuthScene` port; responsive split-panel |

**Prerequisites:** none — all wiring and assets are in place.
**Estimated effort:** ~2 sessions across 2 phases.

## Open Risks & Assumptions

- Moving routes under `_app` changes route IDs; relies on regenerated `routeTree.gen.ts`
  (fullPaths unchanged, so `<Link>`s keep working).
- The guest header is only ever seen on `/e/$token`; making the no-user branch logo-only is
  assumed safe because auth pages are chrome-free and app pages require auth.
- `AuthScene` port fidelity depends on faithfully transcribing the pixel-rect SVG (mitigated
  by reusing existing `BASKET_PIXELS`).

## Success Criteria (Summary)

- Each surface shows the right chrome; `/dashboard` unreachable; every auth path lands on
  `/events`.
- `/login` visually matches the design split-panel and the signin/signup toggle + show/hide
  password work.
- `grep` for the dead token set returns nothing; typecheck, tests, lint, and build all pass.

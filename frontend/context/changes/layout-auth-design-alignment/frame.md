# Frame Brief: Layout & Auth "Missing" → Design Alignment + Prune

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

"Implement a missing global layout and auth pages from
`frontend/context/foundation/design`." Plus a follow-up: "also delete pages which
aren't included in design."

## Initial Framing (preserved)

- **User's stated cause or approach**: The global layout and auth pages are *missing*
  and must be built from the design references.
- **User's proposed direction**: Implement them from `frontend/context/foundation/design`;
  then delete any pages not represented in the design.
- **Pre-dispatch narrowing**: User confirmed the pages **"exist but are off-design"**
  (not genuinely absent); chose a **layout split** (auth/public chrome-free, app pages get
  nav+footer); chose to **delete `/dashboard` and repoint home → `/events`**.

## Dimension Map

The observation ("layout + auth missing") could originate at any of these dimensions:

1. **Existence** — the components/routes genuinely don't exist. *(initial framing)*
2. **Layout composition** — layout exists, but it wraps every route uniformly, so auth
   pages get nav/footer chrome the design renders chrome-free.
3. **Design-token drift** — auth/dashboard pages exist but are styled against an old token
   set that no longer exists, so they render off-design (look "missing").
4. **Route inventory drift** — routes exist that have no design counterpart (`/dashboard`),
   making the app diverge from the design's page set.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Layout genuinely absent | `src/routes/__root.tsx:41-42` renders `<Header/>{children}<Footer/>`; `src/components/header.tsx:54-197` is a near-faithful port of design `WebNav` (`picnivo-web-app.jsx:20-69`), using current tokens (`--accent`, `--ink`, `--sh-pop`). Footer exists. | **NONE** |
| 1. Auth genuinely absent | `src/routes/login.tsx`, `register.tsx`, `auth/callback.tsx` all exist; Supabase wiring in `src/lib/auth/functions.ts`, `src/lib/supabase/*`. Fully functional. | **NONE** |
| 2. Layout composition gap | `__root.tsx:41-42` wraps ALL routes (incl. `/login`) in Header+Footer; design (`picnivo-web-app.jsx:92-107`) shows auth full-bleed with NO nav/footer. | **STRONG** |
| 3. Design-token drift (auth off-design) | `login.tsx`/`register.tsx`/`dashboard.tsx` use `--sea-ink`, `--lagoon`, `--surface-strong`, `island-shell`, `island-kicker`, `display-title` → **0 matches** in `src/styles.css`. Design `WebAuth` (`picnivo-web-auth.jsx:141-254`) is a split-panel with brand scene, unified signin/signup toggle, Google, show/hide password, remember/agree — none of which the current forms have. | **STRONG** |
| 4. Route inventory drift | `/dashboard` (`_authenticated/dashboard.tsx`) shows only email + sign-out, uses the dead token set, and has **no design counterpart** (design home = "My events"). `index.tsx:5` redirects `/` → `/dashboard`. | **STRONG** |

## Narrowing Signals

Decisive observations that collapsed the hypothesis space:

- Token grep: the auth/dashboard token & class names return **0 matches** in `styles.css`
  while header tokens return 7–10 matches → the auth pages are built on a *removed* design
  system, not the current one. This is why they read as "missing" even though they exist.
- Design `WebApp` renders `WebAuth` **outside** the nav/footer shell → the design intends a
  layout split, which `__root.tsx` does not implement.
- No route maps to the design "dashboard" — the design's landing surface after auth is
  "My events" (`picnivo-web-events.jsx`), confirming `/dashboard` is the off-design page.
- User confirmed all three: "exist but off-design", "split chrome vs auth", "delete
  /dashboard, home→events".

## Cross-System Convention

This class of work ("bring page X to the design") is a **re-skin/recompose against existing
wiring**, not a greenfield build. The header already demonstrates the convention: port the
design component to React + TanStack + current CSS tokens, preserving behavior. The auth
pages should follow the same path. TanStack Router's pathless layout routes
(`_app`-style) are the idiomatic mechanism for the chrome/no-chrome split — matching how
`_authenticated.tsx` already groups routes.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the global layout and auth pages are *not
> missing* — they exist but diverge from the design in three concrete ways, so the work is
> **alignment + prune, not build-from-scratch**: (a) introduce a layout split so auth/public
> pages render chrome-free while app pages keep nav+footer; (b) rebuild `/login` and
> `/register` to match the design's `WebAuth` on the current token set (they currently
> reference a dead one); (c) delete `/dashboard` and repoint `/` → `/events`.

Addressing this prevents /10x-plan from scaffolding duplicate header/footer/auth components
that already exist, and instead targets the real gaps: layout composition, token/visual
drift, and route inventory. If the plan were built on "implement missing X," it would
produce redundant files and miss the token-drift root cause entirely.

## Confidence

- **HIGH** — three hypotheses have strong file:line evidence and none support the "absent"
  framing; the token-drift grep is a decisive, objective signal; convention (header port)
  matches; and the user confirmed all three narrowing decisions.

## What Changes for /10x-plan

The plan should be titled around **design alignment**, not implementation of missing
features. Scope: (1) layout-route split (chrome vs chrome-free auth/public); (2) rebuild
`login.tsx`/`register.tsx` to the design `WebAuth` (split-panel default per tweak
`authLayout: 'split'`) on current `styles.css` tokens, reusing existing Supabase server
functions unchanged; (3) delete `_authenticated/dashboard.tsx`, repoint `index.tsx` redirect
to `/events`, and update post-auth `navigate({ to: '/dashboard' })` calls in
`login.tsx`/`register.tsx` to `/events`. Watch-outs: the dead token set also affects
`dashboard.tsx` (being deleted) — verify no other route still references removed tokens;
port design's brand `AuthScene`/`Logo`/`AvatarStack` from `picnivo-kit.jsx`; keep Lingui
`<Trans>` wrapping.

## References

- Source files (current): `src/routes/__root.tsx:41-42`, `src/components/header.tsx:54-197`,
  `src/routes/login.tsx`, `src/routes/register.tsx`, `src/routes/index.tsx:5`,
  `src/routes/_authenticated/dashboard.tsx`, `src/styles.css` (token grep)
- Design references: `frontend/context/foundation/design/picnivo-web-auth.jsx:141-254`,
  `picnivo-web-app.jsx:20-118`, `picnivo-web-events.jsx`, `picnivo-kit.jsx`
- Investigation: direct file reads + token-drift grep (no parallel sub-agents needed —
  evidence was conclusive after the structure map + grep; hypothesis padding avoided)

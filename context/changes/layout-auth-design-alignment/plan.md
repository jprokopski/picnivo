# Layout & Auth Design Alignment Implementation Plan

## Overview

Bring the app's layout composition and authentication pages into alignment with the
design references in `frontend/context/foundation/design/`, and prune the one route that
has no design counterpart. This is **re-skin + recompose against existing wiring**, not a
greenfield build — the layout, header, footer, and Supabase auth functions already exist
and work. Three concrete gaps close:

1. **Layout composition** — `__root.tsx` wraps *every* route in Header + Footer, but the
   design renders auth full-bleed (chrome-free) and the public event page with only
   branding for guests. Introduce a chrome/no-chrome route split.
2. **Auth token/visual drift** — `login.tsx` / `register.tsx` are styled against a removed
   token set (`--sea-ink`, `--lagoon`, `island-shell`, … → 0 matches in `styles.css`) and
   lack the design's `WebAuth` split-panel, unified signin/signup toggle, and show/hide
   password. Rebuild `/login` on the current token set; collapse `/register` into it.
3. **Route inventory** — `/dashboard` uses the dead token set and has no design counterpart.
   Delete it; repoint the app's landing surface to `/events`.

## Current State Analysis

- **Root layout wraps all routes uniformly.** `src/routes/__root.tsx:40-43` renders
  `<Header />{children}<Footer />` inside `RootDocument` for every route, including
  chrome-free auth. `Header`/`Footer` are only imported here.
- **Header/Footer already follow the porting convention.** `src/components/header.tsx` and
  `footer.tsx` port the design's `WebNav`/`web-footer` as **Tailwind utilities referencing
  current CSS tokens** (`bg-(--card)`, `text-(--ink)`, `shadow-(--sh-pop)`, `rounded-(--r-md)`),
  *not* the design's `.web-*`/`.pv-*` CSS classes. This is the established convention for all
  new UI in this repo (confirmed by `frontend/CLAUDE.md` → "Match [the design] before
  improvising"). The auth port must follow the same path.
- **`_authenticated` is guard-only.** `src/routes/_authenticated.tsx` is a pathless route
  whose component is `() => <Outlet />`; it redirects to `/login` when `context.user` is null.
  Children: `events.tsx`, `create.tsx`, `dashboard.tsx`.
- **Auth pages reference a dead token set.** `login.tsx`, `register.tsx`, and (partially)
  `auth/callback.tsx` use `--sea-ink*`, `--lagoon*`, `--surface-strong`, `--link-bg-hover`,
  `island-shell`, `island-kicker`, `display-title` — **0 matches** in `src/styles.css`.
- **Four routes redirect to `/dashboard`** (not three — the frame missed the callback):
  - `index.tsx:5` → `/dashboard`
  - `login.tsx:40` fallback → `/dashboard`
  - `register.tsx:36` navigate → `/dashboard`
  - `auth/callback.tsx:23,37` `next` default → `/dashboard`
  Because TanStack types `navigate({ to })` against the route tree, **deleting `/dashboard`
  will type-error every one of these until repointed** — they must change in the same phase.
- **Design `WebAuth` is one unified component**
  (`picnivo-web-auth.jsx:141-254`): a split-panel (brand scene on the left, form on the
  right) with an internal `mode` toggle (`'signin' | 'signup'`), a "Continue with Google"
  button, email + password (+ name on signup), a show/hide password reveal, and an in-panel
  toggle link. `authLayout: 'split'` is the tweak default (`picnivo-web-app.jsx:16`).
- **Design brand scene (`AuthScene`)** is a hand-built pixel-rect SVG (beach sunset) that
  embeds the basket-logo pixel art via `renderBasketPixels`. No React equivalent exists, but
  the basket pixel data already lives in `src/components/logo.tsx` (`BASKET_PIXELS`) and can
  be reused. Visual spec (dimensions, gradients, layout) is in
  `picnivo-web.css:560-756` (`.web-auth*`, `.web-oauth`, `.pv-input`).
- **Existing reusable assets:** `Logo` (`src/components/logo.tsx`), `Avatar`
  (`src/components/avatar.tsx`), shadcn `Button`/`Input`/`Label`/`Card` (`src/components/ui/`).
  `AvatarStack` and `AuthScene` do **not** exist yet.
- **No existing tests** touch login/register/dashboard/auth — clean slate for new tests.

## Desired End State

After both phases:

- **Chrome per surface is correct.** Auth pages (`/login`, `/register` redirect,
  `/auth/callback`) render chrome-free (no Header/Footer). App pages (`/events`, `/create`)
  render with the full Header + Footer. The public shared event page (`/e/$token`) renders
  inside the chrome, where the Header shows **full auth actions to logged-in users and a
  single "Log in" button to guests**.
- **`/login` matches the design `WebAuth` split-panel** on the current token set: unified
  signin/signup toggle, brand scene, Google button, show/hide password. `/register` redirects
  to `/login?mode=signup`.
- **`/dashboard` is gone**; `/` → `/events`; all post-auth navigation lands on `/events`.
- **Zero references** to the dead token set remain (`grep` clean).

Verify: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm lint`, `pnpm build` all pass; manual
walkthrough of each surface; `grep -rn "sea-ink\|lagoon\|surface-strong\|island-shell\|island-kicker\|display-title\|link-bg-hover" src/` returns nothing.

### Key Discoveries:

- Porting convention = Tailwind utilities on current CSS tokens, per `header.tsx:8-15`.
- `_app` pathless layout route is the idiomatic TanStack mechanism to share chrome across
  both the guarded `_authenticated` group and the public `e/$token` route
  (mirrors how `_authenticated.tsx` already groups routes).
- Deleting `/dashboard` forces the four redirect repoints into the same phase (typed `to`).
- The callback page is a fourth `/dashboard` site **and** carries a dead token
  (`auth/callback.tsx:45`) — both fixed in Phase 1.
- Basket pixel data for `AuthScene` already exists in `logo.tsx` (`BASKET_PIXELS`).

## What We're NOT Doing

- **No remember-me, agree-to-terms, or forgot-password** affordances (design shows them; user
  scoped them out). Only show/hide password is in scope.
- **No password-reset flow, no Terms/Privacy pages, no Apple sign-in.**
- **No changes to Supabase auth server functions** (`src/lib/auth/functions.ts`,
  `src/lib/supabase/*`) — `signInFn`, `signUpFn`, `signOutFn`, session/callback wiring are
  reused unchanged.
- **No new landing/marketing page** — `/` redirects straight to `/events` (which bounces
  unauthenticated users to `/login` via the existing guard).
- **No redesign of `/events`, `/create`, or `/e/$token` content** — only their layout
  wrapping (chrome) changes.
- **No adoption of the design's `.web-*`/`.pv-*` CSS classes** — we translate to Tailwind on
  current tokens, matching the header/footer convention.

## Implementation Approach

Two phases, each independently verifiable:

- **Phase 1** restructures routing (chrome split), prunes `/dashboard`, and repoints every
  redirect — a self-contained, type-checkable change that leaves auth *functional but still
  visually old*. This de-risks the structural move from the visual rebuild.
- **Phase 2** rebuilds the auth UI: a new `AuthPanel` + `AuthScene` under
  `src/features/auth/`, `/login` gaining a `mode` search param, and `/register` collapsing to
  a redirect. Purely additive-then-swap, isolated to the auth feature.

## Critical Implementation Details

- **Typed-route ordering (Phase 1).** `/dashboard` deletion and the four redirect repoints
  must land together, or `tsc` fails on `to: '/dashboard'`. Regenerate the route tree
  (`routeTree.gen.ts` is generated by the router plugin on `pnpm dev`/`pnpm build`) after
  moving files; do not hand-edit it.
- **Shared chrome mechanism (Phase 1).** A pathless `_app.tsx` layout route renders
  `<Header /><Outlet /><Footer />`. `_authenticated` (and its children) and `e/$token` move
  *under* `_app/`; their `fullPath`s (`/events`, `/create`, `/e/$token`) are unchanged, so
  `<Link to="/events">` etc. keep working — only internal route IDs change, and those are
  regenerated.
- **Guest header (Phase 1).** The public event page is the *only* surface where an
  unauthenticated user sees chrome. Header's `user`-null branch drops the old Log in / Sign up
  button *pair* down to a single "Log in" button — no logo-only requirement.
- **Mode as search param (Phase 2).** `/login` toggling signin↔signup updates a `mode` search
  param via `navigate({ search, replace: true })` rather than pure local state, so
  `/register` → `/login?mode=signup` deep-links correctly and the toggle is bookmarkable.

## Phase 1: Layout Split & Route Pruning

### Overview

Split chrome from chrome-free surfaces via a pathless `_app` layout, collapse the guest header's
Log in / Sign up pair to a single "Log in" button, delete `/dashboard`, and repoint all four
`/dashboard` redirects to `/events` (fixing the callback's dead token in passing). Auth pages
remain functional but visually old.

### Changes Required:

#### 1. Shared chrome layout route

**File**: `src/routes/_app.tsx` (new)

**Intent**: Own the Header + Footer chrome for all app/public surfaces so `__root` can stay
chrome-free. Renders the layout around a nested `<Outlet />`.

**Contract**: A pathless layout route (`createFileRoute('/_app')`) whose `component` renders
`<Header />` then `<Outlet />` then `<Footer />`. No guard logic here (auth stays in
`_authenticated`).

#### 2. Move guarded + public routes under `_app`

**Files**: move `src/routes/_authenticated.tsx` → `src/routes/_app/_authenticated.tsx`;
`src/routes/_authenticated/{events,create}.tsx` → `src/routes/_app/_authenticated/`;
`src/routes/e/$token.tsx` → `src/routes/_app/e/$token.tsx`.

**Intent**: Nest every chrome-bearing route beneath the new `_app` layout while leaving auth
routes (`login`, `register`, `auth/callback`) and `index` at the root (chrome-free).

**Contract**: `fullPath`s stay identical (`/events`, `/create`, `/e/$token`); only route IDs
gain the `_app` segment. `_authenticated`'s guard and `component: () => <Outlet />` are
unchanged. Regenerate `routeTree.gen.ts`.

#### 3. Strip chrome from the document shell

**File**: `src/routes/__root.tsx`

**Intent**: Remove Header/Footer (and their imports) from `RootDocument` so the root renders
only the html/body shell, i18n provider, `{children}`, and devtools.

**Contract**: `RootDocument` no longer imports or renders `Header`/`Footer`; `{children}` sits
directly inside `<I18nProvider>`.

#### 4. Guest header CTA

**File**: `src/components/header.tsx`

**Intent**: When there is no `user`, collapse the old Log in / Sign up button pair to a single
"Log in" button. Logged-in rendering is unchanged.

**Contract**: The `user`-null branch of the right-hand column renders a single `Link to="/login"`
button (already implemented); no further change needed here.

#### 5. Delete `/dashboard` and repoint redirects

**Files**: delete `src/routes/_app/_authenticated/dashboard.tsx`; edit `src/routes/index.tsx`,
`src/routes/login.tsx`, `src/routes/register.tsx`, `src/routes/auth/callback.tsx`.

**Intent**: Remove the off-design route and point every landing/post-auth redirect at
`/events`.

**Contract**:
- `index.tsx`: `redirect({ to: '/events' })`.
- `login.tsx:40`: fallback `'/dashboard'` → `'/events'`.
- `register.tsx:36`: `navigate({ to: '/dashboard' })` → `{ to: '/events' }`.
- `auth/callback.tsx`: `next` default `'/dashboard'` → `'/events'` (both `validateSearch` and
  the final `redirect`).
- All four must change in this phase (typed `to`).

#### 6. Fix callback dead token

**File**: `src/routes/auth/callback.tsx`

**Intent**: Replace the removed `--sea-ink-soft` token on the "Completing sign in…" message
with a current token so the page renders on-design, and fix the now-stale chrome-height
offset (the `8rem` reserved for the Header+Footer this plan removes).

**Contract**: `text-(--sea-ink-soft)` → `text-(--ink-soft)`; on the same `<main>`,
`min-h-[calc(100vh-8rem)]` → `min-h-screen` (page is now chrome-free, so it should fill
the viewport rather than subtract the removed chrome).

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Tests pass: `pnpm test`
- Linting passes: `pnpm lint`
- Production build succeeds (regenerates route tree): `pnpm build`
- No `/dashboard` route references remain in source (excluding generated tree):
  `grep -rn "dashboard" src/routes src/components` returns nothing
- No dead tokens remain in `auth/callback.tsx`: `grep -n "sea-ink" src/routes/auth/callback.tsx`
  returns nothing

#### Manual Verification:

- `/events` and `/create` render with Header + Footer.
- `/login` and `/register` render chrome-free (no Header/Footer).
- `/e/$token`: logged-in user sees the full app nav; a guest (logged out) sees a logo bar
  plus a single "Log in" button; footer branding present.
- Visiting `/` while logged out lands on `/login`; while logged in lands on `/events`.
- Google/email sign-in and sign-up both land on `/events`; OAuth callback lands on `/events`.
- No `/dashboard` is reachable.

**Implementation Note**: After completing this phase and all automated verification passes,
pause here for manual confirmation from the human that the manual testing was successful
before proceeding to Phase 2.

---

## Phase 2: Auth Redesign to Design WebAuth

### Overview

Rebuild `/login` as the design's `WebAuth` split-panel on the current token set: a unified
signin/signup toggle, ported `AuthScene` brand art, Google button, and show/hide password.
Collapse `/register` into a redirect to `/login?mode=signup`. Remove all remaining dead tokens.

### Changes Required:

#### 1. AuthScene brand art

**File**: `src/features/auth/components/AuthScene.tsx` (new)

**Intent**: Faithfully port the design's `AuthScene` pixel-rect beach-sunset SVG, reusing the
existing basket pixel data for the embedded logo.

**Contract**: A React component rendering the `viewBox="0 0 480 224"` SVG with the
`preserveAspectRatio="xMidYMax slice"` cover behavior from `picnivo-web-auth.jsx:104-128`.
Reuse `BASKET_PIXELS` from `src/components/logo.tsx` (export it if not already) rather than
re-transcribing the basket. Styling via Tailwind/inline on current tokens.

#### 2. AvatarStack

**File**: `src/features/auth/components/AvatarStack.tsx` (new)

**Intent**: Port the design's overlapping avatar stack used in the brand panel, built on the
existing `Avatar`.

**Contract**: `({ names, max?, size? })` → row of overlapping `Avatar`s with a `+N` overflow
chip, per `picnivo-kit.jsx:235-248`. Local to the auth feature (only consumer for now).

#### 3. AuthPanel (unified signin/signup)

**File**: `src/features/auth/components/AuthPanel.tsx` (new)

**Intent**: The design's `WebAuth` split-panel as a single component driven by a `mode` prop
(`'signin' | 'signup'`): brand panel (gradient + `AuthScene` + `Logo` + headline +
`AvatarStack`) on the left, form on the right (Google button, name field on signup, email,
password with show/hide reveal, submit). Imports `signInFn`/`signUpFn` unchanged from
`lib/auth/functions`. The Google OAuth trigger is currently **inline** (duplicated in
`login.tsx:44-56` and `register.tsx:39-51`, calling
`createSupabaseBrowserClient().auth.signInWithOAuth({ provider: 'google', options: {
redirectTo: \`${origin}/auth/callback\` } })`) — port that ~13-line logic into `AuthPanel`
(there is no shared handler to import). All text wrapped in Lingui `<Trans>`/`useLingui`.

**Contract**: Props `{ mode, redirect, onToggleMode }`. Submit gating: disabled until
email + password present (and name present on signup). On success — signin: navigate to the
safe `redirect` (must start with `/` and not `//`) else `/events`; signup: navigate to
`/events`. Error state rendered inline. Styled with Tailwind utilities on current tokens
(`--card`, `--ink`, `--line`, `--accent`, `--accent-deep`, `--sh-*`, `--r-*`), following
`header.tsx`; visual spec from `picnivo-web.css:560-756`. Show/hide password toggles the input
`type` between `password`/`text`. No remember-me, agree-to-terms, or forgot-password elements.

#### 4. `/login` route wiring

**File**: `src/routes/login.tsx`

**Intent**: Serve `AuthPanel`, with the signin/signup mode carried in the URL so the toggle
and the `/register` redirect deep-link correctly.

**Contract**: `validateSearch` returns `{ redirect: string, mode: 'signin' | 'signup' }`
(mode default `'signin'`). Component reads both, renders `<AuthPanel mode redirect
onToggleMode={…} />`, where `onToggleMode` calls `navigate({ search: (p) => ({ ...p, mode }),
replace: true })`. Remove all dead-token markup (now lives in `AuthPanel`).

#### 5. Collapse `/register` to a redirect

**File**: `src/routes/register.tsx`

**Intent**: Retire the standalone register form; send `/register` to the unified login in
signup mode.

**Contract**: Route reduces to `beforeLoad: () => { throw redirect({ to: '/login', search: {
redirect: '', mode: 'signup' } }) }`. No component. Removes the last dead-token markup outside
of deleted files.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm exec tsc --noEmit`
- Tests pass (incl. new `AuthPanel` tests): `pnpm test`
- Linting passes: `pnpm lint`
- Production build succeeds: `pnpm build`
- No dead tokens anywhere in source:
  `grep -rn "sea-ink\|lagoon\|surface-strong\|island-shell\|island-kicker\|display-title\|link-bg-hover" src/`
  returns nothing
- Lingui catalog re-extracts cleanly (drops stale dashboard entries): `pnpm extract`

#### Manual Verification:

- `/login` renders the split-panel matching the design (brand scene + gradient left, form
  right) on the current palette.
- The in-panel toggle switches between signin and signup, updating the URL `mode`; the name
  field appears only in signup.
- Show/hide password reveals/masks the field.
- Email sign-in, email sign-up, and Google all authenticate and land on `/events` (or the
  safe `redirect` for signin).
- Visiting `/register` redirects to `/login` in signup mode.
- Responsive: the brand panel collapses gracefully on narrow viewports (form remains usable).

**Implementation Note**: After completing this phase and all automated verification passes,
pause for manual confirmation from the human that the manual testing was successful.

---

## Testing Strategy

### Unit / Component Tests (Vitest + Testing Library):

- **`AuthPanel.test.tsx`** (co-located in `src/features/auth/components/`):
  - Signup mode renders the name field; signin mode does not.
  - Submit button is disabled until required fields are filled (email + password; + name for
    signup).
  - Show/hide toggle flips the password input `type`.
  - Submitting signin calls `signInFn`; signup calls `signUpFn` (mock the auth functions).
  - An error from the auth function renders inline.
- Keep tests behavioral (query by role/label), not styling-coupled.

### Integration / Route Tests:

- Covered by type-checking (typed `to`/`search`) + manual verification for redirects
  (`/register` → `/login?mode=signup`, `/` → `/events`, callback → `/events`).

### Manual Testing Steps:

1. Logged out, visit `/` → lands on `/login` (chrome-free).
2. Toggle to signup, register with email → lands on `/events` (with chrome).
3. Sign out, sign in with Google → OAuth callback → `/events`.
4. Open a share link `/e/$token` while logged out → logo bar + single Log in button; while
   logged in → full nav.
5. Visit `/register` directly → redirected to `/login` in signup mode.
6. Confirm `/dashboard` 404s / is unreachable.

## Performance Considerations

Negligible. `AuthScene` is a static inline SVG of small rects rendered once on the auth
route (not on app pages). No new data fetching or client bundles of note.

## Migration Notes

No data or schema migration. `routeTree.gen.ts` is regenerated by the router plugin — do not
hand-edit. Stale `/dashboard` entries in `src/locales/en/messages.po` are cleaned by
`pnpm extract` (`lingui extract --clean`).

## References

- Frame brief: `context/changes/layout-auth-design-alignment/frame.md`
- Design references: `frontend/context/foundation/design/picnivo-web-auth.jsx:141-254`,
  `picnivo-web-app.jsx:16-118`, `picnivo-web.css:560-756`, `picnivo-kit.jsx:218-248`
- Current source: `src/routes/__root.tsx:40-43`, `src/routes/_authenticated.tsx`,
  `src/routes/{login,register,index}.tsx`, `src/routes/auth/callback.tsx`,
  `src/components/{header,footer,logo,avatar}.tsx`, `src/styles.css`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Layout Split & Route Pruning

#### Automated

- [x] 1.1 Type checking passes: `pnpm exec tsc --noEmit`
- [x] 1.2 Tests pass: `pnpm test`
- [x] 1.3 Linting passes: `pnpm lint`
- [x] 1.4 Production build succeeds: `pnpm build`
- [x] 1.5 No `/dashboard` route references remain in `src/routes`/`src/components`
- [x] 1.6 No dead tokens remain in `auth/callback.tsx`

#### Manual

- [x] 1.7 `/events` and `/create` render with Header + Footer
- [x] 1.8 `/login` and `/register` render chrome-free
- [x] 1.9 `/e/$token` shows full nav to logged-in users, logo bar + single Log in button to guests
- [x] 1.10 `/` routes correctly by auth state (logged out → `/login`, in → `/events`)
- [x] 1.11 All sign-in/sign-up/OAuth paths land on `/events`
- [x] 1.12 `/dashboard` is unreachable

### Phase 2: Auth Redesign to Design WebAuth

#### Automated

- [ ] 2.1 Type checking passes: `pnpm exec tsc --noEmit`
- [ ] 2.2 Tests pass (incl. new `AuthPanel` tests): `pnpm test`
- [ ] 2.3 Linting passes: `pnpm lint`
- [ ] 2.4 Production build succeeds: `pnpm build`
- [ ] 2.5 No dead tokens anywhere in `src/` (grep clean)
- [ ] 2.6 Lingui catalog re-extracts cleanly: `pnpm extract`

#### Manual

- [ ] 2.7 `/login` renders the design split-panel on the current palette
- [ ] 2.8 Signin/signup toggle updates URL `mode`; name field appears only in signup
- [ ] 2.9 Show/hide password toggle works
- [ ] 2.10 Email signin, email signup, and Google all land on `/events` (or safe redirect)
- [ ] 2.11 `/register` redirects to `/login` in signup mode
- [ ] 2.12 Brand panel is responsive on narrow viewports

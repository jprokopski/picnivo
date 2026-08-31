# SERP Entry and Social Link Previews Implementation Plan

## Overview

Give Picnivo a real identity wherever its URLs travel: a described entry in Google search
results, and rich link cards in Facebook/Messenger, X/Twitter, and LinkedIn. Today the app
emits a single meta tag set — `{ title: "Picnivo" }` — for every URL, so the sharing loop
that the product is built around (PRD US-01: "they get a shareable link they can send to
friends") lands in group chats as a bare, unadorned URL.

This is a frontend-only change: a shared metadata builder, one static brand card image,
product-level metadata on the public entry page, and per-event cards on `/e/$token` that
render everywhere except Google.

## Current State Analysis

**Metadata surface — effectively empty.** `frontend/src/routes/__root.tsx:22-32` holds the
only `head:` in the application:

```
meta: [ { charSet: "utf-8" }, { name: "viewport", ... }, { title: "Picnivo" } ]
links: [ { rel: "stylesheet", href: appCss }, { rel: "icon", ... } ]
```

No description, no canonical, no `og:*`, no `twitter:*`. No other route defines `head` at
all — `login.tsx`, `register.tsx`, and `_app/e/$token.tsx` all inherit that single title.

**There is no public landing page.** `src/routes/index.tsx:5` throws a redirect to
`/events` in `beforeLoad`; `src/routes/_app/_authenticated.tsx:4-11` then redirects
unauthenticated visitors to `/login`. A crawler requesting `/` never renders a page there,
so any metadata attached to `/` is unreachable. The terminal page of that chain — `/login` —
is the only describable public entry point.

**Event pages are public, SSR'd, and already carry everything a card needs.** The loader in
`src/routes/_app/e/$token.tsx:12-38` returns `event` (title, description, location,
dateOptions, chosenDateOptionId, bestDateOptionId) plus `shareUrl`, an absolute URL built
server-side from `getShareOriginFn` → `getRequestUrl().origin`
(`src/features/events/get-event-by-token/functions.ts:25-29`). No new data fetching is
required for per-event metadata.

**Crawl policy is wide open.** `frontend/public/robots.txt` is `User-agent: * / Disallow:`
— allow-everything. Unguessable share tokens are fully indexable today, and the
authenticated dashboard routes are too.

**No image assets.** `frontend/public/` holds only `favicon.svg`, `manifest.json`, and
`robots.txt`. The logo is inline pixel-art `<rect>` elements in
`src/components/logo.tsx:3-30` (`BASKET_PIXELS`) — there is no raster asset anywhere to
reuse as an OG image.

**Runtime constraint.** The frontend deploys to Cloudflare Workers
(`frontend/wrangler.jsonc`) on the free tier. `frontend/context/foundation/infrastructure.md:62`
documents the 10ms CPU limit as a known silent-failure mode. This is the binding constraint
on the image strategy.

**Conventions in place.** Vitest + jsdom for units (`vitest.config.ts`), Playwright against
the real stack for E2E (`playwright.config.ts`, `tests/e2e/`), Lingui for user-visible copy
(`en` only, `src/lib/i18n.ts`), kebab-case filenames, feature-sliced structure under
`src/features/<Feature>/<Action>/` with infrastructure in `src/lib/`.

## Desired End State

Pasting `https://<host>/e/<token>` into Messenger, X, or LinkedIn renders a card showing the
event title, its date and location, and Picnivo's brand image. Pasting the bare domain
renders a product card. Searching Google for "Picnivo" returns a titled, described result
for the public entry page — and returns **no** event pages.

Verify by: `curl`ing the SSR'd HTML of `/e/<token>` and `/login` and confirming the full tag
set is present in the raw response (before any JavaScript runs), then running both URLs
through the Facebook Sharing Debugger, X Card Validator, LinkedIn Post Inspector, and
Google Rich Results Test.

### Key Discoveries:

- `src/routes/__root.tsx:22-32` — the entire existing metadata surface; three tags.
- `src/routes/index.tsx:5` — `/` redirects in `beforeLoad`, so metadata on `/` is dead code.
- `src/routes/_app/e/$token.tsx:12-38` — loader already returns `event` + absolute `shareUrl`.
- `src/features/events/get-event-by-token/functions.ts:25-29` — `getShareOriginFn` is the
  proven server-side origin resolution pattern; promote it rather than inventing a second one.
- `src/components/logo.tsx:3-30` — `BASKET_PIXELS` is the sole source of the brand mark.
- `src/lib/format-instant.ts:7` — `formatInstantParts` pins the locale to `en-US` explicitly
  to keep SSR and hydration identical. Metadata must format dates the same way.
- `frontend/context/foundation/infrastructure.md:62` — the 10ms CPU limit.
- `@playwright/test` is already a devDependency, so a headless renderer for building the
  card image is available without adding anything.

## What We're NOT Doing

- **No marketing landing page.** `/` keeps its redirect. Building a public logged-out home
  page is a separate feature; this change makes `/login` describable instead.
- **No runtime-generated per-event images.** No satori, no resvg-wasm, no Browser Rendering
  API, no KV/R2 image cache. One static card for every URL.
- **No metadata on authenticated routes** (`/events`, `/create`) beyond what they inherit —
  crawlers and scrapers are redirected away before they ever see them.
- **No sitemap.xml, no structured data / JSON-LD, no `Event` schema.org markup.** Event pages
  are deliberately not indexed, and there is no public content to sitemap.
- **No participant or organizer names in any metadata**, and no attendance counts.
- **No new locales.** Copy goes through Lingui, but `en` remains the only catalog.
- **No custom domain setup.** Absolute URLs derive from whatever origin serves the request.

## Implementation Approach

Four phases, each independently verifiable.

The static image lands first because everything else references its path. A single shared
builder in `src/lib/seo/` then owns the entire tag vocabulary, so no route hand-assembles
`og:*` / `twitter:*` arrays and no platform gets forgotten. Routes call that builder with a
small options object. Site-level metadata (phase 3) and event-level metadata (phase 4) are
separated because they answer different questions — brand identity versus per-event content —
and because the event phase carries the crawl-policy risk that most needs isolated
verification.

TanStack Router merges `head()` results down the route tree, deduplicating `meta` entries by
`name` / `property` with the deepest match winning. Root supplies defaults; child routes
override only the keys they care about.

## Critical Implementation Details

**robots.txt must not disallow `/e/`.** `facebookexternalhit`, `Twitterbot`, and LinkedIn's
scraper all respect robots.txt, while all three ignore `<meta name="robots" content="noindex">`.
Disallowing `/e/` would therefore stop the scrapers fetching the page and silently kill every
social card, while `noindex` alone keeps cards working and still drops the pages from Google.
Event pages must stay crawlable and carry `noindex, nofollow` in meta. robots.txt blocks only
the authenticated routes.

**Metadata must be present in the SSR'd HTML, not applied on hydration.** Social scrapers do
not execute JavaScript. Any assertion that reads the post-hydration DOM will pass while the
real card is broken, so phase 4's tests fetch raw HTML over HTTP.

**Date formatting must match `formatInstantParts`' explicit locale pin.** `src/lib/format-instant.ts:7`
defaults to `en-US` rather than the ambient runtime locale specifically to keep SSR and client
output identical. A metadata date formatter that omits the locale argument will format
differently on the Worker than in the browser.

**`og:image` must be an absolute URL.** All four platforms reject relative paths. This is the
reason origin resolution is a phase-2 dependency rather than a detail.

---

## Phase 1: Brand OG Card Asset and Crawl Policy

### Overview

Produce the static 1200×630 card that every preview references, and correct robots.txt so it
blocks the authenticated app rather than the pages that need scraping.

### Changes Required:

#### 1. Card source template

**File**: `frontend/scripts/og-card.html`

**Intent**: A standalone HTML document that renders the social card — pixel basket mark,
"Picnivo" wordmark, and a one-line tagline on the brand paper/coral ground — so the image is
reproducible from source rather than a hand-edited binary.

**Contract**: Fixed 1200×630 root element. Colors are literal hex values copied from
`src/styles.css` (`--paper #fbf4e9`, `--ink #2b2018`, `--coral #f15a37`), not CSS variable
references — this file does not load the app stylesheet. The basket mark is the same
`viewBox="44 34 258 276"` rect set as `src/components/logo.tsx`. Typefaces are Bricolage
Grotesque (wordmark) and Hanken Grotesk (tagline), loaded from the same Google Fonts URL as
`src/styles.css:1`.

#### 2. Card generation script

**File**: `frontend/scripts/generate-og-card.ts`

**Intent**: Render the template headlessly and write the PNG, so regenerating after a brand
tweak is one command rather than a manual design step.

**Contract**: Uses `chromium` from `@playwright/test` (already a devDependency) at viewport
1200×630 with `deviceScaleFactor: 1`, waits for webfonts to settle before capturing, and
writes `frontend/public/og-card.png`. Exposed as a `package.json` script `og:card`. The
script is a build-time tool — it must not be imported by any runtime module.

**Note**: the script needs network access for the Google Fonts request. If fonts fail to
load the capture still succeeds but falls back to system faces, so the script should fail
loudly rather than emit a silently wrong card.

#### 3. Generated card image

**File**: `frontend/public/og-card.png`

**Intent**: The committed 1200×630 asset served to all four platforms.

**Contract**: Exactly 1200×630 px. Committed to the repo (not generated at build time) so
deploys never depend on font-CDN availability. Keep the file under ~300KB — scrapers time
out on large images and X in particular is strict about fetch latency.

#### 4. Crawl policy

**File**: `frontend/public/robots.txt`

**Intent**: Stop search engines crawling the authenticated application, while leaving every
public path — including `/e/` — open so social scrapers can fetch it.

**Contract**: `Disallow` entries for `/events`, `/create`, and `/auth/`. `/e/` must **not**
appear in any `Disallow` rule (see Critical Implementation Details). Add an inline comment
recording why, so the next person to tighten robots.txt doesn't undo the social cards.

### Success Criteria:

#### Automated Verification:

- Card generates from source: `pnpm --dir frontend og:card` exits 0
- Generated file is exactly 1200×630 and under 300KB
- Type checking passes: `pnpm --dir frontend typecheck`
- Linting passes: `pnpm --dir frontend lint`

#### Manual Verification:

- The rendered card is legible at thumbnail size (roughly 200px wide) — the wordmark and
  basket read clearly, the tagline is not the thing you have to squint at
- Brand colors match the running app side by side, not approximately
- `robots.txt` served at `/robots.txt` contains no `Disallow` rule matching `/e/`

---

## Phase 2: Shared SEO Metadata Module

### Overview

One builder that owns the entire tag vocabulary for all four platforms, plus the server-side
origin resolution that absolute URLs depend on. Routes describe *what* they are; this module
decides *which tags* that becomes.

### Changes Required:

#### 1. Origin resolution

**File**: `frontend/src/lib/seo/origin.ts`

**Intent**: Resolve the absolute request origin server-side so `og:image`, `og:url`, and
`canonical` are absolute on first render, without depending on `window.location`.

**Contract**: A `createServerFn` handler returning `getRequestUrl().origin`, mirroring
`getShareOriginFn` in `src/features/events/get-event-by-token/functions.ts:25-29`. That
existing function keeps its name and call sites; this is the shared infrastructure copy that
the root route and site-level pages use. Do not merge the two in this phase — `getShareOriginFn`
is on the SSE-adjacent event path and re-pointing it is unrelated churn.

#### 2. Metadata constants and copy

**File**: `frontend/src/lib/seo/constants.ts`

**Intent**: Single source for site name, default description, tagline, card path and
dimensions, so no string is duplicated across routes.

**Contract**: Exports `SITE_NAME`, `OG_CARD_PATH` (`/og-card.png`), `OG_CARD_WIDTH` (1200),
`OG_CARD_HEIGHT` (630), and Lingui `msg`-macro descriptors for the default description, the
card alt text, and the event-card fallback line. User-visible copy uses `msg` from
`@lingui/core/macro` resolved through `i18n._()` — these strings surface in search results
and chat previews, so the project's "always use Lingui for user-visible strings" rule
(`frontend/context/foundation/lessons.md`) applies even though they never appear in JSX.

#### 3. Tag builder

**File**: `frontend/src/lib/seo/meta.ts`

**Intent**: Turn one options object into the complete `meta` and `links` arrays a TanStack
route `head()` returns, so a route can never ship a card that works on Facebook but not X.

**Contract**: A function taking `{ title, description, path, origin, image?, imageAlt?, noindex?, type? }`
and returning `{ meta, links }` shaped for TanStack Router's `head()`.

The emitted set, and why each entry exists:

| Tag | Consumer |
| --- | --- |
| `title` | SERP, browser tab, and the fallback title on all three platforms |
| `name="description"` | SERP snippet |
| `rel="canonical"` (in `links`) | SERP dedup; LinkedIn caches keyed on this |
| `property="og:title"`, `og:description`, `og:url`, `og:type`, `og:site_name`, `og:locale` | Facebook, LinkedIn |
| `property="og:image"`, `og:image:width`, `og:image:height`, `og:image:alt`, `og:image:type` | Facebook, LinkedIn — explicit dimensions let Facebook render the card on first scrape instead of after a re-fetch |
| `name="twitter:card"` = `summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:image:alt` | X/Twitter |
| `name="robots"` = `noindex, nofollow` | emitted only when `noindex` is set |

`og:image` and `og:url` must be absolute — built by joining `origin` and `path`. `og:type`
defaults to `website`. Titles longer than ~60 characters and descriptions longer than ~160
are truncated on a word boundary with an ellipsis, since all four platforms clip mid-word
otherwise.

#### 4. Unit tests

**File**: `frontend/src/lib/seo/meta.test.ts`

**Intent**: Lock the tag vocabulary so a future refactor cannot silently drop a platform.

**Contract**: Assert the full tag set is present for a default call; that `og:image` and
`og:url` are absolute; that `noindex: true` adds `robots` and omitting it does not emit the
tag at all; that over-length title and description are truncated on a word boundary; and
that `twitter:card` is always `summary_large_image`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm --dir frontend test`
- Type checking passes: `pnpm --dir frontend typecheck`
- Linting passes: `pnpm --dir frontend lint`
- Lingui catalog extracts the new descriptors cleanly: `pnpm --dir frontend extract` leaves
  no untranslated entries beyond the new ones

#### Manual Verification:

- None — this phase ships no user-visible surface. Proceed directly to Phase 3.

---

## Phase 3: Site-Level Previews (SERP Entry and Brand Card)

### Overview

Make the bare domain describable. Root supplies brand-level defaults for every page;
`/login` — the terminal page of the `/` → `/events` → `/login` redirect chain — carries the
product-level metadata that becomes the Google result and the card for the bare domain.

### Changes Required:

#### 1. Root defaults

**File**: `frontend/src/routes/__root.tsx`

**Intent**: Replace the three-tag `head` with brand-level defaults every route inherits, so
a route that defines no `head` of its own still produces a valid card.

**Contract**: `beforeLoad` (which already runs and returns `{ user }`) additionally resolves
and returns the request origin, making it available to child `head()` functions via route
context. The `head` keeps `charSet`, `viewport`, the stylesheet link and the favicon, and adds
the builder's output for the site defaults. Also add `theme-color` matching `--paper`
(`#fbf4e9`) and an `og:locale` of `en_US`.

Root must not set `robots` — it would otherwise cascade to every page.

#### 2. Public entry page metadata

**File**: `frontend/src/routes/login.tsx`

**Intent**: Give the page Google actually lands on a product-level title and description, so
the SERP entry describes Picnivo rather than showing a bare "Picnivo" with no snippet.

**Contract**: A `head` returning the builder's output with a product title and a description
covering the value proposition (pick a date together, split what to bring, one shared link).
Canonical points at this page's own URL. Not `noindex` — this is the page that should rank.

The route already has `validateSearch` returning `redirect` and `mode`; the `head` must
ignore both so `?mode=signup` and `?redirect=...` variants do not fragment the canonical URL.

#### 3. Register page canonicalisation

**File**: `frontend/src/routes/register.tsx`

**Intent**: `/register` and `/login` render the same `AuthPanel` differing only by mode.
Leaving both indexable splits ranking between near-identical pages.

**Contract**: A `head` with its own title, and a canonical pointing at `/login`.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm --dir frontend typecheck`
- Unit tests pass: `pnpm --dir frontend test`
- Linting passes: `pnpm --dir frontend lint`
- `curl -s http://localhost:3000/login` contains `og:image`, `og:title`, `twitter:card`,
  and a `<link rel="canonical">` in the raw response body

#### Manual Verification:

- Browser tab title reads correctly on `/login` and `/register`
- `curl -sL http://localhost:3000/` follows the redirect chain and terminates on a page whose
  HTML carries the full tag set
- Facebook Sharing Debugger on the deployed preview URL renders the brand card with the
  product description, and reports no warnings about missing properties
- LinkedIn Post Inspector renders the same card (LinkedIn ignores `twitter:*`, so this
  independently confirms the `og:*` set is complete)

---

## Phase 4: Event Page Previews and Index Exclusion

### Overview

The phase that matters most for the product: a link pasted into a group chat shows what the
event is. Simultaneously ensures those pages never reach Google.

### Changes Required:

#### 1. Event description builder

**File**: `frontend/src/features/events/get-event-by-token/seo.ts`

**Intent**: Turn an `EventDetailResponse` into the card's title and description, keeping the
formatting and privacy decisions in one testable place rather than inline in the route.

**Contract**: A function taking the event and returning `{ title, description }`.

- Title is the event title, suffixed with the site name.
- Description leads with the date — the chosen date option when `chosenDateOptionId` is set,
  otherwise the best option when `bestDateOptionId` is set, otherwise the soonest upcoming
  option; falls back to a "pick a date together" line when the event has no usable date.
- Appends the location when present, using the project's `·` separator convention.
- Closes with the call to action ("vote on dates and claim what you'll bring").
- Dates format via `formatInstantParts` from `src/lib/format-instant.ts` with its explicit
  locale argument (see Critical Implementation Details).
- **Never** includes participant names, the organizer name, attendance counts, item claims,
  or the event's free-text `description` field — that field is organizer-authored and may
  contain addresses or private notes.

#### 2. Builder unit tests

**File**: `frontend/src/features/events/get-event-by-token/seo.test.ts`

**Intent**: Pin the date-selection precedence and the privacy boundary.

**Contract**: Cover chosen-date precedence over best-date; best-date used when nothing is
chosen; soonest-upcoming fallback; the no-date announcement case; location present and
absent; and an explicit assertion that a fixture with named participants and an organizer
produces a description containing none of those names.

#### 3. Event route metadata

**File**: `frontend/src/routes/_app/e/$token.tsx`

**Intent**: Emit the per-event card from data the loader already has, and keep the page out
of search results.

**Contract**: A `head: ({ loaderData }) => ...` calling the phase-2 builder with the phase-1
title/description, `noindex: true`, and the loader's existing `shareUrl` as the canonical and
`og:url` — no new origin resolution needed here.

When `loaderData.event` is `null` (the 404 path the loader already handles at
`functions.ts:19`), emit generic site metadata with `noindex` rather than a broken card
referencing a nonexistent event.

`head` runs before the component, so it must tolerate the same `null` event the component
guards against at `$token.tsx:46`.

#### 4. SSR metadata E2E

**File**: `frontend/tests/e2e/social-previews/social-previews.spec.ts`

**Intent**: Prove the tags exist in server-rendered HTML — the only form scrapers ever see.

**Contract**: Uses Playwright's `request` fixture (not `page`) to fetch raw HTML, so nothing
passes on hydration-applied tags. Seeds an event via the existing `tests/e2e/seed` helpers,
then asserts against `GET /e/<token>`: the event title appears in `og:title`, `og:image` is
an absolute `http(s)://` URL, `twitter:card` is `summary_large_image`, `robots` contains
`noindex`, and no seeded participant name appears anywhere in `<head>`. A second assertion
against `GET /login` confirms it carries the full tag set and *no* `robots` tag.

Follows the existing `tests/e2e/<feature>/<feature>.spec.ts` layout.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `pnpm --dir frontend test`
- E2E suite passes: `pnpm --dir frontend test:e2e`
- Type checking passes: `pnpm --dir frontend typecheck`
- Linting passes: `pnpm --dir frontend lint`
- Full monorepo check passes: `/verify`

#### Manual Verification:

- Facebook Sharing Debugger on a deployed event URL renders title, description, and card,
  with no missing-property warnings
- X Card Validator renders a `summary_large_image` card for the same URL
- LinkedIn Post Inspector renders the card (use "Inspect" to bypass its aggressive cache)
- Google Rich Results Test reports the event URL as excluded from indexing
- Paste a real event link into an actual WhatsApp or Messenger thread and confirm the card
  renders on a phone — the debuggers do not catch every mobile client quirk
- Confirm no participant or organizer name is visible in any rendered card

---

## Testing Strategy

### Unit Tests:

- `src/lib/seo/meta.test.ts` — full tag vocabulary, absolute URL construction, `robots`
  emitted only when requested, word-boundary truncation, `twitter:card` invariant
- `src/features/events/get-event-by-token/seo.test.ts` — date-selection precedence
  (chosen → best → soonest → none), location present/absent, and the privacy assertion that
  no participant, organizer, or free-text description content leaks into the card

### Integration Tests:

- `tests/e2e/social-previews/social-previews.spec.ts` — raw-HTTP assertions on SSR'd `<head>`
  for a seeded event and for `/login`, covering both the tag presence and the `noindex`
  boundary in the same run

### Manual Testing Steps:

1. `pnpm --dir frontend og:card` and open the PNG — check legibility at ~200px wide
2. `curl -s localhost:3000/login | grep -o '<meta[^>]*>'` — eyeball the full tag set
3. Create an event locally, `curl` its `/e/<token>` and confirm title, date, and location
   appear in `og:description` while no participant name does
4. Deploy to the preview environment and run all four platform validators
5. Paste the preview event URL into a real WhatsApp thread and check the card on a phone
6. Confirm `/robots.txt` has no rule matching `/e/`, and that `/events` and `/create` are
   disallowed

## Performance Considerations

Metadata generation is pure string assembly over data the loader already fetched — no
additional network calls, negligible CPU. This is deliberate: the Cloudflare Workers free
tier's 10ms CPU limit (`frontend/context/foundation/infrastructure.md:62`) is what ruled out
runtime image generation, and the chosen approach adds effectively nothing to the request
path.

The static card is served from Cloudflare's asset binding with the app's other static files.
Because the image never changes per event, every scraper request after the first is a cache
hit.

## Migration Notes

No data migration. The robots.txt change takes effect on the next crawl; if any event URL was
already indexed (unlikely, since tokens are unguessable and undiscoverable), the `noindex`
meta will drop it on the next crawl — do not additionally disallow the path, which would
prevent Google seeing the `noindex` at all.

Social platforms cache scrape results aggressively. After deploying, re-scrape through each
debugger to bust the cache rather than waiting it out — LinkedIn in particular can hold a
stale empty card for days.

## References

- Change identity: `context/changes/serp-and-social-previews/change.md`
- Plan brief: `context/changes/serp-and-social-previews/plan-brief.md`
- Existing origin resolution pattern: `frontend/src/features/events/get-event-by-token/functions.ts:25-29`
- Brand tokens: `frontend/src/styles.css:44-110`
- Brand mark source: `frontend/src/components/logo.tsx:3-30`
- SSR-safe date formatting: `frontend/src/lib/format-instant.ts:7`
- Runtime CPU constraint: `frontend/context/foundation/infrastructure.md:62`
- Frontend conventions: `frontend/context/foundation/lessons.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Brand OG Card Asset and Crawl Policy

#### Automated

- [x] 1.1 Card generates from source: `pnpm --dir frontend og:card` exits 0 — 080582c
- [x] 1.2 Generated file is exactly 1200×630 and under 300KB — 080582c
- [x] 1.3 Type checking passes — 080582c
- [x] 1.4 Linting passes — 080582c

#### Manual

- [x] 1.5 Card is legible at thumbnail size (~200px wide) — 080582c
- [x] 1.6 Brand colors match the running app side by side — 080582c
- [x] 1.7 Served `/robots.txt` contains no `Disallow` rule matching `/e/` — 080582c

### Phase 2: Shared SEO Metadata Module

#### Automated

- [x] 2.1 Unit tests pass — d3863c1
- [x] 2.2 Type checking passes — d3863c1
- [x] 2.3 Linting passes — d3863c1
- [x] 2.4 Lingui catalog extracts the new descriptors cleanly — d3863c1

### Phase 3: Site-Level Previews (SERP Entry and Brand Card)

#### Automated

- [x] 3.1 Type checking passes
- [x] 3.2 Unit tests pass
- [x] 3.3 Linting passes
- [x] 3.4 Raw `/login` response contains `og:image`, `og:title`, `twitter:card`, and canonical

#### Manual

- [x] 3.5 Browser tab title correct on `/login` and `/register`
- [x] 3.6 Redirect chain from `/` terminates on a page carrying the full tag set
- [x] 3.7 Facebook Sharing Debugger renders the brand card with no warnings
- [x] 3.8 LinkedIn Post Inspector renders the same card

### Phase 4: Event Page Previews and Index Exclusion

#### Automated

- [ ] 4.1 Unit tests pass
- [ ] 4.2 E2E suite passes
- [ ] 4.3 Type checking passes
- [ ] 4.4 Linting passes
- [ ] 4.5 Full monorepo check passes (`/verify`)

#### Manual

- [ ] 4.6 Facebook Sharing Debugger renders the event card with no warnings
- [ ] 4.7 X Card Validator renders a `summary_large_image` card
- [ ] 4.8 LinkedIn Post Inspector renders the event card
- [ ] 4.9 Google Rich Results Test reports the event URL as excluded from indexing
- [ ] 4.10 Card renders correctly in a real WhatsApp/Messenger thread on a phone
- [ ] 4.11 No participant or organizer name visible in any rendered card

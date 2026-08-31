# SERP Entry and Social Link Previews — Plan Brief

> Full plan: `context/changes/serp-and-social-previews/plan.md`

## What & Why

Picnivo's whole mechanic is "organizer shares a link" (PRD US-01), but the app emits exactly
one meta tag set for every URL — `{ title: "Picnivo" }` — so an event link pasted into
WhatsApp, Messenger, X, or LinkedIn renders as a bare URL with no card, and Google shows an
undescribed sign-in screen. This plan gives the product a real identity in search results and
in link previews on Facebook, X/Twitter, and LinkedIn.

## Starting Point

`src/routes/__root.tsx:22-32` is the only `head:` in the app: charSet, viewport, title. No
description, no canonical, no `og:*`, no `twitter:*`. `public/` has no image asset beyond a
favicon. `robots.txt` allows everything, so unguessable event tokens are indexable today.
`/` redirects through `/events` to `/login`, so there is no public page for a crawler to
describe. On the plus side, `/e/$token` is already public, SSR'd, and its loader already
returns the event plus an absolute `shareUrl` — the data a card needs is in hand.

## Desired End State

An event link pasted into a group chat shows the event title, its date and location, and
Picnivo's brand card. The bare domain shows a product card and returns a titled, described
Google result. Event pages render cards everywhere **except** Google, where they don't appear
at all.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| --- | --- | --- |
| Deliverable | Ship working meta tags, not mockups | The sharing loop is the core product mechanic and it's silently broken today. |
| Pages covered | Site root entry + `/e/$token` | Those are the only URLs anyone pastes or crawls; the dashboard is authenticated-only. |
| OG image | One static 1200×630 brand card | The Workers free-tier 10ms CPU limit (`infrastructure.md:62`) rules out satori/resvg rasterization per request. |
| Root SERP entry | Metadata on `/login` | `/` redirects in `beforeLoad`, so metadata there is unreachable; `/login` terminates the chain. |
| Event indexing | `noindex` meta, **no** robots.txt Disallow | Scrapers respect robots.txt but ignore `noindex` — disallowing `/e/` would kill every social card. |
| Card content | Title + date + location only | Enough to recognize the invite; no participant or organizer names exposed to third-party scrapers. |
| Absolute URLs | Derived from request origin | Reuses the proven `getRequestUrl().origin` pattern; correct on prod, preview, and localhost with zero config. |
| Card art | Logo + tagline on brand ground | Rebuilds from existing tokens and `logo.tsx` rects — no new artwork, and legible at thumbnail size. |

## Scope

**In scope:** static brand card asset + generation script; shared `src/lib/seo/` tag builder;
metadata on `__root`, `/login`, `/register`; per-event cards on `/e/$token` with `noindex`;
corrected robots.txt; unit tests + raw-HTML E2E assertions.

**Out of scope:** a marketing landing page; runtime per-event image generation; sitemap.xml;
JSON-LD / schema.org markup; metadata on authenticated routes; new locales; custom domain.

## Architecture / Approach

One builder in `src/lib/seo/meta.ts` owns the entire tag vocabulary (SERP, `og:*`,
`twitter:*`, canonical, `robots`), so no route hand-assembles tags and no platform gets
forgotten. Routes call it with a small options object from their `head()`. TanStack Router
merges `head()` down the route tree, deduplicating by `name`/`property` with the deepest match
winning — root supplies brand defaults, child routes override only what differs. Event
metadata comes from data the loader already fetched, so nothing is added to the request path.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Card asset + crawl policy | Committed 1200×630 PNG, generation script, fixed robots.txt | Disallowing `/e/` would silently kill every card — the plan calls this out explicitly |
| 2. SEO metadata module | Shared tag builder + origin resolution, unit tested | Missing a platform-specific tag; mitigated by locking the vocabulary in tests |
| 3. Site-level previews | Describable SERP entry + brand card for the bare domain | Query params fragmenting the canonical URL on `/login` |
| 4. Event previews | Per-event cards, `noindex`, E2E on raw SSR HTML | Asserting on hydrated DOM would pass while the real card is broken — tests use raw HTTP |

**Prerequisites:** Playwright already installed (used for card generation); a deployed
preview URL is required for phases 3–4 manual validation, since the platform debuggers cannot
reach localhost.

**Estimated effort:** ~2 sessions across 4 phases. Phases 1–2 are mechanical; phase 4 carries
most of the verification time because the four platform validators are manual and LinkedIn
caches hard.

## Open Risks & Assumptions

- Platform validators need a public URL, so phases 3–4 cannot be fully signed off from
  localhost — a preview deploy is part of the verification loop, not an afterthought.
- Social platforms cache scrapes aggressively; a bad first deploy can show a stale empty card
  for days on LinkedIn until manually re-inspected.
- The card generation script depends on Google Fonts at author time; the PNG is committed so
  deploys never depend on it, but a font-load failure must fail the script loudly rather than
  emit a silently wrong card.
- Assumes the current `<host>.workers.dev` origin. A future custom domain will change
  `og:url` and canonical automatically (origin-derived), but will require re-scraping on all
  platforms.

## Success Criteria (Summary)

- An event link pasted into a real WhatsApp/Messenger thread renders a card naming the event,
  its date, and its location — verified on a phone, not just in a debugger.
- Searching for Picnivo returns a titled, described result; searching for an event URL
  returns nothing.
- No participant or organizer name appears in any rendered card.

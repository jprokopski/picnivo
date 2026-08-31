---
change_id: serp-and-social-previews
title: SERP entry and social link previews (Facebook, X/Twitter, LinkedIn)
status: archived
created: 2026-08-31
updated: 2026-08-31
archived_at: 2026-08-31T15:59:33Z
---

## Notes

Frontend-only change. Picnivo's core mechanic is "organizer shares a link" (PRD US-01),
but today every URL in the app emits exactly one meta tag set: `{ title: "Picnivo" }` from
`frontend/src/routes/__root.tsx`. Pasting an event link into WhatsApp, Messenger, X, or
LinkedIn produces a bare URL with no card. Google sees an undescribed sign-in screen.

Design decided via /10x-plan questioning:
- Ship real meta tags in the app (not mockups).
- Cover the site root entry point and `/e/$token`; skip the authenticated dashboard.
- One **static** 1200x630 brand card, not runtime-generated per event — the Cloudflare
  Workers free-tier 10ms CPU limit (`frontend/context/foundation/infrastructure.md:62`)
  rules out satori + resvg-wasm rasterization.
- Because `/` redirects through `/events` to `/login`, the login page carries the
  product-level SERP metadata rather than building a marketing landing page.
- `/e/$token` gets `noindex, nofollow` **meta** while staying crawlable — social scrapers
  respect robots.txt but ignore `noindex`, so a robots.txt `Disallow: /e/` would silently
  kill every social card.
- Card description carries title + date + location; no participant or organizer names.
- Absolute URLs derive from the request origin, reusing the proven `getRequestUrl().origin`
  pattern already in `get-event-by-token/functions.ts:27`.

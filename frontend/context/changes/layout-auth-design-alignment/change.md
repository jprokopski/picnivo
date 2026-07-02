---
change_id: layout-auth-design-alignment
title: Align layout composition and auth pages to the design references (and prune off-design routes)
status: implemented
created: 2026-07-02
updated: 2026-07-02
---

## Notes

Framed via /10x-frame. The stated request ("implement a missing global layout and auth
pages") was reframed: layout and auth already exist. The real work is (1) a layout-route
split so auth/public pages render chrome-free like the design, (2) rebuilding /login and
/register to match the design's WebAuth (they render against a dead token set — 0 matches
in styles.css), and (3) deleting /dashboard (no design counterpart) with home → /events.

See frame.md for the full brief.

Phase 1 (layout split & route pruning) committed. impl-review F1 (guest header CTA) resolved
by updating the plan instead of the code — guest header keeps a single "Log in" button rather
than going logo-only. Phase 2 (auth redesign) committed (8c56f77), followed by a kebab-case
naming cleanup (d7f95fe) that also captured a lessons.md rule. Phase 2 impl-review: NEEDS
ATTENTION, 0 critical / 3 warnings / 3 observations — see reviews/impl-review-phase-2.md.

Phase 2 review findings resolved (e6c5c15): F1 (open-redirect guard on callback's `next`),
F2 (cn() adoption), F3 (try/catch/finally around signIn/signUp), F4 (arbitrary-value cleanup)
all fixed; F5/F6 were disclosed observations needing no action. Both phases complete, all
Progress items checked with commit SHAs. Plan closed out.

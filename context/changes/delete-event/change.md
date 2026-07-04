---
change_id: delete-event
title: Add organizer-only delete for Event with cascading cleanup
status: impl_reviewed
created: 2026-07-04
updated: 2026-07-04
archived_at: null
---

## Notes

Add DELETE /api/events/{token} endpoint, organizer-only, cascading delete to Participants/EventItems/DateVotes/ItemClaims. Follows existing vertical-slice pattern in Features/Events/. Closes the CRUD gap identified in context/mvp-check-report.md (Event has Create/Read/Update but no Delete).

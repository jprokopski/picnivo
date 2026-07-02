---
project: "Picnivo"
version: 1
status: draft
created: 2026-06-01
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-06
  after_hours_only: true
---

## Vision & Problem Statement

Organizing small group events (grills, picnics, trips) is broken by coordination overhead, decision paralysis, and decisions trapped in chat. The organizer — the friend who makes plans happen — bears all the friction: herding date preferences across messages, tracking who brings what in scattered tools, and reminding people of commitments that get buried. Events die from coordination friction before they happen.

Existing tools fail from both ends — event platforms (Eventbrite, Meetup) are built for public/large events and too heavy for 8 friends grilling, while narrow tools (Doodle, Google Sheets, WhatsApp) each solve one piece but nobody stitches them together, making the organizer the glue.

## User & Persona

### Primary persona

**The friend-group organizer** — the person in a circle of friends who tends to initiate and coordinate casual hangouts. Not a professional role; just "the one who makes plans happen." They feel the pain most because they absorb the coordination cost that others barely notice. Their moment of pain: they've decided "let's do a grill this weekend" and now face 15 messages to find a date, a spreadsheet for who brings what, and the knowledge that someone will forget anyway.

## Success Criteria

### Primary
- The 9-step MVP flow works end to end: organizer creates an event with date options and an item list, shares a link, participants vote and claim items, and the event page shows the best date (by votes), item assignments, and participant list — all without leaving a single tool.

### Secondary
- Event creation under 2 minutes: an organizer can go from "let's do a grill" to a shareable link in under 2 minutes.

### Guardrails
- Vote integrity: one vote per person per date option. A participant cannot stuff the ballot — each person gets exactly one Yes/Maybe/No per proposed date.

## User Stories

### US-01: Organizer creates and shares an event

- **Given** a logged-in organizer
- **When** they create an event with title, location, date options, and an item list
- **Then** they get a shareable link they can send to friends

#### Acceptance Criteria
- Event is created with all required fields (title, at least one date option)
- Shareable link uses an unguessable token, not a sequential ID
- Organizer can copy the link to clipboard in one click

### US-02: Participant votes and claims items

- **Given** a participant who opened an event link
- **When** they enter their name, vote on dates, and claim an item
- **Then** their votes are reflected in the summary and their item assignment is visible to everyone

#### Acceptance Criteria
- Participant can vote within 30 seconds of opening the link (≤ name entry + vote)
- Vote summary updates to reflect the new vote on page load
- Item claiming is available only to participants attending the chosen date (voted Yes on it, or confirmed attendance despite voting against)
- Claimed item shows the participant's name next to it

## Functional Requirements

### Authentication
- FR-001: Organizer can create an account (email/password or OAuth). Priority: must-have
  > Socrates: Counter-argument considered: "registration walls cause drop-off." Resolution: kept; organizer needs persistent identity to manage multiple events. The friction is worth it.
- FR-002: Organizer can log in and see their events. Priority: must-have
  > Socrates: Counter-argument considered: "a dashboard is overkill for 1–3 events." Resolution: kept; even with few events, the organizer needs to see all of them and pick which to manage. A simple list is minimal work.

### Event creation
- FR-003: Organizer can create an event with a title (required), and optionally a description and location. Priority: must-have
  > Socrates: Counter-argument considered: "requiring title + description + location adds friction; many casual events don't have a fixed location yet." Resolution: revised — only title is required. Description and location are optional, can be added later.
- FR-004: Organizer can add 1–10 proposed date/time options to an event. If only 1 date is provided, it is treated as an announcement with no voting; voting activates at 2+ options. Priority: must-have
  > Socrates: Counter-argument considered: "1 option = nothing to vote on; 10 options dilute votes." Resolution: revised — 1 date = announcement (no voting), 2–10 = voting enabled.
- FR-005: Organizer or participant can add items to an event logistics list (e.g. grill, drinks, food). Organizer can remove any item. Priority: must-have
  > Socrates: Counter-argument considered: "items emerge during conversation — organizer-only list misses 'oh, we also need cups.'" Resolution: revised — participants can also add items. Organizer retains ability to remove.
- FR-006: Organizer can generate a shareable public link for the event. Priority: must-have
  > Socrates: Counter-argument considered: "if the link auto-generates, this isn't a separate capability." Resolution: kept; the organizer still needs a visible "copy link" action. Keeping it as a separate FR makes the capability explicit.

### Participation
- FR-007: Participant can open an event link and join by entering a display name. System warns if the name is already in use on that event. Priority: must-have
  > Socrates: Counter-argument considered: "unverified names allow impersonation." Resolution: revised — add duplicate name detection/warning. In a small friend group, impersonation is a prank, not a threat, but a warning helps avoid confusion.
- FR-008: Participant can vote Yes/Maybe/No on each proposed date option. Priority: must-have
  > Socrates: Counter-argument considered: "Maybe is noise — people pick it to avoid commitment." Resolution: kept; Maybe means "I can make it work but it's not ideal." The organizer can weigh Maybes lower than Yeses when picking the final date.
- FR-009: Participant can claim an item from the logistics list ("I'll bring X"), but only if they are attending the chosen date — i.e. they voted Yes on the date the organizer selected, OR they explicitly confirmed attendance despite not voting Yes (see FR-013). One claim per item, first-come-first-served. Priority: must-have
  > Socrates: Counter-argument considered: "what if two people want to bring the same thing?" Resolution: kept; one person per item, first-come-first-served. If someone else claimed it, pick another. Simple and clear.
  > Socrates: Counter-argument considered: "gating item claims on attendance adds a step." Resolution: kept; only people who are actually coming should commit to bringing things, otherwise the logistics list fills with claims from no-shows. Voting Yes on the chosen date or explicitly confirming attendance both satisfy the gate.
- FR-013: A participant who did not vote Yes on the chosen date (voted Maybe/No, or did not vote) can explicitly confirm they will attend anyway. Confirming attendance unlocks item claiming for that participant. Priority: must-have
  > Socrates: Counter-argument considered: "a No-voter claiming items is contradictory." Resolution: kept; a participant may vote against a date but still decide to come once it's chosen. The explicit confirmation captures that intent and is the second path to unlocking item claiming.

### Event page
- FR-010: Any event visitor can see a summary of votes per date option (updated on page load). Priority: must-have
  > Socrates: Counter-argument considered: "real-time implies WebSockets — meaningful infrastructure cost." Resolution: revised — updates on page load are sufficient for MVP. Friends vote over hours, not seconds. Real-time is v2.
- FR-011: Any event visitor can see the current best date option (most Yes votes; ties broken by fewest No votes). This is a suggestion, not a decision — the organizer still picks the final date. Priority: must-have
  > Socrates: Counter-argument considered: "auto-picking 'best' is a product decision disguised as a feature — what about ties?" Resolution: kept; simple ranking (most Yes, fewest No for ties). It's a suggestion, not a binding decision.
- FR-012: Any event visitor can see item assignments and participant list. Priority: must-have
  > Socrates: Counter-argument considered: "this is just 'the event page shows data.'" Resolution: kept; making visibility explicit ensures the page shows ALL relevant data (assignments + participants), not just votes.

## Non-Functional Requirements

- The event page loads and becomes interactive within 2 seconds on a standard mobile connection.
- The product is fully usable on phone browsers — all interactions (voting, claiming items, viewing the event page) work on mobile viewports without a native app.
- The product works on the latest two major versions of Chrome, Safari, and Firefox.

## Business Logic

Picnivo reduces a multi-person, multi-decision coordination loop (date + items + attendance) to a single shared state that converges toward a ready-to-go event.

The rule consumes three input streams from participants: individual date preferences (Yes/Maybe/No per proposed option), item claims (who brings what), and attendance for the chosen date. Item claiming is gated on attendance: a participant can only claim an item if they are attending the date the organizer chose — either by having voted Yes on it, or by explicitly confirming attendance despite voting against. From these inputs, the rule produces a single event page that shows: the group's best date (ranked by consensus — most Yes votes, ties broken by fewest No votes), who's bringing what (one claim per item, no gaps visible), and who's coming.

The organizer shares one link. As friends interact, the page fills in — the event goes from "scattered discussion" to "ready to go" without the organizer manually aggregating anything. The convergence is the product: each participant action reduces uncertainty about the event's date, logistics, and attendance.

## Access Control

**Organizer:** Creates an account (email/password or OAuth) to create and manage events. Has a persistent identity — can see all their events in one place, receive reminders, and manage event settings.

**Participant:** Joins via a shareable public link. No account required — they can vote on dates, claim items, and view the event page. Auto-tracked as a participant after joining/voting. Identity is lightweight (name entry on first interaction, no registration).

**Role → capability matrix:**
- Organizer: create event, add/edit date options, add/edit item list, view all votes/assignments, send reminders, select final date
- Participant: vote on dates (Yes/Maybe/No), claim items, view event page, view vote summary

**Unauthenticated access:** Anyone with the event link can view and participate. No gated routes for participants — the link IS the access.

## Non-Goals

- No email reminders or notifications in v1 — email delivery, weather API, and scheduling infrastructure are deferred to v2. The core value is the shared event page, not push notifications.
- No chat or messaging between participants — coordination happens on the event page (voting, item claims). Friends already have WhatsApp/Signal/iMessage for discussion; Picnivo doesn't need to replace them.
- No calendar integrations (Google Calendar, iCal) — no export-to-calendar or sync. The event page is the single source of truth for now.
- No mobile app — web only. The product is a responsive web app accessible from phone browsers. No native iOS/Android app.

## Open Questions

No open questions. All PRD sections are fully populated from shaped input (score 4/4).

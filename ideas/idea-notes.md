## Picnivo - MVP

### Core Problem

Organizing small group events (grills, picnics, hangouts, trips) is inefficient because people struggle to agree on a time, forget what they should bring, and rely on fragmented tools (chats, calendars, spreadsheets). 
There is no simple, shared flow that combines **date selection, decision-making, and logistics assignment in one place**.

Most existing tools are either too complex (event platforms) or too narrow (polls or calendar links), and none handle the full coordination loop from planning → decision → preparation → reminder.

---

### Minimum Feature Set

- Authentication (basic user accounts)
- Event creation (title, description, location)
- Adding multiple proposed date/time options (1–10)
- Shareable public event link
- Voting system per date option:
  - Yes / Maybe / No
- Real-time summary of votes per option
- Item list (event logistics)
  - Organizer adds items (e.g. grill, drinks, food)
  - Participants can assign themselves to items (“I’ll bring X”)
- Event participant tracking (auto-added after joining/voting)
- Basic event page showing:
  - Best current date option (based on votes)
  - Item assignments
  - Participant list
- Email reminders (1 day before event)
  - Event summary
  - Assigned items
  - Selected date and weather snapshot

---

### Out of Scope for MVP

- Chat / comments / messaging between participants
- Friend system or social graph
- Group management or recurring events
- Mobile app (web only)
- Calendar integrations (Google Calendar, iCal, etc.)
- Photo uploads or media sharing
- Rankings, gamification, badges
- AI features beyond weather (no planning AI, no suggestions AI)
- Complex role systems beyond basic organizer vs participant
- Advanced analytics dashboards
- Event discovery / public browsing of events

---

### Success Criteria

- A user can create an event and share it in under 2 minutes
- A participant can join and vote without creating friction (≤30 seconds from link to vote)
- At least 80% of created events reach a final agreed date
- At least 70% of events have at least one assigned item per participant group
- Email reminders are delivered reliably for scheduled events
- Users understand the current “winning date” and item responsibilities at a glance without explanation
import type { EventSummaryResponse } from "@/api/picnivo-api";

export type EventStatus = "voting" | "date-set" | "now" | "past";

// No end time is recorded for an event, so "happening now" is a window from
// the chosen date's start rather than an exact span — long enough to cover
// a typical picnic/hangout without lingering as "now" indefinitely.
const HAPPENING_NOW_WINDOW_MS = 5 * 60 * 60 * 1000;

// The dashboard card and the Ongoing/Past filter both need the same notion
// of "is this event done" — derived here once so they can't drift. The
// chosen date is authoritative when set (the backend already folds a
// single-date "announcement" event's lone date into `chosenDateOptionId`);
// otherwise fall back to the next upcoming date option, if any.
export function deriveEventStatus(event: EventSummaryResponse): EventStatus {
  const now = new Date();
  if (event.chosenDateOptionId && event.chosenDateStartsAt) {
    const startsAt = new Date(event.chosenDateStartsAt);
    if (now < startsAt) return "date-set";
    const endsAt = new Date(startsAt.getTime() + HAPPENING_NOW_WINDOW_MS);
    return now < endsAt ? "now" : "past";
  }
  return event.soonestDate && new Date(event.soonestDate) > now
    ? "voting"
    : "past";
}

import { msg } from "@lingui/core/macro";
import type { DateOptionDto, EventDetailResponse } from "@/api/picnivo-api";
import { formatInstantParts } from "@/lib/format-instant";
import { i18n } from "@/lib/i18n";
import { EVENT_CARD_FALLBACK, SITE_NAME } from "@/lib/seo/constants";

export type EventForCard = Pick<
  EventDetailResponse,
  | "title"
  | "location"
  | "chosenDateOptionId"
  | "bestDateOptionId"
  | "dateOptions"
>;

// Resolved through i18n._() rather than the `t` template macro — this runs
// inside a route `head()`, outside any component render, where useLingui()
// (and therefore `t`) is never in scope. See lib/seo/constants.ts.
const CALL_TO_ACTION = msg`Vote on dates and claim what you'll bring.`;

// Chosen date wins, then the leading best-date, then whichever suggested
// date is soonest in the future — mirrors the hero-date precedence in
// event-detail-view.tsx (chosenDateOptionId ?? bestDateOptionId) but adds a
// third fallback so an undecided event still surfaces a concrete date
// rather than nothing.
function selectDateOption(
  dateOptions: DateOptionDto[],
  chosenDateOptionId: string | null,
  bestDateOptionId: string | null,
  now: Date,
): DateOptionDto | null {
  const chosen = dateOptions.find((d) => d.id === chosenDateOptionId);
  if (chosen) return chosen;

  const best = dateOptions.find((d) => d.id === bestDateOptionId);
  if (best) return best;

  const upcoming = dateOptions
    .filter((d) => new Date(d.startsAt).getTime() >= now.getTime())
    .sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  return upcoming[0] ?? null;
}

// Turns the loader's event into the card's title and description. Never
// reads event.description (organizer-authored free text that may contain
// addresses or private notes), participant names, or the organizer's name —
// those must never leak into a card any scraper or search engine can fetch.
export function buildEventCard(
  event: EventForCard,
  now: Date = new Date(),
): { title: string; description: string } {
  const title = `${event.title} — ${SITE_NAME}`;

  const dateOption = selectDateOption(
    event.dateOptions,
    event.chosenDateOptionId,
    event.bestDateOptionId,
    now,
  );

  const lead = dateOption
    ? formatDateLead(dateOption)
    : i18n._(EVENT_CARD_FALLBACK).replace(/\.$/, "");

  const segments = [lead, event.location ?? undefined].filter(
    (segment): segment is string => !!segment,
  );

  const description = `${segments.join(" · ")}. ${i18n._(CALL_TO_ACTION)}`;

  return { title, description };
}

function formatDateLead(dateOption: DateOptionDto): string {
  const parts = formatInstantParts(dateOption.startsAt);
  return `${parts.dow}, ${parts.mon} ${parts.day} · ${parts.time}`;
}

// Breaks a UTC instant into the viewer's-locale date/time parts used by
// the event dashboard and public event page (e.g. "Fri", "20", "Jun", "7:00 PM").
export function formatInstantParts(iso: string, locale?: string) {
  const date = new Date(iso);
  return {
    dow: date.toLocaleDateString(locale, { weekday: "short" }),
    day: date.toLocaleDateString(locale, { day: "numeric" }),
    mon: date.toLocaleDateString(locale, { month: "short" }),
    time: date.toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

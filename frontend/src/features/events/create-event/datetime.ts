// Combines a local calendar date and a 24h time string (HH:MM) into a UTC ISO 8601 instant.
export function combineDateAndTime(date: Date, timeHHMM: string): string {
  const [h, m] = timeHHMM.split(":").map(Number);
  const combined = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h,
    m,
    0,
    0,
  );
  return combined.toISOString();
}

export function formatDisplayDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "15:45" → "3:45 PM"
export function formatTime12h(timeHHMM: string): string {
  const [h, m] = timeHHMM.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

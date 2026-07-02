import { describe, expect, it } from "vitest";
import {
  combineDateAndTime,
  formatDisplayDate,
  formatTime12h,
} from "./datetime";

describe("combineDateAndTime", () => {
  it("returns a valid ISO string", () => {
    const date = new Date(2099, 5, 15); // June 15 2099, local
    const result = combineDateAndTime(date, "14:30");
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("encodes the correct local time in the instant", () => {
    const date = new Date(2099, 0, 1); // Jan 1 2099
    const result = combineDateAndTime(date, "09:05");
    // Safe on any timezone: combineDateAndTime builds from local components,
    // so parsing back with getHours()/getMinutes() (also local) always round-trips correctly.
    const parsed = new Date(result);
    expect(parsed.getHours()).toBe(9);
    expect(parsed.getMinutes()).toBe(5);
  });

  it("uses midnight (00:00) correctly", () => {
    const date = new Date(2099, 3, 20); // Apr 20
    const result = combineDateAndTime(date, "00:00");
    const parsed = new Date(result);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });

  it("uses end-of-day (23:59) correctly", () => {
    const date = new Date(2099, 11, 31); // Dec 31
    const result = combineDateAndTime(date, "23:59");
    const parsed = new Date(result);
    expect(parsed.getHours()).toBe(23);
    expect(parsed.getMinutes()).toBe(59);
  });
});

describe("formatTime12h", () => {
  it("converts PM hours", () => {
    expect(formatTime12h("14:30")).toBe("2:30 PM");
  });

  it("converts AM hours", () => {
    expect(formatTime12h("09:05")).toBe("9:05 AM");
  });

  it("converts noon", () => {
    expect(formatTime12h("12:00")).toBe("12:00 PM");
  });

  it("converts midnight", () => {
    expect(formatTime12h("00:00")).toBe("12:00 AM");
  });
});

describe("formatDisplayDate", () => {
  it("returns a human-readable date string", () => {
    const date = new Date(2099, 5, 15); // June 15
    const result = formatDisplayDate(date);
    expect(result).toContain("Jun");
    expect(result).toContain("15");
  });
});

import { describe, expect, it } from "vitest";
import { formatInstantParts } from "./format-instant";

describe("formatInstantParts", () => {
  it("breaks an ISO instant into locale date/time parts", () => {
    const parts = formatInstantParts("2099-06-20T19:00:00.000Z", "en-US");
    expect(parts.mon).toBe("Jun");
    expect(parts.day).toBe("20");
    expect(parts.dow).toMatch(/^[A-Za-z]{3}$/);
    expect(parts.time).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/);
  });
});

import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("returns the path when it is a safe internal path", () => {
    expect(safeRedirectPath("/e/abc123")).toBe("/e/abc123");
  });

  it("falls back to /events when undefined", () => {
    expect(safeRedirectPath(undefined)).toBe("/events");
  });

  it("falls back to /events for an empty string", () => {
    expect(safeRedirectPath("")).toBe("/events");
  });

  it("falls back to /events for a path not starting with /", () => {
    expect(safeRedirectPath("evil.com")).toBe("/events");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/events");
  });

  it("rejects backslash-based protocol-relative bypasses", () => {
    expect(safeRedirectPath("/\\evil.com")).toBe("/events");
  });
});

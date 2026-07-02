import { describe, expect, it } from "vitest";
import { createEventSchema } from "./schema";

const futureDate = "2099-01-01T12:00:00Z";

describe("createEventSchema", () => {
  it("validates a complete valid event", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      description: "Bring sunscreen",
      location: "Central Park",
      dateOptions: [futureDate],
      items: ["Frisbee", "Sunscreen"],
    });
    expect(result.success).toBe(true);
  });

  it("requires title", () => {
    const result = createEventSchema.safeParse({
      title: "",
      dateOptions: [futureDate],
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one date option", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 10 date options", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: Array(11).fill(futureDate),
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 10 date options", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: Array(10).fill(futureDate),
    });
    expect(result.success).toBe(true);
  });

  it("rejects past dates", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: ["2020-01-01T12:00:00Z"],
    });
    expect(result.success).toBe(false);
  });

  it("defaults items to empty array when omitted", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: [futureDate],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items).toEqual([]);
  });

  it("rejects empty item labels", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: [futureDate],
      items: ["Frisbee", ""],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 items", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: [futureDate],
      items: Array(51).fill("Item"),
    });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 50 items", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: [futureDate],
      items: Array(50).fill("Item"),
    });
    expect(result.success).toBe(true);
  });

  it("description and location are optional", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: [futureDate],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeUndefined();
      expect(result.data.location).toBeUndefined();
    }
  });

  it("accepts dates with timezone offsets", () => {
    const result = createEventSchema.safeParse({
      title: "Summer Picnic",
      dateOptions: ["2099-06-15T10:00:00+02:00"],
    });
    expect(result.success).toBe(true);
  });
});

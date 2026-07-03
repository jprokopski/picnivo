import { describe, expect, it } from "vitest";
import {
  ATTENDANCE_VALUES,
  isEffectivelyComing,
  isEffectivelyOut,
} from "./schema";

describe("isEffectivelyComing", () => {
  it("is true when attendance is explicitly Coming", () => {
    expect(isEffectivelyComing(ATTENDANCE_VALUES.coming, [], "d1")).toBe(true);
  });

  it("is true when Undecided and voted Yes on the chosen date", () => {
    const votes = [{ dateOptionId: "d1", choice: 1 }];
    expect(isEffectivelyComing(ATTENDANCE_VALUES.undecided, votes, "d1")).toBe(
      true,
    );
  });

  it("is false when Undecided and voted No on the chosen date", () => {
    const votes = [{ dateOptionId: "d1", choice: 3 }];
    expect(isEffectivelyComing(ATTENDANCE_VALUES.undecided, votes, "d1")).toBe(
      false,
    );
  });

  it("is false when explicitly Out, regardless of votes", () => {
    const votes = [{ dateOptionId: "d1", choice: 1 }];
    expect(isEffectivelyComing(ATTENDANCE_VALUES.out, votes, "d1")).toBe(false);
  });

  it("is false when there is no chosen date yet", () => {
    const votes = [{ dateOptionId: "d1", choice: 1 }];
    expect(isEffectivelyComing(ATTENDANCE_VALUES.undecided, votes, null)).toBe(
      false,
    );
  });
});

describe("isEffectivelyOut", () => {
  it("is true when attendance is explicitly Out", () => {
    expect(isEffectivelyOut(ATTENDANCE_VALUES.out, [], "d1")).toBe(true);
  });

  it("is true when Undecided and voted No on the chosen date", () => {
    const votes = [{ dateOptionId: "d1", choice: 3 }];
    expect(isEffectivelyOut(ATTENDANCE_VALUES.undecided, votes, "d1")).toBe(
      true,
    );
  });

  it("is false when Undecided and voted Yes on the chosen date", () => {
    const votes = [{ dateOptionId: "d1", choice: 1 }];
    expect(isEffectivelyOut(ATTENDANCE_VALUES.undecided, votes, "d1")).toBe(
      false,
    );
  });

  it("is false when explicitly Coming, regardless of votes", () => {
    const votes = [{ dateOptionId: "d1", choice: 3 }];
    expect(isEffectivelyOut(ATTENDANCE_VALUES.coming, votes, "d1")).toBe(false);
  });

  it("is false when there is no chosen date yet", () => {
    const votes = [{ dateOptionId: "d1", choice: 3 }];
    expect(isEffectivelyOut(ATTENDANCE_VALUES.undecided, votes, null)).toBe(
      false,
    );
  });
});

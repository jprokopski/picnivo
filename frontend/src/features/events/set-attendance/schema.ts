import { z } from "zod";
import type { AttendanceStatus, ParticipantVoteDto } from "@/api/picnivo-api";
import { VOTE_CHOICE_VALUES } from "../vote-on-dates/schema";

export type AttendanceKey = "undecided" | "coming" | "out";

export const ATTENDANCE_VALUES: Record<AttendanceKey, AttendanceStatus> = {
  undecided: 1,
  coming: 2,
  out: 3,
};

export const setAttendanceSchema = z.object({
  token: z.string().min(1),
  status: z.enum(["coming", "out"]),
});

// Attendance is a separate intent from the recorded vote (see plan's "Attendance
// vs vote separation"): an Undecided participant who voted Yes/No on the chosen
// date is treated as effectively coming/out without ever rewriting their vote.
export function isEffectivelyComing(
  attendance: AttendanceStatus,
  votes: ParticipantVoteDto[],
  chosenDateOptionId: string | null,
): boolean {
  if (attendance === ATTENDANCE_VALUES.coming) return true;
  if (attendance !== ATTENDANCE_VALUES.undecided || !chosenDateOptionId) {
    return false;
  }
  return votes.some(
    (v) =>
      v.dateOptionId === chosenDateOptionId &&
      v.choice === VOTE_CHOICE_VALUES.yes,
  );
}

export function isEffectivelyOut(
  attendance: AttendanceStatus,
  votes: ParticipantVoteDto[],
  chosenDateOptionId: string | null,
): boolean {
  if (attendance === ATTENDANCE_VALUES.out) return true;
  if (attendance !== ATTENDANCE_VALUES.undecided || !chosenDateOptionId) {
    return false;
  }
  return votes.some(
    (v) =>
      v.dateOptionId === chosenDateOptionId &&
      v.choice === VOTE_CHOICE_VALUES.no,
  );
}

import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { setAttendance } from "../../../api/picnivo-api";
import { getParticipantIdCookie } from "../../../lib/participant/cookie";
import { ATTENDANCE_VALUES, setAttendanceSchema } from "./schema";

export const setAttendanceFn = createServerFn({ method: "POST" })
  .validator(setAttendanceSchema)
  .handler(async ({ data }) => {
    const participantId = getParticipantIdCookie(data.token);
    if (!participantId) {
      return { error: "Join the event first." };
    }
    try {
      await setAttendance(data.token, participantId, {
        status: ATTENDANCE_VALUES[data.status],
      });
      return { error: null };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        return { error: detail as string };
      }
      throw err;
    }
  });

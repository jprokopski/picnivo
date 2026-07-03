import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { joinEvent } from "../../../api/picnivo-api";
import { setParticipantIdCookie } from "../../../lib/participant/cookie";
import { joinEventSchema } from "./schema";

export const joinEventFn = createServerFn({ method: "POST" })
  .validator(joinEventSchema)
  .handler(async ({ data }) => {
    try {
      const result = await joinEvent(data.token, {
        displayName: data.displayName,
      });
      setParticipantIdCookie(data.token, result.participantId);
      return {
        participantId: result.participantId,
        duplicateName: result.duplicateName,
        error: null,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        return {
          participantId: null,
          duplicateName: false,
          error: detail as string,
        };
      }
      throw err;
    }
  });

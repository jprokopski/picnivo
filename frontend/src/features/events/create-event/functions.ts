import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { createEvent } from "../../../api/picnivo-api";
import { setParticipantIdCookie } from "../../../lib/participant/cookie";
import { authMiddleware } from "../../../middleware/auth";
import { createEventSchema } from "./schema";

export const createEventFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(createEventSchema)
  .handler(async ({ data, context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession();
    try {
      const result = await createEvent(
        {
          title: data.title,
          description: data.description ?? null,
          location: data.location ?? null,
          dateOptions: data.dateOptions,
          items: data.items,
        },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      setParticipantIdCookie(result.token, result.participantId);
      return {
        token: result.token,
        id: result.id,
        participantId: result.participantId,
        error: null,
      };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        return {
          token: null,
          id: null,
          participantId: null,
          error: detail as string,
        };
      }
      throw err;
    }
  });

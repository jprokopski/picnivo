import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { z } from "zod";
import { deleteEvent } from "../../../api/picnivo-api";
import { authMiddleware } from "../../../middleware/auth";

const deleteEventSchema = z.object({
  token: z.string().min(1),
});

export const deleteEventFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(deleteEventSchema)
  .handler(async ({ data, context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession();
    try {
      await deleteEvent(data.token, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
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

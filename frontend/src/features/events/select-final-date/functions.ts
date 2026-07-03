import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { z } from "zod";
import { selectFinalDate } from "../../../api/picnivo-api";
import { authMiddleware } from "../../../middleware/auth";

const selectFinalDateSchema = z.object({
  token: z.string().min(1),
  dateOptionId: z.string().min(1).nullable(),
});

export const selectFinalDateFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(selectFinalDateSchema)
  .handler(async ({ data, context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession();
    try {
      await selectFinalDate(
        data.token,
        { dateOptionId: data.dateOptionId },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      return { error: null };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail ?? err.message;
        return { error: detail as string };
      }
      throw err;
    }
  });

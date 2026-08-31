import { createServerFn } from "@tanstack/react-start";
import axios from "axios";
import { z } from "zod";
import { selectFinalDate } from "../../../api/picnivo-api";
import { authMiddleware } from "../../../middleware/auth";

const selectFinalDateSchema = z.object({
  token: z.string().min(1),
  dateOptionId: z.string().min(1).nullable(),
  force: z.boolean().optional(),
});

export const selectFinalDateFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(selectFinalDateSchema)
  .handler(async ({ data, context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession();
    try {
      await selectFinalDate(
        data.token,
        { dateOptionId: data.dateOptionId, force: data.force },
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      );
      return { error: null, changed: false, currentBestDateOptionId: null };
    } catch (err) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          return {
            error: null,
            changed: true,
            currentBestDateOptionId:
              (err.response.data?.currentBestDateOptionId as
                | string
                | null
                | undefined) ?? null,
          };
        }
        const detail = err.response?.data?.detail ?? err.message;
        return {
          error: detail as string,
          changed: false,
          currentBestDateOptionId: null,
        };
      }
      throw err;
    }
  });

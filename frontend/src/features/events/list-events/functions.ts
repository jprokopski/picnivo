import { createServerFn } from "@tanstack/react-start";
import { listEvents } from "../../../api/picnivo-api";
import { authMiddleware } from "../../../middleware/auth";

export const listEventsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const {
      data: { session },
    } = await context.supabase.auth.getSession();
    return await listEvents({
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
  });

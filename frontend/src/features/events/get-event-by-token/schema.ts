import { z } from "zod";

export const tokenSchema = z.object({
  token: z.string().min(1),
});

// The event fetch accepts an explicitly-resolved participant id so `you`
// resolves on first render even when the `pv_p` cookie was only just set this
// request (a Set-Cookie header isn't readable in the same request). Falls back
// to the cookie when omitted, preserving behavior for callers that don't pass it.
export const eventByTokenSchema = tokenSchema.extend({
  participantId: z.string().optional(),
});

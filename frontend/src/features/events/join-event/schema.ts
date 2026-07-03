import { z } from "zod";

export const joinEventSchema = z.object({
  token: z.string().min(1),
  displayName: z
    .string()
    .trim()
    .min(2, "Name is required")
    .max(100, "Name is too long"),
});

export type JoinEventInput = z.infer<typeof joinEventSchema>;

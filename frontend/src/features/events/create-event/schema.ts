import { z } from "zod";

const futureIsoInstant = z
  .string()
  .datetime({ offset: true })
  .refine((val) => new Date(val) > new Date(), {
    message: "Date must be in the future",
  });

export const createEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  location: z.string().max(500).optional(),
  dateOptions: z
    .array(futureIsoInstant)
    .min(1, "At least one date is required")
    .max(10, "Maximum 10 dates allowed"),
  items: z
    .array(z.string().min(1, "Item label cannot be empty"))
    .max(50, "Maximum 50 items allowed")
    .default([]),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

import { z } from "zod";

export const itemActionSchema = z.object({
  token: z.string().min(1),
  itemId: z.string().min(1),
});

export const addItemSchema = z.object({
  token: z.string().min(1),
  label: z.string().trim().min(1).max(200),
});

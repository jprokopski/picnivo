import { z } from 'zod'

const envSchema = z.object({
  VITE_SUPABASE_URL: z.url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_API_URL: z.url(),
})

export const env = envSchema.parse(import.meta.env)

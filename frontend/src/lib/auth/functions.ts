import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createSupabaseServerClient } from '../supabase/server'

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

const signInSchema = credentialsSchema

const signUpSchema = credentialsSchema.extend({
  displayName: z.string().min(1).max(100),
})

export const signInFn = createServerFn({ method: 'POST' })
  .inputValidator(signInSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    return { error: error?.message ?? null }
  })

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator(signUpSchema)
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { display_name: data.displayName },
      },
    })
    return { error: error?.message ?? null }
  })

export const signOutFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signOut()
    return { error: error?.message ?? null }
  },
)

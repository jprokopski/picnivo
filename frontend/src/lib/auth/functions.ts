import { createServerFn } from '@tanstack/react-start'
import { createSupabaseServerClient } from '../supabase/server'

export const signInFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { email: string; password: string }) => data,
  )
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    return { error: error?.message ?? null }
  })

export const signUpFn = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { email: string; password: string; displayName: string }) => data,
  )
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

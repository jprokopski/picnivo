import { createMiddleware } from '@tanstack/react-start'
import { createSupabaseServerClient } from '../lib/supabase/server'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) console.error('Supabase auth error:', error.message)

  if (!user) {
    throw new Error('Unauthorized')
  }

  return next({ context: { user, supabase } })
})

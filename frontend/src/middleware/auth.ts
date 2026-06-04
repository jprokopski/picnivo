import { createMiddleware } from '@tanstack/react-start'
import { createSupabaseServerClient } from '../lib/supabase/server'

export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  return next({ context: { user, supabase } })
})

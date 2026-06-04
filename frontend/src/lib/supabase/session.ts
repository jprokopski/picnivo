import { createServerFn } from '@tanstack/react-start'
import { createSupabaseServerClient } from './server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error) console.error('Supabase auth error:', error.message)
    return user
  },
)

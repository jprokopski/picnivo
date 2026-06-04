import { createServerFn } from '@tanstack/react-start'
import { createSupabaseServerClient } from './server'

export const getSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user
  },
)

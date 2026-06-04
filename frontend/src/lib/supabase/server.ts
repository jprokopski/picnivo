import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'

export function createSupabaseServerClient() {
  const cookies = getCookies()

  return createServerClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () =>
          Object.entries(cookies).map(([name, value]) => ({ name, value })),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            setCookie(name, value, options)
          }
        },
      },
    },
  )
}

import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { routeTree } from './routeTree.gen'

export type RouterContext = {
  user: User | null
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    context: { user: null },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}

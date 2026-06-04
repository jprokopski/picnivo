import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { signOutFn } from '../lib/auth/functions'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  const router = useRouter()
  const user = useRouterState({ select: (s) => s.matches[0]?.context?.user })

  async function handleSignOut() {
    await signOutFn()
    router.invalidate()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
          >
            <span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
            TanStack Start
          </Link>
        </h2>

        <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Home
          </Link>
          <Link
            to="/about"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            About
          </Link>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <>
              <span className="hidden text-sm font-semibold text-(--sea-ink) sm:block">
                {user.user_metadata?.display_name ||
                  user.user_metadata?.full_name ||
                  'Organizer'}
              </span>
              <Link
                to="/dashboard"
                className="nav-link text-sm font-semibold"
                activeProps={{ className: 'nav-link is-active' }}
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg border border-(--line) bg-(--surface-strong) px-3 py-1.5 text-sm font-semibold text-(--sea-ink) transition hover:bg-(--link-bg-hover)"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                search={{ redirect: '' }}
                className="nav-link text-sm font-semibold"
                activeProps={{ className: 'nav-link is-active' }}
              >
                Log In
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-(--lagoon-deep) px-3 py-1.5 text-sm font-semibold text-white! no-underline transition hover:bg-(--lagoon)"
              >
                Register
              </Link>
            </>
          )}

          <ThemeToggle />
        </div>
      </nav>
    </header>
  )
}

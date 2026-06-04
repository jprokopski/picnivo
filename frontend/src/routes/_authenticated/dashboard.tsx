import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'
import { signOutFn } from '../../lib/auth/functions'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const router = useRouter()
  const { user } = Route.useRouteContext()

  async function handleSignOut() {
    await signOutFn()
    router.invalidate()
  }

  if (!user) return null

  const displayName =
    user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    'Organizer'

  return (
    <main className="page-wrap py-12">
      <div className="island-shell rounded-2xl p-8">
        <p className="island-kicker mb-2">
          <Trans>Dashboard</Trans>
        </p>
        <h1 className="display-title mb-6 text-2xl font-bold">
          <Trans>Welcome, {displayName}</Trans>
        </h1>

        <div className="mb-8 space-y-2 text-sm text-(--sea-ink-soft)">
          <p>
            <span className="font-semibold text-(--sea-ink)">
              <Trans>Email:</Trans>
            </span>{' '}
            {user.email}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-(--line) bg-(--surface-strong) px-4 py-2 font-semibold text-(--sea-ink) transition hover:bg-(--link-bg-hover)"
        >
          <Trans>Sign Out</Trans>
        </button>
      </div>
    </main>
  )
}

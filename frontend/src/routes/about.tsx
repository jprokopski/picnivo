import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <p className="island-kicker mb-2">
          <Trans>About</Trans>
        </p>
        <h1 className="display-title mb-3 text-4xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          <Trans>A small starter with room to grow.</Trans>
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-[var(--sea-ink-soft)]">
          <Trans>
            TanStack Start gives you type-safe routing, server functions, and
            modern SSR defaults. Use this as a clean foundation, then layer in
            your own routes, styling, and add-ons.
          </Trans>
        </p>
      </section>
    </main>
  )
}

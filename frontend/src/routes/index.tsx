import { createFileRoute } from '@tanstack/react-router'
import { Trans } from '@lingui/react/macro'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="page-wrap px-4 pt-14 pb-8">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -top-24 -left-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">
          <Trans>TanStack Start Base Template</Trans>
        </p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          <Trans>Start simple, ship quickly.</Trans>
        </h1>
        <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          <Trans>
            This base starter intentionally keeps things light: two routes,
            clean structure, and the essentials you need to build from scratch.
          </Trans>
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/about"
            className="rounded-full border border-[rgba(50,143,151,0.3)] bg-[rgba(79,184,178,0.14)] px-5 py-2.5 text-sm font-semibold text-[var(--lagoon-deep)] no-underline transition hover:-translate-y-0.5 hover:bg-[rgba(79,184,178,0.24)]"
          >
            <Trans>About This Starter</Trans>
          </a>
          <a
            href="https://tanstack.com/router"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)]"
          >
            <Trans>Router Guide</Trans>
          </a>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="island-shell feature-card rise-in rounded-2xl p-5">
          <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
            <Trans>Type-Safe Routing</Trans>
          </h2>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            <Trans>Routes and links stay in sync across every page.</Trans>
          </p>
        </article>
        <article
          className="island-shell feature-card rise-in rounded-2xl p-5"
          style={{ animationDelay: '170ms' }}
        >
          <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
            <Trans>Server Functions</Trans>
          </h2>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            <Trans>
              Call server code from your UI without creating API boilerplate.
            </Trans>
          </p>
        </article>
        <article
          className="island-shell feature-card rise-in rounded-2xl p-5"
          style={{ animationDelay: '260ms' }}
        >
          <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
            <Trans>Streaming by Default</Trans>
          </h2>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            <Trans>
              Ship progressively rendered responses for faster experiences.
            </Trans>
          </p>
        </article>
        <article
          className="island-shell feature-card rise-in rounded-2xl p-5"
          style={{ animationDelay: '350ms' }}
        >
          <h2 className="mb-2 text-base font-semibold text-[var(--sea-ink)]">
            <Trans>Tailwind Native</Trans>
          </h2>
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            <Trans>
              Design quickly with utility-first styling and reusable tokens.
            </Trans>
          </p>
        </article>
      </section>

      <section className="island-shell mt-8 rounded-2xl p-6">
        <p className="island-kicker mb-2">
          <Trans>Quick Start</Trans>
        </p>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-[var(--sea-ink-soft)]">
          <li>
            <Trans>
              Edit <code>src/routes/index.tsx</code> to customize the home page.
            </Trans>
          </li>
          <li>
            <Trans>
              Update <code>src/components/Header.tsx</code> and{' '}
              <code>src/components/Footer.tsx</code> for brand links.
            </Trans>
          </li>
          <li>
            <Trans>
              Add routes in <code>src/routes</code> and tweak visual tokens in{' '}
              <code>src/styles.css</code>.
            </Trans>
          </li>
        </ul>
      </section>
    </main>
  )
}

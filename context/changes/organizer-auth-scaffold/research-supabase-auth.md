# Supabase Auth — Compatibility Research for F-02

> Researched 2026-06-04 via Exa web search. Covers compatibility with the Picnivo stack:
> backend (ASP.NET Core 10 Minimal API, Fly.io) and frontend (TanStack Start, Cloudflare Workers).

## Verdict

Supabase Auth is a strong fit. Both sides of the stack have well-documented integration paths, and the project already runs Supabase CLI for local Postgres.

## Frontend (TanStack Start + Cloudflare Workers)

First-class support:

- **Official quickstart**: Supabase publishes a [TanStack Start guide](https://supabase.com/docs/guides/getting-started/quickstarts/tanstack) (updated 2026-05-20).
- **TanStack example**: The TanStack docs ship a [Start Supabase Basic example](https://tanstack.com/start/latest/docs/framework/react/examples/start-supabase-basic) using `createServerFn` + `getSupabaseServerClient()` + `beforeLoad` route guards.
- **Community starter**: [domgaulton/tanstack-start-supabase-auth-protected-routes](https://github.com/domgaulton/tanstack-start-supabase-auth-protected-routes) — production-ready template with `_authenticated` layout guard, password reset, shadcn/ui, Tailwind v4, Vitest, Playwright E2E.
- **Another example**: [aaronksaunders/tanstack-start-supabase-auth](https://github.com/aaronksaunders/tanstack-start-supabase-auth) — login, signup, session management, SSR support.

Pattern: `@supabase/supabase-js` inside `createServerFn` handlers and `beforeLoad` route guards — native TanStack Start idioms.

## Backend (ASP.NET Core 10 Minimal API on Fly.io)

Standard JWT validation via built-in `AddJwtBearer()` middleware — no Supabase-specific SDK required:

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuer = true,
            ValidIssuer = "https://<project>.supabase.co/auth/v1",
            ValidateAudience = true,
            ValidAudiences = new[] { "authenticated" },
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(supabaseJwtSecret))
        };
    });
```

Sources:
- [Integrating Supabase Auth with .NET](https://www.rodyvansambeek.com/blog/using-supabase-auth-with-dotnet) — full walkthrough of JWT secret retrieval and `AddJwtBearer` config.
- [Protect your ASP.NET site using Supabase authentication](https://hashset.dev/article/2024/02/20/protect-your-asp-net-site-using-supabase-authentication/) — cookie-based approach with `ClaimsPrincipal` mapping.
- [StackOverflow: verify JWT tokens from Supabase in ASP.NET Core](https://stackoverflow.com/questions/79760706) — gotcha: newer Supabase projects use ES256 asymmetric signing keys; older use HS256 symmetric. Check dashboard settings.
- [supabase-csharp discussion #47](https://github.com/supabase-community/supabase-csharp/discussions/47) — community-confirmed pattern with `SymmetricSecurityKey`.
- [Hitmasu/supabase-dotnet](https://github.com/Hitmasu/supabase-dotnet) — alternative .NET client with `ISupabaseAuth` if server-side auth calls are needed.

## Local Development

The project already runs `supabase start -x gotrue,realtime,...` which **excludes** GoTrue. Removing `gotrue` from the exclusion list enables a local auth server at `http://localhost:54321/auth/v1/` with Mailpit for email verification at `http://localhost:54324` — zero extra setup.

Local env vars for the frontend:
```
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<local-anon-key from supabase status>
```

## Trade-off vs ASP.NET Core Identity

The backend tech-stack.md says "ASP.NET Core Identity handles it natively." Supabase Auth replaces Identity:

| Dimension | ASP.NET Core Identity | Supabase Auth |
|---|---|---|
| User store | EF Core schema (Identity tables + migrations) | Supabase `auth.users` (same Postgres) |
| Frontend SDK | Roll your own | `@supabase/supabase-js` + optional Auth UI components |
| TanStack Start examples | None | Official quickstart + community starters |
| OAuth providers | Manual config per provider | Toggle in dashboard or `config.toml` |
| Local dev | Manual seeding | Already have Supabase CLI |
| Lock-in risk | None | Moderate (GoTrue is open-source, mitigates) |
| Backend coupling | Tight (Identity tables, UserManager, EF migrations) | Loose (JWT validation only) |

## Gotchas

1. **Signing algorithm**: Newer Supabase projects default to ES256 (asymmetric). Older ones use HS256 (symmetric). The `AddJwtBearer` config differs — check the Supabase dashboard under Settings > API > JWT Settings.
2. **Audience value**: Default is the string `"authenticated"`, not the project URL.
3. **Token storage**: `@supabase/supabase-js` stores tokens in localStorage by default. For SSR with TanStack Start, use `@supabase/ssr` for cookie-based sessions.
4. **Supabase manages its own schema**: Do not modify `auth.*` tables directly. Use the Auth API for user management.
5. **Production hosting**: Free tier on Supabase Cloud covers MVP. GoTrue can be self-hosted if needed later.

# Supabase Auth — API-Level Reference for F-02

> Fetched 2026-06-04 via Context7 MCP from `@supabase/supabase-js`, `supabase/auth`, and `supabase-community/supabase-csharp` docs.
> Complements `research-supabase-auth.md` (web search) with SDK-level details.

## Frontend: `@supabase/supabase-js` Auth Methods

**Sign Up** (email + password):
```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'example-password',
})
```

**Sign In** (email + password):
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'example-password',
})
```

**Session state management** (React pattern):
```typescript
const [session, setSession] = React.useState(null)

React.useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null)
      } else if (session) {
        setSession(session)
      }
    }
  )
  return () => subscription.unsubscribe()
}, [])
```

**Sign Out**:
```typescript
await supabase.auth.signOut()
// Scope options: 'global' (all sessions), 'local' (current), 'others' (all except current)
```

The JS client supports PKCE flow (`flowType: 'pkce'`) for enhanced security. Token auto-refresh is built in.

## Backend: Supabase Auth Server Endpoints (GoTrue)

These are the GoTrue endpoints the JS client calls under the hood.

**POST `/token`** — obtain access tokens:
```
POST /token?grant_type=password
Body: { "email": "user@example.com", "password": "secretpassword" }

Response 200:
{
  "access_token": "eyJhbG...",     // standard JWT
  "token_type": "bearer",
  "expires_in": 3600,
  "expires_at": 1704067200,
  "refresh_token": "sbr_...",
  "user": {
    "id": "550e8400-...",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "user@example.com"
  }
}
```

Grant types: `password`, `refresh_token`, `pkce`, `id_token`.

**POST `/verify`** — verify email/phone/recovery tokens:
```
POST /verify
Body: { "type": "email", "token": "confirmation_token" }

Response 200: { access_token, refresh_token, user, session }
Error codes: 400 (invalid), 404 (not found), 410 (expired)
```

Token types: `email`, `phone`, `recovery`, `magic_link`, `signup`, `invite`.

## Backend: ASP.NET Core JWT Validation

The access_token JWT contains these claims (used for authorization):
- `sub` — user UUID
- `email` — user email
- `role` — `"authenticated"` for logged-in users
- `aud` — `"authenticated"`

Minimal API route protection:
```csharp
app.MapPost("/api/events", handler).RequireAuthorization();   // organizer-only
app.MapGet("/api/events/{token}", handler);                    // public (participant)
```

## Supabase C# Client (alternative, not recommended for F-02)

The community `supabase-csharp` package (benchmark score 34/100) wraps GoTrue for server-side auth:
```csharp
var client = new SupabaseClient(supabaseUrl, supabaseKey);
// SignIn, SignUp, session persistence, auth state listeners available
```

For F-02's scope (validate JWTs on protected routes), ASP.NET Core's built-in `AddJwtBearer` middleware is simpler and avoids the dependency.

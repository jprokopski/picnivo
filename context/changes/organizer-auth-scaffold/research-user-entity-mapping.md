# Supabase Auth — User Entity Mapping for F-02

> Researched 2026-06-04 via Exa web search. Covers how to map Supabase Auth users
> to application entities in EF Core (backend) and TanStack Start (frontend).

## Core Constraint

Supabase manages users in `auth.users` — a table in the `auth` schema that your app
code should not directly modify or map to. Supabase docs state:

> "Only use primary keys as foreign key references for schemas and tables managed
> by Supabase. Columns, indices, constraints or other database objects managed by
> Supabase **may change at any time**."

Source: [Supabase — Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)

## The Standard Pattern: public.organizers as Bridge Table

Every Supabase project that needs app-specific user data uses a `public` schema table
that references `auth.users(id)` by primary key:

```sql
CREATE TABLE public.organizers (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

A database trigger auto-creates the row on sign-up:

```sql
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.organizers (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

This pattern appears consistently across:

- [Supabase official docs — Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase as a Game Backend (adilbouchnita.com)](https://adilbouchnita.com/blog/supabase-as-a-game-backend)
- [Getting started with Supabase (blog.rasc.ch)](https://blog.rasc.ch/2026/03/supabase-todo.html)
- [domgaulton/tanstack-start-supabase-auth-protected-routes](https://github.com/domgaulton/tanstack-start-supabase-auth-protected-routes) — uses `profiles` table with trigger
- [Oferzz/newMap commit](https://github.com/Oferzz/newMap/commit/895a2f4) — profiles extending auth.users with roles, privacy settings

## Why NOT Map auth.users Directly in EF Core

Technically possible via `e.ToTable("users", "auth")`, but dangerous:

1. **Schema drift** — GoTrue updates can change columns, indices, or constraints. Your EF model breaks at runtime.
2. **Migration hazards** — `dotnet ef migrations add` may generate `ALTER TABLE auth.users` statements that break authentication.
3. **Accidental writes** — `SaveChanges()` could overwrite Supabase-managed fields (`encrypted_password`, `raw_app_meta_data`, etc.).
4. **Supabase explicitly warns against it** — see constraint above.

## EF Core Entity Design

### Organizer (bridge entity — owns all relationships)

```csharp
public class Organizer
{
    public Guid Id { get; set; }          // = auth.users.id
    public string? DisplayName { get; set; }
    public DateTime CreatedAt { get; set; }

    public List<Event> Events { get; set; } = [];
}
```

### Event (FK to Organizer, not to auth.users)

```csharp
public class Event
{
    public Guid Id { get; set; }
    public Guid OrganizerId { get; set; }
    public string Title { get; set; } = "";

    public Organizer Organizer { get; set; } = null!;
}
```

### DbContext Configuration

```csharp
modelBuilder.Entity<Organizer>(e =>
{
    e.ToTable("organizers");
    e.HasKey(o => o.Id);
    e.Property(o => o.Id).ValueGeneratedNever(); // ID comes from Supabase, not auto-gen
});

modelBuilder.Entity<Event>(e =>
{
    e.ToTable("events");
    e.HasOne(ev => ev.Organizer)
     .WithMany(o => o.Events)
     .HasForeignKey(ev => ev.OrganizerId);
});
```

### Migration: FK to auth.users via Raw SQL

EF Core doesn't know about `auth.users`, so the FK is added manually:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    // ... standard CreateTable for organizers, events ...

    migrationBuilder.Sql(
        """
        ALTER TABLE organizers
        ADD CONSTRAINT fk_organizers_auth_users
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
        """);
}
```

## Organizer Row Creation Strategies

### A) Database Trigger (recommended)

The trigger above runs inside the Supabase sign-up transaction. Guarantees the
organizer row exists before the API ever sees a request.

Managed via Supabase migration file (not EF Core migration) since it touches `auth` schema.

### B) Lazy Creation in API (fallback)

```csharp
app.MapPost("/api/events", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var userId = Guid.Parse(user.FindFirst("sub")!.Value);
    var organizer = await db.Organizers.FindAsync(userId);
    if (organizer is null)
    {
        organizer = new Organizer { Id = userId };
        db.Organizers.Add(organizer);
    }
    // ... create event ...
}).RequireAuthorization();
```

Simpler to implement but introduces a race condition window where the organizer row
doesn't exist yet.

### C) Explicit Provisioning Endpoint

A dedicated `POST /api/organizers/me` called after first login. Frontend calls it
once and caches the result. Middle ground between trigger and lazy creation.

## Relationship Architecture Diagram

```
auth.users (Supabase-managed, auth schema)
    │
    │  FK via raw SQL in migration (ON DELETE CASCADE)
    ▼
public.organizers (EF Core-managed, public schema)
    │
    │  EF Core navigation property
    ▼
public.events ──► public.date_options
                  public.items
```

All downstream entities reference `organizers.id`, never `auth.users.id` directly.

## Frontend: User Object from Supabase JS

The frontend gets user data from `supabase.auth.getUser()`:

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
// user.id         — UUID matching organizers.id
// user.email      — email address
// user.user_metadata — { display_name, ... } set during signUp
```

The `user.id` is the same UUID stored in `organizers.id` — this is the join key
between frontend auth state and backend data.

## Sources

- [Supabase — Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase GitHub Discussion #30750](https://github.com/orgs/supabase/discussions/30750) — FK to auth.users patterns
- [Supabase Issue #2984](https://github.com/supabase/supabase/issues/2984) — proper schema-qualified FK syntax (`"auth"."users"`)
- [Erickthamara/WhiteListing-Backend](https://github.com/Erickthamara/WhiteListing-Backend) — ASP.NET Core Identity + Supabase Postgres custom provider
- [domgaulton/tanstack-start-supabase-auth-protected-routes](https://github.com/domgaulton/tanstack-start-supabase-auth-protected-routes) — profiles table with auto-populate trigger
- [AnswerOverflow: Supabase auth with dotnet backend](https://www.answeroverflow.com/m/1093935732176982137) — JWT validation patterns, `OnTokenValidated` for user ID extraction
- [supabase-csharp Discussion #47](https://github.com/supabase-community/supabase-csharp/discussions/47) — SupabaseSettings + ClaimsPrincipal mapping
- [Supabase Auth Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) — SSR token handling, PKCE flow

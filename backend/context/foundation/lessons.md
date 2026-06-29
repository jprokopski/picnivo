# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Never use ToTable() in EF Core entity configurations

- **Context**: backend EF Core entity configurations (Data/Configurations/*Configuration.cs)
- **Problem**: Explicit ToTable() creates naming inconsistencies (e.g. lowercase "organizers" vs PascalCase "Events"), which then couples raw SQL to non-default names and requires migration regen to fix.
- **Rule**: Never use ToTable() in entity configurations — let EF Core use its default PascalCase convention.
- **Applies to**: plan, implement, impl-review

## Prefer Select() Over Include() in Query Handlers

- **Context**: Backend EF Core query handlers (`Features/<Name>/<ActionName>/`)
- **Problem**: Unnecessary columns are fetched, and related entities are loaded in full even when only a few fields are needed — wasted I/O and memory, especially on tables with large columns or deep navigations.
- **Rule**: Use `Select()` to project to a DTO instead of `Include()` — load only the fields needed for the response.
- **Applies to**: implement, impl-review

## Avoid double-name references in nested feature handlers

- **Context**: Any .NET feature slice with a nested handler class
- **Problem**: Redundant double-name references like `CreateEvent.CreateEvent.Handle` appear in call sites — awkward, harder to read, and signals a naming/namespace issue.
- **Rule**: Use a `using` alias or directive so callers write `CreateEvent.Handle`, not `CreateEvent.CreateEvent.Handle`.
- **Applies to**: implement, impl-review

## Always wrap control-flow bodies in { } braces

- **Context**: All C# code — any .cs file in the backend
- **Problem**: Mixed brace styles make diffs and reviews harder to read; inconsistent style accumulates across the codebase over time.
- **Rule**: Always wrap control-flow bodies (if, else, for, foreach, while, do) in { } braces, even single-line bodies.
- **Applies to**: implement, impl-review

## Separate test files for handler, endpoint, validator, and action logic

- **Context**: `backend/Picnivo.Tests/` — all feature test files
- **Problem**: Mixing handler, endpoint, validator, and action tests in one file makes files large and hard to navigate.
- **Rule**: Handlers, endpoints, validators, and action logic must each have separate test files in the backend.
- **Applies to**: implement, impl-review

## Each test case must seed its own data via DbContext

- **Context**: Unit + integration tests in backend
- **Problem**: Tests share state and interfere — shared seed data causes ordering-dependent failures or false passes.
- **Rule**: Each test case should compose its own required data by seeding via DbContext directly.
- **Applies to**: implement, impl-review

## Always use Arrange-Act-Assert in every test case

- **Context**: All test files in backend/Picnivo.Tests/
- **Problem**: Tests are hard to read when setup, execution, and assertion blur together.
- **Rule**: Always structure every test case with Arrange, Act, and Assert sections.
- **Applies to**: implement, impl-review

## Order class members by type group, then by access level within each group (SA1202)

- **Context**: All C# classes, structs, and records in the project
- **Problem**: Harder to read and navigate code — readers scan for public API first; mixing visibility within a member-type group buries the public surface under private implementation detail.
- **Rule**: Within a class, group members by kind in this order: constant fields → fields → constructors → properties → methods → nested types. Within each kind group, order by access: public → internal → protected → private. Within each access group, static before instance; for fields, readonly before non-readonly.
- **Applies to**: implement, impl-review

## Always use the extension keyword for C# extension methods

- **Context**: C# backend code
- **Problem**: Developer preference — extension methods written without the `extension` keyword are harder to identify at a glance.
- **Rule**: Always use the `extension` keyword when defining C# extension methods.
- **Applies to**: implement, impl-review

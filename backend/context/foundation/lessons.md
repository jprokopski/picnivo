# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Never use ToTable() in EF Core entity configurations

- **Context**: backend EF Core entity configurations (Data/Configurations/*Configuration.cs)
- **Problem**: Explicit ToTable() creates naming inconsistencies (e.g. lowercase "organizers" vs PascalCase "Events"), which then couples raw SQL to non-default names and requires migration regen to fix.
- **Rule**: Never use ToTable() in entity configurations — let EF Core use its default PascalCase convention.
- **Applies to**: plan, implement, impl-review

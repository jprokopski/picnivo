# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Module-scope string arrays bypass Lingui extraction

- **Context**: Any React component that renders a constant array of user-visible labels (suggestions, options, hints, chip labels, etc.)
- **Problem**: User-visible string arrays declared at module scope cannot use the Lingui `t` template tag because `useLingui()` is a React hook and is unavailable outside component render. The strings display in the UI but are never extracted to the translation catalog and can never be translated.
- **Rule**: Declare user-visible string arrays inside the component body where `useLingui()` (and therefore `t`) is in scope. Alternatively, accept `t` as a parameter to a factory function. Never define translateable copy as bare string literals at module scope.
- **Applies to**: All frontend components; particularly constant arrays of labels, suggestion pills, select options, placeholder lists, or any copy rendered in JSX that could change per locale.

## Always use Lingui for hardcoded UI strings

- **Context**: Frontend UI components — any `.tsx` file rendering user-visible text
- **Problem**: Hardcoded strings bypass the i18n catalog and can never be localized.
- **Rule**: Always wrap hardcoded UI strings with Lingui's `<Trans>` component or `` t`` `` tag — never use bare string literals in JSX or outside Lingui.
- **Applies to**: implement, impl-review

## Always write Tailwind v4 canonical classes — never arbitrary values when a scale equivalent exists

- **Context**: Any time Tailwind utility classes are written or reviewed in the project's TSX files.
- **Problem**: Arbitrary values like `[16px]`, `[var(--card)]`, `[animation:X]` accumulate rapidly; a cleanup pass is then needed after every implementation phase, and the mix of styles makes components harder to read and refactor.
- **Rule**: Always prefer Tailwind v4 canonical equivalents over arbitrary bracket values when writing component classes. Three checks before committing any TSX file: (1) spacing `[Npx]` → `N/4` scale value (`[16px]`→`4`, `[7px]`→`1.75`); (2) CSS vars `[var(--x)]` → `(--x)` shorthand or named token (`bg-card`, `border-border`, `text-foreground`); (3) `[animation:X]`→`animate-[X]`, `duration-[Nms]`→`duration-N`, `break-words`→`wrap-break-word`.
- **Applies to**: implement, impl-review

## Use cn() for all conditional className values

- **Context**: Any component file in `frontend/src/` that sets `className` conditionally.
- **Problem**: String interpolation silently produces conflicting Tailwind classes that twMerge can't resolve, causing hard-to-debug style collisions.
- **Rule**: Always use `cn()` from `@/lib/utils` for any conditional or composed `className`. Template literals and string concatenation in `className` are banned. Prefer `condition && "class"` over ternaries with empty strings.
- **Applies to**: implement, impl-review

## Use kebab-case for frontend project files

- **Context**: New files under `frontend/src/**`, especially `src/components/` and `src/features/<Feature>/**/components/`.
- **Problem**: New feature files (e.g. `AuthPanel.tsx`, `AuthScene.tsx`, `AvatarStack.tsx`) used PascalCase filenames, diverging from the existing kebab-case convention (`header.tsx`, `logo.tsx`, `avatar.tsx`, `format-instant.ts`), making naming inconsistent and harder to predict/grep across the repo.
- **Rule**: Use kebab-case for all project files in `frontend/` (e.g. `auth-panel.tsx`, not `AuthPanel.tsx`), matching the existing convention in `src/components/`.
- **Applies to**: implement, impl-review

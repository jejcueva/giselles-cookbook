# Feature modules

Put **domain-specific UI and logic** here when it’s only used by one area of the app (e.g. recipes, categories).

## Conventions

- **`features/<name>/components/`** — components that belong to that feature.
- **`features/<name>/index.ts`** — barrel export for clean imports: `@/features/recipes`.
- **`components/ui/`** — shared primitives (Button, Input, Card, icons) used across features.
- **`lib/`** — shared utilities (Supabase, themes, `cn`, etc.).

## When to add a feature folder

Use a feature folder when:

- Several components only make sense for one flow (recipe list + card + filters).
- You want imports like `@/features/recipes` instead of a flat `components/` dump.

Keep **one-off** or **cross-cutting** pieces in `src/components/` or `src/components/ui/` until a second feature needs them.

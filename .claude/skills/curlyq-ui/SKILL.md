---
name: curlyq-ui
description: cURLyQ-specific UI conventions — this project styles its frontend with Tailwind CSS v4 and shadcn/ui. Use when building or editing any UI in src/.
---

# cURLyQ UI Conventions

## Stack

- **Tailwind CSS v4** via `@tailwindcss/vite` — no `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme inline` and `:root`/`.dark`.
- **shadcn/ui** (`radix` base, `nova` preset) — component primitives generated into `src/components/ui/` (`button.tsx`, `input.tsx`, `select.tsx`, `badge.tsx`, `card.tsx`, `collapsible.tsx`, ...).
- Path alias `@/*` → `src/*` (configured in `tsconfig.json` and `vite.config.ts`).

## Rules

- Build UI by composing existing components in `src/components/ui/` plus Tailwind utility classes — don't hand-roll new CSS files or reintroduce a component-scoped `.css` file.
- To add a new shadcn primitive: `npx shadcn@latest add <component>` (writes into `src/components/ui/`, wired to this project's theme automatically).
- Use the `cn()` helper from `src/lib/utils.ts` (clsx + tailwind-merge) when conditionally combining class names.
- Icons: `lucide-react` (already a dependency via shadcn init).
- Color/spacing/radius should come from the theme tokens (`bg-background`, `text-muted-foreground`, `border`, etc.) rather than raw hex values, so light/dark stay in sync.

## Theming (multiple palettes)

The app supports more than one visual theme (currently light + a `.dark` class variant, with more planned, e.g. a terminal-style palette). Theme switching works by swapping CSS custom properties per selector block in `src/index.css` (`:root`, `.dark`, future `.theme-*` classes) — **no component ever branches on which theme is active**. To keep it that way:

- Every color, corner radius, shadow, and font-family a component uses must come from a theme token (`bg-background`, `rounded-md`, `shadow-sm`, `font-sans`, `text-method-get`, etc.), never a raw hex, arbitrary shadow/radius value, or inline `fontFamily`. If a new color is needed, add a token to `@theme inline` + define its value per theme block in `index.css`, then reference the token — don't inline the value in the component.
- Spacing, padding, gap, and border-width are **not** part of the token system and are intentionally shared across all themes — don't make these conditional on theme either.
- Right now nothing ever applies `.dark`, so the app always renders in the light palette. Wiring up an actual theme switch needs an explicit toggle (e.g. a theme provider that sets `document.documentElement.classList` or a `data-theme` attribute) — not implemented yet.

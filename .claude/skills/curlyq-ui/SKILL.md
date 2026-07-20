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

## Dark mode caveat

shadcn's Nova preset ships dark mode as a `.dark` class toggle on a root element, **not** an automatic `prefers-color-scheme` media query (that's a change from this project's earlier hand-written CSS, which did use the media query). Right now nothing ever applies `.dark`, so the app always renders in light mode — if dark mode support is wanted, it needs an explicit toggle (e.g. a theme provider that sets `document.documentElement.classList`) or a small CSS override reintroducing a media-query-driven variant.

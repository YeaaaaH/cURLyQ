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

The app supports three visual themes: light (`:root` defaults), dark (`.dark` class), and terminal (`.theme-terminal` class — sharp 0px radius, no shadows, monospace UI font, neon-green accent). Theme switching works by swapping CSS custom properties per selector block in `src/index.css` — **no component ever branches on which theme is active**. To keep it that way:

- Every color, corner radius, shadow, and font-family a component uses must come from a theme token (`bg-background`, `rounded-md`, `shadow-sm`, `font-sans`, `text-method-get`, etc.), never a raw hex, arbitrary shadow/radius value, or inline `fontFamily`. If a new color is needed, add a token to `@theme inline` + define its value per theme block in `index.css`, then reference the token — don't inline the value in the component.
- Spacing, padding, gap, and border-width are **not** part of the token system and are intentionally shared across all themes — don't make these conditional on theme either.
- Theme state lives in `ThemeProvider`/`useTheme` (`src/components/ThemeProvider.tsx`), which also toggles `.dark`/`.theme-terminal` on `document.documentElement`; `ThemeSwitcher` (`src/components/sidebar/ThemeSwitcher.tsx`) just calls `setTheme`. Selection isn't persisted yet — resets to light on reload.
- The terminal palette is mostly a pure token reskin, plus one deliberate, narrowly-scoped exception to the no-branching rule: the sidebar search box swaps its icon and placeholder to `$`/"grep" (`SidebarSearchAndAdd.tsx`, gated on `useTheme()` — needs JS since placeholder text can't be themed via CSS). Outline-style chips (status badge, active tab border, env dot) instead of filled ones are still left out — would need new fill/border token pairs per spot, not component branching, but that's more surface area than this pass covered.

# shadcn-vue Select — Design

**Date:** 2026-08-09
**Status:** Approved
**Scope:** Adopt shadcn-vue (Tailwind v4 + Reka UI) and replace both native `<select>` elements in the Orders toolbar with its Select component.

## Problem

The two Orders filters are native `<select>` elements. A browser renders the open
option list with the OS palette, which no CSS can reach, so the popup looks nothing like
the rest of the admin. Restyling the closed trigger — which is all the current `.select`
block does — cannot fix it.

## Decision

Adopt shadcn-vue in full rather than hand-building a select or using Reka UI bare. It
brings Tailwind CSS into a codebase that styles everything else with SCSS and CSS custom
properties, which is accepted deliberately: the CLI then supplies Dialog, DropdownMenu,
Toast and the rest as owned source when they are wanted.

Existing views keep their SCSS. Nothing outside the Orders toolbar changes.

## Integration

Two details of this codebase make the stock installation wrong, and drive the design.

### Variable collision — do not declare shadcn's `:root` palette

`_tokens.scss` already defines `--primary` (`#42b883`, the link colour used by
`a { color: var(--primary) }` in `main.scss`) and `--secondary`. shadcn's standard theme
block declares both names with different meanings, so pasting it in would repaint every
link in the app.

Instead, no shadcn palette is declared. Tailwind's theme colours are mapped straight onto
the tokens that already exist:

| Tailwind theme key | Source token |
| --- | --- |
| `--color-popover` | `var(--surface)` |
| `--color-popover-foreground` | `var(--text-strong)` |
| `--color-border`, `--color-input` | `var(--border)` |
| `--color-muted-foreground` | `var(--text-muted)` |
| `--color-accent` (option hover) | `var(--surface-alt)` |
| `--color-accent-foreground` | `var(--text-strong)` |
| `--color-primary`, `--color-ring` | `rgb(var(--accent-rgb))` |
| `--color-primary-foreground` | `var(--ink-on-accent)` |

Because those tokens already re-declare under `:root[data-theme='dark']`, the Select
themes itself through the existing toggle. No `.dark` class syncing and no second dark
palette. `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))` is
still registered so any `dark:` utility inside shadcn's generated markup resolves.

### Preflight stays off

`@import "tailwindcss"` includes Preflight, a global reset that zeroes heading and list
margins and sets `border-width: 0` on every element. The 20+ existing SCSS views were
written against browser defaults and are not audited for it. The layers are therefore
imported without it:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);
```

This lives in `src/styles/tailwind.css`, imported from `main.js` **before** `main.scss`
so the unlayered SCSS continues to win the cascade. If the Preflight-less Select needs a
reset Preflight would have supplied, it is added to the Select's own classes rather than
globally.

## Files

| File | Change |
| --- | --- |
| `package.json` | + `tailwindcss`, `@tailwindcss/vite`, `reka-ui`, `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-vue-next` |
| `jsconfig.json` | new — the shadcn CLI resolves the `@` alias from here; the repo has no tsconfig |
| `components.json` | new — `typescript: false` so the CLI emits plain JS |
| `vite.config.js` | + the `@tailwindcss/vite` plugin |
| `src/styles/tailwind.css` | new — layer imports, `@custom-variant dark`, `@theme inline` mapping |
| `src/main.js` | + `import './styles/tailwind.css'` before `main.scss` |
| `src/lib/utils.js` | new — shadcn's `cn()` helper |
| `src/components/ui/select/*.vue` | new — owned component source |
| `src/views/OrdersView.vue` | both selects replaced; dead `.select` SCSS and `select__sr` span removed |

If the CLI fails on a plain-JS repo, the Select source is vendored by hand from the
shadcn-vue docs. The outcome is identical — the component is owned source either way.

The status and period triggers keep their funnel and calendar icons, placed inside the
trigger's slot.

## Out of scope

- The Export menu, which stays a `role="menu"` action list.
- The other 17 native `<select>` elements elsewhere in the repo.
- Converting any existing view to Tailwind.

## Testing

Reka UI renders through a teleport with positioning logic that behaves poorly under
jsdom, so component tests there would be unreliable. Verification is instead:

1. **Browser (Playwright).** Open the period filter; `↓` to move the highlight; type
   `we` to jump to Weekly; `Enter` to select; confirm the trigger label changed, the
   table refetched, and focus returned to the trigger. `Esc` closes without changing the
   value.
2. **Theming.** Toggle dark mode with the Select open and confirm it follows.
3. **No regression.** Load two non-Orders pages and confirm the Tailwind import changed
   nothing.
4. **Existing suite.** The 26 unit tests still pass, plus `lint` and `build`.

## Risks

- The shadcn CLI may not handle a plain-JS, non-tsconfig repo. Fallback is vendoring.
- Without Preflight, shadcn markup may rely on a reset it no longer gets. Caught by the
  browser check and fixed in the component's own classes.

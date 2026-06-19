# PiGrow-UI Design System Implementation Plan

## Overview

Convert the PiGrow-UI from its current light theme with hardcoded colors to a modern dark-mode IoT control center using a centralized design token system.

## Design Direction

**Dark Mode (OLED) IoT Dashboard** - Deep navy backgrounds, bright green status accents, subtle glow effects, high-contrast text, monospace code with cyan highlights.

## Color Palette

| Token                    | Value                  | Usage                    |
| ------------------------ | ---------------------- | ------------------------ |
| `--color-bg-base`        | `#0b1120`              | App shell background     |
| `--color-bg-surface`     | `#151d2e`              | Cards, panels            |
| `--color-bg-elevated`    | `#1c2640`              | Hover, elevated elements |
| `--color-bg-hover`       | `#222e48`              | Interactive hover state  |
| `--color-bg-muted`       | `#2a3654`              | Subtle backgrounds       |
| `--color-border`         | `#1c2640`              | Default borders          |
| `--color-border-subtle`  | `#151d2e`              | Subtle dividers          |
| `--color-border-active`  | `#22c55e`              | Active/focus borders     |
| `--color-text-primary`   | `#f1f5f9`              | Headings, primary text   |
| `--color-text-secondary` | `#94a3b8`              | Body text                |
| `--color-text-muted`     | `#64748b`              | Labels, timestamps       |
| `--color-accent`         | `#22c55e`              | CTA, active, online      |
| `--color-accent-hover`   | `#16a34a`              | Hovered accent           |
| `--color-accent-glow`    | `rgba(34,197,94,0.2)`  | Glow halos               |
| `--color-accent-bg`      | `rgba(34,197,94,0.08)` | Subtle green bg          |
| `--color-accent-border`  | `rgba(34,197,94,0.25)` | Green borders            |
| `--color-danger`         | `#ef4444`              | Error, offline           |
| `--color-warning`        | `#f59e0b`              | Warning states           |
| `--color-info`           | `#3b82f6`              | Info badges              |
| `--color-code-text`      | `#7dd3fc`              | Monospace code           |
| `--color-code-bg`        | `rgba(15,23,42,0.6)`   | Code backgrounds         |

## Typography (Keep Existing Fonts)

- **Headings/UI:** Inter (400/500/600/700)
- **Monospace:** JetBrains Mono (for IPs, GPIO pins, MQTT topics)
- No font changes - these are ideal for IoT dashboards

## Files to Create

### 1. `src/assets/design-tokens.css`

Central CSS custom properties file containing:

- Color tokens (backgrounds, borders, text, accent, semantic, code, phase, device)
- Typography scale (sizes, line heights, letter spacing)
- Spacing scale
- Border radius tokens
- Shadow tokens (sm, md, lg, glow, glow-strong)
- Transition tokens (durations, easing)
- Z-index tokens
- Content width token

### 2. `src/assets/transitions.css`

Shared animation definitions:

- `@keyframes pulse` for live status dots
- `@keyframes fadeIn` for page transitions
- `prefers-reduced-motion` media query to disable animations

### 3. `.env` file

```
VITE_API_BASE_URL=http://192.168.0.105:4000/api
```

## Files to Modify

### 4. `src/assets/main.css`

Change from:

```css
@import './base.css';
```

To:

```css
@import './design-tokens.css';
@import './base.css';
@import './transitions.css';
```

### 5. `src/assets/base.css`

- Set `body` background to `var(--color-bg-base)`, color to `var(--color-text-primary)`
- Set `font-family: var(--font-sans)`
- Update monospace rule to use `var(--font-mono)`
- Add custom scrollbar styles for dark theme
- Add `color-scheme: dark` to `:root`

### 6. `src/main.ts`

Overhaul the `AppPreset` dark theme:

- Change surface palette to dark values matching design tokens
- Keep primary as emerald
- Update component overrides:
  - DataTable: dark header bg, dark rows, subtle borders using token colors
  - Card: glass bg `var(--color-bg-surface)`, subtle border, shadow from tokens
  - Button: green primary, dark secondary
  - InputText/Select/Dropdown: dark backgrounds, light borders
  - Tag: adjust severity colors for dark background
- Set `darkModeSelector: '.dark'` and add `class="dark"` to html or use `darkModeSelector: '.p-dark'`

### 7. `src/App.vue`

- Navbar: dark background (`var(--color-bg-surface)`), border-bottom with subtle glow
- Brand text: `var(--color-text-primary)` for name, `var(--color-text-muted)` for divider/suffix
- Nav links: `var(--color-text-secondary)` default, hover to `var(--color-bg-hover)` bg
- Active link: accent color text + accent-bg background
- Content area: dark background

### 8. `src/views/HomeView.vue`

- Page background: transparent (inherits dark)
- Page titles: `var(--color-text-primary)`
- Subtitles: `var(--color-text-secondary)`
- Active badge: accent glow, green dot with pulse animation
- Cycle cards: dark surface bg, accent top border, hover lift + glow shadow
- Field labels: `var(--color-text-muted)`
- IP address code: `var(--color-code-bg)` + `var(--color-code-text)`
- Open link text: accent color

### 9. `src/views/GrowMonitorView.vue`

- Phase tracker: dark track bg, green fill, dots with glow on active/done
- Progress bars: `var(--color-track-bg)` track, `var(--color-accent)` fill
- Device tiles: dark bg, accent glow border when active
- Meta labels: `var(--color-text-secondary)`
- Meta values: `var(--color-text-primary)`
- Code elements: `var(--color-code-bg)` + `var(--color-code-text)`
- Empty states: `var(--color-text-muted)`
- Error states: `var(--color-danger)`

### 10. `src/views/AdminView.vue`

- Page background: transparent
- Section headers: `var(--color-text-primary)`
- Row actions: existing PrimeVue buttons should look correct with dark theme

### 11. `src/views/admin/ControllerFormView.vue`

- All hardcoded colors replaced with design tokens
- Field labels: `var(--color-text-secondary)`
- Type pills: `var(--color-bg-elevated)` bg, `var(--color-text-secondary)` text
- Code elements: design token code colors
- Empty state: `var(--color-text-muted)` + `var(--color-border)` dashed border
- Form actions: proper spacing with tokens

### 12. `src/views/admin/GrowFormView.vue` (MAJOR REFACTOR)

- **Remove ALL 40+ inline `style=""` attributes**
- Convert to scoped CSS classes with design tokens
- Dark card styling consistent with other views
- Phase order badges: `var(--color-info)` bg (blue)
- Date range displays: dark bg, muted text
- Phase cards: `var(--color-bg-elevated)` bg, `var(--color-border)` border
- Total cycle summary: dark bg, accent total text
- All form labels: `var(--color-text-secondary)`
- All interactive states using design tokens

### 13. `src/stores/growStore.ts`

- Change `const API_BASE = 'http://192.168.0.105:4000/api'`
- To: `const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://192.168.0.105:4000/api'`

### 14. `package.json`

- Remove the `"router": "^2.2.0"` dependency (erroneous; app uses vue-router)

## Files to Delete

- `src/components/HelloWorld.vue`
- `src/components/TheWelcome.vue`
- `src/components/WelcomeItem.vue`
- `src/components/icons/IconCommunity.vue`
- `src/components/icons/IconDocumentation.vue`
- `src/components/icons/IconEcosystem.vue`
- `src/components/icons/IconSupport.vue`
- `src/components/icons/IconTooling.vue`
- `src/assets/logo.svg`

## PrimeVue Dark Theme Strategy

The PrimeVue theme will use a semantic token system that maps to our dark colors:

```typescript
const AppPreset = definePreset(Aura, {
  semantic: {
    primary: {
      /* emerald palette */
    },
    colorScheme: {
      light: {
        /* We won't use light - map to dark anyway */
      },
      dark: {
        surface: {
          0: '#ffffff',
          50: '#0b1120', // base bg
          100: '#151d2e', // surface bg
          200: '#1c2640', // elevated
          300: '#222e48', // hover
          400: '#2a3654', // muted
          500: '#475569', // subtle text
          600: '#64748b', // secondary text
          700: '#94a3b8', // body text
          800: '#cbd5e1', // emphasized text
          900: '#f1f5f9', // primary text
          950: '#ffffff',
        },
      },
    },
  },
  // ...component overrides
})
```

## Design Effects Summary

1. **Pulsing status dots** - CSS animation on active indicators
2. **Subtle glow** - box-shadow on active/focused elements
3. **Smooth transitions** - 150-300ms on all interactive states
4. **Glass cards** - `var(--color-bg-surface)` with subtle border and shadow
5. **Code highlight** - Cyan monospace text on dark bg for IPs/MQTT topics
6. **Green accent system** - Consistent green for all active/online/success states
7. **Dark elevated layers** - Background hierarchy: base < surface < elevated < hover

## Pre-Delivery Checklist

- [ ] No emojis used as icons (using PrimeIcons)
- [ ] All clickable elements have cursor: pointer
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Dark mode text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard nav
- [ ] prefers-reduced-motion respected
- [ ] Responsive at 375px, 768px, 1024px, 1440px

## Execution Order

1. Create design-tokens.css
2. Create transitions.css
3. Create .env file
4. Update main.css imports
5. Update base.css
6. Update main.ts (PrimeVue preset)
7. Update App.vue
8. Update HomeView.vue
9. Update GrowMonitorView.vue
10. Update AdminView.vue
11. Update ControllerFormView.vue
12. Refactor GrowFormView.vue (remove inline styles)
13. Update growStore.ts (env variable)
14. Update package.json (remove bad dep)
15. Delete scaffold files
16. Run type-check

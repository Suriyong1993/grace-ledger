# Motion Guidelines — Grace Ledger v3.0

## Single framework

**Framer Motion** is the only JavaScript animation library. GSAP was
fully removed during the v3.0 rollout (`lib/gsap.ts`,
`hooks/useGSAPAnimation.ts` deleted; `gsap` dependency removed from
`package.json`). No remaining use case in the app required GSAP-specific
features (ScrollTrigger was registered but never actually used) —
everything was a straightforward `opacity`/`transform` entrance
animation, well within Framer Motion's `initial`/`animate`/`transition`
API.

A small set of **CSS-only** keyframe utilities (`animate-fade-up`,
`animate-scale-in`, etc., defined in `src/styles.css`) coexist
deliberately — these are for simple, non-interactive entrance effects
that don't need JS, not a second animation framework. Framer Motion owns
all interactive component/page motion; CSS utilities own static
declarative entrance effects (e.g. `.stagger` list children). If you need
a *JS-driven* animation (route transitions, conditional entrance based on
state), use Framer Motion, not a new CSS utility.

## Durations & easing

| Category | Duration | Easing | Example |
|---|---|---|---|
| Micro (press, hover) | 100–150ms | `ease` / `var(--ease-out)` | `.active-press` (100ms) |
| Component (dialog, sheet open/close) | 200–250ms | `var(--ease-out)` | Dialog/Sheet Radix defaults |
| Page transition | 250–300ms | `var(--ease-out)` = `cubic-bezier(0.23, 1, 0.32, 1)` | `_app.tsx` route transition, `PageTransition.tsx` |
| Stagger (list mount) | 40ms delay per item | `var(--ease-out)` | `.stagger` CSS utility |

**Never** exceed 400ms for a UI interaction. **Never** use `bounce` or
`elastic` easing for business UI (available as `--ease-spring` for the
rare case that genuinely warrants it, but not a default choice).
**Never** use `animate-spin`/`animate-bounce` decoratively.

## Reference implementations

**Page-level transition** (`src/routes/_app.tsx`, `src/components/shared/PageTransition.tsx`):
```tsx
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
>
```

**Card entrance** (`src/components/shared/StatCard.tsx`):
```tsx
<motion.div
  initial={{ opacity: 0, y: 12, scale: 0.99 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
>
```

Both use the same `[0.23, 1, 0.32, 1]` cubic-bezier (Emil Kowalski's
`--ease-out`, already defined in `src/styles.css`) — reuse this curve
for new component/card entrance animations rather than inventing a new
one, for motion consistency across the app.

## Accessibility

Every animation must respect `prefers-reduced-motion: reduce`. The CSS
utilities already guard this globally (`src/styles.css`, `@media
(prefers-reduced-motion: reduce)` disables all `.animate-*`/`.stagger`
animations). For new Framer Motion usage, pass `transition={{ duration:
shouldReduceMotion ? 0 : 0.25, ... }}` using Framer Motion's
`useReducedMotion()` hook, or rely on Framer Motion's automatic
respect for the media query where applicable — verify per-component,
since Framer Motion doesn't universally auto-disable without explicit
handling in all animation types.

# Grace Ledger — Design System

Emerald Vault — porcelain surfaces, deep-evergreen brand, dark vault sidebar, brass accents. Church financial OS. Thai-first. Money is the product — every UI decision protects the number.

## Governing Principle

**"เรียบ สุขุม, แม่นยำ"** (Calm, Refined, Exact) — three words that define every choice. No decoration serves the eye at the expense of the number. If a screen shows money, the money is the most legible thing on it. The interface recedes; the work surfaces.

---

## Identity

| Aspect        | Choice                   | Rationale                                        |
| ------------- | ------------------------ | ------------------------------------------------ |
| Brand color   | Deep evergreen `#14532D` | Church — sacred, trustworthy, not corporate-blue |
| Accent        | Brass `#B45309`          | Warm offering/attention, never primary           |
| Income        | Emerald `#0D9273`        | Credit/positive — fixed, never reused            |
| Expense       | Red `#D92D20`            | Debit/negative — fixed, never reused             |
| Pending       | Amber `#d97706`          | Attention/warning — fixed, never reused          |
| Background    | Porcelain `#F4F5F2`      | Warm near-white, soft on elderly eyes            |
| Card          | White `#FFFFFF`          | Clean separation via border, not shadow          |
| Sidebar       | Vault black `#0B1F17`    | Dark chrome, porcelain workspace                 |
| Thai type     | Anuphan                  | Native Thai, not Latin fallback                  |
| Latin/numeral | Space Grotesk            | Tabular-nums, financial precision                |

---

## Typography

| Token         | Size | Use                    |
| ------------- | ---- | ---------------------- |
| `--text-2xs`  | 11px | Kicker/eyebrow         |
| `--text-xs`   | 12px | Meta, secondary        |
| `--text-sm`   | 13px | Body, nav              |
| `--text-base` | 15px | Body default           |
| `--text-md`   | 16px | Section heading        |
| `--text-lg`   | 18px | Card title             |
| `--text-xl`   | 20px | Page heading (mobile)  |
| `--text-2xl`  | 22px | Page heading           |
| `--text-3xl`  | 26px | Page heading (desktop) |
| `--text-4xl`  | 32px | Hero balance           |
| `--text-5xl`  | 40px | Hero balance (lg)      |

**Rules:**

- `.num-display` for every money value — tabular-nums, lining-nums, slashed-zero
- `--tracking-heading: -0.02em` on display text
- `--leading-heading: 1.2`, `--leading-body: 1.6`
- Kicker: uppercase, `0.08em` spacing, `--muted-foreground`

---

## Spacing

| Token                | Size | Use                        |
| -------------------- | ---- | -------------------------- |
| `--space-1`          | 4px  | Tight gaps                 |
| `--space-2`          | 8px  | Inside buttons, badge gaps |
| `--space-3`          | 12px | Form gaps, card padding    |
| `--space-4`          | 16px | Section gaps               |
| `--space-5`          | 20px | Card padding, table cells  |
| `--space-6`          | 24px | Page sections              |
| `--space-8`          | 32px | Major breaks               |
| `--touch-target-min` | 44px | Minimum touch target       |

**Rules:**

- Page padding: `--gl-page-pad-x` (clamp 16-40px), `--gl-page-pad-top` (clamp 20-32px)
- Card padding: `--space-5`
- Table cells: `--table-cell-x: --space-5`, `--table-cell-y: --space-3`

---

## Radius

| Token             | Size   | Use                      |
| ----------------- | ------ | ------------------------ |
| `--radius-sm`     | 6px    | Tags, small elements     |
| `--radius-md`     | 10px   | Inputs, badges           |
| `--radius-lg`     | 12px   | Cards, buttons           |
| `--radius-xl`     | 14px   | Modals, sheets           |
| `--radius-2xl`    | 18px   | Large cards              |
| `--radius-button` | 12px   | Buttons                  |
| `--radius-input`  | 10px   | Form inputs              |
| `--radius-card`   | 20px   | Cards                    |
| `--radius-dialog` | 24px   | Dialogs                  |
| `--radius-sheet`  | 28px   | Bottom sheet top corners |
| `--radius-full`   | 9999px | Pills, avatars           |

---

## Shadows (Minimal)

| Token                 | Use              |
| --------------------- | ---------------- |
| `--shadow-xs`         | Hairline         |
| `--shadow-sm-card`    | Subtle card lift |
| `--shadow-card`       | Standard card    |
| `--shadow-elevated`   | Modals, popovers |
| `--shadow-hover-card` | Card hover       |

**Rules:**

- Border-based depth over shadow
- No glow, no heavy shadow
- Cards: `border: 1px solid var(--border)` + optional `--shadow-sm-card`

---

## Motion

| Token                  | Value                           | Use                                |
| ---------------------- | ------------------------------- | ---------------------------------- |
| `--duration-micro`     | 120ms                           | Press feedback, micro-interactions |
| `--duration-component` | 220ms                           | Modals, tabs, dropdowns            |
| `--duration-page`      | 280ms                           | Page transitions                   |
| `--duration-ceiling`   | 400ms                           | Maximum animation                  |
| `--ease-out`           | cubic-bezier(0.23, 1, 0.32, 1)  | Default (entering)                 |
| `--ease-in-out`        | cubic-bezier(0.77, 0, 0.175, 1) | Moving on screen                   |
| `--ease-drawer`        | cubic-bezier(0.32, 0.72, 0, 1)  | Drawers, sheets                    |

**Rules:**

- Never exceed `--duration-ceiling` (400ms)
- Press feedback: `scale(0.97)` on `:active`, fires on pointer-down
- No bounce/spring on business UI
- Stagger: 30-80ms between items
- `prefers-reduced-motion`: collapse durations, zero delays

---

## Components

### Buttons

| Class                  | Use                                         |
| ---------------------- | ------------------------------------------- |
| `.gl-btn`              | Base button                                 |
| `.gl-btn--primary`     | One per screen — committing action          |
| `.gl-btn--secondary`   | Alternative action                          |
| `.gl-btn--ghost`       | Tertiary, navigation                        |
| `.gl-btn--destructive` | Delete, void, danger                        |
| `.gl-btn--sm`          | Compact (34px on fine pointers, 44px touch) |
| `.gl-btn--block`       | Full width                                  |

**Rules:**

- One primary per screen
- Destructive never looks like primary
- `--touch-target-min` (44px) always
- Press feedback: `scale(0.97)` on `:active`

### Cards

| Class                 | Use            |
| --------------------- | -------------- |
| `.gl-card`            | Standard card  |
| `.gl-card--tight`     | Dense padding  |
| `.gl-card--attention` | Primary border |
| `.gl-card--danger`    | Expense border |
| `.gl-card--elevated`  | With shadow    |

### Badges

| Class                 | Use        |
| --------------------- | ---------- |
| `.gl-badge`           | Base       |
| `.gl-badge--neutral`  | Structural |
| `.gl-badge--pending`  | Amber      |
| `.gl-badge--approved` | Emerald    |
| `.gl-badge--rejected` | Red        |
| `.gl-badge--info`     | Secondary  |

### Tags

| Class     | Use                                        |
| --------- | ------------------------------------------ |
| `.gl-tag` | Fund/category context (neutral, no status) |

### Notices

| Class                 | Use     |
| --------------------- | ------- |
| `.gl-notice`          | Base    |
| `.gl-notice--success` | Emerald |
| `.gl-notice--warning` | Amber   |
| `.gl-notice--error`   | Red     |

### Forms

| Class            | Use             |
| ---------------- | --------------- |
| `.gl-field`      | Field container |
| `.gl-label`      | Label           |
| `.gl-input`      | Text input      |
| `.gl-select`     | Select          |
| `.gl-textarea`   | Textarea        |
| `.gl-hint`       | Helper text     |
| `.gl-error-text` | Error message   |

### Table

| Class              | Use                              |
| ------------------ | -------------------------------- |
| `.gl-table`        | Full table                       |
| `.gl-table--cards` | Responsive card mode             |
| `.is-right`        | Right-align numbers              |
| `.gl-td-lead`      | Lead cell (full-width on mobile) |
| `.gl-td-actions`   | Actions row                      |

### Navigation

| Class                  | Use               |
| ---------------------- | ----------------- |
| `.gl-sidebar`          | Desktop sidebar   |
| `.gl-nav-item`         | Sidebar link      |
| `.gl-nav-item--active` | Current page      |
| `.gl-mobilenav`        | Mobile bottom nav |
| `.gl-mobilenav__item`  | Mobile nav link (also used for the "เพิ่มเติม" trigger button) |
| `.gl-mobilenav__badge` | Mobile nav badge count |
| `.gl-attention-panel`  | Popover sheet base (bell panel and "เพิ่มเติม" overflow share it) |
| `.gl-more-panel`       | Mobile overflow sheet — positions `.gl-attention-panel` above the bottom nav instead of below the topbar |
| `.gl-tablist`          | Tab row           |
| `.gl-tab`              | Individual tab    |

### Shell

| Class                      | Use                |
| -------------------------- | ------------------ |
| `.gl-shell-topbar`         | Top bar            |
| `.gl-shell-icon-btn`       | Icon button        |
| `.gl-shell-primary-action` | Primary CTA        |
| `.gl-shell-bell-badge`     | Notification badge |
| `.gl-shell-mark`           | Logo mark          |
| `.gl-shell-avatar`         | User avatar        |
| `.gl-shell-church-chip`    | Church name chip   |
| `.gl-shell-status-dot`     | Online status      |
| `.gl-logout-btn`           | Sign out           |
| `.gl-app-container`        | Flex container     |
| `.gl-app-main`             | Main content       |

### Content

| Class                | Use                 |
| -------------------- | ------------------- |
| `.gl-page`           | Page wrapper        |
| `.gl-page-header`    | Page title row      |
| `.gl-section`        | Content section     |
| `.gl-section__head`  | Section heading     |
| `.gl-section__link`  | Section action link |
| `.gl-loading-center` | Loading state       |
| `.gl-empty-center`   | Empty state         |
| `.gl-fade-in`        | Entrance animation  |
| `.gl-rise`           | Staggered entrance  |
| `.gl-skeleton`       | Skeleton loader     |
| `.gl-spin`           | Spinner             |
| `.gl-progress`       | Progress bar        |
| `.gl-progress__fill` | Fill                |
| `.gl-divider`        | Horizontal rule     |
| `.gl-legend`         | Chart legend        |

### Dashboard

| Class                         | Use                                                                    |
| ----------------------------- | ---------------------------------------------------------------------- |
| `.gl-dash-hero`               | Hero card                                                              |
| `.gl-dash-hero__value`        | Hero figure                                                            |
| `.gl-dash-hero__actions`      | Action strip                                                           |
| `.gl-dash-hero__figure-delta` | Month-over-month delta chip under an income/expense hero figure        |
| `.gl-dash-greeting`           | Page-context greeting line (name + role) — plain text, no card surface |
| `.gl-dash-review`             | Review panel                                                           |
| `.gl-dash-user-card`          | Identity card                                                          |
| `.gl-dash-context`            | Month context                                                          |
| `.gl-dash-split`              | Two-column layout                                                      |
| `.gl-dash-hero-row`           | Hero row                                                               |

### Funds

| Class                        | Use              |
| ---------------------------- | ---------------- |
| `.gl-fundlist`               | Fund list        |
| `.gl-fundrow__head`          | Fund row heading |
| `.gl-fundrow__name`          | Fund name        |
| `.gl-fundrow__foot`          | Fund footer      |
| `.gl-funds-pagehead`         | Page header      |
| `.gl-funds-grid`             | Grid layout      |
| `.gl-funds-card__head`       | Card heading     |
| `.gl-funds-card__balance`    | Balance display  |
| `.gl-funds-progress-caption` | Progress label   |

### Transactions

| Class                      | Use                   |
| -------------------------- | --------------------- |
| `.gl-txn-row`              | Clickable row         |
| `.gl-row`                  | Navigable row         |
| `.gl-row__icon`            | Semantic icon         |
| `.gl-row__body`            | Row content           |
| `.gl-row__title`           | Row title             |
| `.gl-row__meta`            | Row metadata          |
| `.gl-row__end`             | Right-aligned content |
| `.gl-row__chevron`         | Chevron               |
| `.gl-row__icon--income`    | Green icon            |
| `.gl-row__icon--expense`   | Red icon              |
| `.gl-row__icon--transfer`  | Neutral icon          |
| `.gl-row__icon--attention` | Amber icon            |
| `.gl-filter-pill`          | Filter pill           |
| `.gl-command-center`       | Command center        |

### Approvals

| Class                          | Use               |
| ------------------------------ | ----------------- |
| `.gl-approval-item`            | Queue card        |
| `.gl-approval-item__row`       | Card row          |
| `.gl-approval-item__badges`    | Badge row         |
| `.gl-approval-item__ref`       | Reference         |
| `.gl-approval-item__title`     | Title             |
| `.gl-approval-item__meta`      | Metadata          |
| `.gl-approval-item__amount`    | Amount            |
| `.gl-approval-amount`          | Hero amount       |
| `.gl-projbal__result`          | Projected balance |
| `.gl-projbal__result--deficit` | Deficit state     |

### Offering

| Class                          | Use             |
| ------------------------------ | --------------- |
| `.gl-offering-backlink`        | Back link       |
| `.gl-offering-step`            | Step indicator  |
| `.gl-offering-step__badge`     | Step badge      |
| `.gl-offering-step__label`     | Step label      |
| `.gl-offering-chip`            | Info chip       |
| `.gl-offering-kpi`             | KPI card        |
| `.gl-allocation-row`           | Allocation row  |
| `.gl-cashcount-summary__value` | Cash count hero |

### Reports

| Class                        | Use            |
| ---------------------------- | -------------- |
| `.gl-reports-pagehead`       | Page header    |
| `.gl-reports-hero`           | Hero card      |
| `.gl-reports-hero__value`    | Hero figure    |
| `.gl-reports-hero__figures`  | Figure row     |
| `.gl-reports-table-head`     | Table header   |
| `.gl-reports-leadership-row` | Leadership row |

---

## Anti-AI-Slop Rules

### Universal

- No decorative gradients on KPI/stat cards
- No glassmorphism on a content or chrome surface. Blur is for overlay scrims
  only (modal/sheet backdrop), at 2-6px behind a veil. Depth on a surface comes
  from the border and the surface step; the token shadow only confirms it. See
  D15 — a 14px glass layer on the topbar and bottom bar was retired for this.
- No bounce/spring animations on business UI
- No animation > 300ms (except entrance)
- No decorative SVG illustrations
- No emoji as UI iconography
- No hover scale-110 on icons
- No drop-shadow glow on logos/icons

### Financial

- Green = credit/positive ONLY — never mixed
- Red = debit/negative ONLY — never mixed
- No NumberTicker animation on money values
- No rounding totals — show exact calculated values
- Tabular-nums ALWAYS on numbers
- Right-align all numerical columns
- Alternating row backgrounds when > 5 rows
- Sticky header on scrollable tables
- Status = color + icon, never color alone
- No compact table padding below `py-3 px-5`

### Thai UI

- No bilingual double-labels
- No internal vocabulary in UI (no "Screen 06", no "PostgreSQL 17")
- No raw exception strings in UI
- No vague declarative copy — say the state, not an essay about it

---

## Responsive Breakpoints

| Breakpoint | Width    | Behavior                             |
| ---------- | -------- | ------------------------------------ |
| Mobile     | < 540px  | Single column, full-width actions    |
| Tablet     | < 768px  | Sidebar → bottom nav, stacked header |
| Desktop    | > 900px  | Two-column layouts, sidebar visible  |
| Wide       | > 1024px | Max content width `--gl-page-max`    |

---

## Dark Mode

- Token-based via `.dark` class on `<html>`
- Toggle via `prefers-color-scheme` or user preference (localStorage)
- All colors defined in `:root` and `.dark` blocks
- Background: slate dark, card: slightly lighter
- Text: off-white
- Border: white-alpha

---

## Accessibility

- `--touch-target-min` (44px) on all interactive elements
- Visible focus ring: `2px solid var(--ring)`, offset 2px
- `aria-label` on icon-only buttons
- `aria-live` on dynamic content
- `prefers-reduced-motion`: collapse animations
- `prefers-contrast: more`: increase contrast
- Skip-to-content link
- Semantic HTML: `<button>`, `<a>`, `<nav>`, `<main>`

---

## File Structure

| File                                   | Responsibility         |
| -------------------------------------- | ---------------------- |
| `design-system-extracted/tokens/*.css` | Design tokens (values) |
| `src/styles/app.css`                   | Component classes      |
| `src/components/layout/AppShell.ts`    | Shell + nav            |
| `src/pages/*.ts`                       | Page rendering         |
| `src/services/*.ts`                    | Data layer             |

**Single source of truth:** Token NAMES in `design-system-extracted/` are the public API. Values can change; names cannot. Component classes in `app.css` consume tokens. Pages consume component classes. No page defines its own color, radius, shadow, or font-size.

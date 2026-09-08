# Grace Ledger — Modern UI Direction

> Companion to `DESIGN.md`. This document does **not** replace the Coral Vault identity or existing tokens. It defines how to make the current product feel contemporary without turning it into a generic dashboard.

## North Star

**Modern, calm, dense enough for work, and unmistakably financial.**

Grace Ledger is not a marketing site. A user should understand the financial state, what requires attention, and the next safe action within seconds.

### Design equation

`Clarity > hierarchy > confidence > decoration`

If a visual treatment does not improve one of those four, remove it.

---

## 1. Modern UI principles

### 1.1 Reduce the card wall

Do not place every piece of information inside a rounded rectangle.

Prefer this hierarchy:

1. page canvas
2. one or two primary surfaces
3. grouped sections separated by spacing or dividers
4. cards only when information has an independent boundary or action

**Bad:** six identical KPI cards with equal visual weight.

**Better:** one dominant financial answer + supporting metrics + a compact work queue.

### 1.2 Strong focal point per screen

Every screen must answer:

> What is the one thing the user came here to know or do?

That answer receives the strongest type scale, placement, and whitespace. Secondary information must not compete with it.

### 1.3 Progressive disclosure

Show summary first. Reveal details when the user asks.

Use:

- expandable detail rows
- drawers or sheets for contextual work
- detail pages for irreversible or complex workflows
- inline disclosure for small supporting facts

Do not solve information density by making everything smaller.

### 1.4 Content-aware hierarchy

Finance UI is not symmetrical decoration. Importance depends on meaning.

- primary balance: dominant
- amount requiring review: highly visible
- status: recognizable but secondary
- metadata: quiet
- historical context: tertiary

Never make a timestamp visually compete with an amount.

---

## 2. Layout direction

### Desktop

Use a stable application shell with a quiet content canvas.

Recommended rhythm:

- dark sidebar for global orientation
- restrained topbar for context and global actions
- generous page edge spacing
- content maximum width controlled by existing app tokens
- asymmetric grids when the data hierarchy calls for them

Avoid automatically forcing every dashboard into equal-width columns.

### Mobile

Mobile is a primary work surface, not a shrunken desktop.

At 390px:

- one-column reading order
- important money values visible without horizontal scrolling
- bottom navigation only for high-frequency destinations
- commit actions remain reachable above the mobile navigation
- tables transform according to task, not merely CSS width
- metadata may move below the main value instead of being squeezed beside it

### Responsive breakpoints are not a design strategy

Do not simply stack desktop cards. Reconsider hierarchy at each constrained layout.

---

## 3. Surface and depth

The existing Coral Vault identity stays authoritative.

Use three levels of depth:

### Level 0 — Canvas

Paper/stone background. Most of the page should live here.

### Level 1 — Work surface

White or subtle semantic surface with a border. Used for forms, totals, queues, and focused groups.

### Level 2 — Elevated context

Modal, popover, floating action area. Rare. Use existing elevation tokens only.

Rules:

- no decorative glassmorphism
- no glow
- no gradient unless it communicates hierarchy already defined by the brand
- borders should explain grouping before shadows do
- rounded corners must follow existing tokens, never visual fashion alone

---

## 4. Dashboard composition

A modern dashboard should not be a collection of widgets. Compose it as a decision surface.

Recommended order:

1. **Financial answer** — the most important balance or period answer
2. **Attention queue** — what requires human action now
3. **Movement** — recent income, expense, transfers, or changes
4. **Breakdown** — funds or categories
5. **History** — trends only when real data exists and the trend supports a decision

Do not add charts because dashboards are expected to have charts. A chart must answer a question that a number cannot answer faster.

---

## 5. Tables and transaction lists

Desktop tables are appropriate for comparison. Mobile tables are usually not.

### Desktop

- strong column alignment
- numbers aligned consistently
- reduced visual noise in row separators
- row actions appear only when actionable
- avoid excessive badges

### Mobile

Transform each transaction into a hierarchy:

1. title/category
2. amount
3. date or relevant metadata
4. status only when meaningful

Never preserve all desktop columns at the expense of readability.

---

## 6. Forms and workflows

A financial workflow must communicate progress and consequence.

### Prefer

- one clear task per screen
- visible field grouping
- inline validation near the cause
- persistent context for money totals
- review step before irreversible posting

### Avoid

- long undifferentiated forms
- error summaries that do not identify the field
- primary and destructive actions with similar appearance
- modal stacking

For multi-step work, show the user's current position and what remains without creating a decorative stepper when the flow is actually linear and obvious.

---

## 7. Interaction language

Modern does not mean animated.

Motion may explain:

- navigation transition
- successful completion
- hierarchy entering view
- state change

Motion must not explain branding.

Use existing motion tokens. Respect `prefers-reduced-motion`. Do not add spring physics, bounce, or continuous decorative animation.

### Hover is enhancement, not functionality

Every critical action must remain understandable on touch devices. Never hide essential meaning behind hover-only behavior.

---

## 8. Information density

Grace Ledger should feel professional, not empty.

Use whitespace to group and prioritize, not to make a business application look like a landing page.

Before increasing padding, ask:

1. Does this improve scanning?
2. Does this separate different concepts?
3. Does the user need this much space to avoid mistakes?

If not, keep the layout denser.

---

## 9. Accessibility as visual quality

A modern interface that fails under keyboard, zoom, screen reader, or contrast requirements is not high quality.

Every UI review must check:

- visible focus state
- semantic controls
- keyboard path through the screen
- labels and error association
- status announcements where state changes asynchronously
- contrast in normal and muted states
- 200% zoom / narrow viewport behavior where practical

---

## 10. AI implementation rules

When an AI agent is asked to "make the UI modern", it must **not** start by replacing colors, adding gradients, or increasing border radius.

### Required sequence

1. Read `CLAUDE.md`, `DESIGN.md`, `DESIGN_MODERN.md`, and `COMPONENTS.md`.
2. Inspect the existing route and its shared components.
3. Identify the user's primary question and primary action.
4. Identify duplicated visual weight, unnecessary cards, and information competing with the primary task.
5. Propose the smallest hierarchy/layout improvement.
6. Reuse existing tokens and `.gl-*` classes.
7. Add or improve a reusable pattern only when a real repetition exists.
8. Verify desktop and 390px views.
9. Test all reachable states.
10. Report visual evidence and implementation evidence separately.

### Review questions

Before marking a UI change complete:

- Can the user identify the most important number within seconds?
- Is the primary action obvious without making every button loud?
- Did we reduce complexity or merely restyle it?
- Is there any card that could be a section instead?
- Is any chart decorative rather than decision-supporting?
- Does the mobile layout have a deliberate hierarchy?
- Are financial semantics preserved?

---

## 11. Explicitly banned modern-design shortcuts

- generic SaaS dashboard clones
- equal-sized KPI card walls
- glass cards
- glow effects
- decorative gradients
- giant empty hero areas inside application screens
- fake charts or placeholder analytics
- excessive pills and badges
- oversized rounded rectangles for every container
- icon-only critical actions without accessible labels
- hover-only controls
- emoji used as application icons
- shrinking dense content until it technically fits on mobile

---

## 12. Inspiration translation rule

External inspiration may inform **patterns**, not identity copying.

When borrowing an idea from a Figma community file, design system, screenshot, or another product, document:

1. the pattern being borrowed
2. the user problem it solves
3. how it maps to existing Grace Ledger tokens/components
4. why copying its colors or visual identity is unnecessary

Examples of acceptable pattern borrowing:

- clearer data hierarchy
- contextual side sheet
- responsive transaction-row transformation
- grouped action bar
- better empty-state composition
- compact filter architecture

Unacceptable borrowing:

- copying another product's brand palette
- importing a complete foreign component library into this Vanilla TypeScript application
- reproducing a screenshot without understanding the underlying interaction model

---

## Definition of "modern enough"

A screen is modern when it is:

- immediately scannable
- structurally calm
- dense enough for real work
- responsive by hierarchy, not just dimensions
- accessible
- visually consistent with Coral Vault
- free from decorative technology clichés

**Modernity is the result of better decisions, not more visual effects.**

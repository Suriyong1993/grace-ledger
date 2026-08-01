# Frontend Engineer Role Specification

## Mission

Craft intuitive, responsive, and high-performance user interfaces adhering strictly to the Warm Ivory/Gold Amber design system.

## Responsibilities

- Implement UI components using React 19, Tailwind CSS v4, and TanStack Router.
- Integrate state management, micro-animations (GSAP), and responsive layouts.
- Adhere to `engineering/memory/DESIGN_SYSTEM.md`.

## Inputs

- UI Mockups, Design System tokens, API Specs.

## Outputs

- Clean, modular React components under `src/components/` and `src/routes/`.

## Decision Authority

- **Authority** on component implementation details within design system boundaries.

## Quality Checklist

- [ ] No generic/slop UI styling — uses curated tokens and OKLCH color space.
- [ ] Fully responsive across mobile, tablet, and desktop views.
- [ ] Zero unnecessary re-renders; proper use of TanStack Query caching.

## Definition of Done (DoD)

- UI passes visual inspection, accessibility checklist, and code review.

# Accessibility Specialist Role Specification

## Mission
Ensure the application is fully accessible (WCAG 2.1 AA) to all church personnel regardless of physical or cognitive abilities.

## Responsibilities
- Review UI components for keyboard navigation, screen reader ARIA tags, and contrast ratios.
- Maintain `engineering/checklists/accessibility.md`.

## Inputs
- React UI components, page layouts, design system specs.

## Outputs
- Accessibility audit reports and remediation directives.

## Decision Authority
- **Authority** on WCAG compliance, ARIA attributes, and focus management.

## Quality Checklist
- [ ] Color contrast ratio ≥ 4.5:1 for normal text.
- [ ] All interactive elements accessible via keyboard (`Tab`, `Space`, `Enter`).
- [ ] Proper `aria-label`, `role`, and screen-reader headings.

## Definition of Done (DoD)
- Zero automated or manual accessibility violations in audited routes.

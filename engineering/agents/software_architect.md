# Software Architect Role Specification

## Mission
Design scalable, maintainable, high-performance system architecture, establish technology stack boundaries, and enforce systemic design coherence.

## Responsibilities
- Define component boundaries, state management patterns, and system interfaces.
- Write Architecture Decision Records (ADRs) in `engineering/memory/ADR/`.
- Ensure adherence to TanStack Router, Drizzle ORM, and React 19 best practices.
- Maintain `engineering/memory/ARCHITECTURE.md`.

## Inputs
- PRDs and Business Rules.
- Existing codebase structure and performance constraints.

## Outputs
- System Architecture Specifications (RFCs).
- Architecture Decision Records (ADRs).
- Component interface contracts.

## Decision Authority
- **Final authority** on technical stack choices, module interfaces, and architectural patterns.

## Quality Checklist
- [ ] Deep module boundaries with thin interfaces.
- [ ] No circular dependencies or leaky abstractions.
- [ ] Clear separation between presentation, state, and data fetching layers.

## Definition of Done (DoD)
- RFC/ADR published, reviewed by Security & Database Architects, and committed to repository memory.

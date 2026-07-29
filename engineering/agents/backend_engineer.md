# Backend Engineer Role Specification

## Mission
Build secure, performant, and reliable API services, data access layers, and business logic execution pipelines.

## Responsibilities
- Implement server handlers, Drizzle ORM queries, and service functions under `src/services/`.
- Enforce strict input validation, authorization checks, and transaction boundaries.
- Maintain API specs in `engineering/memory/API_SPEC.md`.

## Inputs
- RFCs, API Specifications, Database schemas.

## Outputs
- Clean TypeScript server code, unit/integration tests.

## Decision Authority
- **Authority** on internal function implementation details within architectural guidelines.

## Quality Checklist
- [ ] Type-safe API signatures (Zod validation).
- [ ] Comprehensive error handling without leak of sensitive trace details.
- [ ] Unit test coverage for core business logic.

## Definition of Done (DoD)
- Code passes linting, type checks, unit tests, and security review.

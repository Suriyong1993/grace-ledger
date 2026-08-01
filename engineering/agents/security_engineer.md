# Security Engineer Role Specification

## Mission

Guard financial and donor data integrity, enforce authentication/authorization models, and prevent OWASP Top 10 vulnerabilities.

## Responsibilities

- Audit codebase for authentication, authorization (RBAC), data sanitization, and SHA-256 audit integrity.
- Maintain `engineering/memory/SECURITY.md` and `engineering/checklists/security.md`.

## Inputs

- Application code, API endpoints, database queries, dependency trees.

## Outputs

- Security Audit Reports and blocking security advisories.

## Decision Authority

- **Veto power** over any deployment or PR that introduces security risks.

## Quality Checklist

- [ ] Role-based access control (RBAC) enforced on every API route and mutation.
- [ ] Inputs validated using strict Zod schemas; SQL injection impossible via Drizzle parameterization.
- [ ] Sensitive fields (PINs, tokens) encrypted/hashed.

## Definition of Done (DoD)

- Security audit passed with zero high or critical findings.

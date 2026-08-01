# Database Architect Role Specification

## Mission

Design resilient, normalized, high-performance database schemas, transaction models, and audit logs for ledger data integrity.

## Responsibilities

- Define Drizzle ORM schemas, migration scripts, and indexing strategies.
- Maintain data integrity constraints, foreign key cascades, and audit trail triggers.
- Document database structures in `engineering/memory/DATABASE.md`.

## Inputs

- Business logic requirements and data models from Business Analysts & Software Architects.

## Outputs

- Drizzle schema files, SQL migrations, database specs (`engineering/templates/Database.md`).

## Decision Authority

- **Authority** on schema design, query optimization, migration safety, and transaction isolation levels.

## Quality Checklist

- [ ] Schema normalized (3NF where applicable).
- [ ] Proper indexes on query lookup columns (e.g. `church_id`, `date`, `fund_id`).
- [ ] Zero data loss migration strategies defined.

## Definition of Done (DoD)

- Migration tested, schema documented in `DATABASE.md`, and approved by Software Architect.

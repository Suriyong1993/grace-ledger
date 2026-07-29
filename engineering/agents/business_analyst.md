# Business Analyst Role Specification

## Mission
Translate high-level product goals into precise accounting business rules, domain workflows, and edge-case specifications for technical implementation.

## Responsibilities
- Define exact accounting formulas (Net Balance, Fund Allocations, Offering Counts).
- Specify validation rules for income, expense, and fund transfer transactions.
- Document domain terms and maintain the domain lexicon in `BUSINESS_RULES.md`.

## Inputs
- PRDs from Product Manager.
- Domain accounting standards and church financial bylaws.

## Outputs
- Detailed Business Rule Specifications.
- Functional Edge Case Matrices.

## Decision Authority
- **Authority** on financial domain terminology, business calculation logic, and validation constraints.

## Quality Checklist
- [ ] Financial calculations explicitly specify decimal precision and rounding rules.
- [ ] Edge cases (e.g. negative balances, multi-currency, fund transfers) accounted for.

## Definition of Done (DoD)
- Business rules documented in `engineering/memory/BUSINESS_RULES.md` and accepted by Product Manager.

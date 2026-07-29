# Workflow: Production Release

## Prerequisites
- All PRs merged to main branch.
- Passed `npx tsc --noEmit` and build checks.
- Passed Security, Performance, and QA checklists.

## Steps
1. Tag release candidate (`vX.Y.Z`).
2. Run automated staging build.
3. Conduct smoke tests on core financial workflows (Income, Expense, Offering Count).
4. Release Manager triggers production branch sync.
5. Technical Writer updates release notes.

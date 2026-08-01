# Workflow: Refactoring

## Guidelines

1. **Incremental Steps**: Break refactor into small, atomic commits that compile independently.
2. **Behavioral Invariance**: Existing tests must pass without modification unless requirements changed.
3. **Deepening Interfaces**: Simplify caller-facing interfaces while encapsulating complexity.
4. **Architectural Review**: Software Architect sign-off required for structural changes.

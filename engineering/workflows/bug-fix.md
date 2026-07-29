# Workflow: Bug Fix

## Procedure
1. **Diagnosis & Log Evidence**: QA / Engineer extracts exact runtime error logs or failing test output.
2. **Root Cause Analysis**: Identify contract violation in underlying domain logic or schema.
3. **Regression Test Creation**: Write failing unit test reproducing the bug.
4. **Fix Implementation**: Modify code to satisfy underlying contract.
5. **Verification**: Run test suite to ensure bug is resolved and no regressions exist.
6. **Peer Review**: Code Reviewer sign-off on PR.

## Exit Criteria
- Reproduction test passes.
- Full test suite passes cleanly.
- Root cause documented in PR description.

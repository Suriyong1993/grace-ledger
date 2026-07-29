# Release Manager Role Specification

## Mission
Orchestrate safe, zero-downtime production deployments, manage release tags, and verify post-deployment stability.

## Responsibilities
- Verify all quality gates (Architecture, Security, Performance, QA) are signed off.
- Coordinate git tagging, release notes, and Lovable/Vercel branch sync.

## Inputs
- Fully reviewed PRs, QA sign-off, Security sign-off, release notes.

## Outputs
- Release tags, production deployment approval, release announcements.

## Decision Authority
- **Final authority** to trigger or abort production releases.

## Quality Checklist
- [ ] All Quality Gates passed.
- [ ] Rollback plan documented and ready.

## Definition of Done (DoD)
- Release deployed, sanity checks passed, deployment logged.

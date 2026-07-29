# Workflow: Feature Development

## Pipeline Stages

```
Requirements (Product Manager)
     ↓
Planning & BA Specs (Business Analyst)
     ↓
Architecture & Schema (Software & DB Architect)
     ↓
Task Breakdown (Engineering Team)
     ↓
Implementation (Frontend & Backend Engineers)
     ↓
Code & Spec Review (Code Reviewer)
     ↓
Testing & QA (QA Engineer)
     ↓
Security & Performance Audit (Security & Performance Engineers)
     ↓
Documentation (Technical Writer)
     ↓
Release Gate (Release Manager)
```

## Stage Gate Definitions

### 1. Requirements & Planning Stage
- **Inputs**: Feature Request / User Story.
- **Outputs**: Approved PRD in `engineering/templates/PRD.md`.
- **Required Approval**: Product Manager.
- **Exit Criteria**: PRD contains clear functional acceptance criteria.

### 2. Architecture & Design Stage
- **Inputs**: Approved PRD.
- **Outputs**: Technical RFC / ADR in `engineering/templates/RFC.md`.
- **Required Approval**: Software Architect, Security Engineer.
- **Exit Criteria**: API interfaces and data schemas finalized.

### 3. Implementation Stage
- **Inputs**: Approved RFC / Task breakdown.
- **Outputs**: Feature code branch.
- **Required Approval**: Peer Developers.
- **Exit Criteria**: Clean compilation (`npx tsc --noEmit`), lint checks pass.

### 4. Review & QA Stage
- **Inputs**: Feature PR.
- **Outputs**: Review sign-off, QA test results.
- **Required Approval**: Code Reviewer, QA Engineer.
- **Exit Criteria**: 100% test pass rate, 0 regression bugs.

### 5. Quality Audit & Release Stage
- **Inputs**: Staging build.
- **Outputs**: Release tag.
- **Required Approval**: Security Engineer, Release Manager.
- **Exit Criteria**: Passed all quality gate checklists in `engineering/checklists/`.

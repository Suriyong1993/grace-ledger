# Grace Ledger v2 — Church Accounting Platform

## Tech Stack

- **Frontend**: React 19 + TypeScript, TanStack Router, TanStack Start, Tailwind CSS v4, shadcn/ui
- **Backend**: TanStack Start (SSR), Nitro server, Drizzle ORM
- **Database**: PostgreSQL (Supabase compatible)
- **Auth**: JWT-based sessions + Supabase Auth
- **Deployment**: Docker (production) / Vercel (preview)

## Project Structure

```
src/
├── components/   # React components (church/, layout/, receipts/, shared/, ui/)
├── db/           # Drizzle schema (schema.ts)
├── hooks/        # Custom React hooks
├── lib/          # Utilities (auth, csv, format, types, mock-db)
├── routes/       # TanStack Router routes (_app.*.tsx)
├── server/       # Server-side (api/, auth/, domain/, infrastructure/, services/)
│   ├── api/      # API routes (journal, fund, period, transfer, etc.)
│   ├── domain/   # Business logic (journal, money, validation, chart-of-accounts)
│   ├── auth/     # Session management, permissions
│   ├── services/ # Audit, Fund, Period, Transfer, Reconciliation
│   └── infrastructure/ # DB connection
└── services/     # Client-side services
```

## Available Skills (in .claude/skills/)

Skills are already installed and linked to this project:

- **Agent Workflow**: code-review, codebase-design, domain-modeling, implement, tdd, to-spec, planning-and-task-breakdown, debugging-and-error-recovery
- **Frontend**: frontend-ui-engineering
- **Backend**: api-and-interface-design, performance-optimization, security-and-hardening
- **Database**: postgresql-table-design, database-migration
- **DevOps**: git-workflow-and-versioning, ci-cd-and-automation
- **AI/Claude**: claude-api, mcp-builder, prompt-engineering-patterns, context-engineering, agent-development, skill-development
- **Docs**: create-agentsmd, create-readme, create-specification, create-implementation-plan, documentation-and-adrs
- **Tools**: conventional-commit, playwright-cli, git-guardrails-claude-code, claude-handoff

## Key Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run preview    # Preview production build
```

## Architecture Notes

- API routes match manually (no URLPattern dependency) via src/server/api/routes.ts
- Audit trail uses SHA-256 hash chaining per church (src/server/services/audit.service.ts)
- Approval thresholds: <5K baht (admin), 5K-50K (admin), >50K (dual super_admin)
- Soft deletes used across all entities (deletedAt column)
- Multi-tenant by churchId

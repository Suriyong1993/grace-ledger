# Shared Project Brain — Architecture Specification

## Technology Stack

- **Framework**: TanStack Start / TanStack Router + React 19
- **State & Data**: TanStack Query + Drizzle ORM
- **Database**: SQLite / Supabase PostgreSQL compatible engine
- **Styling**: Tailwind CSS v4 + OKLCH color space tokens + GSAP animations
- **Type Safety**: TypeScript strict mode + Zod validation

## Layer Boundaries

```
┌────────────────────────────────────────────────────────┐
│ Presentation Layer (React 19, TanStack Router, UI)      │
├────────────────────────────────────────────────────────┤
│ Application Layer (TanStack Query, State Hooks)         │
├────────────────────────────────────────────────────────┤
│ Domain & Business Services (src/services/church.ts)    │
├────────────────────────────────────────────────────────┤
│ Data Layer (Drizzle ORM Schemas, Migration Engines)    │
└────────────────────────────────────────────────────────┘
```

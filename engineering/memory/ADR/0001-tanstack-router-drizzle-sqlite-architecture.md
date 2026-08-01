# ADR 0001: TanStack Router + Drizzle ORM Architecture Choice

## Status

Accepted

## Context

Grace Ledger requires a ultra-fast, offline-capable, highly responsive web application for managing church financial ledgers with low network overhead.

## Decision

Adopt TanStack Start / TanStack Router with React 19 on the frontend, backed by Drizzle ORM for type-safe database queries.

## Consequences

- Full type safety from database query to UI component props.
- High performance rendering with minimal bundle overhead.
- Simple, testable service functions under `src/services/`.

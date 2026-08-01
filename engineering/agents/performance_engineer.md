# Performance Engineer Role Specification

## Mission

Ensure rapid response times, optimal bundle sizes, and efficient database query execution across all devices.

## Responsibilities

- Monitor bundle size, page load times (Core Web Vitals), and query execution metrics.
- Maintain `engineering/checklists/performance.md`.

## Inputs

- Application build output, network waterfall logs, database query plans.

## Outputs

- Performance audit reports and optimization recommendations.

## Decision Authority

- **Authority** to require performance optimization when latency or bundle thresholds are exceeded.

## Quality Checklist

- [ ] First Contentful Paint (FCP) < 1.2s.
- [ ] No N+1 database query patterns.
- [ ] Proper bundle splitting and lazy loading.

## Definition of Done (DoD)

- Build outputs pass performance budgets.

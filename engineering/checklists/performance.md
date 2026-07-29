# Quality Checklist: Performance & Bundle Optimization

- [ ] Does the application pass TypeScript compilation (`npx tsc --noEmit`) without errors?
- [ ] Are list views virtualized or paginated to prevent DOM node inflation?
- [ ] Are heavy chart or scanner components lazy-loaded?
- [ ] Are database queries structured to avoid N+1 fetches?
- [ ] Are React re-renders minimized using TanStack Query caching and memoization?

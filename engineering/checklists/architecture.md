# Quality Checklist: Architecture Review

- [ ] Does the implementation adhere to the deep module principle (thin interface, deep logic)?
- [ ] Are state management boundaries clearly separated from UI presentation?
- [ ] Are API contracts type-safe and validated with Zod schemas?
- [ ] Are database operations routed through services rather than inline component calls?
- [ ] Are ADR decisions honored without introducing unvetted external dependencies?

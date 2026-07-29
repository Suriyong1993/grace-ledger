# Shared Project Brain — Coding Standards

## Rules & Practices
1. **Strict TypeScript**: No implicit `any`, no unverified `as` type assertions without guard checks.
2. **Component Structure**: Pure presentation in UI components, state management using TanStack Query.
3. **No Symptom Patching**: Fix underlying logic contract errors rather than swallowing errors or returning dummy values.
4. **Clickable Markdown Links**: All file and symbol references in documentation must use standard markdown `file:///` URLs.
5. **Clean Verification**: All changes must pass `npx tsc --noEmit` and ESLint checks before merge.

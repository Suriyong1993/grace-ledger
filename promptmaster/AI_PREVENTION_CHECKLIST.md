# Anti-AI Slop Quality Checklist — Grace Ledger v2

Use this checklist to ensure code quality stays clean, robust, and production-ready when developing features with AI assistants.

---

## ❌ What is "AI Slop" & How to Avoid It

| AI Slop Anti-Pattern | Production-Grade Standard |
|---|---|
| ❌ Adding `// TODO: implement later` or returning hardcoded dummy data | ✅ Write 100% complete end-to-end code or do not submit the PR |
| ❌ Using `number` / `float` for monetary math (`a + b`) | ✅ Always use `Money.fromBaht()` or `Money.fromSqlDecimal()` |
| ❌ Generic Tailwind colors (`bg-blue-500`, `text-red-600`) | ✅ Use semantic tokens (`bg-primary`, `text-success`, `text-destructive`) mapped in `src/styles.css` |
| ❌ Hardcoding pixel width/heights or static offsets | ✅ Use responsive grid layouts, flex containers, and shadcn utility classes |
| ❌ Leaving unhandled promise rejections or empty catch blocks | ✅ Catch errors, log with context, and display user-friendly Toast notifications via `sonner` |
| ❌ Hardcoding API keys in frontend components | ✅ Proxy third-party API calls through `/api/ai/*` server endpoints |

---

## ✅ Quality Checklist Before Marking Any Task Complete

- [ ] **Type Safety:** `npm run typecheck` passes with 0 TypeScript errors.
- [ ] **Linting:** `npm run lint` passes with 0 ESLint errors.
- [ ] **Test Coverage:** `npm test` passes 51/51 integration and domain test cases.
- [ ] **Production Build:** `npm run build` generates `.output/` bundle without bundling errors.
- [ ] **Tenant Isolation:** All newly created queries include `church_id` filtering.
- [ ] **Tabular Formatting:** Financial figures use `num-display` CSS class for tabular number alignment.
- [ ] **Accessible Labels:** Buttons and interactive elements include proper `aria-label` or visible text labels.

---

## 🛠️ Verification Execution Workflow

Always run these commands in terminal before submitting work:

```bash
# 1. Check linting rules
npm run lint

# 2. Check TypeScript types
npm run typecheck

# 3. Run in-memory PGlite test suite
npm test

# 4. Confirm production build works
npm run build
```

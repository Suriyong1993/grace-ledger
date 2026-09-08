Target: design-system-extracted/tokens/motion.css
Type: NO CHANGE.

The Decision Record's R1-c scope tentatively proposed removing `--ease-spring` "only after grep confirms
zero consumers in src/". `github_search_code` for `ease-spring` under `src/` returned 3 live matches, all in
`src/components/login/loginStyles.ts` (approximately lines 147, 199, 412). The token is in active use.

Per the guardrail "do not treat removal as safe without verifying actual consumers," `motion.css` ships
unchanged in this package. This is recorded as a closed finding, not a deferred one — no future action is
implied unless the login surface's own styling changes independently (tracked separately under
`design-plans/`, not this redesign).

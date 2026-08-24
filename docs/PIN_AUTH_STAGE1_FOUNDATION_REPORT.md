# PIN Authentication — Stage 1 Foundation Report

**Date:** 2026-08-24
**Branch:** `fix/ui-design-system-conformance`
**Supabase project:** `jeklcfpqmytdmwczxqlx` (`grace-ledger-test`, ap-northeast-1, PostgreSQL 17.6)
**DEPLOYMENT_CHURCH_ID:** not stored in this repo — see §0

**Headline: Stage 1 is complete. Stage 2 did not run.** The session-minting half of
`verify-pin` — `generateLink` → `verifyOtp` → `setSession` → RLS query — has never
executed. See §4. No frontend file was touched. No production PIN was provisioned.

**`DEPLOYMENT_CHURCH_ID` is now set and both endpoints are live.** See §0c for the
post-configuration verification.

---

## KNOWN RISK — no staging environment

> No separate staging Supabase project exists.
> Testing currently relies on tenant isolation inside the production DB.
>
> **Do not claim environment-level isolation.**
>
> This is a future infrastructure improvement, not a blocker for the current staged
> implementation, provided no real-user credentials are provisioned during testing.

Carried as **R9** in §6. Every test so far has honoured the proviso: zero PINs exist,
and no real-user credential has been created.

---

## 0. Environment safety — a violation was found and fixed

The first implementation of `_shared/deployment.ts` carried the church id as a committed
fallback:

```ts
export const DEFAULT_DEPLOYMENT_CHURCH_ID = "66666666-…";   // REMOVED
return Deno.env.get("DEPLOYMENT_CHURCH_ID") ?? DEFAULT_DEPLOYMENT_CHURCH_ID;
```

That put a production config value in the repo and — the worse half — let a
misconfigured deployment quietly serve the **wrong congregation** instead of refusing to
start. Both halves are now gone. `deploymentChurchId()` returns `string | null`, reads
only the secret store, validates the value is a well-formed uuid, and both endpoints
answer 503 when it is absent or malformed.

| Requirement | Status | Evidence |
|---|---|---|
| Configured only in Edge Function secrets | **FIXED** | no fallback constant; `deploymentChurchId()` returns `null` without the secret |
| Never in Vite client env vars | **PASS** | no `VITE_*` var added; no frontend file touched |
| Never in the frontend bundle | **PASS** | value lives only in `supabase/functions/`, which Vite does not bundle |
| Never accepted from request query/body/header | **PASS** | matrix item 12 — client-supplied `church_id` / `p_church_id` ignored |
| Never logged | **PASS** | all 6 `console.error` calls audited; they emit fixed strings and `error.message` only — no church id, no key material |
| Not committed to git | **FIXED, with one caveat** | scrubbed from every Stage 1 file. **Caveat below.** |

**Caveat, and it is not mine to close.** The church uuid is *already* in committed git
history, from earlier work — five tracked files under `scripts/`:

```
scripts/m2_phase2_1_governance_semantics_test.mjs:63
scripts/m2_phase2_3_browser_e2e.mjs:85
scripts/m3_slice2_browser_test.mjs:12
scripts/m3_slice3_browser_test.mjs:12
scripts/m3_slice4_browser_test.mjs:12
```

Nothing I wrote has been committed yet, so my side is clean. But if the id is to be
treated as a secret going forward, those five files and the history behind them are a
separate decision — scrubbing history is destructive and is your call, not mine.

**To activate the endpoints:**

```bash
supabase secrets set DEPLOYMENT_CHURCH_ID=<church-uuid> --project-ref jeklcfpqmytdmwczxqlx
```

No MCP tool can set Supabase secrets, so this is yours to run. Until then both endpoints
stay 503 — which is the correct posture, not a defect.

A regression test now fails the build if a bare uuid literal ever reappears in
`_shared/deployment.ts` (`deploymentChurchId > is never baked into the source`).

## 0c. Post-configuration verification

`DEPLOYMENT_CHURCH_ID` was reported as already set, but the functions kept answering 503.
`supabase secrets list` showed only the 7 platform-injected names — the secret had **not
landed on project `jeklcfpqmytdmwczxqlx`**. It was then set from this machine and the
verification re-run. No secret value was printed at any point; the CLI's list output
returns digests, not plaintext, and only key *names* were echoed.

Two improvements came out of the diagnosis:

- `deploymentChurchId()` now trims whitespace and strips wrapping quotes, so a secret
  that is correct apart from shell quoting no longer takes the deployment down.
- A new `deploymentConfigFault()` returns a log-safe phrase naming *which* variable is
  wrong and whether it is absent or malformed — never the value. That is what turned a
  generic "deployment not configured" into `DEPLOYMENT_CHURCH_ID not set` and ended the
  guesswork.

| # | Check | Result |
|---|---|---|
| 1 | `GET /login-profiles` | **200**, 3 profiles |
| 2 | `POST /verify-pin`, test-safe input | 9 cases, **all 401 `{"error":"invalid"}`**; GET → 405; no apikey → 401 |
| 3 | No longer 503 from missing configuration | **PASS** — both endpoints read the secret |
| 4 | Profiles scoped to the deployment church | **PASS** — 3 returned = 3 active profiles of that church; 12 profiles exist across all churches, 9 withheld |
| 5 | Response excludes sensitive fields | **PASS with one deliberate exception — read below** |

Check 5 field audit on the live payload — response keys are exactly `id, initials, name, role`:

```
email  absent   church_id  absent   is_active       absent   pin_hash        absent
pin    absent   churchId   absent   failed_attempts absent   lockout_count   absent
locked_until absent   requires_reset absent   last_success_at absent   last_failure_at absent

"@" (email sigil) anywhere in body:        false
"$2" (bcrypt sigil) anywhere in body:      false
raw role slug (e.g. "finance_staff") leaked: false
```

**`role` IS returned, and that is a conflict with your check-5 list that I am not going to
resolve silently.** The approved profile-selection UI shows a role line under each name
(`ProfileSelectView` renders `ศิษยาภิบาล`, `ผู้นับเงิน`, …). Removing `role` from the
payload would leave that line blank and break the design you approved in Phase 2.1.

What is returned is the **Thai display label**, never the RBAC slug — `ผู้ดูแลระบบ`, not
`super_admin` — so it grants no capability information beyond what the sign-in screen is
designed to show. It is still, honestly, a pre-auth disclosure of who holds which office
at that church, which is the same exposure class as R2.

Three options, your call — I have changed nothing:

1. **Keep it** (current). Accept the disclosure as inherent to a profile-picker login.
2. **Drop `role` from the payload** and remove the role line from `ProfileSelectView`.
   Costs a UI change to an approved design.
3. **Keep the line, drop the office.** Return a generic label, or show role only after
   the PIN succeeds.

## 0b. Test data rule

| Requirement | Status | Evidence |
|---|---|---|
| No real-user PIN seeded into production | **PASS** | `auth_pins` and `auth_pin_probes` are empty; zero PINs exist anywhere |
| No test PIN in a production seed or migration file | **PASS** | new contract tests: no `INSERT INTO auth_pins`, no `crypt(`, no `gen_salt` outside a function body; no other migration mentions the PIN tables; no bcrypt hash literal in any migration except the decoy |
| Disposable test PINs isolated | **PARTIAL — read this** | see below |

Test PINs were created by **ad-hoc SQL, never by a migration file**, and only against
tenant `77777777-…` (`P22_TEST_Grace_Church`). All were deleted (§8).

**The honest gap:** there is no separate staging Supabase project. `grace-ledger-test` is
simultaneously the deployment target the app's `client.ts` points at. So the test PINs
were isolated by **tenant**, not by **environment**. That satisfies the letter of the rule
— nothing production-facing was seeded, no migration carries a PIN — but not its spirit.
A real staging project is the durable fix, and it is a decision for you, not something I
should create unilaterally.

---

## 1. Migration result

Two migrations applied, both purely additive.

| Migration | Contents |
|---|---|
| `20260824000020_auth_pins.sql` | `auth_pins`, `auth_pin_probes`, 5 functions |
| `20260824000021_auth_pins_helper_search_path.sql` | pins `search_path` on the two pure helpers |

**`auth_pins`** — one row per profile: `pin_hash` (bcrypt, cost 10, 60-char `$2a$10$…`),
`failed_attempts`, `lockout_count`, `locked_until`, `requires_reset`, `last_success_at`,
`last_failure_at`.

**`auth_pin_probes`** — lockout state for subject ids with *no* PIN row: unknown ids,
ids from another church, inactive profiles, unprovisioned profiles. Without it,
"the account starts saying *locked* on the 5th try" is itself the oracle that tells an
attacker which profile ids are real. With it, a nonexistent id locks on exactly the same
schedule (proven in §5, row 11).

Posture, read back from `pg_class` / `pg_proc` after apply:

```
auth_pins        rls_enabled=true  policies=0  acl: postgres, service_role only
auth_pin_probes  rls_enabled=true  policies=0  acl: postgres, service_role only
```

RLS is enabled with **zero policies** on purpose — that denies every row to every
non-owner role — and table grants are revoked from `PUBLIC`, `anon`, `authenticated`
as a second layer.

Nothing existing was modified. The contract test `blast radius` in
`tests/unit/auth-pin-migration-contract.test.ts` parses the migration and fails on any
`ALTER TABLE` outside the two new tables, any `DROP`, any function outside the five new
ones, and any write to a table other than `auth_pins`, `auth_pin_probes`, `audit_logs`.

## 2. RPC result

| Function | SECURITY DEFINER | search_path | anon | authenticated | service_role |
|---|---|---|---|---|---|
| `verify_and_consume_pin(uuid,uuid,text)` | yes | pinned | ✗ | ✗ | ✓ |
| `set_own_pin(text,text)` | yes | pinned | ✗ | ✓ | ✓ |
| `auth_pin_record_probe(uuid)` | yes | pinned | ✗ | ✗ | ✓ |
| `auth_pin_is_acceptable(text)` | no | pinned | ✓ | ✓ | ✓ |
| `auth_pin_lockout_interval(int)` | no | pinned | ✓ | ✓ | ✓ |

The last two are pure, own no data, and expose nothing; they stay callable.

**`verify_and_consume_pin` contract**

```
success -> {"status":"success","user_id":uuid,"email":text,"requires_reset":bool}
invalid -> {"status":"invalid"}
locked  -> {"status":"locked","locked_until":timestamptz}
```

Failure carries **no attempt counter and no hint of cause**. `p_church_id` comes from
the server, never the browser. Every failure path burns a bcrypt comparison against a
decoy hash so response time does not sort real profiles from imaginary ones.

**`set_own_pin` contract** — acts on `auth.uid()` only; there is no parameter naming a
target profile, so it structurally cannot overwrite anyone else's PIN. Returns
`success | unauthenticated | invalid_current | locked | weak_pin | reused_pin`.
Requires the current PIN unless an admin flagged the row `requires_reset`.

**PIN policy:** exactly 6 digits; rejects a single repeated digit (`111111`) and straight
runs in either direction (`123456`, `654321`).

**Lockout policy:** 5 consecutive failures lock. Escalation `15 min → 1 hour → 24 hours`.
The failure counter restarts after a lockout expires; the *escalation level* does not.

## 3. Edge Function result

Both deployed, both `verify_jwt = false` — they are what a person reaches *before* a
session exists, so the platform cannot check one for them.

| Function | Version | Verified behaviour |
|---|---|---|
| `login-profiles` | 3 | v2: 200 with the 3 active profiles of the deployment church. v3: **503** until the secret is set |
| `verify-pin` | 3 | v2: 401/423/405 across the whole case set in §5. v3: **503** until the secret is set |

The §5 matrix was proven against **v2**, which read the church from a committed fallback.
v3 removes that fallback and changes exactly one thing: where the church id comes from.
Every guard, response shape, and lockout path is byte-identical. The fail-closed behaviour
of v3 was verified live:

```
GET  /login-profiles  -> 503 {"error":"unavailable"}
POST /verify-pin      -> 503 {"error":"unavailable"}
```

Re-running the matrix against v3 needs the secret set first, so §5 should be re-confirmed
once it is — it is a re-verification, not an unproven claim.

`login-profiles` returns `{ id, name, role (Thai label), initials }` and nothing else —
**no email, no church_id, no phone, no lockout state.** Live response confirmed on v2.

Both endpoints are shielded by a project-key check and an instance-local per-address
throttle (`login-profiles` 60/min, `verify-pin` 20/min).

One deployment note worth recording: the platform injects `SUPABASE_ANON_KEY` as the
**newer publishable key** (`sb_publishable_…`) while the browser bundle still ships the
**legacy anon JWT**. A naive equality check rejected the real client with 401. The guard
now accepts either generation; `tests/unit/auth-pin-edge-guards.test.ts` locks that in.

## 4. Real session round-trip result — **NOT RUN (BLOCKED)**

**Status: blocked before the test could start. Not attempted-and-failed.**

Stage 2 required a disposable test auth user. Creating it needs a row in `auth.users`
(no service-role key is reachable from this session, so the Admin API is not an option).
The `INSERT INTO auth.users` was **denied by the permission classifier**:

> Permission for this action was denied by the Claude Code auto mode classifier.

Per the Stage 2 instruction, no workaround was invented. Consequently **this chain has
never executed even once**:

```
generateLink({type:'magiclink', email})
  → verifyOtp({token_hash, type:'email'})
  → access_token + refresh_token
  → supabase.auth.setSession()
  → onAuthStateChange()
  → loadSession()
  → RLS-protected query
```

Everything in `verify-pin` *after* `verify_and_consume_pin` returns `success` is written
but unproven: the `generateLink` call, the `hashed_token` extraction, the `verifyOtp`
redemption, and the session-subject cross-check. Known unknowns:

- whether `generateLink` succeeds when Supabase Auth has no SMTP/email provider configured
- whether `properties.hashed_token` is present on this Auth version
- whether `verifyOtp({type:'email'})` is the right OTP type for a magiclink hash here
- whether a PIN-minted session carries the same claims, and therefore the same RLS reach,
  as a password session

## 5. Security test matrix

Test tenant `77777777-…` (`P22_TEST_Grace_Church`) throughout. **No profile in the
deployment church was ever given a PIN.** All fixtures were torn down (§8).

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | nonexistent profile | **PASS** | `{"status":"invalid"}` |
| 2 | inactive profile | **PASS** | correct PIN on an inactive profile → `{"status":"invalid"}` |
| 3 | wrong church | **PASS** | correct PIN + foreign `church_id` → `invalid` (RPC) and 401 `{"error":"invalid"}` (HTTP) |
| 4 | no PIN row | **PASS** | `{"status":"invalid"}` |
| 5 | wrong PIN | **PASS** | `{"status":"invalid"}` |
| 6 | 5th failure | **PASS** | attempts 1–4 `invalid`, attempt 5 `locked` |
| 7 | lockout | **PASS** | `locked_until = now + 15 min`, `lockout_count = 1` |
| 8 | correct PIN during lockout | **PASS** | returns `locked`; `locked_until` byte-identical before/after; `last_success_at` stays `null` |
| 9 | escalation | **PASS** | lock 1 → +15 min; lock 2 → +59:51; lock 3 → next day 11:34 (24 h) |
| 10 | successful reset | **PASS** | after expiry: `success`, `failed_attempts=0`, `lockout_count=0`, `locked_until=null`, `last_success_at` stamped |
| 11 | enumeration | **PASS** | 7 distinct failure causes all return the byte-identical `{"status":"invalid"}`; a nonexistent id locks on attempt 5, same as a real one |
| 12 | profile_id tampering | **PASS** | extra `church_id` / `p_church_id` fields in the POST body ignored; server-pinned church holds |
| 13 | token replay | **NOT TESTED** | requires Stage 2 |
| 14 | timing | **PASS** | 8 samples per path, medians: no-PIN-row 60.1, wrong-church 60.1, unknown-profile 60.3, correct-PIN 60.4, wrong-PIN 60.5 ms — 0.4 ms spread (0.7%) |
| 15 | concurrency | **PASS** | 10 simultaneous HTTP attempts on one id → 4×401 + 6×423, and `lockout_count = 1`. Exactly 5 attempts consumed: none lost, none double-counted. `SELECT … FOR UPDATE` holds |
| 16 | token leakage | **PARTIAL** | `login-profiles` proven to emit no email/church_id. `verify-pin` token handling unproven (§4) |
| 17 | cross-church | **PASS** | same as #3, both layers |
| 18 | RLS equivalence | **PARTIAL** | `anon` and `authenticated` blocked on 12/12 operations (see below). "PIN session has the same RLS reach as a password session" is **unproven** (§4) |
| 19 | requires_reset | **PASS** | admin-set row surfaces `requires_reset:true`; `set_own_pin` clears it; next verify returns `false` |
| 20 | malformed PIN | **PASS** | `4829`, `abcdef`, `NULL`, numeric `482913`, `''`, empty body — all `invalid`, all still spend an attempt |

**Totals: 17 PASS · 2 PARTIAL · 1 NOT TESTED.**

Reachability probe (item 18), each run as the named role:

```
anon          SELECT auth_pins            BLOCKED: permission denied
anon          SELECT auth_pin_probes      BLOCKED: permission denied
anon          INSERT auth_pins            BLOCKED: permission denied
anon          UPDATE auth_pins            BLOCKED: permission denied
anon          DELETE auth_pins            BLOCKED: permission denied
anon          verify_and_consume_pin()    BLOCKED: permission denied for function
authenticated (same six)                  BLOCKED: permission denied
```

`set_own_pin` was exercised through the `authenticated` role with a forged
`request.jwt.claims.sub` — exactly how PostgREST presents a signed-in caller — across
12 cases (no session, 6 weak/malformed PINs, first set, reuse, change without current,
change with wrong current, change with right current). All 12 matched the contract.

Audit rows confirmed in `audit_logs`: `PIN_LOGIN_SUCCESS`, `PIN_LOGIN_FAILED`,
`PIN_LOGIN_LOCKED`, `PIN_SET_SELF`, each with the correct `church_id` and `actor_id`.

## 6. Remaining risks

| # | Severity | Risk |
|---|---|---|
| R1 | **HIGH** | The session-minting half of `verify-pin` has never executed (§4). Until Stage 2 runs, treat `verify-pin` as unproven past the PIN check. |
| R2 | **MEDIUM** | `login-profiles` publishes staff names and roles to anyone holding the anon key — and that key ships in the browser bundle, so effectively to the public internet. This is inherent to any profile-picker login. It needs an explicit accept/reject decision, not a silent one. |
| R3 | **LOW** | The per-address throttle is instance-local. Edge Function instances are ephemeral and plural, so a distributed attacker gets more than the nominal limit. The durable control is the per-profile DB lockout, which held under the concurrency test. |
| R4 | **LOW** | A malformed PIN sent against a profile that *has* a PIN row increments the **probe** counter, not that profile's counter. The two counters diverge. Not reachable through `verify-pin` (it rejects malformed PINs before the RPC); only a direct service-role caller can hit it. |
| R5 | **LOW** | An injection-shaped `profile_id` (`' OR 1=1 --`) is intercepted by Cloudflare's WAF with a 403 HTML page rather than our uniform 401 JSON. No data exposure, but that input class is distinguishable, and the client must not assume every rejection is JSON. |
| R6 | **INFO** | Supabase advisor reports `rls_enabled_no_policy` on both new tables. **Intentional** — that is the deny-all posture. Do not "fix" it by adding a policy. |
| R7 | **INFO** | `auth_leaked_password_protection` is off at the project level. Pre-existing, unrelated to this work. |
| R8 | **MEDIUM** | The church uuid is already in committed git history via five `scripts/*.mjs` files (§0). If it is to be treated as a secret, that history needs a decision. |
| R9 | **LOW** | No separate staging Supabase project exists, so test tenants and the deployment tenant share one database (§0b). Isolation today is per-tenant, not per-environment. |
| R10 | **RESOLVED** | Both endpoints were 503 until `DEPLOYMENT_CHURCH_ID` was set. Secret now configured; both live (§0c). |
| R11 | **OPEN — needs your decision** | `login-profiles` returns a Thai `role` label, which conflicts with the check-5 exclusion list but is required by the approved `ProfileSelectView`. Three options in §0c. Nothing changed pending your call. |

## 7. Exact frontend changes required (NOT YET MADE)

Nothing below has been written. Listed so the Stage 5 diff is reviewable in advance.

**`src/components/login/mockProfiles.ts` — delete.** Replaced by a real fetch.

**New `src/lib/auth/pin-login.ts`:**
- `fetchLoginProfiles(): Promise<LoginProfile[]>` — GET `/functions/v1/login-profiles`, map to the existing `LoginProfile` shape (the Edge Function already returns `id`/`name`/`role`/`initials`).
- `verifyPin(profileId, pin)` — POST `/functions/v1/verify-pin`; map 200 → `{ accessToken, refreshToken, requiresReset }`, 401 → `invalid`, 423 → `locked` + `locked_until`, 429 → `rate_limited`, 5xx → `unavailable`.

**`src/pages/LoginPage.ts`:**
- Replace `MOCK_LOGIN_PROFILES` with injected profiles; add a loading and an error state for the profile list (neither exists today).
- Replace the `PIN_CHECK_MS` fake timer and the hardcoded `pinStatus = "unavailable"` in `submitPin()` with the real call.
- New `PinStatus` values for `locked` and `rate_limited`, with Thai copy. `locked` should say when to try again, not just that it failed.
- On success: `supabase.auth.setSession({ access_token, refresh_token })`, then let the existing `onAuthStateChange` → `loadSession` path run.
- Keep the email + password fallback exactly as it is.

**`src/main.ts`:**
- `onAuthStateChange` currently reacts only to `!authSession` (sign-out). It needs to handle sign-in so a PIN session loads without a page reload.
- Route `requires_reset === true` to a change-PIN screen before the dashboard.

**Not yet designed, and out of Stage 1 scope:** the authenticated admin PIN-provisioning
flow, and the change-PIN screen `set_own_pin` is waiting for.

## 8. Rollback status

**Test fixtures: already reverted.** Verified after teardown:

```
auth_pins rows              0
auth_pin_probes rows        0
profiles with is_active=false   0   (the one flipped for item 2 was restored)
deployment church profiles      3   (unchanged)
```

No `auth.users` row was created (the attempt was blocked). No profile, role grant, or
church row was added. No production PIN exists anywhere.

**Feature rollback** — the whole foundation is inert until the frontend calls it, and
removing it is four statements:

```sql
DROP FUNCTION IF EXISTS set_own_pin(TEXT, TEXT);
DROP FUNCTION IF EXISTS verify_and_consume_pin(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS auth_pin_record_probe(UUID);
DROP FUNCTION IF EXISTS auth_pin_is_acceptable(TEXT);
DROP FUNCTION IF EXISTS auth_pin_lockout_interval(INTEGER);
DROP TABLE IF EXISTS auth_pins;
DROP TABLE IF EXISTS auth_pin_probes;
```

Plus deleting the `login-profiles` and `verify-pin` Edge Functions. No existing object
is touched by any of it.

**Current blast radius if left as-is: zero.** The tables are empty, the RPCs are
unreachable from the browser, both endpoints answer 503, and no frontend code calls
either one. The live login screen is unchanged and still uses email + password.

**Rolling back the secret** is the fastest kill switch — unsetting
`DEPLOYMENT_CHURCH_ID` returns both endpoints to 503 without a redeploy:

```bash
supabase secrets unset DEPLOYMENT_CHURCH_ID --project-ref jeklcfpqmytdmwczxqlx
```

---

## Verification commands

```bash
npm test && npm run build
```

54 test files / 439 tests passing, typecheck clean — including 47 new assertions in
`tests/unit/auth-pin-edge-guards.test.ts` and `tests/unit/auth-pin-migration-contract.test.ts`.

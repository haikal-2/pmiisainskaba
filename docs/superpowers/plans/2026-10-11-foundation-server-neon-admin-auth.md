# PMII Saintek Server and Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize `haikal-2/pmiisainskaba` from the approved local scaffold and deliver a verified Next.js/TypeScript server foundation with Neon-ready PostgreSQL migrations, idempotent public-content seed, and secure single-admin CLI/login/session workflows.

**Architecture:** Keep one Next.js App Router application. Server-only services call repositories over parameterized `pg` queries; migrations and CLI tools run explicitly; admin pages and APIs enforce server-side session checks. PGlite-backed integration tests use an isolated database adapter and the same application operations as production.

**Tech Stack:** Next.js 16.4, React 19, TypeScript 5.9 strict, PostgreSQL/Neon with `pg`, PGlite integration tests, Argon2id (`@node-rs/argon2`), Zod, and `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-11-foundation-server-neon-admin-auth-design.md`

## Global Constraints

- Use Next.js App Router and TypeScript with strict type checking.
- Use PostgreSQL on Neon, Vercel Blob for files in a later integration phase, and Vercel as the hosting target.
- Keep browser-facing UI and server backend in the same Next.js application.
- Keep all database credentials and other secrets server-side in environment variables. Do not request or store production credentials in this repository.
- The admin URL is `/admin-secret`; it is entered directly and is not linked from public pages.
- There is exactly one admin account. There is no public account registration, invitation, social login, or browser-based account bootstrap.
- Provisioning, resetting, and revoking admin access use server-side CLI commands with interactive hidden password entry. Passwords are never passed as command-line arguments or committed.
- The default absolute admin session lifetime is seven days and is configurable by `ADMIN_SESSION_TTL_SECONDS`.
- Rate limiting must not persist raw IP addresses. Use a keyed HMAC-derived identifier and persistent database state.
- Public content seeding must be idempotent and must not overwrite edits made by an admin on subsequent runs.
- Use a local/test database for verification until Neon and Vercel projects and credentials are configured by the user.

## Review Focus

- **Wrong or production database target during CLI execution:** require explicit target confirmation for destructive credential operations and test the cancel path without mutation in Task 4.
- **Malformed, missing, or invalid environment values:** reject invalid `DATABASE_URL`, `ADMIN_PATH`, origin, TTL, and HMAC key with variable-specific messages before operations; test in Tasks 2 and 4.
- **Replayed, edited, partially failed, or concurrently run migrations and seeds:** preserve checksums, transactions, idempotency, and admin edits; test replay, checksum mismatch, rollback, and repeated seed in Task 3.
- **Untrusted or absent forwarding headers on login:** do not trust arbitrary `x-forwarded-for`; test missing and spoofed proxy headers and confirm persisted rows contain only HMAC output in Task 5.
- **Cookie-authenticated requests with invalid session or cross-origin Origin:** fail closed for missing, malformed, expired, revoked, inactive, and cross-origin requests; test login/logout and protected routes in Task 5.

---

## Repository file map

The target GitHub repository currently contains only the approved design specification. Copy the existing `pmii-claude-kit` scaffold to this repository, excluding generated dependencies, build output, Git metadata, and local secret files. Keep the design and plan files already committed in this repository.

Foundation files to adapt:

- `package.json`, `package-lock.json`, `.gitignore`, `.nvmrc`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, and `.env.example`: runtime/dependency/build configuration.
- `src/server/config.ts`, `src/server/errors.ts`, `src/server/api/response.ts`: configuration and error response boundaries.
- `src/server/db/pool.ts`, `src/server/db/migrate.ts`, `src/server/db/seed.ts`, `src/server/db/migrations/001_init.sql`: database lifecycle, schema, and seed.
- `src/server/auth/admin.ts`, `src/server/security/rate-limit.ts`: admin identity, sessions, CSRF/origin checks, and persistent rate limiting.
- `src/app/[adminPath]/page.tsx`, `src/app/api/auth/admin/login/route.ts`, `logout/route.ts`, and `session/route.ts`: direct-path admin login and auth endpoints.
- `src/components/admin/AdminLoginForm.tsx`, `AdminDashboard.tsx`, and `AdminLogoutButton.tsx`: minimum admin login/session UI required by the foundation.
- `scripts/migrate.ts`, `scripts/seed.ts`, `scripts/provision-admin.ts`, `scripts/reset-admin.ts`, `scripts/revoke-admin-sessions.ts`: explicit operational commands.
- CLI commands load local environment files with `@next/env` before dynamically importing modules that read server configuration.
- `tests/integration/run.ts` (new): isolated migration, seed, CLI-domain, and auth integration suite. The scaffold's `package.json` references this path but it is absent.
- `.env.example`, `DEPLOYMENT.md`, and `README.md`: local setup and Neon/Vercel readiness runbook.
- `docs/superpowers/specs/2026-10-11-foundation-server-neon-admin-auth-design.md` and this plan: preserve the already-approved project artifacts.

Public routes and existing non-foundation APIs/components may be copied as part of the scaffold baseline so the application compiles, but their broader feature behavior must not be expanded in this plan. Do not copy `node_modules`, `.next`, `.git`, `.env`, `.env.local`, or `*.tsbuildinfo`.

## Task 1: Initialize the target repository from the approved scaffold

**Files:**
- Copy from `pmii-claude-kit/`: all tracked project files except generated output, local secrets, and Git metadata.
- Preserve: `docs/superpowers/specs/2026-10-11-foundation-server-neon-admin-auth-design.md` and this plan.
- Modify: `package.json`, `.env.example`, `README.md`, `DEPLOYMENT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `SECURITY.md`, `API_SPEC.md`, `OPEN_QUESTIONS.md`, `CLAUDE.md`, `MAIN_PROMPT.md`, `TASKS.md`, and `PRD.md` only as needed to align copied guidance with the confirmed Neon/Vercel decisions and preserve unresolved follow-up choices.
- Test: project-level `npm run typecheck`, `npm run lint`, and `npm run build`.

**Interfaces:**
- Consumes: the approved local scaffold at `C:\Users\m haikal\Downloads\PMII_Claude_Prompt_dan_Arsitektur\pmii-claude-kit`.
- Produces: a runnable project root in this Git clone, with pinned dependencies and no committed secret or generated files.

- [ ] **Step 1: Copy the scaffold without generated or secret files**

Run in PowerShell from the parent directory:

```powershell
$source = 'C:\Users\m haikal\Downloads\PMII_Claude_Prompt_dan_Arsitektur\pmii-claude-kit'
$target = 'C:\Users\m haikal\Downloads\PMII_Claude_Prompt_dan_Arsitektur\pmiisainskaba'
robocopy $source $target /E /XD node_modules .next .git /XF .env .env.local *.tsbuildinfo
if ($LASTEXITCODE -ge 8) { throw "Scaffold copy failed with robocopy code $LASTEXITCODE" }
```

Confirm that `docs/superpowers/specs/` and `docs/superpowers/plans/` still contain the approved artifacts. Do not copy `pmii-claude-kit`'s package-level generated state or any `.env` secret.

- [ ] **Step 2: Confirm runtime and dependency manifests**

Inspect `package.json`, `package-lock.json`, `.nvmrc`, and `tsconfig.json`. Keep the pinned manifest versions and `strict: true`. Ensure scripts `typecheck`, `lint`, `build`, `db:migrate`, `db:seed`, `admin:create`, `admin:reset`, `admin:revoke`, `test:db`, and `verify` resolve to files that will exist at the end of this plan.

- [ ] **Step 3: Install exactly the locked dependencies**

Run:

```powershell
npm ci
```

Expected: exit code 0; no dependency manifest is edited solely to address a warning.

- [ ] **Step 4: Run baseline checks and record pre-existing failures**

Run:

```powershell
npm run typecheck
npm run lint
npm run build
```

Expected: record each failure for a task below; do not silently skip baseline failures or broaden the task scope to unrelated public-page redesign.

- [ ] **Step 5: Commit the scaffold baseline**

```powershell
git add -A
git commit -m "chore: initialize PMII Saintek web scaffold" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Review `git status --short`. Verify no `.env`/`.env.local` secret, `node_modules`, `.next`, or `*.tsbuildinfo` is staged.

## Task 2: Validate server configuration and establish a testable database boundary

**Files:**
- Modify: `src/server/config.ts`, `src/server/db/pool.ts`, `.env.example`.
- Create: `src/server/db/types.ts`, `tests/integration/run.ts`.
- Modify: `package.json`, `package-lock.json` to declare the exact `@next/env` version matching Next.js 16.4 for CLI environment loading.
- Test: `tests/integration/run.ts` (configuration and adapter cases).

**Interfaces:**
- Consumes: the package's `pg` and `@electric-sql/pglite` dependencies.
- Produces: `config` with strict server-only parsing; `DbExecutor.query<T>()` plus `Database.transaction()` shared by PostgreSQL and isolated PGlite tests; the working `test:db` runner.

- [ ] **Step 1: Add failing config tests for invalid required values**

Add cases proving invalid `ADMIN_PATH`, malformed `APP_URL`, out-of-range `ADMIN_SESSION_TTL_SECONDS`, and a missing production `RATE_LIMIT_HASH_SALT` throw errors naming the relevant variable. Assert that development/test configuration never silently selects a production URL.

- [ ] **Step 2: Run only the config tests**

Run:

```powershell
npm run test:db
```

Expected: FAIL because these cases are not implemented or the runner is not yet present.

- [ ] **Step 3: Implement fail-fast server configuration**

Refine `src/server/config.ts` so it validates URL protocols/hosts, a single-segment non-reserved admin path, integer ranges, and production-only secret requirements. Keep `ADMIN_PATH=admin-secret` and the seven-day TTL as non-secret defaults where safe. Never use a fake `localhost` PostgreSQL URL as an implicit working database; require an explicit test DB configuration or use an isolated PGlite test adapter.

- [ ] **Step 4: Define the database executor contract and test adapter**

Create this narrow contract in `src/server/db/types.ts`:

```ts
export type DbResult<Row> = {
  rows: Row[];
  rowCount: number | null;
};

export interface DbExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<DbResult<Row>>;
}

export interface Database extends DbExecutor {
  transaction<T>(operation: (transaction: DbExecutor) => Promise<T>): Promise<T>;
}
```

Adapt `pg` and PGlite results at the boundary, not in repositories. Ensure test transactions use the same executor supplied to the tested service and are rolled back on error. Test adapter creation must be explicit and unavailable to production code paths.

Declare `@next/env` directly at the Next.js 16.4-compatible version and update the lockfile. In each CLI entry point, call `loadEnvConfig(process.cwd())` before dynamically importing modules that evaluate `src/server/config.ts`; ordinary static imports must not evaluate config first.

- [ ] **Step 5: Load CLI environment before server configuration**

Update each CLI entry point to use this order:

```ts
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const { runMigrations } = await import('../src/server/db/migrate');
```

Apply the same ordering to seed, provision, reset, and revoke entry points. Keep config-consuming imports dynamic after environment loading.

- [ ] **Step 6: Verify connection behavior and configuration cases**

Run:

```powershell
npm run test:db
npm run typecheck
```

Expected: config rejects malformed cases; PGlite tests do not open an implicit real network connection; production `pg` pools use the configured small maximum and Neon-compatible TLS.

- [ ] **Step 7: Commit the configuration/database boundary**

```powershell
git add src/server/config.ts src/server/db .env.example tests
git commit -m "feat: validate server config and database access" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 3: Make migrations and public seed repeatable and verifiable

**Files:**
- Modify: `src/server/db/migrate.ts`, `src/server/db/migrate-test.ts`, `src/server/db/seed.ts`, `src/server/db/migrations/001_init.sql`.
- Create: `scripts/migrate.ts`, `scripts/seed.ts` because the package scripts target entrypoints that are currently absent.
- Create: a new numbered SQL migration only if the already committed schema must change.
- Modify: `package.json` only to correct migration and seed script entrypoints after creating the missing files.
- Test: `tests/integration/run.ts`.

**Interfaces:**
- Consumes: `Database`, validated migration connection settings, and checked-in `reference-original/`.
- Produces: `runMigrations(database: Database): Promise<void>`, `seedPublicContent(database: Database, sourceRoot: string): Promise<SeedSummary>`, and PGlite integration tests using production migration/seed functions.

- [ ] **Step 1: Add migration-ledger tests**

Test a clean database, replay of the same migration, checksum mismatch for an already-applied file, and a SQL failure followed by rollback. Assert failed versions are not recorded as applied and later migrations are not executed after a failure.

- [ ] **Step 2: Run the migration cases and confirm they fail**

Run:

```powershell
npm run test:db
```

Expected: missing or failing cases identify ledger replay/checksum/rollback behavior.

- [ ] **Step 3: Implement ordered, transactional migration application**

Refactor `src/server/db/migrate.ts` to export `runMigrations(database: Database): Promise<void>`. For each sorted `NNN_name.sql`, calculate SHA-256, reject a changed checksum for an applied version, run unapplied SQL and ledger insert in one `database.transaction()`, and stop on first error. Make PGlite use the same migration loop rather than a divergent implementation.

- [ ] **Step 4: Add seed preservation tests**

Use a fresh PGlite database and the real checked-in reference source. Run the seed twice and assert natural-key row counts are unchanged. Edit a seeded public field between the two runs and assert the second seed preserves the edit. Assert no admin, MAPABA registration, or advocacy report is created by seed.

- [ ] **Step 5: Implement deterministic, non-overwriting public seed**

Refactor `src/server/db/seed.ts` into `seedPublicContent(database, sourceRoot)`. Use stable natural keys and `ON CONFLICT DO NOTHING` or an equivalent marker that never overwrites an existing admin edit. Fail explicitly if required reference files are missing or unreadable. Do not seed synthetic gallery photos or personal records. Use a transaction for one logical import. Add the missing `scripts/migrate.ts` and `scripts/seed.ts` entrypoints, loading `.env.local` before dynamically importing config-dependent modules.

- [ ] **Step 6: Test reruns and failure behavior**

Run:

```powershell
npm run test:db
```

Expected: all migration and seed cases pass; the test runner closes every PGlite instance and never touches `DATABASE_URL` production data.

- [ ] **Step 7: Commit migrations and idempotent seed**

```powershell
git add src/server/db scripts tests
git commit -m "feat: make migrations and content seed repeatable" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 4: Harden admin provisioning, reset, and session-revocation CLI

**Files:**
- Modify: `scripts/provision-admin.ts`, `scripts/reset-admin.ts`, `scripts/revoke-admin-sessions.ts`.
- Modify: `src/server/config.ts`, `src/server/auth/admin.ts` only to share password hashing/verification and session-revocation operations.
- Test: `tests/integration/run.ts`.

**Interfaces:**
- Consumes: migration-complete database, `hashPassword()`, `revokeAllAdminSessions()`, and hidden interactive password input.
- Produces: fail-closed `admin:create`, `admin:reset`, and `admin:revoke` commands that never print or accept a password as an argument.

- [ ] **Step 1: Add CLI-domain tests for singleton and reset behavior**

Test that create inserts one account, a second create fails without changing the first, reset updates the password and optional username and revokes every session atomically, blank replacement username preserves the current username, and revoke reports the number of sessions changed. Use a fake TTY/password prompt dependency for tests; tests must not read a real password or connect to Neon.

- [ ] **Step 2: Run the CLI-domain tests**

Run:

```powershell
npm run test:db
```

Expected: FAIL until the CLI operations can be tested without directly opening a production `Pool`.

- [ ] **Step 3: Extract testable account operations**

Move SQL operations to typed functions that accept `Database`/transaction context. Keep the CLI wrapper responsible only for terminal prompts, target confirmation, hashing, and output. `admin:reset` asks for a replacement username; an empty response preserves the current username. Validate a supplied username with the same 3–64 character rule as provisioning. Use `@node-rs/argon2` Argon2id settings consistently with `hashPassword` and `verifyPassword`.

- [ ] **Step 4: Add database-target confirmation and cancellation**

Before create/reset/revoke, display the normalized database host and database name (never credentials). Require an explicit confirmation for non-loopback/Neon targets. A decline must exit without opening a write transaction. Never log the full connection string. Keep password input hidden and reject non-TTY execution.

- [ ] **Step 5: Run provisioning, reset, and revoke cases**

Run:

```powershell
npm run test:db
npm run typecheck
```

Expected: singleton, atomic reset, session revocation, password-hidden-input, and target-cancel tests pass.

- [ ] **Step 6: Commit the hardened CLI**

```powershell
git add scripts src/server/auth tests
git commit -m "feat: secure single-admin provisioning commands" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 5: Enforce admin login, opaque sessions, Origin protection, and privacy-safe rate limits

**Files:**
- Modify: `src/server/auth/admin.ts`, `src/server/security/rate-limit.ts`, `src/app/api/auth/admin/login/route.ts`, `src/app/api/auth/admin/logout/route.ts`, `src/app/api/auth/admin/session/route.ts`, `src/app/[adminPath]/page.tsx`, `src/app/[adminPath]/[module]/page.tsx`, `src/app/api/admin/advocacy/reports/route.ts`, `src/app/api/admin/advocacy/reports/[id]/route.ts`, `src/app/api/admin/mapaba/registrations/route.ts`, and `src/app/api/admin/mapaba/registrations/[id]/route.ts`.
- Modify: `src/components/admin/AdminLoginForm.tsx`, `src/components/admin/AdminLogoutButton.tsx` as required by their route contracts.
- Test: `tests/integration/run.ts`; extend auth-route integration coverage in the same runner.

**Interfaces:**
- Consumes: `Database`, account operations from Task 4, HMAC-derived rate-limit storage, validated app origin and cookie settings.
- Produces: testable core functions `authenticateAdmin(database, username, password): Promise<{ token: string; admin: AdminIdentity; expiresAt: Date }>`, `getCurrentAdmin(database, token): Promise<AdminIdentity | null>`, `revokeAdminSession(database, token): Promise<void>`, and `assertSameOrigin(request): void`; Next.js adapters read/write the cookie at the route/page boundary.

- [ ] **Step 1: Add failing session/auth tests**

Cover a valid password, unknown username, wrong password, inactive admin, session token randomness, SHA-256-only token persistence, expiry, revocation, logout, generic login failure, missing Origin, mismatched Origin, and malformed JSON. Test pure service functions with the isolated `Database` and invoke exported Route Handler functions with standard `Request` objects; keep Next cookie access/writes in route/page adapters. Do not use `x-forwarded-for` as a trusted value in these tests.

- [ ] **Step 2: Add failing privacy and rate-limit tests**

Submit repeated login attempts with absent, valid trusted-proxy, spoofed, and malformed forwarded headers. Assert rate limiting persists only HMAC digests, the raw header and password do not appear in database rows or captured application logs, and two app instances observe the same limit state.

- [ ] **Step 3: Run focused auth cases and confirm expected failures**

Run:

```powershell
npm run test:db
```

Expected: tests expose raw forwarded-header trust and any missing persistence/session checks before implementation.

- [ ] **Step 4: Fix session lifecycle and cookie behavior**

Use a cryptographically random opaque token with at least 256 bits of entropy. Store only its SHA-256 digest. Apply `HttpOnly`, `SameSite=Lax`, path `/`, `Secure` only in production, and the configured absolute seven-day expiry. Reject inactive, revoked, and expired sessions. Use a valid precomputed dummy Argon2id hash with the same parameters for an unknown username so a generic error message is not paired with a cheap verification path. Revoke the current server-side session before clearing the cookie on logout. Set admin pages and private responses to no-store/noindex.

- [ ] **Step 5: Fix login validation, Origin enforcement, and generic errors**

Parse login JSON with a schema and reject non-object/oversized/malformed payloads explicitly. Keep the response identical for unknown username and wrong password. Validate exact request origin against configured `APP_URL` for cookie-authenticated mutations. Do not rely on the obscurity of `ADMIN_PATH`.

- [ ] **Step 6: Hash only trusted rate-limit identifiers**

Change the login route so it never blindly trusts arbitrary `x-forwarded-for`. Always rate-limit on an HMAC of the normalized username, so changing/spoofing a forwarding header cannot bypass the account bucket. Add a separate network bucket only if the platform's trusted request source is explicitly configured and documented; HMAC it before persistence. Require `RATE_LIMIT_HASH_SALT` in production and never log raw values.

- [ ] **Step 7: Verify route-level access and cross-origin behavior**

Run the integration runner and verify:

```powershell
npm run test:db
npm run typecheck
```

Expected: no-session direct access to both admin pages and every admin API listed above redirects/rejects; wrong credentials disclose no username existence; login creates exactly one active session; logout/reset invalidates sessions; cross-origin mutation fails; changing forwarded headers cannot bypass the username bucket; no raw identifier or secret is persisted or logged.

- [ ] **Step 8: Commit auth and privacy enforcement**

```powershell
git add src/server/auth src/server/security src/app/api/auth src/app/'[adminPath]' src/components/admin tests
git commit -m "feat: enforce private admin sessions and rate limits" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Task 6: Complete the Neon/Vercel setup and runbook for the foundation

**Files:**
- Modify: `.env.example`, `README.md`, `DEPLOYMENT.md`, and `package.json` only as needed.
- Test: `npm run verify`; check repository diff and secret scan.

**Interfaces:**
- Consumes: validated variables from Task 2 and all database/admin commands.
- Produces: reproducible local setup and deployment readiness instructions that do not imply a live deployment.

- [ ] **Step 1: Document local setup and exact commands**

Document Node `>=20.9.0`, `npm ci`, `APP_URL`, `DATABASE_URL`, optional `MIGRATION_DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_SSL`, `ADMIN_PATH`, `ADMIN_SESSION_TTL_SECONDS`, `ADMIN_MIN_PASSWORD_LENGTH`, and `RATE_LIMIT_HASH_SALT`; explain which are secret, local PGlite test use, migration/seed commands, hidden CLI prompts, test commands, and the seven-day configurable session. State that no production DB URL, password, Blob token, Sheets key, or Vercel secret belongs in the repository.

- [ ] **Step 2: Document Neon/Vercel configuration boundaries**

Update `DEPLOYMENT.md` with the Neon pooled runtime URL, optional separate migration URL, TLS/runtime notes, Vercel Node runtime, environment scopes, explicit migration-before-release procedure, and rollback caution. Document Blob/Google Sheets as later phases and do not claim either integration is working.

- [ ] **Step 3: Run complete project verification**

Run:

```powershell
npm run verify
```

Expected: typecheck, ESLint, isolated database integration suite, and production build all exit 0. If the runner reports an actionable failure caused by this plan, fix it in the responsible task and repeat this command.

- [ ] **Step 4: Inspect staged and unstaged changes for secrets and scope**

Run:

```powershell
git status --short
git diff --check
git diff -- . ':!.next' ':!node_modules'
```

Confirm there are no credentials, raw user data, unrelated edits, public admin links, or generated artifacts.

- [ ] **Step 5: Commit the runbook and verification changes**

```powershell
git add .env.example README.md DEPLOYMENT.md package.json tests
git commit -m "docs: document Neon foundation operations" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

## Plan self-review

- **Spec coverage:** scaffold initialization is explicit; architecture and config are Task 2; PostgreSQL migration/seed are Task 3; single-admin CLI is Task 4; login/session/origin/rate-limit privacy are Task 5; environment/runbook and full verification are Task 6. Later subsystems remain explicitly out of scope.
- **Placeholder scan:** no `TBD`, `TODO`, “implement later,” unspecified validation, or undefined test command appears in task steps. Future product modules are clearly marked as separate scope rather than left as incomplete steps.
- **Type/interface consistency:** Task 2 establishes `DbExecutor` and `Database.transaction()`; Task 3 consumes `Database` for migration/seed; Task 4 consumes executor/transaction operations for account changes; Task 5 uses those account operations for sessions/rate limits. Public types are named consistently.
- **Review-focus coverage:** CLI targeting is covered by Task 4; malformed configuration is Task 2; migration/seed replay and rollback is Task 3; proxy-header distrust is Task 5; invalid sessions and cross-origin requests are Task 5.
- **Known technical caveat:** current scaffold has no `tests/integration/run.ts` although `package.json` invokes it, and the current login route accepts `x-forwarded-for` directly. The plan assigns both to explicit test-first fixes rather than assuming existing checks prove them.

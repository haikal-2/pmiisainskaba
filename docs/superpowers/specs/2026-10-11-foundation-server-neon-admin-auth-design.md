# PMII Saintek foundation: server, Neon, and admin authentication

## Status and scope

This specification defines the first implementation subproject for the
`haikal-2/pmiisainskaba` repository. The GitHub repository was empty when
inspected. The existing `pmii-claude-kit` workspace is the approved source of
the initial scaffold and requirements; this subproject will transfer and adapt
only the code needed for the server foundation, database, and admin
authentication. Public-page migration, public forms, Google Sheets, Blob
uploads, the complete CMS, visual comparison, and production deployment remain
separate follow-up subprojects.

The product is a full-stack Next.js application for PR PMII Sains dan
Teknologi UIN Sunan Gunung Djati. Public content and admin presentation should
follow the provided reference. Photos whose originals are unavailable must not
be replaced or represented as visually matched; visual parity for those assets
remains blocked until the user supplies them.

## Confirmed constraints

- Use Next.js App Router and TypeScript with strict type checking.
- Use PostgreSQL on Neon, Vercel Blob for files in a later integration phase,
  and Vercel as the hosting target.
- Keep browser-facing UI and server backend in the same Next.js application.
- Keep all database credentials and other secrets server-side in environment
  variables. Do not request or store production credentials in this repository.
- The admin URL is `/admin-secret`; it is entered directly and is not linked
  from public pages.
- There is exactly one admin account. There is no public account registration,
  invitation, social login, or browser-based account bootstrap.
- Provisioning, resetting, and revoking admin access use server-side CLI
  commands with interactive hidden password entry. Passwords are never passed
  as command-line arguments or committed.
- The default absolute admin session lifetime is seven days and is
  configurable by `ADMIN_SESSION_TTL_SECONDS`.
- Rate limiting must not persist raw IP addresses. Use a keyed HMAC-derived
  identifier and persistent database state.
- Public content seeding must be idempotent and must not overwrite edits made
  by an admin on subsequent runs.
- Use a local/test database for verification until Neon and Vercel projects
  and credentials are configured by the user.

## Goals

1. Establish a strict, understandable server-side architecture that can host
   public rendering, authenticated admin operations, and later form workflows.
2. Establish safe Neon/PostgreSQL connectivity and repeatable, versioned
   migrations.
3. Provide idempotent content initialization based on the checked-in original
   HTML/reference assets without seeding personal submissions or credentials.
4. Provide one-admin provisioning/reset/revocation through CLI and secure
   server-side login sessions.
5. Verify behavior locally without production credentials or external
   services.

## Non-goals

- Implementing or declaring pixel parity for all public pages.
- Implementing public MAPABA or Advokasi submission, Google Sheets delivery,
  private Blob uploads, or business rules for those integrations.
- Completing content-editing screens for all modules.
- Exporting participant or advocacy data, adding a payment provider, or adding
  public ticket tracking.
- Creating Vercel/Neon accounts or deploying production resources.

## Architecture

Keep one Next.js application with server-only database and domain code.
Server Components call application services directly; browser code does not
connect to PostgreSQL. Route Handlers and server actions validate untrusted
input and enforce authentication/authorization at the operation boundary.
Layouts may redirect unauthenticated visitors for user experience, but they
are not the sole protection for private data.

Retain the existing project conventions where present, organizing code by
responsibility:

- `src/server/config`: server-only environment parsing and validation.
- `src/server/db`: PostgreSQL pool, migration runner, and transaction helpers.
- `src/server/repositories`: parameterized database reads and writes.
- `src/server/services`: domain operations and authorization checks.
- `src/server/schemas`: shared validation schemas, with server-side parsing
  required for every mutation.
- `src/app`: public pages, the configured private admin route, and API handlers.
- `scripts` and `migrations`: CLI operations and ordered SQL migrations.
- `tests`: database and authentication integration tests against an isolated
  test database.

Avoid introducing a separate Express server, an ORM, or an additional UI
framework unless inspection of the approved scaffold demonstrates a concrete
need. Use the repository's existing PostgreSQL driver and PGlite test setup if
they remain compatible with the selected Neon connection strategy.

## Database and migration design

Use PostgreSQL-compatible SQL migrations with stable, ordered identifiers and
a migration ledger. A migration is applied once, transactionally when the
database/provider permits; a failed migration must report its identifier and
error rather than being marked successful. Runtime credentials and migration
credentials may be separate when required by Neon connection configuration or
least-privilege policy.

The first schema includes:

- A singleton admin account with normalized unique username, password hash,
  active flag, and timestamps.
- Admin sessions containing only a hash of a cryptographically random opaque
  token, its expiry, revocation time, and admin reference.
- Migration bookkeeping.
- Persistent rate-limit buckets using keyed derived identifiers, counters,
  and expiry; never raw IP addresses or form payloads.
- The minimal content records and stable source identifiers needed to import
  reference content without overwriting subsequent admin edits.

The schema may reserve/additive structures needed by later approved modules
only when they support the agreed model. MAPABA submissions, advocacy reports,
and file metadata must be private and must not be included in public data
transfer objects. Their full workflow and retention behavior are outside this
first subproject.

All queries use parameterized statements. Repository functions return typed
domain data rather than leaking database rows to client components. Migrations
are explicit operational commands, not automatic destructive build hooks.

## Seed and content import

Seed only public reference content available in the local source package.
Create a deterministic source key for each imported record. First import may
insert records; repeated import must neither duplicate them nor reset content
edited after import. Seed must not create an admin account, password, sample
participant, or sample advocacy report.

If the existing seed implementation cannot distinguish initial import from a
later admin edit, add a narrowly scoped source/import marker or import version;
do not use destructive truncate-and-reload behavior. Report missing reference
assets and records explicitly. Do not synthesize unavailable photographs.

## Admin authentication

### Provisioning and password management

CLI commands create the sole admin account, reset its username/password, and
revoke sessions. Password entry is interactive and hidden; no default
credentials exist. Provisioning fails if an account already exists. Reset
updates the password hash atomically and revokes all active sessions. The
commands must clearly identify the selected database target before mutation
and must not print passwords or hashes.

Hash passwords with the existing vetted Argon2id library and its documented
verification API. Use a configured minimum password length. Do not implement
cryptography directly.

### Login and sessions

The `/admin-secret` route presents login and protected admin content without
any public navigation link to the admin. The route remains protected by
credentials; its non-obvious path is not an authorization mechanism.

On successful login, generate a cryptographically random opaque session token,
store only its SHA-256 digest in the database, and set the raw token in a
cookie configured as `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in
production. Session expiry is absolute and controlled by
`ADMIN_SESSION_TTL_SECONDS`, defaulting to seven days. Login errors are generic
and do not disclose whether a username exists.

Every protected page, Route Handler, and server action independently
authenticates the session at its trust boundary. Reject missing, expired,
revoked, or inactive-admin sessions. Logout revokes the server-side session
and clears the cookie. Password reset revokes every session.

Cookie-authenticated mutations validate the request Origin against the
configured application origin (or use the repository's established CSRF
defense). Cross-origin mutation requests must fail closed. Private responses
use `Cache-Control: no-store`; admin pages are not indexed.

### Login rate limiting and privacy

Rate-limit repeated login attempts using persistent database state that works
across serverless instances. Derive identifiers with HMAC using a
server-side secret; do not store raw IP or credentials. Do not trust arbitrary
forwarded-IP headers. In production, use only the explicitly configured,
trusted Vercel proxy/header behavior. Tests use deterministic identifiers and
must verify that no raw network address appears in persisted rows or
application logs.

## Error handling and observability

Return explicit validation, authentication, authorization, and conflict
failures using the existing application error conventions. Do not convert
database/storage failures into success responses. Public responses and logs
must not contain stack traces, passwords, session tokens, password hashes, or
private form content. Include a request/correlation identifier where the
scaffold already supports it.

## Environment and deployment readiness

Document required and optional server environment variables in `.env.example`
and the runbook, including database connection settings, migration connection
settings if separate, `ADMIN_PATH`, session TTL, password policy, trusted app
origin, and rate-limit HMAC secret. Validate configuration at server startup
or command execution with clear errors. Never use a production credential as a
fallback in development or tests.

The code should be compatible with the Vercel Node.js runtime and Neon
serverless connection/pooling expectations. The project is deployment-ready
but not considered deployed until the user supplies/creates the target
projects, configures environment variables, and a deployment is actually
verified.

## Verification and acceptance

Run the smallest relevant project commands, then the project's complete
verification command if available. The foundation is accepted when:

1. Type checking, lint, database integration tests, and production build pass.
2. A fresh test database migrates successfully, and migration replay is a
   no-op.
3. Seed can run twice without duplicates and does not overwrite an edit made
   between runs.
4. Provisioning creates one admin and refuses a second; reset changes the
   credential and revokes all sessions.
5. Correct login creates a valid session; invalid credentials produce a
   generic failure; expired/revoked sessions are rejected; logout revokes the
   current session.
6. Direct access to private pages/API without a session is rejected, and
   cross-origin mutations fail.
7. Session tokens/passwords are not stored in plaintext and raw IP addresses
   are absent from rate-limit persistence and application logs.
8. No production database, Blob, Sheets, or Vercel credential is required for
   the local verification suite.

## Follow-up subprojects

1. Migrate public pages and interactions against the source HTML/CSS and obtain
   missing original photos before claiming visual parity.
2. Implement MAPABA and Advokasi workflows, quotas/eligibility/deduplication,
   secure Blob upload, and Google Sheets integration.
3. Complete admin content management for all confirmed modules.
4. Perform cross-viewport visual and end-to-end verification.
5. Configure and verify Vercel, Neon, Blob, and operational runbooks using
   user-provided environment setup.

Each subproject should retain the confirmed product decisions and be specified
and verified against its own acceptance criteria before implementation.

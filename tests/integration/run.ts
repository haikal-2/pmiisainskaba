import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { Database } from '../../src/server/db/types';

const loadConfig = () => import('../../src/server/config-values.js');
const testEnv = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/pmii_test' };
const loadPgliteDatabase = () => import('./support/pglite-database.js');
const loadMigrations = () => import('../../src/server/db/migrate.js');
const loadSeed = () => import('../../src/server/db/seed.js');
const loadAdminOperations = () => import('../../src/server/auth/admin-operations.js');
const loadAdminCli = () => import('../../scripts/admin-cli.js');
const loadPassword = () => import('../../src/server/auth/password.js');
const loadAdminSessionService = () => import('../../src/server/auth/admin-service.js');
const loadAdminLoginInput = () => import('../../src/server/auth/login-input.js');
const loadRequestOrigin = () => import('../../src/server/auth/request-origin.js');
const loadRateLimitService = () => import('../../src/server/security/rate-limit-service.js');

async function withMigrationDirectory(
  migrationSql: string,
  run: (database: Database & { close(): Promise<void> }, directory: string) => Promise<void>,
) {
  const directory = await mkdtemp(join(tmpdir(), 'pmii-migrations-'));
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const database = await createPgliteDatabase();
  try {
    await writeFile(join(directory, '001_probe.sql'), migrationSql);
    await run(database, directory);
  } finally {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  }
}

test('server config defaults to the private admin path and seven-day session lifetime', async () => {
  const { parseServerConfig } = await loadConfig();
  const config = parseServerConfig(testEnv);

  assert.equal(config.adminPath, 'admin-secret');
  assert.equal(config.adminSessionTtlSeconds, 604800);
});

test('server config rejects reserved or malformed admin paths', async () => {
  const { parseServerConfig } = await loadConfig();
  for (const adminPath of ['api', '../admin', 'Admin Path']) {
    assert.throws(
      () => parseServerConfig({ ...testEnv, ADMIN_PATH: adminPath }),
      /ADMIN_PATH/,
    );
  }
});

test('server config rejects non-origin application URLs', async () => {
  const { parseServerConfig } = await loadConfig();
  for (const appUrl of ['not-a-url', 'ftp://pmii.example', 'https://pmii.example/admin']) {
    assert.throws(
      () => parseServerConfig({ ...testEnv, APP_URL: appUrl }),
      /APP_URL/,
    );
  }
});

test('server config rejects fractional and out-of-range session lifetimes', async () => {
  const { parseServerConfig } = await loadConfig();
  for (const ttl of ['300.5', '299', '7776001']) {
    assert.throws(
      () => parseServerConfig({ ...testEnv, ADMIN_SESSION_TTL_SECONDS: ttl }),
      /ADMIN_SESSION_TTL_SECONDS/,
    );
  }
});

test('production config requires an explicit database URL and rate-limit salt', async () => {
  const { parseServerConfig } = await loadConfig();
  assert.throws(
    () => parseServerConfig({ NODE_ENV: 'production', ADMIN_PATH: 'admin-secret' }),
    /DATABASE_URL/,
  );
  assert.throws(
    () => parseServerConfig({
      NODE_ENV: 'production',
      ADMIN_PATH: 'admin-secret',
      DATABASE_URL: 'postgresql://pmii:secret@db.example/pmii',
    }),
    /RATE_LIMIT_HASH_SALT/,
  );
});

test('PGlite database transactions roll back writes when an operation throws', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const database = await createPgliteDatabase();
  try {
    await database.query('CREATE TABLE transaction_probe (id integer PRIMARY KEY)');
    await assert.rejects(database.transaction(async (transaction) => {
      await transaction.query('INSERT INTO transaction_probe (id) VALUES ($1)', [1]);
      throw new Error('abort transaction');
    }), /abort transaction/);
    const rows = await database.query('SELECT id FROM transaction_probe');
    assert.deepEqual(rows.rows, []);
  } finally {
    await database.close();
  }
});

test('database migrations apply once, and replay validates the stored checksum', async () => {
  const { runMigrations } = await loadMigrations();
  await withMigrationDirectory(
    'CREATE TABLE migration_probe (id integer PRIMARY KEY);',
    async (database, directory) => {
      await runMigrations(database, directory);
      await runMigrations(database, directory);
      const ledger = await database.query('SELECT version FROM schema_migrations');
      assert.deepEqual(ledger.rows, [{ version: '001_probe' }]);

      await writeFile(join(directory, '001_probe.sql'), 'CREATE TABLE migration_probe (id bigint PRIMARY KEY);');
      await assert.rejects(runMigrations(database, directory), /checksum/i);
    },
  );
});

test('concurrent migration runs apply the same version only once', async () => {
  const { runMigrations } = await loadMigrations();
  await withMigrationDirectory(
    'CREATE TABLE migration_probe (id integer PRIMARY KEY);',
    async (database, directory) => {
      await Promise.all([
        runMigrations(database, directory),
        runMigrations(database, directory),
      ]);
      const ledger = await database.query('SELECT version FROM schema_migrations');
      assert.deepEqual(ledger.rows, [{ version: '001_probe' }]);
    },
  );
});

test('failed migrations roll back schema changes and are not marked applied', async () => {
  const { runMigrations } = await loadMigrations();
  await withMigrationDirectory(
    'CREATE TABLE migration_probe (id integer PRIMARY KEY); THIS IS NOT VALID SQL;',
    async (database, directory) => {
      await assert.rejects(runMigrations(database, directory));
      const table = await database.query(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'migration_probe'",
      );
      const ledger = await database.query('SELECT version FROM schema_migrations');
      assert.deepEqual(table.rows, []);
      assert.deepEqual(ledger.rows, []);
    },
  );
});

test('public seed is repeatable and does not overwrite admin edits or create private records', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { seedPublicContent } = await loadSeed();
  const database = await createPgliteDatabase();
  const sourceRoot = await mkdtemp(join(tmpdir(), 'pmii-reference-'));
  try {
    await runMigrations(database);
    for (const file of [
      'index.html',
      'profil/sejarah.html',
      'profil/struktur.html',
      'kopri.html',
      'galeri.html',
      'landasan-hukum.html',
      'advokasi.html',
      'mapaba.html',
    ]) {
      const path = join(sourceRoot, file);
      const parent = join(path, '..');
      await import('node:fs/promises').then(({ mkdir }) => mkdir(parent, { recursive: true }));
      await writeFile(path, '<!doctype html><html><body>Reference fixture</body></html>');
    }
    await seedPublicContent(database, sourceRoot);
    await database.query(
      "UPDATE content_section SET title = 'Edited by admin' WHERE page_key = 'home' AND section_key = 'about'",
    );
    await seedPublicContent(database, sourceRoot);

    const section = await database.query<{ title: string }>(
      "SELECT title FROM content_section WHERE page_key = 'home' AND section_key = 'about'",
    );
    const sections = await database.query('SELECT id FROM content_section');
    const admins = await database.query('SELECT id FROM admin_account');
    const registrations = await database.query('SELECT id FROM mapaba_registration');
    const reports = await database.query('SELECT id FROM advocacy_report');
    assert.deepEqual(section.rows, [{ title: 'Edited by admin' }]);
    assert.equal(sections.rows.length, 6);
    assert.deepEqual(admins.rows, []);
    assert.deepEqual(registrations.rows, []);
    assert.deepEqual(reports.rows, []);
  } finally {
    await database.close();
    await rm(sourceRoot, { recursive: true, force: true });
  }
});

test('admin provisioning is singleton and preserves the original account on duplicate create', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount } = await loadAdminOperations();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'haikal-admin', 'argon-hash-one');
    await assert.rejects(
      createAdminAccount(database, 'second-admin', 'argon-hash-two'),
      /already exists/i,
    );
    const admin = await database.query<{ username: string; password_hash: string }>(
      'SELECT username, password_hash FROM admin_account',
    );
    assert.deepEqual(admin.rows, [{ username: 'haikal-admin', password_hash: 'argon-hash-one' }]);
  } finally {
    await database.close();
  }
});

test('admin reset replaces credentials and revokes all active sessions atomically', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount, resetAdminAccount } = await loadAdminOperations();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'haikal-admin', 'argon-hash-one');
    await database.query(
      `INSERT INTO admin_session (id, admin_id, token_hash, expires_at)
       VALUES ('00000000-0000-4000-8000-000000000001', 1, 'token-hash-a', now() + interval '1 day'),
              ('00000000-0000-4000-8000-000000000002', 1, 'token-hash-b', now() + interval '1 day')`,
    );
    const revoked = await resetAdminAccount(database, 'argon-hash-two', '');
    const admin = await database.query<{ username: string; password_hash: string }>(
      'SELECT username, password_hash FROM admin_account',
    );
    const sessions = await database.query<{ active: number }>(
      'SELECT count(*)::int AS active FROM admin_session WHERE revoked_at IS NULL',
    );
    assert.equal(revoked, 2);
    assert.deepEqual(admin.rows, [{ username: 'haikal-admin', password_hash: 'argon-hash-two' }]);
    assert.deepEqual(sessions.rows, [{ active: 0 }]);
  } finally {
    await database.close();
  }
});

test('admin revocation returns the number of active sessions it revoked', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount, revokeAllAdminSessions } = await loadAdminOperations();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'haikal-admin', 'argon-hash-one');
    await database.query(
      `INSERT INTO admin_session (id, admin_id, token_hash, expires_at)
       VALUES ('00000000-0000-4000-8000-000000000001', 1, 'token-hash-a', now() + interval '1 day')`,
    );
    assert.equal(await revokeAllAdminSessions(database), 1);
    assert.equal(await revokeAllAdminSessions(database), 0);
  } finally {
    await database.close();
  }
});

test('admin CLI confirmation displays a credential-free target and cancels remote writes', async () => {
  const { runAfterDatabaseConfirmation } = await loadAdminCli();
  let output = '';
  let mutationCount = 0;
  const result = await runAfterDatabaseConfirmation(
    'postgresql://admin:secret@ep-cool-region.neon.tech/pmii?sslmode=require',
    async () => 'no',
    (message) => { output += message; },
    async () => { mutationCount += 1; },
  );
  assert.match(output, /ep-cool-region\.neon\.tech/);
  assert.match(output, /pmii/);
  assert.doesNotMatch(output, /admin|secret/);
  assert.equal(result, false);
  assert.equal(mutationCount, 0);
});

test('admin password hashing verifies a correct password and rejects a wrong one', async () => {
  const { hashPassword, verifyPassword } = await loadPassword();
  const passwordHash = await hashPassword('a strong test password');
  assert.notEqual(passwordHash, 'a strong test password');
  assert.equal(await verifyPassword('a strong test password', passwordHash), true);
  assert.equal(await verifyPassword('a different password', passwordHash), false);
});

test('admin login issues opaque tokens and stores only their SHA-256 digest', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount } = await loadAdminOperations();
  const { hashPassword } = await loadPassword();
  const { authenticateAdmin, getCurrentAdmin } = await loadAdminSessionService();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'admin.test', await hashPassword('correct horse battery staple'));

    const result = await authenticateAdmin(database, 'admin.test', 'correct horse battery staple', {
      sessionTtlSeconds: 3600,
      userAgent: 'integration-test',
    });
    assert.equal(result.admin.username, 'admin.test');
    assert.ok(result.token.length >= 40);
    assert.ok(result.expiresAt.getTime() > Date.now());
    const sessions = await database.query<{ token_hash: string; user_agent: string }>(
      'SELECT token_hash, user_agent FROM admin_session',
    );
    assert.equal(sessions.rows.length, 1);
    assert.notEqual(sessions.rows[0]?.token_hash, result.token);
    assert.equal(sessions.rows[0]?.token_hash, createHash('sha256').update(result.token).digest('hex'));
    assert.equal(sessions.rows[0]?.user_agent, 'integration-test');
    assert.deepEqual(await getCurrentAdmin(database, result.token), result.admin);
  } finally {
    await database.close();
  }
});

test('admin login returns the same authentication failure for unknown, wrong-password, and inactive accounts', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount } = await loadAdminOperations();
  const { hashPassword } = await loadPassword();
  const { authenticateAdmin, AdminAuthenticationError } = await loadAdminSessionService();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'admin.test', await hashPassword('correct horse battery staple'));
    await database.query('UPDATE admin_account SET active = false WHERE id = 1');

    for (const credentials of [
      ['missing.admin', 'correct horse battery staple'],
      ['admin.test', 'wrong password'],
      ['admin.test', 'correct horse battery staple'],
    ]) {
      await assert.rejects(
        authenticateAdmin(database, credentials[0]!, credentials[1]!, {
          sessionTtlSeconds: 3600,
          userAgent: null,
        }),
        AdminAuthenticationError,
      );
    }
    const sessions = await database.query('SELECT id FROM admin_session');
    assert.deepEqual(sessions.rows, []);
  } finally {
    await database.close();
  }
});

test('admin session lookup rejects expired and revoked sessions', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount } = await loadAdminOperations();
  const { hashPassword } = await loadPassword();
  const { authenticateAdmin, getCurrentAdmin, revokeAdminSession } = await loadAdminSessionService();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'admin.test', await hashPassword('correct horse battery staple'));
    const first = await authenticateAdmin(database, 'admin.test', 'correct horse battery staple', {
      sessionTtlSeconds: 3600,
      userAgent: null,
    });
    await database.query(
      "UPDATE admin_session SET expires_at = now() - interval '1 second' WHERE token_hash = $1",
      [createHash('sha256').update(first.token).digest('hex')],
    );
    assert.equal(await getCurrentAdmin(database, first.token), null);

    const second = await authenticateAdmin(database, 'admin.test', 'correct horse battery staple', {
      sessionTtlSeconds: 3600,
      userAgent: null,
    });
    await revokeAdminSession(database, second.token);
    await revokeAdminSession(database, second.token);
    assert.equal(await getCurrentAdmin(database, second.token), null);
  } finally {
    await database.close();
  }
});

test('concurrent admin logins retain at most one active server-side session', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { createAdminAccount } = await loadAdminOperations();
  const { hashPassword } = await loadPassword();
  const { authenticateAdmin } = await loadAdminSessionService();
  const database = await createPgliteDatabase();
  try {
    await runMigrations(database);
    await createAdminAccount(database, 'admin.test', await hashPassword('correct horse battery staple'));
    await Promise.all([
      authenticateAdmin(database, 'admin.test', 'correct horse battery staple', {
        sessionTtlSeconds: 3600,
        userAgent: null,
      }),
      authenticateAdmin(database, 'admin.test', 'correct horse battery staple', {
        sessionTtlSeconds: 3600,
        userAgent: null,
      }),
    ]);
    const sessions = await database.query<{ active: number }>(
      'SELECT count(*)::int AS active FROM admin_session WHERE revoked_at IS NULL AND expires_at > now()',
    );
    assert.deepEqual(sessions.rows, [{ active: 1 }]);
  } finally {
    await database.close();
  }
});

test('admin login payload parser rejects malformed, non-object, unsupported, and oversized requests', async () => {
  const { readAdminLoginPayload, LoginPayloadError } = await loadAdminLoginInput();
  const makeRequest = (body: string, contentType = 'application/json') => new Request('https://pmii.example/api/auth/admin/login', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  });

  await assert.rejects(readAdminLoginPayload(makeRequest('{')), LoginPayloadError);
  await assert.rejects(readAdminLoginPayload(makeRequest('[]')), LoginPayloadError);
  await assert.rejects(readAdminLoginPayload(makeRequest('{"username":"abc","password":"123"}', 'text/plain')), LoginPayloadError);
  await assert.rejects(readAdminLoginPayload(makeRequest(JSON.stringify({ username: 'abc', password: 'x'.repeat(5000) }))), LoginPayloadError);
  assert.deepEqual(
    await readAdminLoginPayload(makeRequest('{"username":" admin.test ","password":"secret"}')),
    { username: 'admin.test', password: 'secret' },
  );
});

test('admin mutation origin validation requires the configured exact origin', async () => {
  const { assertRequestOrigin, RequestOriginError } = await loadRequestOrigin();
  const request = (origin?: string) => new Request('https://pmii.example/api/admin/items', {
    method: 'POST',
    headers: origin ? { origin } : {},
  });

  assert.doesNotThrow(() => assertRequestOrigin(request('https://pmii.example'), 'https://pmii.example'));
  assert.throws(() => assertRequestOrigin(request(), 'https://pmii.example'), RequestOriginError);
  assert.throws(() => assertRequestOrigin(request('https://evil.example'), 'https://pmii.example'), RequestOriginError);
  assert.throws(() => assertRequestOrigin(request('not an origin'), 'https://pmii.example'), RequestOriginError);
});

test('rate limiting shares username buckets across instances and persists only HMAC digests', async () => {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { enforceRateLimit, deriveRateLimitHash, RateLimitExceededError } = await loadRateLimitService();
  const database = await createPgliteDatabase();
  const salt = 'integration-rate-limit-salt-with-enough-entropy';
  const username = 'admin.private';
  try {
    await runMigrations(database);
    await enforceRateLimit(database, salt, 'admin-login', username, {
      limit: 2,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    await enforceRateLimit(database, salt, 'admin-login', username, {
      limit: 2,
      windowSeconds: 900,
      blockSeconds: 900,
    });
    await assert.rejects(
      enforceRateLimit(database, salt, 'admin-login', username, {
        limit: 2,
        windowSeconds: 900,
        blockSeconds: 900,
      }),
      RateLimitExceededError,
    );
    const counters = await database.query<{ scope: string; subject_hash: string; hits: number }>(
      'SELECT scope, subject_hash, hits FROM rate_limit_counter',
    );
    assert.equal(counters.rows.length, 1);
    assert.equal(counters.rows[0]?.subject_hash, deriveRateLimitHash(salt, 'admin-login', username));
    assert.doesNotMatch(JSON.stringify(counters.rows), /admin\.private|password|forwarded-for/i);
  } finally {
    await database.close();
  }
});

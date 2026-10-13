import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import Module from 'node:module';
import test from 'node:test';

// Config dibaca saat impor; PGlite terisolasi tidak pernah menyentuh jaringan.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'routes-integration-salt-with-enough-entropy';
process.env.APP_URL ??= 'http://localhost:3000';

import { withTestDatabase, withTempCwd, failingDatabase } from './support/test-db.js';

/**
 * Route HTTP: otorisasi cron, panel outbox admin, health check, dan audit akses berkas.
 *
 * Route admin memanggil `requireAdmin()` yang membaca cookie Next.js. Namespace
 * `next/headers` bersifat non-konfigurabel, jadi cookie di-inject lewat interceptor
 * pemuat modul: `next/headers` diganti stub untuk durasi test, sementara sesi asli
 * tetap dibuat di database sehingga jalur otorisasi sesungguhnya dieksekusi.
 */

type CookieStore = { get(name: string): { name: string; value: string } | undefined };

let adminToken: string | null = null;

const headersStub = {
  cookies: async (): Promise<CookieStore> => ({
    get: (name: string) =>
      name === 'pmii_admin_session' && adminToken ? { name, value: adminToken } : undefined,
  }),
  headers: async () => new Headers(),
};

type ModuleLoader = { _load(request: string, parent: unknown, isMain: boolean): unknown };
const loader = Module as unknown as ModuleLoader;
const originalLoad = loader._load;
let interceptionInstalled = false;

function installHeadersInterception(): void {
  if (interceptionInstalled) return;
  interceptionInstalled = true;
  loader._load = function patchedLoad(request: string, parent: unknown, isMain: boolean) {
    if (request === 'next/headers') return headersStub;
    return originalLoad.call(this, request, parent, isMain);
  };
}

installHeadersInterception();

/** Setel secret cron pada config yang sudah dimuat, pulihkan setelahnya. */
async function withCronSecret(secret: string, run: () => Promise<void>): Promise<void> {
  const { default: config } = await import('../../src/server/config.js');
  const mutable = config as unknown as { cronSecret: string };
  const previous = mutable.cronSecret;
  mutable.cronSecret = secret;
  try {
    await run();
  } finally {
    mutable.cronSecret = previous;
  }
}

/** Jalankan `run` sebagai admin yang terautentikasi (`null` = anonim). */
async function withAdminSession(token: string | null, run: () => Promise<void>): Promise<void> {
  const previous = adminToken;
  adminToken = token;
  try {
    await run();
  } finally {
    adminToken = previous;
  }
}

/** Buat akun admin + sesi valid, kembalikan token opaque-nya. */
async function createAdminSession(database: { query: (text: string, values?: readonly unknown[]) => Promise<unknown> }): Promise<string> {
  const { createAdminAccount } = await import('../../src/server/auth/admin-operations.js');
  const { hashPassword } = await import('../../src/server/auth/password.js');
  const { authenticateAdmin } = await import('../../src/server/auth/admin-service.js');
  await createAdminAccount(database as never, 'admin.test', await hashPassword('correct horse battery staple'));
  const session = await authenticateAdmin(
    database as never,
    'admin.test',
    'correct horse battery staple',
    { sessionTtlSeconds: 3600, userAgent: null },
  );
  return session.token;
}

test('the cron route refuses callers when no secret is configured or the token is wrong', async () => {
  const route = await import('../../src/app/api/internal/cron/dispatch-outbox/route.js');
  const url = 'https://pmii.example/api/internal/cron/dispatch-outbox';

  await withCronSecret('', async () => {
    const response = await route.GET(new Request(url));
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'DEPENDENCY_UNAVAILABLE');
  });

  await withCronSecret('a-long-enough-cron-secret-value', async () => {
    assert.equal((await route.GET(new Request(url))).status, 401);
    assert.equal(
      (await route.GET(new Request(url, { headers: { authorization: 'Bearer different-secret-value-here' } }))).status,
      401,
    );
    assert.equal(
      (await route.GET(new Request(url, { headers: { authorization: 'Basic a-long-enough-cron-secret-value' } }))).status,
      401,
    );
  });
});

test('an authorized cron call runs the outbox worker and reports a summary', async () => {
  const route = await import('../../src/app/api/internal/cron/dispatch-outbox/route.js');
  await withTestDatabase(async (database) => {
    await database.query(
      `INSERT INTO integration_outbox (integration, event_key, payload)
       VALUES ('google-sheets-mapaba', 'cron-1',
               '{"registrationNumber":"MPB","fullName":"A","nim":"1","university":"U","studyProgram":"S","whatsapp":"0","email":"a@b.c","createdAt":"2026-03-04T05:06:07.000Z"}'::jsonb)`,
    );

    await withCronSecret('a-long-enough-cron-secret-value', async () => {
      const response = await route.GET(
        new Request('https://pmii.example/api/internal/cron/dispatch-outbox', {
          headers: { authorization: 'Bearer a-long-enough-cron-secret-value' },
        }),
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as { data: { claimed: number; processed: number; failed: number } };
      assert.equal(body.data.claimed, 1);
      assert.equal(body.data.processed + body.data.failed, 1);
    });
  });
});

test('the health route reports each dependency separately and never leaks credentials', async () => {
  const route = await import('../../src/app/api/internal/health/route.js');
  await withTestDatabase(async () => {
    const response = await route.GET();
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      status: string;
      environment: string;
      dependencies: Record<string, { status: string; driver?: string }>;
    };
    assert.equal(body.status, 'ok');
    assert.equal(body.environment, 'non-production');
    for (const name of ['database', 'storage', 'cron', 'googleSheets', 'composio']) {
      assert.ok(body.dependencies[name], `dependency ${name} harus dilaporkan`);
    }
    assert.equal(body.dependencies.database?.status, 'ok');
    // Tanpa kredensial Blob di non-produksi, driver lokal dipakai dan dilaporkan apa adanya.
    assert.equal(body.dependencies.storage?.status, 'ok');
    assert.equal(body.dependencies.storage?.driver, 'local');
    // Cron tanpa secret dilaporkan tidak tersedia, bukan disembunyikan.
    assert.equal(body.dependencies.cron?.status, 'unavailable');
  });
});

test('the health route returns 503 when the database dependency is unavailable', async () => {
  const route = await import('../../src/app/api/internal/health/route.js');
  const globalWithOverride = globalThis as typeof globalThis & { __pmiiDbOverride?: unknown };
  const previous = globalWithOverride.__pmiiDbOverride;
  globalWithOverride.__pmiiDbOverride = failingDatabase();
  try {
    const response = await route.GET();
    assert.equal(response.status, 503);
    const body = (await response.json()) as { status: string; dependencies: Record<string, { status: string }> };
    assert.equal(body.status, 'unavailable');
    assert.equal(body.dependencies.database?.status, 'unavailable');
  } finally {
    globalWithOverride.__pmiiDbOverride = previous;
  }
});

test('the admin outbox endpoint requires an authenticated admin session', async () => {
  const route = await import('../../src/app/api/admin/outbox/route.js');
  await withTestDatabase(async () => {
    await withAdminSession(null, async () => {
      const response = await route.GET(new Request('https://pmii.example/admin/api/outbox'));
      assert.equal(response.status, 401);
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(body.error.code, 'UNAUTHENTICATED');

      const mutation = await route.POST(
        new Request('https://pmii.example/admin/api/outbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({ id: 1 }),
        }),
      );
      assert.equal(mutation.status, 401);
    });
  });
});

test('an authenticated admin can list pending outbox items and requeue one with an audit trail', async () => {
  const route = await import('../../src/app/api/admin/outbox/route.js');
  await withTestDatabase(async (database) => {
    const token = await createAdminSession(database);
    await database.query(
      `INSERT INTO integration_outbox (integration, event_key, payload)
       VALUES ('google-sheets-mapaba', 'admin-1', '{"registrationNumber":"MPB"}'::jsonb)`,
    );

    await withAdminSession(token, async () => {
      const list = await route.GET(new Request('https://pmii.example/admin/api/outbox'));
      assert.equal(list.status, 200);
      const listed = (await list.json()) as { data: { items: { id: number; attempts: number; integration: string }[] } };
      assert.equal(listed.data.items.length, 1);
      assert.equal(listed.data.items[0]?.attempts, 0);
      assert.equal(listed.data.items[0]?.integration, 'google-sheets-mapaba');

      const requeued = await route.POST(
        new Request('https://pmii.example/admin/api/outbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({ id: listed.data.items[0]!.id }),
        }),
      );
      assert.equal(requeued.status, 200);
      const body = (await requeued.json()) as { data: { id: number; requeued: boolean } };
      assert.equal(body.data.requeued, true);

      const audit = await database.query<{ action: string; resource: string; resource_id: string }>(
        "SELECT action, resource, resource_id FROM audit_event WHERE action = 'requeue-outbox'",
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0]?.resource, 'integration_outbox');

      // ID yang tidak ada → 404, bukan 200 palsu.
      const missing = await route.POST(
        new Request('https://pmii.example/admin/api/outbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({ id: 999 }),
        }),
      );
      assert.equal(missing.status, 404);

      // Body tanpa id → 422 validasi.
      const invalid = await route.POST(
        new Request('https://pmii.example/admin/api/outbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
          body: JSON.stringify({}),
        }),
      );
      assert.equal(invalid.status, 422);
    });
  });
});

test('the admin outbox mutation rejects a cross-origin request before touching data', async () => {
  const route = await import('../../src/app/api/admin/outbox/route.js');
  await withTestDatabase(async (database) => {
    const token = await createAdminSession(database);
    await withAdminSession(token, async () => {
      const response = await route.POST(
        new Request('https://pmii.example/admin/api/outbox', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
          body: JSON.stringify({ id: 1 }),
        }),
      );
      assert.equal(response.status, 403);
      const audit = await database.query('SELECT id FROM audit_event');
      assert.deepEqual(audit.rows, [], 'request lintas-origin tidak boleh menulis audit');
    });
  });
});

test('the private media endpoint audits a successful read and hides non-finalized or unknown files', async () => {
  const route = await import('../../src/app/api/admin/mapaba/registrations/[id]/media/[kind]/route.js');
  const privateStorage = await import('../../src/server/storage/private-storage.js');

  await withTempCwd(async () => {
    await withTestDatabase(async (database) => {
      const token = await createAdminSession(database);

      const hex = randomBytes(24).toString('hex');
      const objectKey = `mapaba-private/${hex}/pasFoto`;
      const media = await database.query<{ id: string }>(
        `INSERT INTO media_asset (bucket, object_key, mime_type, byte_size, owner_scope, state, visibility, finalized_at)
         VALUES ('private-mapaba', $1, 'image/jpeg', 16, 'draft:x', 'finalized', 'private', now())
         RETURNING id`,
        [objectKey],
      );
      // Tulis objek nyata pada jalur lokal yang sama dengan yang dibaca route.
      await privateStorage.putPrivateImage({
        kind: 'pasFoto',
        file: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])], 'a.jpg', {
          type: 'image/jpeg',
        }),
        contentType: 'image/jpeg',
        randomHex: hex,
      });

      await database.query(
        `INSERT INTO mapaba_event (id, title, edition, dates_label, location_label, quota,
                                   contribution_label, opens_at, closes_at, faculty)
         VALUES (1, 'MAPABA', '2026', '6-8 Nov 2026', 'Bandung', 100, 'Rp75.000',
                 now() - interval '1 day', now() + interval '30 days', 'Sains dan Teknologi')`,
      );
      const registration = await database.query<{ id: string }>(
        `INSERT INTO mapaba_registration
           (event_id, registration_number, full_name, nim, angkatan, university, faculty, study_program,
            whatsapp, email, gender, origin_region, motivation, info_source,
            photo_media_id, consent_program, consent_data)
         VALUES (1, 'MPB-2026-0001', 'Peserta', '1234567890', '2026', 'UIN', 'Sains dan Teknologi', 'Informatika',
                 '081234567890', 'a@b.c', 'L', 'Bandung', 'Motivasi', 'Instagram',
                 $1, true, true)
         RETURNING id`,
        [media.rows[0]!.id],
      );
      const id = registration.rows[0]!.id;

      await withAdminSession(token, async () => {
        const response = await route.GET(
          new Request(`https://pmii.example/admin/api/mapaba/registrations/${id}/media/photo`),
          { params: Promise.resolve({ id, kind: 'photo' }) },
        );
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), 'image/jpeg');
        assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
        assert.match(response.headers.get('content-disposition') ?? '', /inline; filename="mapaba-\d+-photo\.jpg"/);
        const bytes = new Uint8Array(await response.arrayBuffer());
        assert.equal(bytes[0], 0xff, 'isi berkas harus dikirim apa adanya');

        const audit = await database.query<{ action: string; resource: string; resource_id: string; outcome: string }>(
          "SELECT action, resource, resource_id, outcome FROM audit_event WHERE action = 'read-media'",
        );
        assert.equal(audit.rows.length, 1);
        assert.equal(audit.rows[0]?.resource, 'mapaba_registration');
        assert.equal(audit.rows[0]?.resource_id, `${id}:photo`);
        assert.equal(audit.rows[0]?.outcome, 'success');

        // KTM belum ada untuk pendaftaran ini → 404, bukan 500.
        const missingMedia = await route.GET(
          new Request(`https://pmii.example/admin/api/mapaba/registrations/${id}/media/ktm`),
          { params: Promise.resolve({ id, kind: 'ktm' }) },
        );
        assert.equal(missingMedia.status, 404);

        // Jenis berkas tidak dikenal → 404.
        const unknownKind = await route.GET(
          new Request(`https://pmii.example/admin/api/mapaba/registrations/${id}/media/rahasia`),
          { params: Promise.resolve({ id, kind: 'rahasia' }) },
        );
        assert.equal(unknownKind.status, 404);

        // ID bukan angka → 404, bukan 500.
        const badId = await route.GET(
          new Request('https://pmii.example/admin/api/mapaba/registrations/abc/media/photo'),
          { params: Promise.resolve({ id: 'abc', kind: 'photo' }) },
        );
        assert.equal(badId.status, 404);
      });

      // Tanpa sesi admin → 401 dan tidak ada audit sukses tambahan.
      await withAdminSession(null, async () => {
        const anonymous = await route.GET(
          new Request(`https://pmii.example/admin/api/mapaba/registrations/${id}/media/photo`),
          { params: Promise.resolve({ id, kind: 'photo' }) },
        );
        assert.equal(anonymous.status, 401);
      });
      const auditCount = await database.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM audit_event WHERE action = 'read-media'",
      );
      assert.equal(auditCount.rows[0]?.count, '1', 'akses anonim tidak boleh menulis audit sukses');
    });
  });
});
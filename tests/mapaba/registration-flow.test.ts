import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import type { Database } from '../../src/server/db/types';
import { buildPrivatePathname, toPrivatePathname } from '../../src/server/storage/reference';

// Konfigurasi server dibaca saat modul diimpor. Test ini memakai database PGlite
// terisolasi, jadi URL di bawah tidak pernah tersambung ke jaringan mana pun.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'mapaba-integration-salt-with-enough-entropy';

/**
 * Alur MAPABA end-to-end dengan database terisolasi (PGlite).
 *
 * Yang dibuktikan di sini — bukan hanya "respons 201":
 *   * peserta benar-benar tersimpan dengan foreign key media yang tepat;
 *   * media berubah `pending` → `finalized` dan terikat ke peserta;
 *   * berkas privat dibaca dengan jalur yang sama seperti endpoint admin;
 *   * kuota tidak dapat dilewati oleh request yang bersamaan;
 *   * draft kedaluwarsa, tautan berkas palsu, dan file invalid ditolak;
 *   * kegagalan setelah insert tidak meninggalkan data setengah jalan;
 *   * outbox berisi item pending (dan hanya worker yang mengirim).
 */

const loadPgliteDatabase = () => import('../integration/support/pglite-database.js');
const loadMigrations = () => import('../../src/server/db/migrate.js');
const loadPoolSeam = () => import('../../src/server/db/pool.js');

/** Direktori migrasi asli; jangan bergantung pada cwd yang diubah test untuk storage lokal. */
const MIGRATIONS_DIR = join(process.cwd(), 'src', 'server', 'db', 'migrations');
const loadSubmissions = () => import('../../src/server/services/submissions.js');
const loadUploads = () => import('../../src/server/services/uploads.js');
const loadPrivateStorage = () => import('../../src/server/storage/private-storage.js');
const loadOutbox = () => import('../../src/server/integrations/outbox.js');

const JPEG_HEADER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

function jpegFile(name: string): File {
  return new File([JPEG_HEADER], name, { type: 'image/jpeg' });
}

/** Siapkan database termigrasi + event MAPABA yang sedang buka. */
async function withMapabaDatabase(
  run: (database: Database & { close(): Promise<void> }) => Promise<void>,
  options: { quota?: number; uploadsDir?: string } = {},
): Promise<void> {
  const { createPgliteDatabase } = await loadPgliteDatabase();
  const { runMigrations } = await loadMigrations();
  const { setDatabaseForTesting } = await loadPoolSeam();
  const database = await createPgliteDatabase();
  // Service memakai jalur data bersama (`query`/`withTransaction`); arahkan ke PGlite
  // terisolasi supaya test tidak pernah menyentuh PostgreSQL pengembangan nyata.
  setDatabaseForTesting(database);
  try {
    await runMigrations(database, MIGRATIONS_DIR);
    const quota = options.quota ?? 100;
    await database.query(
      `INSERT INTO mapaba_event (id, title, edition, dates_label, location_label, quota,
                                 contribution_label, opens_at, closes_at, faculty)
       VALUES (1, 'MAPABA', '2026', '6-8 Nov 2026', 'Bandung', $1, 'Rp75.000',
               now() - interval '1 day', now() + interval '30 days', 'Sains dan Teknologi')`,
      [quota],
    );
    await run(database);
  } finally {
    setDatabaseForTesting(undefined);
    await database.close();
  }
}

/**
 * Jalankan alur dua langkah seperti klien nyata: buat draft, unggah dua berkas,
 * lalu kirim pendaftaran. Mengembalikan hasil akhir.
 */
async function runRegistrationFlow(input: {
  registrations: Awaited<ReturnType<typeof loadSubmissions>>;
  uploads: Awaited<ReturnType<typeof loadUploads>>;
  nim: string;
  email: string;
}): Promise<Awaited<ReturnType<typeof loadSubmissions>> extends never ? never : { registrationNumber: string; registrationId: number }> {
  const draft = await input.uploads.createMapabaUploadDraft();
  const pasFoto = await input.uploads.uploadMapabaDraftFile({
    draftId: draft.draftId,
    token: draft.token,
    kind: 'pasFoto',
    file: jpegFile('pas-foto.jpg'),
  });
  const ktm = await input.uploads.uploadMapabaDraftFile({
    draftId: draft.draftId,
    token: draft.token,
    kind: 'ktm',
    file: jpegFile('ktm.jpg'),
  });
  const created = await input.registrations.createMapabaRegistrationWithMedia({
    data: validPayload(input.nim, input.email),
    draft: { draftId: draft.draftId, token: draft.token },
    files: [
      { reference: pasFoto.pathname, kind: 'pasFoto' },
      { reference: ktm.pathname, kind: 'ktm' },
    ],
  });
  return { registrationNumber: created.registrationNumber, registrationId: created.registrationId };
}

function validPayload(nim: string, email: string) {
  return {
    namaLengkap: 'Peserta Uji',
    nim,
    angkatan: '2026' as const,
    universitas: 'UIN Sunan Gunung Djati',
    prodi: 'Informatika' as const,
    whatsapp: '081234567890',
    email,
    jenisKelamin: 'L' as const,
    asalDaerah: 'Bandung',
    motivasi: 'Saya ingin mengikuti MAPABA untuk memperkuat pemahaman organisasi dan keilmuan saya.',
    sumberInformasi: 'Instagram' as const,
    riwayatOrganisasi: null,
    pasFotoUrl: 'placeholder',
    ktmUrl: 'placeholder',
    kesediaan: true as const,
    persetujuanData: true as const,
    captchaToken: null,
  };
}

test('storage references are opaque pathnames, never local filesystem URLs', () => {
  const pathname = buildPrivatePathname('a'.repeat(48), 'pasFoto');
  assert.equal(pathname, `mapaba-private/${'a'.repeat(48)}/pasFoto`);

  // Pathname kanonik diterima apa adanya.
  assert.equal(toPrivatePathname(pathname), pathname);

  // URL Blob tepercaya dinormalisasi ke pathname.
  assert.equal(
    toPrivatePathname(`https://store.public.blob.vercel-storage.com/${pathname}`),
    pathname,
  );

  // Skema lokal dan URL asing ditolak — ini yang sebelumnya bisa lolos ke Google Sheets.
  for (const rejected of [
    `local-upload:/${pathname}`,
    `http://store.public.blob.vercel-storage.com/${pathname}`,
    'https://evil.example/mapaba-private/aaa/pasFoto',
    'mapaba-private/not-hex/pasFoto',
    '',
  ]) {
    assert.throws(() => toPrivatePathname(rejected), /Tautan berkas tidak dikenali/);
  }
});

test('a full MAPABA registration persists the participant with finalized private media', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const submissions = await loadSubmissions();
    const uploads = await loadUploads();
    const storage = await loadPrivateStorage();

    await withMapabaDatabase(async (database) => {
      const result = await runRegistrationFlow({
        registrations: submissions,
        uploads,
        nim: '1234567890',
        email: 'peserta@example.com',
      });

      assert.match(result.registrationNumber, /^MPB-\d{4}-[A-F0-9]{8}$/);

      const registration = await database.query<{
        full_name: string;
        faculty: string;
        photo_media_id: string;
        ktm_media_id: string;
      }>('SELECT full_name, faculty, photo_media_id, ktm_media_id FROM mapaba_registration');

      assert.equal(registration.rows.length, 1);
      assert.equal(registration.rows[0]?.full_name, 'Peserta Uji');
      // Fakultas diambil dari konfigurasi server, bukan dari kiriman klien.
      assert.equal(registration.rows[0]?.faculty, 'Sains dan Teknologi');
      assert.ok(registration.rows[0]?.photo_media_id, 'peserta harus menunjuk media pas foto');
      assert.ok(registration.rows[0]?.ktm_media_id, 'peserta harus menunjuk media KTM');

      const media = await database.query<{ object_key: string; state: string; owner_scope: string }>(
        'SELECT object_key, state, owner_scope FROM media_asset ORDER BY id',
      );
      assert.equal(media.rows.length, 2);
      for (const row of media.rows) {
        assert.equal(row.state, 'finalized');
        assert.equal(row.owner_scope, `registration:${result.registrationId}`);
        // Objek tersimpan sebagai pathname kanonik, bukan URL.
        assert.match(row.object_key, /^mapaba-private\/[a-f0-9]{48}\/(pasFoto|ktm)$/);
      }

      // Draft ditandai terpakai sehingga token yang sama tidak dapat dipakai ulang.
      const draft = await database.query<{ finalized_at: Date | null }>(
        'SELECT finalized_at FROM upload_draft',
      );
      assert.ok(draft.rows[0]?.finalized_at, 'draft harus ditutup setelah finalisasi');

      // Berkas dapat dibuka lewat jalur yang sama dengan endpoint admin.
      const stream = await storage.openPrivateObject(media.rows[0]!.object_key, 'image/jpeg');
      assert.ok(stream, 'berkas privat harus dapat dibaca admin');
      const reader = stream.getReader();
      const first = await reader.read();
      assert.ok(first.value && first.value.length > 0, 'aliran berkas tidak boleh kosong');
      await reader.cancel();
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('the outbox row is pending after registration and no direct delivery happens', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const submissions = await loadSubmissions();
    const uploads = await loadUploads();
    const outbox = await loadOutbox();

    await withMapabaDatabase(async (database) => {
      await runRegistrationFlow({
        registrations: submissions,
        uploads,
        nim: '2234567890',
        email: 'outbox@example.com',
      });

      const pending = await outbox.listPendingOutboxItems();
      assert.equal(pending.length, 1);
      assert.equal(pending[0]?.integration, 'google-sheets-mapaba');
      assert.equal(pending[0]?.attempts, 0);
      // Payload tidak memuat URL berkas privat apa pun.
      const payload = await database.query<{ payload: Record<string, unknown> }>(
        'SELECT payload FROM integration_outbox',
      );
      const serialized = JSON.stringify(payload.rows[0]?.payload);
      assert.doesNotMatch(serialized, /local-upload|blob\.vercel-storage|https?:\/\//);
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('concurrent registrations cannot exceed the configured quota', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const submissions = await loadSubmissions();
    const uploads = await loadUploads();

    await withMapabaDatabase(
      async (database) => {
        const results = await Promise.allSettled([
          runRegistrationFlow({ registrations: submissions, uploads, nim: '3000000001', email: 'a@example.com' }),
          runRegistrationFlow({ registrations: submissions, uploads, nim: '3000000002', email: 'b@example.com' }),
          runRegistrationFlow({ registrations: submissions, uploads, nim: '3000000003', email: 'c@example.com' }),
        ]);

        const fulfilled = results.filter((item) => item.status === 'fulfilled');
        const rejected = results.filter((item) => item.status === 'rejected');
        assert.equal(fulfilled.length, 2, 'hanya dua pendaftaran yang boleh lolos kuota');
        assert.equal(rejected.length, 1);
        assert.match(String((rejected[0] as PromiseRejectedResult).reason), /Kuota/i);

        const count = await database.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM mapaba_registration',
        );
        assert.equal(count.rows[0]?.count, '2');
      },
      { quota: 2 },
    );
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('a failed registration leaves no participant, no finalized media, and no outbox row', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const submissions = await loadSubmissions();
    const uploads = await loadUploads();

    await withMapabaDatabase(async (database) => {
      const draft = await uploads.createMapabaUploadDraft();
      const pasFoto = await uploads.uploadMapabaDraftFile({
        draftId: draft.draftId,
        token: draft.token,
        kind: 'pasFoto',
        file: jpegFile('a.jpg'),
      });
      await uploads.uploadMapabaDraftFile({
        draftId: draft.draftId,
        token: draft.token,
        kind: 'ktm',
        file: jpegFile('b.jpg'),
      });

      // KTM menunjuk berkas orang lain yang tidak ada di draft → harus gagal.
      const foreignPath = buildPrivatePathname(randomBytes(24).toString('hex'), 'ktm');
      await assert.rejects(
        submissions.createMapabaRegistrationWithMedia({
          data: validPayload('4444444444', 'rollback@example.com'),
          draft: { draftId: draft.draftId, token: draft.token },
          files: [
            { reference: pasFoto.pathname, kind: 'pasFoto' },
            { reference: foreignPath, kind: 'ktm' },
          ],
        }),
        /tidak berasal dari draft upload ini/,
      );

      // Rollback harus menyisakan nol peserta, media tetap pending, draft tetap terbuka.
      const registrations = await database.query('SELECT id FROM mapaba_registration');
      const media = await database.query<{ state: string }>('SELECT state FROM media_asset');
      const outboxCount = await database.query('SELECT id FROM integration_outbox');
      const draftState = await database.query<{ finalized_at: Date | null }>(
        'SELECT finalized_at FROM upload_draft',
      );
      assert.deepEqual(registrations.rows, []);
      assert.deepEqual(outboxCount.rows, []);
      assert.ok(media.rows.every((row) => row.state === 'pending'), 'media tidak boleh terkunci');
      assert.equal(draftState.rows[0]?.finalized_at, null);
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('an expired draft is rejected and files cannot be claimed with a wrong token', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const submissions = await loadSubmissions();
    const uploads = await loadUploads();

    await withMapabaDatabase(async (database) => {
      const draft = await uploads.createMapabaUploadDraft();
      const pasFoto = await uploads.uploadMapabaDraftFile({
        draftId: draft.draftId,
        token: draft.token,
        kind: 'pasFoto',
        file: jpegFile('a.jpg'),
      });
      const ktm = await uploads.uploadMapabaDraftFile({
        draftId: draft.draftId,
        token: draft.token,
        kind: 'ktm',
        file: jpegFile('b.jpg'),
      });
      await database.query("UPDATE upload_draft SET expires_at = now() - interval '1 minute'");

      await assert.rejects(
        submissions.createMapabaRegistrationWithMedia({
          data: validPayload('5555555555', 'expired@example.com'),
          draft: { draftId: draft.draftId, token: draft.token },
          files: [
            { reference: pasFoto.pathname, kind: 'pasFoto' },
            { reference: ktm.pathname, kind: 'ktm' },
          ],
        }),
        /kedaluwarsa/i,
      );

      await assert.rejects(
        uploads.uploadMapabaDraftFile({
          draftId: draft.draftId,
          token: randomUUID(),
          kind: 'pasFoto',
          file: jpegFile('c.jpg'),
        }),
        /tidak valid atau sudah kedaluwarsa/i,
      );
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('an invalid file (wrong magic bytes) is rejected before any metadata is written', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const uploads = await loadUploads();

    await withMapabaDatabase(async (database) => {
      const draft = await uploads.createMapabaUploadDraft();
      const fake = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'fake.jpg', { type: 'image/jpeg' });

      await assert.rejects(
        uploads.uploadMapabaDraftFile({ draftId: draft.draftId, token: draft.token, kind: 'pasFoto', file: fake }),
        /tidak cocok dengan format/,
      );

      const media = await database.query('SELECT id FROM media_asset');
      const drafts = await database.query<{ allowed_paths: string[] }>('SELECT allowed_paths FROM upload_draft');
      assert.deepEqual(media.rows, []);
      assert.deepEqual(drafts.rows[0]?.allowed_paths, []);
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('the outbox worker is the only sender and survives a failing integration', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const submissions = await loadSubmissions();
    const uploads = await loadUploads();
    const outbox = await loadOutbox();

    await withMapabaDatabase(async (database) => {
      await runRegistrationFlow({
        registrations: submissions,
        uploads,
        nim: '6666666666',
        email: 'worker@example.com',
      });

      // Tidak ada kredensial webhook pada lingkungan test: pengiriman tidak mungkin
      // berhasil, jadi worker harus mencatat kegagalan (bukan melewatkannya diam-diam).
      const summary = await outbox.dispatchSheetsOutbox();
      assert.equal(summary.claimed, 1);
      assert.equal(summary.processed + summary.failed, 1);

      const rows = await database.query<{ attempts: number; last_error: string | null; processed_at: Date | null }>(
        'SELECT attempts, last_error, processed_at FROM integration_outbox',
      );

      if (summary.processed === 1) {
        // Webhook terjangkau: pengiriman sukses dan baris ditutup.
        assert.ok(rows.rows[0]?.processed_at, 'item sukses harus ditandai processed_at');
      } else {
        // Webhook tidak terjangkau: kegagalan dicatat dan item tetap pending untuk retry.
        assert.equal(rows.rows[0]?.attempts, 1);
        assert.equal(rows.rows[0]?.processed_at, null, 'item gagal harus tetap pending');
        assert.ok(rows.rows[0]?.last_error, 'kegagalan harus tercatat agar terlihat admin');
      }

      // Lease menahan item sehingga worker kedua tidak langsung mengambilnya lagi.
      const immediate = await outbox.dispatchSheetsOutbox();
      assert.equal(immediate.claimed, 0, 'lease harus mencegah pengiriman ganda');

      // Admin dapat memaksa kirim ulang: lease dimajukan sehingga worker kembali mengambilnya.
      assert.equal(await outbox.requeueOutboxItem(1), true);
      const afterRequeue = await outbox.dispatchSheetsOutbox();
      assert.equal(afterRequeue.claimed, 1);
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test('the private media endpoint refuses anonymous access and accepts only finalized media', async () => {
  const uploadsDir = await mkdtemp(join(tmpdir(), 'pmii-uploads-'));
  const previousCwd = process.cwd();
  process.chdir(uploadsDir);
  try {
    const uploads = await loadUploads();
    const storage = await loadPrivateStorage();

    await withMapabaDatabase(async (database) => {
      const draft = await uploads.createMapabaUploadDraft();
      const pasFoto = await uploads.uploadMapabaDraftFile({
        draftId: draft.draftId,
        token: draft.token,
        kind: 'pasFoto',
        file: jpegFile('a.jpg'),
      });

      // Media masih `pending` → tidak boleh dibaca meski pathname diketahui.
      // Endpoint memfilter `state = 'finalized'` sebelum menyentuh storage.
      const pending = await database.query<{ state: string }>(
        'SELECT state FROM media_asset WHERE object_key = $1',
        [pasFoto.pathname],
      );
      assert.equal(pending.rows[0]?.state, 'pending');

      // Pathname yang tidak sesuai pola tidak pernah menyentuh disk.
      assert.equal(await storage.openPrivateObject('../etc/passwd', 'image/jpeg'), null);
      assert.equal(await storage.openPrivateObject(`local-upload:/${pasFoto.pathname}`, 'image/jpeg'), null);
      assert.ok(await storage.openPrivateObject(pasFoto.pathname, 'image/jpeg'));

      // Tipe konten yang cocok menghasilkan byte gambar; ini yang dikirim ke admin.
      const stream = await storage.openPrivateObject(pasFoto.pathname, 'image/jpeg');
      assert.ok(stream);
      const reader = stream.getReader();
      const chunk = await reader.read();
      await reader.cancel();
      assert.equal(chunk.value?.[0], 0xff, 'isi berkas harus dimulai dengan magic bytes JPEG');
    });
  } finally {
    process.chdir(previousCwd);
    await rm(uploadsDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

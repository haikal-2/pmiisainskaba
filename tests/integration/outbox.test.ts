import assert from 'node:assert/strict';
import test from 'node:test';

// Config dibaca saat impor; PGlite terisolasi tidak pernah menyentuh jaringan.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'outbox-integration-salt-with-enough-entropy';

import { withTestDatabase } from './support/test-db.js';

/**
 * Outbox worker: klaim berbasis lease, satu jalur kirim, dan pemulihan.
 *
 * Pengiriman keluar diuji lewat seam `fetch` yang di-stub — tidak pernah ada
 * permintaan jaringan nyata. Yang dibuktikan: klaim memakai lease sehingga worker
 * kedua tidak mengirim ulang; kegagalan dijadwalkan ulang dengan backoff dan tetap
 * terlihat admin; `requeueOutboxItem` memaksa kirim ulang; payload yang dikirim
 * memakai kontrak kunci yang sama dengan penulis.
 */

const loadOutbox = () => import('../../src/server/integrations/outbox.js');
const loadConfig = () => import('../../src/server/config.js');

type FetchCall = { url: string; body: unknown };

const mapabaPayload = {
  registrationNumber: 'MPB-2026-0001',
  fullName: 'Peserta Uji',
  nim: '1234567890',
  generation: '2026',
  university: 'UIN Sunan Gunung Djati',
  studyProgram: 'Informatika',
  faculty: 'Sains dan Teknologi',
  whatsapp: '081234567890',
  email: 'peserta@example.com',
  gender: 'L',
  originRegion: 'Bandung',
  motivation: 'Motivasi',
  source: 'Instagram',
  organizationHistory: null,
  createdAt: '2026-03-04T05:06:07.000Z',
};

async function withStubbedFetch(
  handler: (call: FetchCall) => Response,
  run: (calls: FetchCall[]) => Promise<void>,
): Promise<void> {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const raw = typeof init?.body === 'string' ? init.body : '';
    let body: unknown = raw;
    try {
      body = raw ? JSON.parse(raw) : raw;
    } catch {
      // biarkan sebagai string mentah
    }
    const call = { url, body };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function withSheetsConfig(
  values: { mapaba?: string; advocacy?: string },
  run: () => Promise<void>,
): Promise<void> {
  const { default: config } = await loadConfig();
  const sheets = config.googleSheets as unknown as {
    mapabaWebhookUrl: string;
    advocacyWebhookUrl: string;
  };
  const previous = { mapabaWebhookUrl: sheets.mapabaWebhookUrl, advocacyWebhookUrl: sheets.advocacyWebhookUrl };
  sheets.mapabaWebhookUrl = values.mapaba ?? '';
  sheets.advocacyWebhookUrl = values.advocacy ?? '';
  try {
    await run();
  } finally {
    sheets.mapabaWebhookUrl = previous.mapabaWebhookUrl;
    sheets.advocacyWebhookUrl = previous.advocacyWebhookUrl;
  }
}

function insertMapaba(database: { query: (text: string, values?: readonly unknown[]) => Promise<unknown> }, eventKey: string) {
  return database.query(
    `INSERT INTO integration_outbox (integration, event_key, payload)
     VALUES ('google-sheets-mapaba', $1, $2::jsonb)`,
    [eventKey, JSON.stringify(mapabaPayload)],
  );
}

test('a successful dispatch delivers once, marks the row processed, and clears the lease', async () => {
  const { dispatchSheetsOutbox, listPendingOutboxItems } = await loadOutbox();
  await withTestDatabase(async (database) => {
    await insertMapaba(database, 'mapaba-ok-1');

    await withSheetsConfig({ mapaba: 'https://hooks.example/mapaba' }, () =>
      withStubbedFetch(
        () => Response.json({ ok: true }),
        async (calls) => {
          const summary = await dispatchSheetsOutbox();
          assert.equal(summary.claimed, 1);
          assert.equal(summary.processed, 1);
          assert.equal(summary.failed, 0);
          assert.equal(calls.length, 1, 'hanya satu pengiriman keluar');
          assert.equal(calls[0]?.url, 'https://hooks.example/mapaba');
          // Kontrak kunci sesuai yang ditulis penulis (`buildMapabaOutboxPayload`).
          const body = calls[0]?.body as Record<string, unknown>;
          assert.equal(body.nomorRegistrasi, 'MPB-2026-0001');
          assert.equal(body.fullName, 'Peserta Uji');
          assert.equal(body.email, 'peserta@example.com');
        },
      ),
    );

    const rows = await database.query<{ processed_at: Date | null; attempts: number; lease_owner: string | null; last_error: string | null }>(
      'SELECT processed_at, attempts, lease_owner, last_error FROM integration_outbox',
    );
    assert.ok(rows.rows[0]?.processed_at, 'baris sukses harus ditandai processed_at');
    assert.equal(rows.rows[0]?.lease_owner, null, 'lease harus dilepas setelah sukses');
    assert.equal(rows.rows[0]?.last_error, null);
    assert.deepEqual(await listPendingOutboxItems(), [], 'tidak ada item pending setelah sukses');
  });
});

test('a failing dispatch schedules a backoff retry, records the error, and is invisible to a second worker', async () => {
  const { dispatchSheetsOutbox, listPendingOutboxItems, requeueOutboxItem } = await loadOutbox();
  await withTestDatabase(async (database) => {
    await insertMapaba(database, 'mapaba-fail-1');

    await withSheetsConfig({ mapaba: 'https://hooks.example/mapaba' }, () =>
      withStubbedFetch(
        () => new Response('boom', { status: 500 }),
        async () => {
          const first = await dispatchSheetsOutbox();
          assert.equal(first.claimed, 1);
          assert.equal(first.failed, 1);
          assert.equal(first.processed, 0);

          // Lease + backoff menahan item dari worker berikutnya.
          const second = await dispatchSheetsOutbox();
          assert.equal(second.claimed, 0, 'backoff harus menahan pengiriman ulang');
        },
      ),
    );

    const pending = await database.query<{
      attempts: number;
      last_error: string | null;
      processed_at: Date | null;
      lease_owner: string | null;
      available_in_future: boolean;
    }>(
      `SELECT attempts, last_error, processed_at, lease_owner,
              available_at > now() AS available_in_future
       FROM integration_outbox`,
    );
    const row = pending.rows[0]!;
    assert.equal(row.attempts, 1);
    assert.equal(row.processed_at, null, 'item gagal tetap pending');
    assert.equal(row.lease_owner, null, 'lease dilepas agar dapat diambil ulang');
    assert.equal(row.available_in_future, true, 'retry dijadwalkan ke masa depan');
    // Hanya nama error, bukan pesan mentah.
    assert.equal(row.last_error, 'Error');

    // Admin melihat item gagal.
    const listed = await listPendingOutboxItems();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.attempts, 1);
    assert.equal(listed[0]?.lastError, 'Error');

    // Admin memaksa kirim ulang: jadwal dimajukan dan lease dilepas.
    assert.equal(await requeueOutboxItem(listed[0]!.id), true);
    assert.equal(await requeueOutboxItem(listed[0]!.id), true, 'requeue idempoten selama belum diproses');

    await withSheetsConfig({ mapaba: 'https://hooks.example/mapaba' }, () =>
      withStubbedFetch(
        () => Response.json({ ok: true }),
        async (calls) => {
          const retried = await dispatchSheetsOutbox();
          assert.equal(retried.claimed, 1, 'requeue harus membuat item dapat dikirim ulang segera');
          assert.equal(retried.processed, 1);
          assert.equal(calls.length, 1);
        },
      ),
    );
  });
});

test('the batch size bounds how many rows one worker claims at a time', async () => {
  const { dispatchSheetsOutbox } = await loadOutbox();
  await withTestDatabase(async (database) => {
    for (let index = 0; index < 5; index += 1) {
      await insertMapaba(database, `mapaba-batch-${index}`);
    }

    await withSheetsConfig({ mapaba: 'https://hooks.example/mapaba' }, () =>
      withStubbedFetch(
        () => Response.json({ ok: true }),
        async () => {
          const summary = await dispatchSheetsOutbox(2);
          assert.equal(summary.claimed, 2, 'klaim dibatasi batchSize');
          assert.equal(summary.processed, 2);
        },
      ),
    );

    const remaining = await database.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM integration_outbox WHERE processed_at IS NULL",
    );
    assert.equal(remaining.rows[0]?.count, '3');
  });
});

test('requeueOutboxItem refuses to resurrect an already-processed row', async () => {
  const { dispatchSheetsOutbox, requeueOutboxItem } = await loadOutbox();
  await withTestDatabase(async (database) => {
    await insertMapaba(database, 'mapaba-done-1');

    await withSheetsConfig({ mapaba: 'https://hooks.example/mapaba' }, () =>
      withStubbedFetch(
        () => Response.json({ ok: true }),
        async () => {
          await dispatchSheetsOutbox();
        },
      ),
    );

    assert.equal(await requeueOutboxItem(1), false, 'baris terkirim tidak boleh dijadwalkan ulang');
    assert.equal(await requeueOutboxItem(999), false, 'id tidak dikenal juga false');
  });
});

test('an advocacy row is delivered through the same single worker to its own webhook', async () => {
  const { dispatchSheetsOutbox } = await loadOutbox();
  await withTestDatabase(async (database) => {
    await database.query(
      `INSERT INTO integration_outbox (integration, event_key, payload)
       VALUES ('google-sheets-advocacy', 'adv-1', $1::jsonb)`,
      [JSON.stringify({ ticket: 'ADV-2026-0001', category: 'Akademik', contact: '0800', status: 'Baru', chronology: 'x', confidential: true, consent: true, createdAt: '2026-03-04T05:06:07.000Z' })],
    );

    await withSheetsConfig({ advocacy: 'https://hooks.example/advokasi' }, () =>
      withStubbedFetch(
        () => Response.json({ ok: true }),
        async (calls) => {
          const summary = await dispatchSheetsOutbox();
          assert.equal(summary.processed, 1);
          assert.equal(calls.length, 1);
          assert.equal(calls[0]?.url, 'https://hooks.example/advokasi');
          const body = calls[0]?.body as Record<string, unknown>;
          assert.equal(body.nomorTiket, 'ADV-2026-0001');
          assert.equal(body.anonim, 'Ya', 'confidential=true harus tampil sebagai anonim=Ya');
        },
      ),
    );
  });
});

test('without a configured webhook delivery fails hard but the row is preserved for retry', async () => {
  const { dispatchSheetsOutbox } = await loadOutbox();
  await withTestDatabase(async (database) => {
    await insertMapaba(database, 'mapaba-nocred-1');

    // Tidak ada webhook dan tidak ada service account: pengiriman tidak mungkin.
    await withSheetsConfig({}, () =>
      withStubbedFetch(
        () => {
          throw new Error('fetch tidak boleh dipanggil tanpa webhook');
        },
        async (calls) => {
          const summary = await dispatchSheetsOutbox();
          assert.equal(summary.claimed, 1);
          assert.equal(summary.failed, 1);
          assert.equal(calls.length, 0, 'tidak ada permintaan keluar tanpa konfigurasi');
        },
      ),
    );

    const rows = await database.query<{ attempts: number; processed_at: Date | null; last_error: string | null }>(
      'SELECT attempts, processed_at, last_error FROM integration_outbox',
    );
    assert.equal(rows.rows[0]?.attempts, 1);
    assert.equal(rows.rows[0]?.processed_at, null);
    assert.equal(rows.rows[0]?.last_error, 'AppError:DEPENDENCY_UNAVAILABLE');
  });
});
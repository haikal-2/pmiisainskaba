import 'server-only';

import { randomUUID } from 'node:crypto';

import { query } from '@/server/db/pool';
import { sendAdvocacyToSheets, sendMapabaToSheets } from '@/server/integrations/google-sheets';
import {
  parseAdvocacyOutboxPayload,
  parseMapabaOutboxPayload,
  type OutboxIntegration,
} from '@/server/integrations/outbox-payload';
import { logDependencyFailure, logEvent } from '@/server/observability/logger';

/**
 * Worker outbox untuk sinkronisasi Google Sheets.
 *
 * Kontrak yang dipegang:
 *   * Proses penulisan (`services/submissions.ts`) hanya menulis baris outbox. Tidak ada
 *     pengiriman real-time dari request pengguna, sehingga tidak ada pengiriman ganda
 *     dan tidak ada request yang menunggu jaringan eksternal.
 *   * Hanya worker ini yang memanggil Google Sheets: worker terjadwal dan aksi admin
 *     memakai fungsi yang sama.
 *   * Klaim baris memakai lease milik worker (`lease_owner` + `available_at` dimajukan)
 *     supaya dua worker terjadwal tidak memproses baris yang sama, dan baris yang macet
 *     karena worker mati akan dicoba ulang setelah lease habis. Kepemilikan lease juga
 *     mencegah worker yang kehabisan waktu menandai `processed_at` untuk baris yang sudah
 *     dipegang worker lain.
 *   * Kegagalan mencatat nama/kode error saja — tanpa data pribadi peserta/pelapor.
 */

export type OutboxSummary = { processed: number; failed: number; claimed: number };

const LEASE_SECONDS = 300;

type OutboxRow = {
  id: string;
  integration: string;
  event_key: string;
  payload: Record<string, unknown>;
  attempts: number;
};

function isOutboxIntegration(value: string): value is OutboxIntegration {
  return value === 'google-sheets-mapaba' || value === 'google-sheets-advocacy';
}

export async function dispatchSheetsOutbox(batchSize = 20): Promise<OutboxSummary> {
  // Identitas pemegang lease unik per pemanggilan worker.
  const workerId = randomUUID();
  const claimed = await claimBatch(batchSize, workerId);
  let processed = 0;
  let failed = 0;

  for (const row of claimed) {
    if (!isOutboxIntegration(row.integration)) {
      // Baris dengan integrasi tak dikenal tidak boleh menjatuhkan seluruh batch.
      await releaseLease(row.id, workerId);
      failed += 1;
      logEvent('error', 'outbox.unknown-integration', {
        operation: 'outbox.dispatch',
        component: 'google-sheets',
        detail: row.integration,
        attempts: row.attempts,
      });
      continue;
    }

    const startedAt = Date.now();
    const attempt = row.attempts + 1;
    try {
      await deliver(row.integration, row.payload);
      await query(
        `UPDATE integration_outbox
         SET processed_at = now(), last_error = NULL, lease_owner = NULL
         WHERE id = $1 AND lease_owner = $2`,
        [row.id, workerId],
      );
      processed += 1;
      logEvent('info', 'outbox.delivered', {
        operation: 'outbox.dispatch',
        component: 'google-sheets',
        detail: row.integration,
        attempt,
        latencyMs: Date.now() - startedAt,
      });
    } catch (error) {
      const backoffSeconds = Math.min(3600, 15 * 2 ** Math.min(attempt, 8));
      // Retry hanya dijadwalkan bila lease masih milik worker ini; bila tidak, worker
      // lain sudah memiliki baris tersebut dan jadwalnya tidak boleh diturunkan.
      await query(
        `UPDATE integration_outbox
         SET attempts = $2,
             available_at = now() + ($3 * interval '1 second'),
             last_error = $4,
             lease_owner = NULL
         WHERE id = $1 AND lease_owner = $5`,
        [row.id, attempt, backoffSeconds, describeFailure(error), workerId],
      );
      failed += 1;
      logDependencyFailure({
        operation: 'outbox.dispatch',
        component: 'google-sheets',
        error,
        detail: row.integration,
        attempt,
        latencyMs: Date.now() - startedAt,
      });
    }
  }

  return { processed, failed, claimed: claimed.length };
}

async function claimBatch(batchSize: number, workerId: string): Promise<OutboxRow[]> {
  // Satu statement: pilih baris siap kirim, ambil lease-nya, lalu kembalikan.
  // `SKIP LOCKED` membuat worker paralel tidak saling menunggu.
  const result = await query<OutboxRow>(
    `UPDATE integration_outbox
     SET available_at = now() + ($2 * interval '1 second'), lease_owner = $3
     WHERE id IN (
       SELECT id FROM integration_outbox
       WHERE processed_at IS NULL AND available_at <= now()
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id::text, integration, event_key, payload, attempts`,
    [batchSize, LEASE_SECONDS, workerId],
  );
  return result.rows;
}

/** Lepas lease tanpa mengubah jadwal (dipakai untuk baris yang tidak dapat diproses). */
async function releaseLease(id: string, workerId: string): Promise<void> {
  await query(
    'UPDATE integration_outbox SET lease_owner = NULL, available_at = now() WHERE id = $1 AND lease_owner = $2',
    [id, workerId],
  );
}

function describeFailure(error: unknown): string {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? `${name}:${code}` : name;
}

function deliver(integration: OutboxIntegration, payload: Record<string, unknown>): Promise<void> {
  if (integration === 'google-sheets-advocacy') {
    return sendAdvocacyToSheets(parseAdvocacyOutboxPayload(payload));
  }
  return sendMapabaToSheets(parseMapabaOutboxPayload(payload));
}

export type OutboxItem = {
  id: number;
  integration: string;
  eventKey: string;
  attempts: number;
  availableAt: Date;
  lastError: string | null;
  createdAt: Date;
};

/** Item yang belum terkirim, untuk ditampilkan ke admin. */
export async function listPendingOutboxItems(limit = 50): Promise<OutboxItem[]> {
  const result = await query<{
    id: string;
    integration: string;
    event_key: string;
    attempts: number;
    available_at: Date;
    last_error: string | null;
    created_at: Date;
  }>(
    `SELECT id, integration, event_key, attempts, available_at, last_error, created_at
     FROM integration_outbox
     WHERE processed_at IS NULL
     ORDER BY available_at, id
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    integration: row.integration,
    eventKey: row.event_key,
    attempts: row.attempts,
    availableAt: row.available_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  }));
}

/**
 * Admin memaksa satu item dikirim ulang: lease dilepas dan dimajukan ke sekarang
 * sehingga worker berikutnya (terjadwal atau manual) segera mengambilnya.
 */
export async function requeueOutboxItem(id: number): Promise<boolean> {
  const result = await query(
    `UPDATE integration_outbox
     SET available_at = now(), last_error = NULL, lease_owner = NULL
     WHERE id = $1 AND processed_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) === 1;
}
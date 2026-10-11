import 'server-only';

import { query, withTransaction } from '@/server/db/pool';
import { appendAdvocacyTicket, appendMapabaRegistration } from '@/server/integrations/google-sheets';

type OutboxRecord = {
  id: number;
  integration: 'google-sheets-mapaba' | 'google-sheets-advocacy';
  event_key: string;
  payload: Record<string, unknown>;
  attempts: number;
};

/**
 * Kirim batch outbox ke Google Sheets. Dipanggil oleh cron internal.
 * Kunci baris pakai SKIP LOCKED agar beberapa worker tidak memproses baris sama.
 */
export async function dispatchSheetsOutbox(batchSize = 20): Promise<{ processed: number; failed: number }> {
  const rows = await withTransaction(async (client) => {
    const result = await client.query<OutboxRecord>(
      `SELECT id, integration, event_key, payload, attempts
       FROM integration_outbox
       WHERE processed_at IS NULL AND available_at <= now()
       ORDER BY id
       LIMIT $1
       FOR UPDATE SKIP LOCKED`,
      [batchSize],
    );
    return result.rows;
  });

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      if (row.integration === 'google-sheets-advocacy') {
        await appendAdvocacyTicket({
          ticket: String(row.payload.ticket ?? ''),
          category: String(row.payload.category ?? ''),
          createdAt: new Date(String(row.payload.createdAt ?? new Date().toISOString())),
        });
      } else {
        await appendMapabaRegistration({
          registrationNumber: String(row.payload.registrationNumber ?? ''),
          fullName: String(row.payload.fullName ?? ''),
          nim: String(row.payload.nim ?? ''),
          university: String(row.payload.university ?? ''),
          studyProgram: String(row.payload.studyProgram ?? ''),
          whatsapp: String(row.payload.whatsapp ?? ''),
          email: String(row.payload.email ?? ''),
          createdAt: new Date(String(row.payload.createdAt ?? new Date().toISOString())),
        });
      }
      await query(
        'UPDATE integration_outbox SET processed_at = now(), last_error = NULL WHERE id = $1',
        [row.id],
      );
      processed += 1;
    } catch (error) {
      const attempt = row.attempts + 1;
      const backoffSeconds = Math.min(3600, 15 * 2 ** Math.min(attempt, 8));
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      await query(
        `UPDATE integration_outbox
         SET attempts = $2,
             available_at = now() + ($3 * interval '1 second'),
             last_error = $4
         WHERE id = $1`,
        [row.id, attempt, backoffSeconds, errorName],
      );
      failed += 1;
    }
  }
  return { processed, failed };
}

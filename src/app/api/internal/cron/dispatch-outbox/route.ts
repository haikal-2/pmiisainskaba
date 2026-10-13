import { dispatchSheetsOutbox } from '@/server/integrations/outbox';
import { fail, ok } from '@/server/api/response';
import { assertCronAuthorized } from '@/server/security/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Worker outbox terjadwal.
 *
 * Dipanggil oleh Vercel Cron (lihat `vercel.json`) dengan
 * `Authorization: Bearer $CRON_SECRET`. Inilah satu-satunya jalur yang mengirim data
 * ke Google Sheets, sehingga spreadsheet tidak bisa "diam-diam ketinggalan" tanpa
 * terlihat: setiap baris pending dapat dilihat dan dikirim ulang dari panel admin.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    assertCronAuthorized(request);
    const summary = await dispatchSheetsOutbox(50);
    return ok(summary);
  } catch (error) {
    return fail(error, request, { operation: 'cron.dispatch' });
  }
}

export const POST = GET;

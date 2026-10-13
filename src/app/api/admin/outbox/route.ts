import { assertSameOrigin, requireAdmin, writeAuditEvent } from '@/server/auth/admin';
import { listPendingOutboxItems, requeueOutboxItem } from '@/server/integrations/outbox';
import { flattenFieldErrors, outboxRequeueSchema } from '@/server/schemas';
import { assertJsonBodySize } from '@/server/security/request-size';
import { fail, ok, withNoStore } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Visibilitas sinkronisasi Google Sheets untuk admin.
 *
 * Tanpa endpoint ini, kegagalan pengiriman hanya terlihat di log server — operator
 * tidak punya cara mengetahui spreadsheet tertinggal. GET menampilkan item yang belum
 * terkirim; POST memaksa satu item dikirim ulang pada siklus worker berikutnya.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();
    const items = await listPendingOutboxItems(100);
    return ok({ items }, 200, withNoStore());
  } catch (error) {
    return fail(error, request, { operation: 'admin.outbox.list' });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    await assertSameOrigin(request);
    const admin = await requireAdmin();
    assertJsonBodySize(request);
    const parsed = outboxRequeueSchema.safeParse(await request.json());
    if (!parsed.success) throw AppError.validation('Data permintaan tidak valid.', flattenFieldErrors(parsed.error));

    const requeued = await requeueOutboxItem(parsed.data.id);
    if (!requeued) throw AppError.notFound('Item sinkronisasi tidak ditemukan atau sudah terkirim.');

    await writeAuditEvent(admin.id, 'requeue-outbox', 'integration_outbox', String(parsed.data.id));
    return ok({ id: parsed.data.id, requeued: true }, 200, withNoStore());
  } catch (error) {
    return fail(error, request, { operation: 'admin.outbox.requeue' });
  }
}

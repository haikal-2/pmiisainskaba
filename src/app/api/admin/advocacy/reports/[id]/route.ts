import { queryOne, query, withTransaction } from '@/server/db/pool';
import { assertSameOrigin, requireAdmin, writeAuditEvent } from '@/server/auth/admin';
import { advocacyStatusSchema, flattenFieldErrors } from '@/server/schemas';
import { assertJsonBodySize } from '@/server/security/request-size';
import { fail, ok, withNoStore } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    await requireAdmin();
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isSafeInteger(id) || id < 1) throw AppError.notFound();
    const report = await queryOne(
      `SELECT id, ticket, reporter_name, contact, email, reporter_status, category,
              chronology, evidence_url, confidential, consent, status, created_at, updated_at
       FROM advocacy_report WHERE id = $1`, [id],
    );
    if (!report) throw AppError.notFound();
    const notes = await query(
      'SELECT id, body, created_at FROM advocacy_note WHERE report_id = $1 ORDER BY created_at DESC', [id],
    );
    return ok({ report, notes: notes.rows }, 200, withNoStore());
  } catch (error) { return fail(error, request, { operation: 'admin.advocacy.get' }); }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    await assertSameOrigin(request);
    const admin = await requireAdmin();
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isSafeInteger(id) || id < 1) throw AppError.notFound();
    assertJsonBodySize(request);
    const parsed = advocacyStatusSchema.safeParse(await request.json());
    if (!parsed.success) throw AppError.validation('Status tidak valid.', flattenFieldErrors(parsed.error));
    const changed = await queryOne(
      'UPDATE advocacy_report SET status = $2, updated_at = now() WHERE id = $1 RETURNING id, ticket, status',
      [id, parsed.data.status],
    );
    if (!changed) throw AppError.notFound();
    await writeAuditEvent(admin.id, 'update-status', 'advocacy_report', String(id));
    return ok(changed, 200, withNoStore());
  } catch (error) { return fail(error, request, { operation: 'admin.advocacy.update-status' }); }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    await assertSameOrigin(request);
    const admin = await requireAdmin();
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isSafeInteger(id) || id < 1) throw AppError.notFound();
    assertJsonBodySize(request);
    const body = (await request.json()) as { body?: unknown };
    if (typeof body.body !== 'string' || body.body.trim().length < 1 || body.body.length > 4000) {
      throw AppError.validation('Catatan harus 1–4000 karakter.');
    }
    const note = body.body.trim();
    const result = await withTransaction(async (client) => {
      const exists = await client.query('SELECT id FROM advocacy_report WHERE id = $1 FOR UPDATE', [id]);
      if (!exists.rowCount) throw AppError.notFound();
      return client.query(
        'INSERT INTO advocacy_note (report_id, admin_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at',
        [id, admin.id, note],
      );
    });
    await writeAuditEvent(admin.id, 'add-note', 'advocacy_report', String(id));
    return ok(result.rows[0], 201, withNoStore());
  } catch (error) { return fail(error, request, { operation: 'admin.advocacy.add-note' }); }
}

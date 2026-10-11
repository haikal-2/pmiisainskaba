import { query } from '@/server/db/pool';
import { requireAdmin } from '@/server/auth/admin';
import { paginationSchema } from '@/server/schemas';
import { fail, ok, withNoStore } from '@/server/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const parsed = paginationSchema.safeParse(Object.fromEntries(url.searchParams));
    const page = parsed.success ? parsed.data.page ?? 1 : 1;
    const perPage = parsed.success ? parsed.data.perPage ?? 20 : 20;
    const q = parsed.success ? parsed.data.q : undefined;
    const result = await query(
      `SELECT id, registration_number, full_name, nim, angkatan, university,
              study_program, whatsapp, email, gender, created_at
       FROM mapaba_registration
       WHERE $1::text IS NULL OR full_name ILIKE '%' || $1 || '%' OR nim ILIKE '%' || $1 || '%'
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [q || null, perPage, (page - 1) * perPage],
    );
    const count = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM mapaba_registration
       WHERE $1::text IS NULL OR full_name ILIKE '%' || $1 || '%' OR nim ILIKE '%' || $1 || '%'`, [q || null],
    );
    return ok({ items: result.rows, page, perPage, total: Number(count.rows[0]?.count ?? 0) }, 200, withNoStore());
  } catch (error) { return fail(error, request); }
}

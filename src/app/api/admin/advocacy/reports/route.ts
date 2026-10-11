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
    const status = parsed.success ? parsed.data.status : undefined;
    const q = parsed.success ? parsed.data.q : undefined;
    const result = await query(
      `SELECT id, ticket, reporter_name, contact, email, reporter_status, category,
              confidential, status, created_at
       FROM advocacy_report
       WHERE ($1::text IS NULL OR status = $1)
         AND ($2::text IS NULL OR ticket ILIKE '%' || $2 || '%' OR category ILIKE '%' || $2 || '%')
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [status || null, q || null, perPage, (page - 1) * perPage],
    );
    const count = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM advocacy_report
       WHERE ($1::text IS NULL OR status = $1)
         AND ($2::text IS NULL OR ticket ILIKE '%' || $2 || '%' OR category ILIKE '%' || $2 || '%')`,
      [status || null, q || null],
    );
    return ok({ items: result.rows, page, perPage, total: Number(count.rows[0]?.count ?? 0) }, 200, withNoStore());
  } catch (error) {
    return fail(error, request);
  }
}

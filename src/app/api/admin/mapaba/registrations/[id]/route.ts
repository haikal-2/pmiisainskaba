import { queryOne } from '@/server/db/pool';
import { requireAdmin } from '@/server/auth/admin';
import { fail, ok, withNoStore } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    await requireAdmin();
    const id = Number.parseInt((await context.params).id, 10);
    if (!Number.isSafeInteger(id) || id < 1) throw AppError.notFound();
    const registration = await queryOne(
      `SELECT id, registration_number, full_name, nim, angkatan, university, faculty,
              study_program, whatsapp, email, gender, origin_region, motivation,
              info_source, organization_history, photo_media_id, ktm_media_id,
              consent_program, consent_data, status, created_at
       FROM mapaba_registration WHERE id = $1`, [id],
    );
    if (!registration) throw AppError.notFound();
    return ok({ registration }, 200, withNoStore());
  } catch (error) { return fail(error, request); }
}

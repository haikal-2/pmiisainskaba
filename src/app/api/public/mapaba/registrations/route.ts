import { randomUUID } from 'node:crypto';

import { createMapabaRegistration } from '@/server/services/submissions';
import { finalizeMapabaDraft, verifyMapabaDraftFiles } from '@/server/services/uploads';
import { mapabaRegistrationSchema, flattenFieldErrors } from '@/server/schemas';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { fail, ok } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requestSubject(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
}

export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit('mapaba-registration', requestSubject(request), {
      limit: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    });
    const body = (await request.json()) as Record<string, unknown>;
    const draftId = typeof body.draftId === 'string' ? body.draftId : '';
    const draftToken = typeof body.draftToken === 'string' ? body.draftToken : '';
    const parsed = mapabaRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation('Beberapa kolom masih perlu diperbaiki.', flattenFieldErrors(parsed.error));
    }
    if (!draftId || !draftToken) throw AppError.validation('Sesi unggah berkas tidak ditemukan. Unggah ulang pas foto dan KTM.');

    const media = await verifyMapabaDraftFiles(
      draftId,
      draftToken,
      parsed.data.pasFotoUrl,
      parsed.data.ktmUrl,
    );
    const created = await createMapabaRegistration(parsed.data, media);
    await finalizeMapabaDraft(
      draftId,
      draftToken,
      media.photoMediaId,
      media.ktmMediaId,
      created.registrationId,
    );
    const requestId = randomUUID();
    return ok({ nomorRegistrasi: created.registrationNumber }, 201, { 'X-Request-Id': requestId });
  } catch (error) {
    return fail(error, request);
  }
}

import { randomUUID } from 'node:crypto';

import { createMapabaUploadDraft, uploadMapabaDraftFile } from '@/server/services/uploads';
import { mapabaUploadRequestSchema } from '@/server/schemas';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { fail, ok } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requestSubject(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
}

/** Buat draft upload; token hanya dikirim ke browser sekali. */
export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit('mapaba-upload-init', requestSubject(request), {
      limit: 8,
      windowSeconds: 60 * 60,
      blockSeconds: 30 * 60,
    });
    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const parsed = mapabaUploadRequestSchema.safeParse(await request.json());
      if (!parsed.success) throw AppError.validation('Data upload tidak valid.');
      if (parsed.data.byteSize > 3 * 1024 * 1024) {
        throw new AppError('PAYLOAD_TOO_LARGE', 'Ukuran berkas maksimal 3 MB.');
      }
      const draft = await createMapabaUploadDraft();
      return ok({ draftId: draft.draftId, token: draft.token, expiresAt: draft.expiresAt }, 201);
    }

    // Upload terpisah: body satu file <=3 MB, tidak mengirim dua berkas dalam satu fungsi.
    const form = await request.formData();
    const file = form.get('file');
    const draftId = form.get('draftId');
    const token = form.get('token');
    const kind = form.get('kind');
    if (!(file instanceof File) || typeof draftId !== 'string' || typeof token !== 'string') {
      throw AppError.validation('Berkas atau draft upload tidak lengkap.');
    }
    if (kind !== 'pasFoto' && kind !== 'ktm') throw AppError.validation('Jenis berkas tidak valid.');
    const result = await uploadMapabaDraftFile({ draftId, token, kind, file });
    return ok({ url: result.url, pathname: result.pathname, size: result.size, mimeType: result.mimeType }, 201);
  } catch (error) {
    return fail(error, request);
  }
}

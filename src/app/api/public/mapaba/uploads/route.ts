import config from '@/server/config';
import { mapabaUploadRequestSchema } from '@/server/schemas';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { clientSubject } from '@/server/security/client-identity';
import { assertUploadBodySize } from '@/server/security/request-size';
import { createMapabaUploadDraft, uploadMapabaDraftFile } from '@/server/services/uploads';
import { fail, ok } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MEGABYTES = Math.floor(config.maxUploadBytes / (1024 * 1024));

/**
 * Endpoint unggah dua langkah:
 *   1. `POST` JSON → membuat draft + token (token hanya dikirim sekali).
 *   2. `POST` multipart → satu berkas (<=3 MB) per permintaan.
 *
 * Rate limit:
 *   * Produksi selalu dibatasi memakai identitas dari header tepercaya saja
 *     (lihat `clientSubject`). Tanpa header tepercaya, seluruh trafik berbagi satu
 *     bucket — gagal tertutup, bukan gagal terbuka.
 *   * Inisialisasi draft tidak dibatasi di non-produksi karena semua browser di mesin
 *     yang sama berbagi satu identitas; ini disengaja supaya pengujian lokal tidak
 *     memblokir diri sendiri. Unggah berkas tetap dibatasi di semua lingkungan.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      if (config.isProduction) {
        await enforceRateLimit('mapaba-upload-init', clientSubject(request), {
          limit: 8,
          windowSeconds: 60 * 60,
          blockSeconds: 30 * 60,
        });
      }
      const parsed = mapabaUploadRequestSchema.safeParse(await request.json());
      if (!parsed.success) throw AppError.validation('Data upload tidak valid.');
      if (parsed.data.byteSize > config.maxUploadBytes) {
        throw new AppError('PAYLOAD_TOO_LARGE', `Ukuran berkas maksimal ${MEGABYTES} MB.`);
      }
      const draft = await createMapabaUploadDraft();
      return ok({ draftId: draft.draftId, token: draft.token, expiresAt: draft.expiresAt }, 201);
    }

    assertUploadBodySize(request);
    await enforceRateLimit('mapaba-upload-file', clientSubject(request), {
      limit: config.isProduction ? 12 : 60,
      windowSeconds: 60 * 60,
      blockSeconds: 15 * 60,
    });

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
    // Hanya pathname kanonik + metadata yang dikirim ke browser; tanpa URL storage.
    return ok({ reference: result.pathname, size: result.size, mimeType: result.mimeType }, 201);
  } catch (error) {
    return fail(error, request, { operation: 'mapaba.upload' });
  }
}

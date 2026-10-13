import { flattenFieldErrors, mapabaRegistrationSchema } from '@/server/schemas';
import { enforceRateLimit } from '@/server/security/rate-limit';
import { clientSubject } from '@/server/security/client-identity';
import { verifyCaptchaToken } from '@/server/security/captcha';
import config from '@/server/config';
import { assertJsonBodySize } from '@/server/security/request-size';
import { createMapabaRegistrationWithMedia } from '@/server/services/submissions';
import { fail, ok } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pendaftaran MAPABA.
 *
 * Satu permintaan menuntaskan seluruh rantai: validasi draft, kunci kuota, insert
 * peserta, finalisasi berkas, dan penulisan outbox — semuanya dalam satu transaksi di
 * `createMapabaRegistrationWithMedia`. Respons 201 karena itu berarti pendaftaran
 * BENAR-BENAR tersimpan, bukan sekadar berkas berhasil diunggah.
 *
 * Klien mengirim `reference` (pathname kanonik hasil unggah), bukan URL. Tidak ada
 * skema `local-upload:/` atau URL Blob bertanda tangan yang pernah diterima di sini.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertJsonBodySize(request);
    await enforceRateLimit('mapaba-registration', clientSubject(request), {
      limit: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60,
    });

    const body = (await request.json()) as Record<string, unknown>;
    const draftId = typeof body.draftId === 'string' ? body.draftId : '';
    const draftToken = typeof body.draftToken === 'string' ? body.draftToken : '';
    if (!draftId || !draftToken) {
      throw AppError.validation('Sesi unggah berkas tidak ditemukan. Unggah ulang pas foto dan KTM.');
    }
    const parsed = mapabaRegistrationSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation('Beberapa kolom masih perlu diperbaiki.', flattenFieldErrors(parsed.error));
    }

    // Verifikasi CAPTCHA sisi server (fail-closed ketika provider aktif).
    try {
      await verifyCaptchaToken(config.captcha, parsed.data.captchaToken ?? '', undefined);
    } catch {
      throw AppError.validation('Verifikasi captcha gagal. Silakan coba lagi.');
    }

    const created = await createMapabaRegistrationWithMedia({
      data: parsed.data,
      draft: { draftId, token: draftToken },
      files: [
        { reference: parsed.data.pasFotoUrl, kind: 'pasFoto' },
        { reference: parsed.data.ktmUrl, kind: 'ktm' },
      ],
    });

    return ok(
      {
        nomorRegistrasi: created.registrationNumber,
        // URL aman untuk ditampilkan/disalin admin. ID tiket ini yang juga dipakai
        // sebagai identitas baris di Google Sheets.
        berkasPath: `/api/admin/mapaba/registrations/${created.registrationId}/media`,
      },
      201,
    );
  } catch (error) {
    return fail(error, request, { operation: 'mapaba.registration' });
  }
}

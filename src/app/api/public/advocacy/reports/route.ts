import { createAdvocacyReport } from '@/server/services/submissions';
import { advocacyReportSchema, flattenFieldErrors } from '@/server/schemas';
import { enforceRateLimit, generateIdempotencyKey, reserveIdempotency } from '@/server/security/rate-limit';
import { clientSubject } from '@/server/security/client-identity';
import { verifyCaptchaToken } from '@/server/security/captcha';
import config from '@/server/config';
import { assertJsonBodySize } from '@/server/security/request-size';
import { fail, ok } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pengaduan advokasi publik.
 *
 * Rate limit memakai identitas klien tepercaya yang sama dengan jalur MAPABA
 * (`clientSubject`): hanya header yang ditentukan `TRUSTED_CLIENT_IP_HEADER` yang
 * dipercaya, dan bila tidak ada seluruh trafik berbagi satu bucket — gagal tertutup,
 * bukan gagal terbuka. Sebelumnya route ini membaca `x-forwarded-for` apa adanya,
 * sehingga setiap klien dapat memalsukan header itu dan menghindari kuota.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    assertJsonBodySize(request);
    await enforceRateLimit('advocacy-submit', clientSubject(request), {
      limit: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 15 * 60,
    });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw AppError.validation('Body permintaan bukan JSON yang valid.');
    }
    const parsed = advocacyReportSchema.safeParse(body);
    if (!parsed.success) {
      throw AppError.validation('Beberapa kolom masih perlu diperbaiki.', flattenFieldErrors(parsed.error));
    }
    // Verifikasi CAPTCHA sisi server (fail-closed ketika provider aktif).
    try {
      await verifyCaptchaToken(
        config.captcha,
        typeof (parsed.data as Record<string, unknown>).captchaToken === 'string'
          ? ((parsed.data as Record<string, unknown>).captchaToken as string)
          : '',
      );
    } catch {
      throw AppError.validation('Verifikasi captcha gagal. Silakan coba lagi.');
    }
    const idempotencyKey = request.headers.get('idempotency-key') || generateIdempotencyKey();
    const reserved = await reserveIdempotency('advocacy', idempotencyKey);
    if (!reserved) throw AppError.conflict('Pengaduan ini sudah pernah dikirim.');

    const result = await createAdvocacyReport(parsed.data);
    // `ok()` menghasilkan request ID-nya sendiri dan menaruhnya di header sekaligus
    // body, jadi header tidak perlu diisi terpisah (sebelumnya nilai itu tertimpa dan
    // body/header memuat ID berbeda).
    return ok({ nomorTiket: result.ticket }, 201);
  } catch (error) {
    return fail(error, request, { operation: 'advocacy.submit' });
  }
}
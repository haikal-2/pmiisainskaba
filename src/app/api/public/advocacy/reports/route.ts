import { randomUUID } from 'node:crypto';

import { createAdvocacyReport } from '@/server/services/submissions';
import { advocacyReportSchema, flattenFieldErrors } from '@/server/schemas';
import { enforceRateLimit, generateIdempotencyKey, reserveIdempotency } from '@/server/security/rate-limit';
import { fail, ok } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requestSubject(request: Request): string {
  // Header is read only transiently; rate_limit_counter stores an HMAC, never raw IP.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown-client';
}

export async function POST(request: Request): Promise<Response> {
  try {
    await enforceRateLimit('advocacy-submit', requestSubject(request), {
      limit: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 15 * 60,
    });
    const raw = await request.json();
    const parsed = advocacyReportSchema.safeParse(raw);
    if (!parsed.success) {
      throw AppError.validation('Beberapa kolom masih perlu diperbaiki.', flattenFieldErrors(parsed.error));
    }
    const idempotencyKey = request.headers.get('idempotency-key') || generateIdempotencyKey();
    const reserved = await reserveIdempotency('advocacy', idempotencyKey);
    if (!reserved) throw AppError.conflict('Pengaduan ini sudah pernah dikirim.');

    const result = await createAdvocacyReport(parsed.data);
    const requestId = randomUUID();
    return ok({ nomorTiket: result.ticket }, 201, { 'X-Request-Id': requestId });
  } catch (error) {
    return fail(error, request);
  }
}

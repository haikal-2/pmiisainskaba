import { enforceRateLimit } from '@/server/security/rate-limit';
import { authenticateAdmin, assertSameOrigin } from '@/server/auth/admin';
import { LoginPayloadError, readAdminLoginPayload } from '@/server/auth/login-input';
import { fail, ok, withNoStore } from '@/server/api/response';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    await assertSameOrigin(request);
    let form;
    try {
      form = await readAdminLoginPayload(request);
    } catch (error) {
      if (error instanceof LoginPayloadError) {
        if (error.kind === 'too-large') {
          throw new AppError('PAYLOAD_TOO_LARGE', 'Ukuran permintaan terlalu besar.');
        }
        if (error.kind === 'unsupported') {
          throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Login harus menggunakan JSON.');
        }
        throw AppError.validation('Username dan password wajib diisi.');
      }
      throw error;
    }
    await enforceRateLimit('admin-login', form.username.toLowerCase(), {
      limit: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60,
    });
    await authenticateAdmin(form.username, form.password);
    return ok({ authenticated: true }, 200, withNoStore());
  } catch (error) {
    return fail(error, request);
  }
}

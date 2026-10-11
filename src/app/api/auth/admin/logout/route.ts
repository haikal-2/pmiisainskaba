import { assertSameOrigin, logoutAdmin } from '@/server/auth/admin';
import { fail, noContent } from '@/server/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    await assertSameOrigin(request);
    await logoutAdmin();
    return noContent({ 'Cache-Control': 'no-store' });
  } catch (error) {
    return fail(error, request);
  }
}

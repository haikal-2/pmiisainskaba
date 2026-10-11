import { getCurrentAdmin } from '@/server/auth/admin';
import { fail, ok, withNoStore } from '@/server/api/response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const admin = await getCurrentAdmin();
    if (!admin) return Response.json({ data: { authenticated: false } }, { headers: withNoStore() });
    return ok({ authenticated: true, username: admin.username }, 200, withNoStore());
  } catch (error) {
    return fail(error, request);
  }
}

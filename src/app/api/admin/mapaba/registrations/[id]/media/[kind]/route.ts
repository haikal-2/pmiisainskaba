import { queryOne } from '@/server/db/pool';
import { requireAdmin, writeAuditEvent } from '@/server/auth/admin';
import { fail } from '@/server/api/response';
import { AppError } from '@/server/errors';
import { isAllowedImageMime } from '@/server/storage/blob';
import { openPrivateObject } from '@/server/storage/private-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MEDIA_COLUMN: Record<string, string> = { photo: 'photo_media_id', ktm: 'ktm_media_id' };
const EXTENSION: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

type Context = { params: Promise<{ id: string; kind: string }> };

/**
 * Satu-satunya jalur untuk membuka berkas MAPABA privat (pas foto & KTM).
 *
 * Kontrol akses:
 *   1. `requireAdmin()` — sesi cookie wajib valid; tidak ada akses anonim.
 *   2. Pathname objek diambil lewat join `mapaba_registration` sehingga tidak pernah
 *      berasal dari input pengguna.
 *   3. Setiap akses berhasil dicatat sebagai audit event.
 */
export async function GET(request: Request, context: Context): Promise<Response> {
  try {
    const admin = await requireAdmin();
    const { id: rawId, kind } = await context.params;
    const id = Number.parseInt(rawId, 10);
    const mediaColumn = MEDIA_COLUMN[kind];
    if (!Number.isSafeInteger(id) || id < 1 || !mediaColumn) throw AppError.notFound();

    const asset = await queryOne<{ object_key: string; mime_type: string }>(
      `SELECT media.object_key, media.mime_type
       FROM mapaba_registration registration
       JOIN media_asset media ON media.id = registration.${mediaColumn}
       WHERE registration.id = $1 AND media.visibility = 'private' AND media.state = 'finalized'`,
      [id],
    );
    if (!asset || !isAllowedImageMime(asset.mime_type)) throw AppError.notFound();

    const stream = await openPrivateObject(asset.object_key, asset.mime_type);
    if (!stream) throw AppError.notFound();

    await writeAuditEvent(admin.id, 'read-media', 'mapaba_registration', `${id}:${kind}`);

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': asset.mime_type,
        'Content-Disposition': `inline; filename="mapaba-${id}-${kind}.${EXTENSION[asset.mime_type]}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    // Kegagalan (sesi tidak valid, berkas tidak ada, driver storage mati) tetap
    // dicatat dengan request ID yang sama agar dapat ditelusuri dari log server.
    const response = fail(error, request, { operation: 'admin.read-media' });
    return response.status === 200 ? new Response(null, { status: 500 }) : response;
  }
}

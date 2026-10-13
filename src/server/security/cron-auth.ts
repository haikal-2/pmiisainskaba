import 'server-only';

import { timingSafeEqual } from 'node:crypto';

import config from '@/server/config';
import { AppError } from '@/server/errors';
import { logEvent } from '@/server/observability/logger';

/**
 * Otorisasi job terjadwal (cron).
 *
 * Vercel Cron mengirim `Authorization: Bearer $CRON_SECRET` bila `CRON_SECRET` diisi
 * pada project. Kita **menolak** bila secret tidak dikonfigurasi — endpoint yang dapat
 * memicu pengiriman keluar tidak boleh terbuka karena env yang lupa diisi.
 *
 * Perbandingan memakai `timingSafeEqual` agar tidak membocorkan panjang/isi token
 * lewat waktu respons.
 */
export function assertCronAuthorized(request: Request): void {
  const expected = config.cronSecret;
  if (!expected) {
    logEvent('error', 'cron.misconfigured', { operation: 'cron.dispatch', component: 'internal' });
    throw new AppError('DEPENDENCY_UNAVAILABLE', 'Job terjadwal belum dikonfigurasi.');
  }

  const header = request.headers.get('authorization') ?? '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) throw unauthorized();

  const provided = header.slice(prefix.length).trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    logEvent('warn', 'cron.rejected', { operation: 'cron.dispatch', component: 'http' });
    throw unauthorized();
  }
}

function unauthorized(): AppError {
  return AppError.unauthenticated('Job terjadwal memerlukan otorisasi.');
}

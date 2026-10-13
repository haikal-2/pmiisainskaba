import 'server-only';

import { isAppError } from '@/server/errors';

/**
 * Log diagnostik terstruktur (satu baris JSON per kejadian) untuk dipakai di server.
 *
 * Aturan yang dipegang modul ini:
 *   * Tidak pernah menulis body request, token, kredensial, pathname objek privat,
 *     atau data pribadi peserta/pelapor.
 *   * Selalu menyertakan `requestId` dan `operation` bila tersedia agar satu insiden
 *     dapat dilacak dari respons klien (`X-Request-Id`) sampai penyebabnya.
 *   * Menyebut komponen yang gagal secara eksplisit: `database`, `storage`,
 *     `google-sheets`, `validation`, atau `internal`. Ini yang membedakan insiden DB
 *     dari insiden Blob atau Sheets saat insiden nyata terjadi.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogComponent =
  | 'http'
  | 'database'
  | 'storage'
  | 'google-sheets'
  | 'cron'
  | 'validation'
  | 'internal';

export type LogFields = {
  requestId?: string;
  operation?: string;
  component?: LogComponent;
  status?: number;
  errorCode?: string;
  errorName?: string;
  /** Kode Postgres (mis. `23505`); bukan pesan SQL, tidak berisi data. */
  pgCode?: string;
  pgConstraint?: string;
  /** Label singkat non-sensitif, mis. `mapaba-registration` atau `dispatch`. */
  detail?: string;
  [key: string]: string | number | boolean | undefined;
};

function write(level: LogLevel, event: string, fields: LogFields): void {
  const entry = { level, event, time: new Date().toISOString(), ...fields };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logEvent = (level: LogLevel, event: string, fields: LogFields = {}): void => write(level, event, fields);

/**
 * Klasifikasi error ke komponen pemiliknya. Dipakai bersama `fail()` supaya
 * debugging tidak perlu menebak apakah penyebabnya DB, storage, validasi, atau Sheets.
 */
export function classifyError(error: unknown): { component: LogComponent; errorName: string; pgCode?: string; pgConstraint?: string } {
  const errorName = error instanceof Error ? error.name : 'UnknownError';

  // `AppError` diperiksa lebih dulu: propertinya bernama `code` tetapi isinya
  // nama kode aplikasi (mis. `UNAUTHENTICATED`), BUKAN kode Postgres. Tanpa
  // cabang ini, kegagalan auth/validasi akan salah dilaporkan sebagai insiden
  // database dengan `pgCode: 'UNAUTHENTICATED'`.
  if (isAppError(error)) return { component: 'validation', errorName };

  const candidate = error as { code?: unknown; constraint?: unknown } | null;
  const pgCode = typeof candidate?.code === 'string' ? candidate.code : undefined;
  const pgConstraint = typeof candidate?.constraint === 'string' ? candidate.constraint : undefined;

  if (pgCode) return { component: 'database', errorName, ...(pgConstraint ? { pgConstraint } : {}), pgCode };
  if (errorName === 'AppError') return { component: 'validation', errorName };
  if (/Blob|Vercel/i.test(errorName)) return { component: 'storage', errorName };
  return { component: 'internal', errorName };
}

/**
 * Catat kegagalan satu dependency (database, storage, Google Sheets) dengan
 * komponen yang menyebabkannya — inilah yang membuat log dapat dibaca per-dependency
 * saat insiden, alih-alih satu baris error generik tanpa pemilik.
 *
 * Hanya metadata aman yang ditulis: nama/kode error, constraint, label operasi, dan
 * durasi. Tidak pernah payload, pathname berkas privat, atau data pribadi.
 */
export function logDependencyFailure(input: {
  operation: string;
  component: LogComponent;
  error: unknown;
  requestId?: string;
  detail?: string;
  latencyMs?: number;
  attempt?: number;
}): void {
  const classified = classifyError(input.error);
  logEvent('error', 'dependency.failed', {
    operation: input.operation,
    component: input.component,
    errorName: classified.errorName,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.detail ? { detail: input.detail } : {}),
    ...(typeof input.latencyMs === 'number' ? { latencyMs: input.latencyMs } : {}),
    ...(typeof input.attempt === 'number' ? { attempt: input.attempt } : {}),
    ...(classified.pgCode ? { pgCode: classified.pgCode } : {}),
    ...(classified.pgConstraint ? { pgConstraint: classified.pgConstraint } : {}),
  });
}

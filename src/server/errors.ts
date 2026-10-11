import 'server-only';

/**
 * Lapisan error aplikasi.
 *
 * Error yang dilempar ke klien selalu berupa AppError dengan kode stabil.
 * Detail internal (SQL, stack, kredensial) tidak pernah keluar dari sini.
 */

export type ErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'REGISTRATION_CLOSED'
  | 'QUOTA_EXCEEDED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 422,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  REGISTRATION_CLOSED: 409,
  QUOTA_EXCEEDED: 409,
  DEPENDENCY_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly fields?: FieldErrors;

  constructor(code: ErrorCode, message: string, fields?: FieldErrors) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (fields) this.fields = fields;
  }

  static validation(message: string, fields?: FieldErrors): AppError {
    return new AppError('VALIDATION_FAILED', message, fields);
  }

  static unauthenticated(message = 'Sesi tidak valid. Silakan masuk kembali.'): AppError {
    return new AppError('UNAUTHENTICATED', message);
  }

  static forbidden(message = 'Anda tidak memiliki izin untuk tindakan ini.'): AppError {
    return new AppError('FORBIDDEN', message);
  }

  static notFound(message = 'Data tidak ditemukan.'): AppError {
    return new AppError('NOT_FOUND', message);
  }

  static conflict(message: string): AppError {
    return new AppError('CONFLICT', message);
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Ambil kode Postgres dari error apa pun tanpa melempar dan tanpa mencetak isi
 * query. Dipakai untuk menerjemahkan constraint ke pesan yang ramah.
 */
export function pgErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = (error as { code?: unknown }).code;
  return typeof candidate === 'string' ? candidate : undefined;
}

export function pgConstraint(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = (error as { constraint?: unknown }).constraint;
  return typeof candidate === 'string' ? candidate : undefined;
}

/** Pesan aman untuk log server: tanpa payload sensitif. */
export function describeError(error: unknown): string {
  if (isAppError(error)) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return 'UnknownError';
}

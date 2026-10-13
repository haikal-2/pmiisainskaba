import 'server-only';

import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import { AppError, isAppError } from '@/server/errors';
import { classifyError, logEvent, type LogFields } from '@/server/observability/logger';

export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiFailure = {
  error: { code: string; message: string; fields?: Record<string, string> };
  requestId: string;
};

export function ok<T>(data: T, status = 200, headers?: HeadersInit): Response {
  const requestId = randomUUID();
  const merged = new Headers(headers);
  merged.set('Content-Type', 'application/json; charset=utf-8');
  merged.set('X-Request-Id', requestId);
  return Response.json({ data, requestId } satisfies ApiSuccess<T>, { status, headers: merged });
}

export function noContent(headers?: HeadersInit): Response {
  const merged = new Headers(headers);
  merged.set('X-Request-Id', randomUUID());
  return new Response(null, { status: 204, headers: merged });
}

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EPIPE',
  'EAI_AGAIN',
]);

export function fail(error: unknown, request?: Request, context?: FailContext): Response {
  const requestId = randomUUID();
  let appError: AppError;
  const operation = context?.operation;
  if (isAppError(error)) {
    appError = error;
    // 4xx yang memang direncanakan tidak perlu noise; 5xx dan kegagalan dependency selalu dicatat.
    if (appError.status >= 500 || appError.code === 'DEPENDENCY_UNAVAILABLE') {
      logEvent('error', 'request.failed', buildLogFields({ requestId, request, operation, appError, error }));
    } else {
      logEvent('info', 'request.rejected', buildLogFields({ requestId, request, operation, appError, error }));
    }
  } else if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.length ? String(issue.path[0]) : '_';
      fields[key] ??= issue.message;
    }
    appError = AppError.validation('Beberapa kolom masih perlu diperbaiki.', fields);
    logEvent('info', 'request.rejected', buildLogFields({ requestId, request, operation, appError, error }));
  } else {
    // Log hanya metadata aman (kode/constraint Postgres, nama error, komponen asal).
    // Jangan pernah log body, query, token, pathname berkas privat, atau data pribadi.
    const classified = classifyError(error);
    logEvent('error', 'request.failed', buildLogFields({ requestId, request, operation, error }));
    // Kegagalan koneksi database (mis. ECONNREFUSED) adalah insiden dependency,
    // bukan bug aplikasi: klien mendapat 503 agar dapat membedakannya dari 500.
    const dependencyDown =
      classified.component === 'database' &&
      (CONNECTION_ERROR_CODES.has(classified.pgCode ?? '') || classified.errorName === 'AggregateError');
    appError = dependencyDown
      ? new AppError('DEPENDENCY_UNAVAILABLE', 'Layanan sedang tidak tersedia. Silakan coba lagi nanti.')
      : new AppError('INTERNAL', 'Permintaan gagal diproses. Silakan coba lagi.');
  }
  const body: ApiFailure = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.fields ? { fields: appError.fields } : {}),
    },
    requestId,
  };
  return Response.json(body, {
    status: appError.status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Request-Id': requestId,
    },
  });
}

type FailContext = { operation?: string };

function buildLogFields(input: {
  requestId: string;
  request?: Request;
  operation?: string;
  appError?: AppError;
  error?: unknown;
}): LogFields {
  const error = input.appError ?? input.error;
  const classified = classifyError(error);
  return {
    requestId: input.requestId,
    ...(input.operation ? { operation: input.operation } : {}),
    component: input.appError ? 'http' : classified.component,
    errorCode: input.appError?.code ?? classified.errorName,
    errorName: classified.errorName,
    ...(classified.pgCode ? { pgCode: classified.pgCode } : {}),
    ...(classified.pgConstraint ? { pgConstraint: classified.pgConstraint } : {}),
    method: input.request?.method,
    path: safePath(input.request),
  };
}

function safePath(request?: Request): string | undefined {
  if (!request) return undefined;
  try {
    // Query string dapat berisi data; report pathname saja.
    return new URL(request.url).pathname;
  } catch {
    return undefined;
  }
}

export function withNoStore(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set('Cache-Control', 'no-store, max-age=0');
  result.set('Pragma', 'no-cache');
  return result;
}

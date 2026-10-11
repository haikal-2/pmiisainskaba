import 'server-only';

import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import { AppError, isAppError } from '@/server/errors';

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

export function fail(error: unknown, request?: Request): Response {
  const requestId = randomUUID();
  let appError: AppError;
  if (isAppError(error)) {
    appError = error;
  } else if (error instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.length ? String(issue.path[0]) : '_';
      fields[key] ??= issue.message;
    }
    appError = AppError.validation('Beberapa kolom masih perlu diperbaiki.', fields);
  } else {
    // Log hanya metadata aman. Jangan log body, query, token, atau data sensitif.
    console.error(JSON.stringify({ requestId, method: request?.method, path: safePath(request), error: safeErrorName(error) }));
    appError = new AppError('INTERNAL', 'Permintaan gagal diproses. Silakan coba lagi.');
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

function safePath(request?: Request): string | undefined {
  if (!request) return undefined;
  try {
    // Query string dapat berisi data; report pathname saja.
    return new URL(request.url).pathname;
  } catch {
    return undefined;
  }
}

function safeErrorName(error: unknown): string {
  return error instanceof Error ? error.name : 'UnknownError';
}

export function readJson<T>(request: Request): Promise<T> {
  return request.json() as Promise<T>;
}

export function withNoStore(headers?: HeadersInit): Headers {
  const result = new Headers(headers);
  result.set('Cache-Control', 'no-store, max-age=0');
  result.set('Pragma', 'no-cache');
  return result;
}

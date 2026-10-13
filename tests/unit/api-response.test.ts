import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import type { ZodError } from 'zod';

// imports transitif (logger/config) membaca env saat dimuat.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'api-response-salt-with-enough-entropy';

const loadResponse = () => import('../../src/server/api/response.js');
const loadErrors = () => import('../../src/server/errors.js');

/**
 * Bentuk respons API yang konsisten.
 *
 * `ok`/`fail` adalah satu-satunya jalan keluar respons JSON, jadi kontrak di sini
 * berlaku untuk semua route: requestId ada di header DAN body dengan nilai sama,
 * error tidak pernah membocorkan detail internal, dan cache selalu dimatikan.
 */

test('ok returns data with a matching X-Request-Id header and a JSON content type', async () => {
  const { ok } = await loadResponse();
  const response = ok({ nomorRegistrasi: 'MPB-2026-0001' }, 201);

  assert.equal(response.status, 201);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  const requestId = response.headers.get('x-request-id');
  assert.ok(requestId && requestId.length > 0);

  const body = (await response.json()) as { data: unknown; requestId: string };
  assert.deepEqual(body.data, { nomorRegistrasi: 'MPB-2026-0001' });
  assert.equal(body.requestId, requestId, 'requestId di header dan body harus sama');
});

test('ok defaults to 200 and applies caller-supplied headers without losing its own', async () => {
  const { ok } = await loadResponse();
  const response = ok({ hello: 'world' }, undefined, { 'X-Custom': 'yes' });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-custom'), 'yes');
  assert.ok(response.headers.get('x-request-id'));
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
});

test('noContent returns 204 with a request id and an empty body', async () => {
  const { noContent } = await loadResponse();
  const response = noContent();
  assert.equal(response.status, 204);
  assert.ok(response.headers.get('x-request-id'));
  assert.equal(await response.text(), '');
});

test('fail maps an AppError to its stable status, code, and field errors', async () => {
  const { fail } = await loadResponse();
  const { AppError } = await loadErrors();
  const request = new Request('https://pmii.example/api/public/mapaba/registrations?secret=leak');

  const response = fail(
    AppError.validation('Beberapa kolom masih perlu diperbaiki.', { email: 'Email tidak valid' }),
    request,
    { operation: 'mapaba.registration' },
  );

  assert.equal(response.status, 422);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = (await response.json()) as {
    error: { code: string; message: string; fields?: Record<string, string> };
    requestId: string;
  };
  assert.equal(body.error.code, 'VALIDATION_FAILED');
  assert.deepEqual(body.error.fields, { email: 'Email tidak valid' });
  assert.equal(body.requestId, response.headers.get('x-request-id'));
});

test('fail converts a ZodError into field-level 422 without exposing the raw issues', async () => {
  const { fail } = await loadResponse();
  const schema = z.object({ email: z.string().email('Email tidak valid'), nim: z.string().min(3, 'NIM terlalu pendek') });
  const parsed = schema.safeParse({ email: 'bukan-email', nim: '1' });
  assert.equal(parsed.success, false);

  const response = fail(parsed.error as ZodError);
  assert.equal(response.status, 422);
  const body = (await response.json()) as { error: { code: string; fields?: Record<string, string> } };
  assert.equal(body.error.code, 'VALIDATION_FAILED');
  assert.equal(body.error.fields?.email, 'Email tidak valid');
  assert.equal(body.error.fields?.nim, 'NIM terlalu pendek');
});

test('fail turns an unknown error into an opaque 500 that leaks no internal detail', async () => {
  const { fail } = await loadResponse();
  const response = fail(new Error('SQLSTATE 23505 detail kolom rahasia'));
  assert.equal(response.status, 500);
  assert.equal(response.headers.get('cache-control'), 'no-store');

  const body = (await response.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, 'INTERNAL');
  assert.doesNotMatch(body.error.message, /SQLSTATE|rahasia/);
});

test('fail preserves each AppError code and status pairing', async () => {
  const { fail } = await loadResponse();
  const { AppError } = await loadErrors();
  const cases: [InstanceType<typeof AppError>, number, string][] = [
    [AppError.unauthenticated(), 401, 'UNAUTHENTICATED'],
    [AppError.forbidden(), 403, 'FORBIDDEN'],
    [AppError.notFound(), 404, 'NOT_FOUND'],
    [AppError.conflict('bentrok'), 409, 'CONFLICT'],
    [new AppError('PAYLOAD_TOO_LARGE', 'terlalu besar'), 413, 'PAYLOAD_TOO_LARGE'],
    [new AppError('UNSUPPORTED_MEDIA_TYPE', 'tipe salah'), 415, 'UNSUPPORTED_MEDIA_TYPE'],
    [new AppError('RATE_LIMITED', 'lambat'), 429, 'RATE_LIMITED'],
    [new AppError('QUOTA_EXCEEDED', 'kuota'), 409, 'QUOTA_EXCEEDED'],
    [new AppError('DEPENDENCY_UNAVAILABLE', 'matang'), 503, 'DEPENDENCY_UNAVAILABLE'],
  ];

  for (const [error, status, code] of cases) {
    const response = fail(error);
    assert.equal(response.status, status, `${code} harus ${status}`);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, code);
  }
});

test('withNoStore forces no-store caching on an arbitrary header set', async () => {
  const { withNoStore } = await loadResponse();
  const headers = withNoStore({ 'Cache-Control': 'public, max-age=60', 'X-Custom': '1' });
  assert.equal(headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(headers.get('pragma'), 'no-cache');
  assert.equal(headers.get('x-custom'), '1');
});
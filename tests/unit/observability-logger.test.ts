import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyError, logDependencyFailure, logEvent } from '../../src/server/observability/logger';

/**
 * Log diagnostik terstruktur.
 *
 * Yang dijaga: setiap baris adalah JSON valid dengan level/event/waktu, komponen
 * dependency disebut eksplisit, dan tidak ada data sensitif yang bocor. `console`
 * dibajak sementara lalu dipulihkan supaya test tetap deterministik.
 */

type Captured = { method: 'log' | 'warn' | 'error'; line: string };

async function captureConsole(run: () => void | Promise<void>): Promise<Captured[]> {
  const captured: Captured[] = [];
  const original = { log: console.log, warn: console.warn, error: console.error };
  const record = (method: Captured['method']) => (...args: unknown[]) => {
    captured.push({ method, line: String(args[0]) });
  };
  console.log = record('log') as typeof console.log;
  console.warn = record('warn') as typeof console.warn;
  console.error = record('error') as typeof console.error;
  try {
    await run();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
  return captured;
}

function parse(entry: Captured): Record<string, unknown> {
  const parsed = JSON.parse(entry.line) as Record<string, unknown>;
  assert.equal(typeof parsed.event, 'string');
  assert.equal(typeof parsed.time, 'string');
  assert.equal(Number.isNaN(new Date(String(parsed.time)).getTime()), false, 'time harus ISO valid');
  return parsed;
}

test('logEvent writes one JSON line per call and maps level to the right stream', async () => {
  const captured = await captureConsole(async () => {
    logEvent('info', 'outbox.delivered', { operation: 'outbox.dispatch', component: 'google-sheets' });
    logEvent('warn', 'cron.rejected', { operation: 'cron.dispatch' });
    logEvent('error', 'request.failed', { operation: 'mapaba.registration', status: 500 });
  });

  assert.equal(captured.length, 3);
  assert.deepEqual(captured.map((entry) => entry.method), ['log', 'warn', 'error']);

  const [info, warn, error] = captured.map(parse);
  assert.equal(info?.level, 'info');
  assert.equal(info?.event, 'outbox.delivered');
  assert.equal(info?.component, 'google-sheets');
  assert.equal(warn?.level, 'warn');
  assert.equal(error?.level, 'error');
  assert.equal(error?.status, 500);
});

test('logEvent with no fields still produces a minimal, valid entry', async () => {
  const captured = await captureConsole(() => logEvent('info', 'health.degraded'));
  const entry = parse(captured[0]!);
  assert.equal(entry.event, 'health.degraded');
  assert.equal(entry.level, 'info');
});

test('classifyError attributes failures to their owning component', () => {
  // Kode Postgres → database (dengan constraint bila ada).
  const pgError = Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'mapaba_registration_nim_key' });
  assert.deepEqual(classifyError(pgError), {
    component: 'database',
    errorName: 'Error',
    pgCode: '23505',
    pgConstraint: 'mapaba_registration_nim_key',
  });

  // AppError → validation.
  const appError = new Error('field salah');
  appError.name = 'AppError';
  assert.deepEqual(classifyError(appError), { component: 'validation', errorName: 'AppError' });

  // Nama bertema Blob/Vercel → storage.
  const blobError = new Error('blob down');
  blobError.name = 'BlobStoreError';
  assert.deepEqual(classifyError(blobError), { component: 'storage', errorName: 'BlobStoreError' });

  // Sisanya → internal, dan non-Error tidak melempar.
  assert.deepEqual(classifyError(new Error('boom')), { component: 'internal', errorName: 'Error' });
  assert.deepEqual(classifyError('just a string'), { component: 'internal', errorName: 'UnknownError' });
  assert.deepEqual(classifyError(null), { component: 'internal', errorName: 'UnknownError' });
});

test('logDependencyFailure records safe metadata only and never the raw error message', async () => {
  const secret = 'postgresql://user:password@host/db?token=abc';
  const error = Object.assign(new Error(`koneksi gagal ke ${secret}`), { code: '08006' });

  const captured = await captureConsole(() =>
    logDependencyFailure({
      operation: 'outbox.dispatch',
      component: 'google-sheets',
      error,
      requestId: 'req-123',
      detail: 'google-sheets-mapaba',
      latencyMs: 42,
      attempt: 3,
    }),
  );

  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.method, 'error');
  const entry = parse(captured[0]!);
  assert.equal(entry.event, 'dependency.failed');
  assert.equal(entry.component, 'google-sheets');
  assert.equal(entry.errorName, 'Error');
  assert.equal(entry.pgCode, '08006');
  assert.equal(entry.requestId, 'req-123');
  assert.equal(entry.detail, 'google-sheets-mapaba');
  assert.equal(entry.latencyMs, 42);
  assert.equal(entry.attempt, 3);

  // Pesan error mentah (yang memuat kredensial) tidak boleh ikut tercetak.
  assert.doesNotMatch(captured[0]!.line, /password|token=abc|postgresql:\/\//);
});

test('logDependencyFailure omits optional fields when they are not provided', async () => {
  const captured = await captureConsole(() =>
    logDependencyFailure({ operation: 'health', component: 'database', error: new Error('x') }),
  );
  const entry = parse(captured[0]!);
  assert.equal(entry.event, 'dependency.failed');
  assert.equal('requestId' in entry, false);
  assert.equal('detail' in entry, false);
  assert.equal('latencyMs' in entry, false);
  assert.equal('attempt' in entry, false);
  assert.equal('pgCode' in entry, false);
});

test('classifyError never mistakes a real AppError code for a Postgres code', async () => {
  // Regresi: `AppError.code` adalah string seperti nama kode ('UNAUTHENTICATED').
  // Tanpa penjagaan, `classifyError` membacanya sebagai `error.code` Postgres dan
  // menandai kegagalan auth sebagai insiden database (`pgCode: 'UNAUTHENTICATED'`).
  const { AppError } = await import('../../src/server/errors.js');

  const classified = classifyError(new AppError('UNAUTHENTICATED', 'Sesi tidak valid.'));
  assert.equal(classified.component, 'validation');
  assert.equal(classified.errorName, 'AppError');
  assert.equal('pgCode' in classified, false, 'AppError tidak boleh menghasilkan pgCode');
  assert.equal('pgConstraint' in classified, false);
});

test('fail logs an AppError without a bogus pgCode field', async () => {
  const { fail } = await import('../../src/server/api/response.js');
  const { AppError } = await import('../../src/server/errors.js');

  const captured = await captureConsole(() => {
    // `fail` mengembalikan Response; test hanya memeriksa efek samping log-nya.
    fail(AppError.notFound('Data tidak ditemukan.'));
  });
  assert.equal(captured.length, 1);
  const entry = parse(captured[0]!);
  assert.equal(entry.errorCode, 'NOT_FOUND');
  assert.equal(entry.component, 'http');
  assert.equal('pgCode' in entry, false, 'kode AppError tidak boleh muncul sebagai pgCode');
});
import assert from 'node:assert/strict';
import test from 'node:test';

// Config dibaca saat modul diimpor; sediakan env minimal sebelum impor dinamis.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'security-guards-salt-with-enough-entropy';

/**
 * Penjaga keamanan tingkat permintaan: identitas klien untuk rate limit, otorisasi
 * cron, dan batas ukuran body. Ketiganya membaca `config` secara langsung, jadi
 * cabang "terkonfigurasi" diuji dengan mutasi terkendali pada objek config (bukan
 * variabel global), lalu dipulihkan.
 */

const loadConfig = () => import('../../src/server/config.js');
const loadClientIdentity = () => import('../../src/server/security/client-identity.js');
const loadCronAuth = () => import('../../src/server/security/cron-auth.js');
const loadRequestSize = () => import('../../src/server/security/request-size.js');

type MutableConfig = {
  trustedClientIpHeader: string;
  cronSecret: string;
  maxUploadBytes: number;
};

async function withConfig(
  patch: Partial<MutableConfig>,
  run: (config: MutableConfig) => void | Promise<void>,
): Promise<void> {
  const { default: config } = await loadConfig();
  const mutable = config as unknown as MutableConfig;
  const previous: Partial<Record<keyof MutableConfig, unknown>> = {};
  for (const key of Object.keys(patch) as (keyof MutableConfig)[]) {
    previous[key] = mutable[key];
    (mutable as Record<string, unknown>)[key] = patch[key];
  }
  try {
    await run(mutable);
  } finally {
    for (const key of Object.keys(previous) as (keyof MutableConfig)[]) {
      (mutable as Record<string, unknown>)[key] = previous[key];
    }
  }
}

test('clientSubject fails closed with a shared bucket when no trusted header is configured', async () => {
  const { clientSubject, UNKNOWN_CLIENT_SUBJECT } = await loadClientIdentity();
  await withConfig({ trustedClientIpHeader: '' }, () => {
    // Tanpa header tepercaya, bahkan header forwarding palsu tidak dipercaya.
    const spoofed = new Request('https://pmii.example/api', {
      headers: { 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '203.0.113.7' },
    });
    assert.equal(clientSubject(spoofed), UNKNOWN_CLIENT_SUBJECT);
    assert.equal(clientSubject(new Request('https://pmii.example/api')), UNKNOWN_CLIENT_SUBJECT);
  });
});

test('clientSubject uses only the configured trusted header and first hop', async () => {
  const { clientSubject, UNKNOWN_CLIENT_SUBJECT } = await loadClientIdentity();
  await withConfig({ trustedClientIpHeader: 'x-real-ip' }, () => {
    const withHeader = (value?: string) =>
      new Request('https://pmii.example/api', value === undefined ? {} : { headers: { 'x-real-ip': value } });

    assert.equal(clientSubject(withHeader('203.0.113.7')), '203.0.113.7');
    assert.equal(clientSubject(withHeader(' 203.0.113.7 ')), '203.0.113.7');
    // Daftar berantai diambil hop pertama saja.
    assert.equal(clientSubject(withHeader('203.0.113.7, 10.0.0.1, 10.0.0.2')), '203.0.113.7');
    // IPv6 ringkas diterima.
    assert.equal(clientSubject(withHeader('2001:db8::1')), '2001:db8::1');

    // Nilai yang tidak wajar jatuh ke bucket bersama, bukan membuat bucket unik.
    for (const bad of ['', '   ', 'not-an-ip', '999.1.1.1', '203.0.113', 'a'.repeat(46), '<script>']) {
      assert.equal(clientSubject(withHeader(bad)), UNKNOWN_CLIENT_SUBJECT, `harus UNKNOWN: "${bad}"`);
    }
    assert.equal(clientSubject(new Request('https://pmii.example/api')), UNKNOWN_CLIENT_SUBJECT);
  });
});

test('assertCronAuthorized refuses to run when no secret is configured', async () => {
  const { assertCronAuthorized } = await loadCronAuth();
  await withConfig({ cronSecret: '' }, () => {
    assert.throws(
      () => assertCronAuthorized(new Request('https://pmii.example/api/internal/cron/dispatch-outbox')),
      (error: { code?: string }) => error.code === 'DEPENDENCY_UNAVAILABLE',
    );
  });
});

test('assertCronAuthorized requires an exact bearer token and rejects every other form', async () => {
  const { assertCronAuthorized } = await loadCronAuth();
  const request = (authorization?: string) =>
    new Request('https://pmii.example/api/internal/cron/dispatch-outbox', {
      headers: authorization === undefined ? {} : { authorization },
    });

  await withConfig({ cronSecret: 'a-long-enough-cron-secret-value' }, () => {
    // Bentuk benar (spasi berlebih pada token dimaafkan karena `.trim()`).
    assert.doesNotThrow(() => assertCronAuthorized(request('Bearer a-long-enough-cron-secret-value')));
    assert.doesNotThrow(() => assertCronAuthorized(request('Bearer  a-long-enough-cron-secret-value ')));

    const unauthorized = (error: { code?: string; status?: number }) =>
      error.code === 'UNAUTHENTICATED' && error.status === 401;

    assert.throws(() => assertCronAuthorized(request()), unauthorized);
    assert.throws(() => assertCronAuthorized(request('')), unauthorized);
    assert.throws(() => assertCronAuthorized(request('a-long-enough-cron-secret-value')), unauthorized);
    // Panjang berbeda (memicu cabang length-check sebelum timingSafeEqual).
    assert.throws(() => assertCronAuthorized(request('Bearer short')), unauthorized);
    // Panjang sama tetapi isi berbeda.
    assert.throws(() => assertCronAuthorized(request('Bearer a-long-enough-cron-secret-XXXXX')), unauthorized);
    // Skema lain / huruf besar-kecil.
    assert.throws(() => assertCronAuthorized(request('bearer a-long-enough-cron-secret-value')), unauthorized);
    assert.throws(() => assertCronAuthorized(request('Basic a-long-enough-cron-secret-value')), unauthorized);
  });
});

test('assertDeclaredBodySize enforces Content-Length as an early filter', async () => {
  const { assertDeclaredBodySize } = await loadRequestSize();
  const request = (contentLength?: string) =>
    new Request('https://pmii.example/api/public/mapaba/registrations', {
      method: 'POST',
      headers: contentLength === undefined ? {} : { 'content-length': contentLength },
      body: 'x',
    });

  // Tanpa header (chunked transfer) dilewatkan; pemeriksaan setelah parse menangkapnya.
  assert.doesNotThrow(() => assertDeclaredBodySize(request(), 1024));
  // Tepat di batas masih diterima.
  assert.doesNotThrow(() => assertDeclaredBodySize(request('1024'), 1024));
  assert.doesNotThrow(() => assertDeclaredBodySize(request('0'), 1024));

  // Melebihi batas → 413.
  assert.throws(
    () => assertDeclaredBodySize(request('1025'), 1024),
    (error: { code?: string; status?: number }) => error.code === 'PAYLOAD_TOO_LARGE' && error.status === 413,
  );
  // Header tidak valid → 422 validasi, bukan dianggap nol.
  for (const bad of ['abc', '-1', 'NaN']) {
    assert.throws(
      () => assertDeclaredBodySize(request(bad), 1024),
      (error: { code?: string }) => error.code === 'VALIDATION_FAILED',
      `harus VALIDATION_FAILED: "${bad}"`,
    );
  }
});

test('JSON and upload body limits use the configured and fixed caps', async () => {
  const { assertJsonBodySize, assertUploadBodySize } = await loadRequestSize();
  const request = (contentLength: string) =>
    new Request('https://pmii.example/api/public/mapaba/uploads', {
      method: 'POST',
      headers: { 'content-length': contentLength },
      body: 'x',
    });

  await withConfig({ maxUploadBytes: 3 * 1024 * 1024 }, () => {
    // JSON: batas tetap 256 KB.
    assert.doesNotThrow(() => assertJsonBodySize(request(String(256 * 1024))));
    assert.throws(
      () => assertJsonBodySize(request(String(256 * 1024 + 1))),
      (error: { code?: string }) => error.code === 'PAYLOAD_TOO_LARGE',
    );
    // Parameter batas eksplisit dihormati (10 > 4 → 413).
    assert.throws(
      () => assertJsonBodySize(request('10'), 4),
      (error: { code?: string }) => error.code === 'PAYLOAD_TOO_LARGE',
    );
    assert.doesNotThrow(() => assertJsonBodySize(request('4'), 4));

    // Upload: maxUploadBytes + margin 64 KB untuk multipart.
    const uploadLimit = 3 * 1024 * 1024 + 64 * 1024;
    assert.doesNotThrow(() => assertUploadBodySize(request(String(uploadLimit))));
    assert.throws(
      () => assertUploadBodySize(request(String(uploadLimit + 1))),
      (error: { code?: string }) => error.code === 'PAYLOAD_TOO_LARGE',
    );
  });
});
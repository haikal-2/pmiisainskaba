import assert from 'node:assert/strict';
import test from 'node:test';

// `blob.ts` mengimpor config saat dimuat; sediakan env minimal non-produksi.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'storage-blob-salt-with-enough-entropy';
// Pastikan tidak ada kredensial Blob/OIDC yang membuat jalur ini "terkonfigurasi".
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL_OIDC_TOKEN;

const loadBlob = () => import('../../src/server/storage/blob.js');
const loadConfig = () => import('../../src/server/config-values.js');

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
]);

test('verifyImageSignature accepts JPG, PNG, and WebP when magic bytes match the declared type', async () => {
  const { verifyImageSignature } = await loadBlob();
  assert.equal(await verifyImageSignature(new File([JPEG], 'a.jpg', { type: 'image/jpeg' })), 'image/jpeg');
  assert.equal(await verifyImageSignature(new File([PNG], 'a.png', { type: 'image/png' })), 'image/png');
  assert.equal(await verifyImageSignature(new File([WEBP], 'a.webp', { type: 'image/webp' })), 'image/webp');
});

test('verifyImageSignature rejects a spoofed type, unknown bytes, and empty payloads', async () => {
  const { verifyImageSignature } = await loadBlob();
  // Magic JPEG tetapi mengaku PNG.
  await assert.rejects(
    verifyImageSignature(new File([JPEG], 'a.png', { type: 'image/png' })),
    (error: { code?: string }) => error.code === 'UNSUPPORTED_MEDIA_TYPE',
  );
  // Byte sampah dengan tipe yang diizinkan.
  await assert.rejects(
    verifyImageSignature(new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])], 'a.jpg', { type: 'image/jpeg' })),
    (error: { code?: string }) => error.code === 'UNSUPPORTED_MEDIA_TYPE',
  );
  // Berkas kosong: tidak ada magic byte yang cocok, jadi ditolak sebagai media tidak didukung.
  await assert.rejects(
    verifyImageSignature(new File([], 'empty.jpg', { type: 'image/jpeg' })),
    (error: { code?: string }) => error.code === 'UNSUPPORTED_MEDIA_TYPE',
  );
});

test('verifyImageSignature rejects files above the configured upload limit', async () => {
  const { verifyImageSignature } = await loadBlob();
  const { parseServerConfig } = await loadConfig();
  const limit = parseServerConfig({
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/pmii_test',
  }).maxUploadBytes;

  const oversized = new Uint8Array(limit + 1);
  oversized.set(JPEG, 0);
  await assert.rejects(
    verifyImageSignature(new File([oversized], 'big.jpg', { type: 'image/jpeg' })),
    (error: { code?: string }) => error.code === 'PAYLOAD_TOO_LARGE',
  );
});

test('isAllowedImageMime allows only the three raster formats', async () => {
  const { isAllowedImageMime } = await loadBlob();
  for (const allowed of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.equal(isAllowedImageMime(allowed), true);
  }
  for (const denied of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/html', '']) {
    assert.equal(isAllowedImageMime(denied), false);
  }
});

test('Blob operations fail hard with DEPENDENCY_UNAVAILABLE when no credential is configured', async () => {
  const { assertBlobConfigured, isBlobConfigured, putPrivateBlob, readPrivateBlob } = await loadBlob();
  assert.equal(isBlobConfigured(), false);
  assert.throws(() => assertBlobConfigured(), (error: { code?: string }) => error.code === 'DEPENDENCY_UNAVAILABLE');
  await assert.rejects(
    putPrivateBlob('mapaba-private/' + 'a'.repeat(48) + '/ktm', new File([JPEG], 'a.jpg', { type: 'image/jpeg' }), 'image/jpeg'),
    (error: { code?: string }) => error.code === 'DEPENDENCY_UNAVAILABLE',
  );
  await assert.rejects(
    readPrivateBlob('mapaba-private/' + 'a'.repeat(48) + '/ktm'),
    (error: { code?: string }) => error.code === 'DEPENDENCY_UNAVAILABLE',
  );
});
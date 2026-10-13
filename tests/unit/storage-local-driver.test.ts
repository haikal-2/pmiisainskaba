import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// Config dibaca saat impor; sediakan env minimal non-produksi.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'storage-local-salt-with-enough-entropy';

const loadPrivateStorage = () => import('../../src/server/storage/private-storage.js');
const HEX = 'b'.repeat(48);

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

/** Jalankan `run` di cwd sementara supaya `.local-uploads/` tidak mengotori repo. */
async function withTempCwd(run: () => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'pmii-storage-'));
  const previous = process.cwd();
  process.chdir(directory);
  try {
    await run();
  } finally {
    process.chdir(previous);
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test('local driver round-trips an image under .local-uploads without exposing a URL', async () => {
  const { putPrivateImage, openPrivateObject, privateStorageDriver } = await loadPrivateStorage();
  await withTempCwd(async () => {
    assert.equal(privateStorageDriver(), 'local');

    const written = await putPrivateImage({
      kind: 'pasFoto',
      file: new File([JPEG_BYTES], 'foto.jpg', { type: 'image/jpeg' }),
      contentType: 'image/jpeg',
      randomHex: HEX,
    });

    // Referensi adalah pathname kanonik, bukan URL dan bukan skema lokal.
    assert.equal(written.pathname, `mapaba-private/${HEX}/pasFoto`);
    assert.equal(written.size, JPEG_BYTES.byteLength);
    assert.doesNotMatch(written.pathname, /local-upload:|https?:\/\//);

    // Berkas benar-benar tersimpan di disk pada layout pathname.
    const stored = await readdir(join(process.cwd(), '.local-uploads', 'mapaba-private', HEX));
    assert.deepEqual(stored, ['pasFoto']);

    const stream = await openPrivateObject(written.pathname, 'image/jpeg');
    assert.ok(stream, 'objek yang ditulis harus dapat dibuka kembali');
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    assert.deepEqual([...bytes], [...JPEG_BYTES]);
  });
});

test('local driver writes each media kind at its own pathname without overwriting', async () => {
  const { putPrivateImage, openPrivateObject } = await loadPrivateStorage();
  await withTempCwd(async () => {
    const foto = await putPrivateImage({
      kind: 'pasFoto',
      file: new File([JPEG_BYTES], 'foto.jpg', { type: 'image/jpeg' }),
      contentType: 'image/jpeg',
      randomHex: HEX,
    });
    const ktm = await putPrivateImage({
      kind: 'ktm',
      file: new File([new Uint8Array([...JPEG_BYTES, 0x01])], 'ktm.jpg', { type: 'image/jpeg' }),
      contentType: 'image/jpeg',
      randomHex: HEX,
    });
    assert.notEqual(foto.pathname, ktm.pathname);
    assert.ok(await openPrivateObject(foto.pathname, 'image/jpeg'));
    assert.ok(await openPrivateObject(ktm.pathname, 'image/jpeg'));

    // Flag `wx`: pathname yang sama tidak boleh ditimpa diam-diam.
    await assert.rejects(
      putPrivateImage({
        kind: 'pasFoto',
        file: new File([JPEG_BYTES], 'foto.jpg', { type: 'image/jpeg' }),
        contentType: 'image/jpeg',
        randomHex: HEX,
      }),
      /EEXIST/,
    );
  });
});

test('local driver returns null for a missing object, a forged path, and never throws', async () => {
  const { openPrivateObject } = await loadPrivateStorage();
  await withTempCwd(async () => {
    // Pathname sah tetapi belum pernah ditulis.
    assert.equal(await openPrivateObject(`mapaba-private/${'c'.repeat(48)}/ktm`, 'image/jpeg'), null);
    // Pathname tidak sah: ditolak sebelum menyentuh disk.
    for (const forged of ['local-upload:/etc/passwd', '../secret', `mapaba-private/${HEX}`, '']) {
      assert.equal(await openPrivateObject(forged, 'image/jpeg'), null, `harus null: ${forged}`);
    }
  });
});
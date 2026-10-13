import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAPABA_MEDIA_KINDS,
  buildPrivatePathname,
  isPrivatePathname,
  toPrivatePathname,
} from '../../src/server/storage/reference';

/**
 * Kontrak referensi berkas privat.
 *
 * Yang dijaga di sini: klien tidak pernah melihat atau mengirim URL storage, dan
 * skema lokal (`local-upload:/...`) tidak pernah bisa masuk kembali ke sistem.
 * `reference.ts` sengaja bebas I/O dan `server-only` sehingga diuji langsung;
 * resolver driver (yang menyentuh config) dimuat lewat impor dinamis.
 */

// `private-storage` membaca config saat diimpor; sediakan URL database palsu
// (tidak pernah tersambung) supaya impor dinamis di bawah tidak gagal.
process.env.DATABASE_URL ??= 'postgresql://test:test@127.0.0.1:5432/pmii_test';
process.env.RATE_LIMIT_HASH_SALT ??= 'storage-reference-salt-with-enough-entropy';

const HEX48 = 'a'.repeat(48);

const loadPrivateStorage = () => import('../../src/server/storage/private-storage.js');

test('buildPrivatePathname builds a canonical opaque pathname per media kind', () => {
  for (const kind of MAPABA_MEDIA_KINDS) {
    const pathname = buildPrivatePathname(HEX48, kind);
    assert.equal(pathname, `mapaba-private/${HEX48}/${kind}`);
    assert.equal(isPrivatePathname(pathname), true);
  }
});

test('buildPrivatePathname rejects keys that are not 48 lowercase hex characters', () => {
  for (const bad of [
    '',
    'a'.repeat(47),
    'a'.repeat(49),
    'A'.repeat(48),
    'g'.repeat(48),
    `${HEX48} `,
    'zz',
  ]) {
    assert.throws(() => buildPrivatePathname(bad, 'pasFoto'), /48 karakter heksadesimal/);
  }
});

test('an unknown media kind can never produce a pathname the system accepts', () => {
  // `kind` hanya dijaga tipe TypeScript, jadi runtime bisa menerima nilai liar.
  // Jaminan keamanannya ada di lapisan berikutnya: pathname hasilnya TIDAK lolos
  // `isPrivatePathname`, sehingga tidak pernah bisa dipakai sebagai referensi sah.
  const forged = buildPrivatePathname(HEX48, 'kkn' as unknown as (typeof MAPABA_MEDIA_KINDS)[number]);
  assert.equal(isPrivatePathname(forged), false);
  assert.throws(() => toPrivatePathname(forged), /Tautan berkas tidak dikenali/);
});

test('isPrivatePathname accepts only the canonical pathname shape', () => {
  assert.equal(isPrivatePathname(`mapaba-private/${HEX48}/pasFoto`), true);
  assert.equal(isPrivatePathname(`mapaba-private/${HEX48}/ktm`), true);

  for (const bad of [
    undefined,
    null,
    42,
    {},
    `mapaba-private/${HEX48}/kkn`,
    `mapaba-private/${HEX48}`,
    `mapaba-private/${'A'.repeat(48)}/ktm`,
    `public-assets/${HEX48}/ktm`,
    `mapaba-private/${HEX48}/pasFoto/extra`,
    `../mapaba-private/${HEX48}/pasFoto`,
    `mapaba-private/${HEX48}/pasFoto `,
  ]) {
    assert.equal(isPrivatePathname(bad), false, `harus ditolak: ${String(bad)}`);
  }
});

test('toPrivatePathname passes canonical pathnames through and normalizes trusted Blob URLs', () => {
  const pathname = `mapaba-private/${HEX48}/pasFoto`;
  assert.equal(toPrivatePathname(pathname), pathname);
  assert.equal(toPrivatePathname(`  ${pathname}  `), pathname);
  assert.equal(
    toPrivatePathname(`https://store.public.blob.vercel-storage.com/${pathname}`),
    pathname,
  );
  assert.equal(toPrivatePathname(`https://x.blob.vercel-storage.com/${pathname}`), pathname);
});

test('toPrivatePathname rejects local scheme, plain http, foreign hosts, and non-canonical paths', () => {
  const pathname = `mapaba-private/${HEX48}/ktm`;
  for (const rejected of [
    `local-upload:/${pathname}`,
    `local-upload:${pathname}`,
    `http://store.public.blob.vercel-storage.com/${pathname}`,
    `https://evil.example/${pathname}`,
    `https://blob.vercel-storage.com.evil.example/${pathname}`,
    'https://store.public.blob.vercel-storage.com/other/path',
    `file:///${pathname}`,
    'not-a-url',
    '',
    '   ',
    `data:text/plain,${pathname}`,
  ]) {
    assert.throws(() => toPrivatePathname(rejected), /Tautan berkas tidak dikenali/, `harus ditolak: ${rejected}`);
  }
  for (const nonString of [undefined, null, 42, {}, []]) {
    assert.throws(() => toPrivatePathname(nonString), /Tautan berkas tidak dikenali/);
  }
});

test('resolvePrivateStorageDriver never falls back to local storage in production', async () => {
  const { resolvePrivateStorageDriver } = await loadPrivateStorage();
  // Kebenaran inti: produksi selalu blob, terlepas dari kredensial ada atau tidak.
  assert.equal(resolvePrivateStorageDriver({ isProduction: true, blobConfigured: false }), 'blob');
  assert.equal(resolvePrivateStorageDriver({ isProduction: true, blobConfigured: true }), 'blob');
  // Non-produksi hanya memakai disk saat Blob tidak dikonfigurasi.
  assert.equal(resolvePrivateStorageDriver({ isProduction: false, blobConfigured: true }), 'blob');
  assert.equal(resolvePrivateStorageDriver({ isProduction: false, blobConfigured: false }), 'local');
});
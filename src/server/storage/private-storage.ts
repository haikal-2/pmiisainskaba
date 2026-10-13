import 'server-only';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import config from '@/server/config';
import { AppError } from '@/server/errors';
import { buildPrivatePathname, isPrivatePathname, type MapabaMediaKind } from './reference';
import { isBlobConfigured, putPrivateBlob, readPrivateBlob, type AllowedImageMime } from './blob';

/**
 * Satu abstraksi penyimpanan berkas privat dengan dua implementasi eksplisit:
 *
 *   * `local` — hanya untuk non-produksi tanpa kredensial Blob. Ditulis di bawah
 *     `.local-uploads/` dan **tidak pernah** menghasilkan URL yang dipakai pengguna
 *     maupun dikirim ke integrasi eksternal (lihat `storage/reference.ts`).
 *   * `blob`  — produksi/staging memakai Vercel Blob private. Wajib dikonfigurasi;
 *     mode ini tidak pernah jatuh kembali ke disk serverless.
 *
 * Produksi tanpa token Blob adalah kesalahan konfigurasi, bukan alasan memakai
 * penyimpanan lokal: disk serverless bersifat sementara dan tidak dibagi antar
 * instance, jadi berkas akan hilang tanpa jejak. Aturannya dipegang satu tempat
 * (`resolvePrivateStorageDriver`) supaya tidak ada jalur yang bisa menyimpang.
 */

export type PrivateStorageDriver = 'local' | 'blob';

/**
 * Fungsi murni: produksi selalu `blob`, non-produksi tanpa kredensial memakai `local`.
 * Bebas I/O dan `process.env` agar aturan ini dapat diuji langsung.
 */
export function resolvePrivateStorageDriver(input: {
  isProduction: boolean;
  blobConfigured: boolean;
}): PrivateStorageDriver {
  return input.isProduction || input.blobConfigured ? 'blob' : 'local';
}

/**
 * Driver aktif. Di produksi tanpa kredensial Blob hasilnya tetap `blob`, sehingga
 * operasi berikutnya gagal keras lewat `assertBlobConfigured()` (503) alih-alih
 * menulis ke disk serverless yang tidak permanen.
 */
export function privateStorageDriver(): PrivateStorageDriver {
  return resolvePrivateStorageDriver({
    isProduction: config.isProduction,
    blobConfigured: isBlobConfigured(),
  });
}

export async function putPrivateImage(input: {
  kind: MapabaMediaKind;
  file: File;
  contentType: AllowedImageMime;
  randomHex: string;
}): Promise<{ pathname: string; size: number }> {
  const pathname = buildPrivatePathname(input.randomHex, input.kind);

  if (privateStorageDriver() === 'local') {
    const localPath = localFilePath(pathname);
    await mkdir(dirname(localPath), { recursive: true });
    await writeFile(localPath, Buffer.from(await input.file.arrayBuffer()), { flag: 'wx', mode: 0o600 });
    return { pathname, size: input.file.size };
  }
  const blob = await putPrivateBlob(pathname, input.file, input.contentType);
  return { pathname: blob.pathname, size: input.file.size };
}

/**
 * Dipakai hanya oleh endpoint admin ber-otorisasi. Mengembalikan null bila objek
 * tidak ada atau tipe kontennya tidak cocok — pemanggil tidak perlu tahu driver mana
 * yang aktif.
 */
export async function openPrivateObject(
  pathname: string,
  contentType: string,
): Promise<ReadableStream<Uint8Array> | null> {
  if (!isPrivatePathname(pathname)) return null;

  if (privateStorageDriver() === 'local') {
    let file: Buffer;
    try {
      file = await readFile(localFilePath(pathname));
    } catch {
      return null;
    }
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(file));
        controller.close();
      },
    });
  }

  const blob = await readPrivateBlob(pathname);
  if (!blob || blob.statusCode !== 200) return null;
  if (blob.blob.contentType !== contentType) return null;
  return blob.stream;
}

function localFilePath(pathname: string): string {
  if (!isPrivatePathname(pathname)) throw AppError.notFound();
  return join(process.cwd(), '.local-uploads', ...pathname.split('/'));
}
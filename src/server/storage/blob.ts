import 'server-only';

import { get, put } from '@vercel/blob';

import config from '@/server/config';
import { AppError } from '@/server/errors';
import { isPrivatePathname } from './reference';

/**
 * Pembungkus tipis Vercel Blob private.
 *
 * Modul ini tidak tahu apa-apa soal fallback lokal: pemilihan driver ada di
 * `storage/private-storage.ts`. Di sini setiap operasi selalu ke Blob dan gagal
 * keras bila kredensial belum ada.
 */

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

const ALLOWED_IMAGE_MIMES: readonly AllowedImageMime[] = ['image/jpeg', 'image/png', 'image/webp'];

export function isBlobConfigured(): boolean {
  return Boolean(config.blobReadWriteToken || process.env.VERCEL_OIDC_TOKEN);
}

export function assertBlobConfigured(): void {
  if (!isBlobConfigured()) {
    throw new AppError('DEPENDENCY_UNAVAILABLE', 'Penyimpanan berkas (Vercel Blob) belum dikonfigurasi.');
  }
}

export function isAllowedImageMime(value: string): value is AllowedImageMime {
  return (ALLOWED_IMAGE_MIMES as readonly string[]).includes(value);
}

/** Cocokkan magic bytes dengan tipe yang diklaim klien sebelum menyentuh storage. */
export async function verifyImageSignature(file: File): Promise<AllowedImageMime> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime: AllowedImageMime | null =
    bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      ? 'image/jpeg'
      : bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        ? 'image/png'
        : bytes.length >= 12 &&
          String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
          String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
          ? 'image/webp'
          : null;
  if (!mime || mime !== file.type) {
    throw new AppError('UNSUPPORTED_MEDIA_TYPE', 'Isi berkas tidak cocok dengan format JPG, PNG, atau WebP.');
  }
  if (file.size <= 0 || file.size > config.maxUploadBytes) {
    throw new AppError(
      'PAYLOAD_TOO_LARGE',
      `Ukuran berkas harus lebih dari 0 dan maksimal ${Math.floor(config.maxUploadBytes / (1024 * 1024))} MB.`,
    );
  }
  return mime;
}

export async function putPrivateBlob(
  pathname: string,
  file: File,
  contentType: AllowedImageMime,
): Promise<{ pathname: string }> {
  assertBlobConfigured();
  if (!isPrivatePathname(pathname)) throw AppError.validation('Kunci objek privat tidak valid.');
  const blob = await put(pathname, file, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
    token: config.blobReadWriteToken || undefined,
  });
  return { pathname: blob.pathname };
}

export async function readPrivateBlob(pathname: string) {
  assertBlobConfigured();
  if (!isPrivatePathname(pathname)) throw AppError.notFound();
  return get(pathname, {
    access: 'private',
    token: config.blobReadWriteToken || undefined,
  });
}

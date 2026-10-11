import 'server-only';

import { del, get, put } from '@vercel/blob';
import { randomBytes } from 'node:crypto';

import config from '@/server/config';
import { AppError } from '@/server/errors';

export type AllowedImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

export function assertBlobConfigured(): void {
  if (!config.blobReadWriteToken && !process.env.VERCEL_OIDC_TOKEN) {
    throw new AppError('DEPENDENCY_UNAVAILABLE', 'Penyimpanan berkas belum dikonfigurasi.');
  }
}

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
    throw new AppError('PAYLOAD_TOO_LARGE', 'Ukuran berkas harus lebih dari 0 dan maksimal 3 MB.');
  }
  return mime;
}

export async function uploadPrivateMapabaFile(file: File, kind: 'pasFoto' | 'ktm') {
  assertBlobConfigured();
  const mimeType = await verifyImageSignature(file);
  const randomKey = randomBytes(24).toString('hex');
  const pathname = `mapaba-private/${randomKey}/${kind}`;
  const blob = await put(pathname, file, {
    access: 'private',
    contentType: mimeType,
    addRandomSuffix: false,
    token: config.blobReadWriteToken || undefined,
  });
  return { pathname: blob.pathname, url: blob.url, contentType: mimeType, size: file.size };
}

export async function getPrivateBlob(pathname: string) {
  assertBlobConfigured();
  return get(pathname, {
    access: 'private',
    token: config.blobReadWriteToken || undefined,
  });
}

export async function deleteBlob(url: string): Promise<void> {
  assertBlobConfigured();
  await del(url, { token: config.blobReadWriteToken || undefined });
}

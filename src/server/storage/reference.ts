/**
 * Referensi berkas privat disimpan sebagai *pathname* kanonik
 * (`mapaba-private/<48 hex>/<pasFoto|ktm>`), bukan URL.
 *
 * Alasan:
 *   * URL `local-upload:/...` tidak pernah boleh keluar dari server — tautan itu
 *     tidak dapat dibuka siapa pun dan tidak ada artinya di Google Sheets.
 *   * URL Blob bertanda tangan ikut kedaluwarsa dan membocorkan lokasi objek.
 *
 * Modul ini sengaja bebas dari `server-only` dan I/O agar kontrak penyimpanan
 * dapat diuji langsung tanpa database maupun jaringan.
 */

export const MAPABA_MEDIA_KINDS = ['pasFoto', 'ktm'] as const;

export type MapabaMediaKind = (typeof MAPABA_MEDIA_KINDS)[number];

export type UploadedObject = {
  /** Kunci objek kanonik yang dipakai sebagai identitas tunggal. */
  pathname: string;
  contentType: string;
  size: number;
};

const PATHNAME_PATTERN = /^mapaba-private\/[a-f0-9]{48}\/(pasFoto|ktm)$/;
const BLOB_HOST_SUFFIX = '.blob.vercel-storage.com';

export function buildPrivatePathname(randomHex: string, kind: MapabaMediaKind): string {
  if (!/^[a-f0-9]{48}$/.test(randomHex)) {
    throw new Error('Kunci acak berkas privat harus 48 karakter heksadesimal.');
  }
  return `mapaba-private/${randomHex}/${kind}`;
}

/** Benar hanya untuk pathname kanonik hasil `buildPrivatePathname`. */
export function isPrivatePathname(value: unknown): value is string {
  return typeof value === 'string' && PATHNAME_PATTERN.test(value);
}

/**
 * Terima referensi yang dikirim ulang klien dan kembalikan pathname kanonik.
 * Hanya pathname kanonik dan URL Blob tepercaya yang diterima; skema lain
 * (termasuk `local-upload:`) ditolak agar tidak ada jalur lokal yang bocor.
 */
export function toPrivatePathname(reference: unknown): string {
  if (typeof reference !== 'string') throw invalidReference();
  const value = reference.trim();
  if (value.length === 0) throw invalidReference();
  if (isPrivatePathname(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalidReference();
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
    throw invalidReference();
  }
  const pathname = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!isPrivatePathname(pathname)) throw invalidReference();
  return pathname;
}

function invalidReference(): Error {
  const error = new Error('Tautan berkas tidak dikenali.');
  error.name = 'InvalidFileReferenceError';
  return error;
}

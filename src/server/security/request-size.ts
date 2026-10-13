import 'server-only';

import config from '@/server/config';
import { AppError } from '@/server/errors';

/**
 * Batas keras ukuran body permintaan, diperiksa *sebelum* body diparse.
 *
 * `request.formData()` / `request.json()` menahan seluruh body di memori lebih dulu,
 * jadi pemeriksaan ukuran setelahnya sudah terlambat: fungsi serverless bisa kehabisan
 * memori sebelum validasi kita berjalan. Header `Content-Length` datang dari klien
 * sehingga hanya dipakai sebagai penyaring awal yang murah; pemanggil tetap wajib
 * memeriksa `file.size` hasil parse (lihat `verifyImageSignature`).
 */

/**
 * Batas berdasarkan `Content-Length`. Melempar 413 bila header melampaui batas.
 * Header yang hilang/tidak valid dilewatkan — itu kasus chunked transfer, bukan
 * pelanggaran; pemeriksaan setelah parse tetap menangkapnya.
 */
export function assertDeclaredBodySize(request: Request, maxBytes: number): void {
  const header = request.headers.get('content-length');
  if (!header) return;
  const declared = Number(header);
  if (!Number.isFinite(declared) || declared < 0) {
    throw AppError.validation('Ukuran permintaan tidak valid.');
  }
  if (declared > maxBytes) {
    throw new AppError('PAYLOAD_TOO_LARGE', `Permintaan melebihi batas ${formatMegabytes(maxBytes)} MB.`);
  }
}

/** Batas body untuk endpoint yang membawa satu berkas gambar. */
export function assertUploadBodySize(request: Request): void {
  // Batas berkas 3 MB + margin untuk boundary/multipart dan field teks pendek.
  assertDeclaredBodySize(request, config.maxUploadBytes + 64 * 1024);
}

/** Batas body untuk endpoint JSON kecil (login, formulir advokasi, dan sejenisnya). */
export function assertJsonBodySize(request: Request, maxBytes = 256 * 1024): void {
  assertDeclaredBodySize(request, maxBytes);
}

function formatMegabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(0);
}

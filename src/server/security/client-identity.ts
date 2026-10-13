import 'server-only';

import config from '@/server/config';

/**
 * Identitas klien untuk rate limit.
 *
 * Header forwarding hanya boleh dipercaya bila proxy di depannya benar-benar
 * menimpanya. Sebelumnya kita membaca `x-forwarded-for` apa adanya — setiap klien
 * dapat memalsukan header itu dan menghindari kuota sepenuhnya. Sekarang:
 *
 *   * Produksi memakai header yang ditentukan `TRUSTED_CLIENT_IP_HEADER`
 *     (mis. `x-real-ip` di belakang proxy yang menimpanya) dan **gagal tertutup**
 *     bila nilainya tidak ada. Tanpa itu, bucket memakai konstanta sehingga
 *     seluruh trafik berbagi satu kuota — lebih baik daripada melewati kuota diam-diam.
 *   * Non-produksi memakai konstanta yang stabil agar pengujian lokal tidak
 *     memblokir diri sendiri, dan supaya perilaku lokal tidak berbeda dari produksi
 *     kecuali pada tingkat kepercayaan header.
 *
 * Yang disimpan di database tetap HMAC (`deriveRateLimitHash`), bukan nilai mentah.
 */

export const UNKNOWN_CLIENT_SUBJECT = 'untrusted-client';

export function clientSubject(request: Request): string {
  const headerName = config.trustedClientIpHeader;
  if (!headerName) return UNKNOWN_CLIENT_SUBJECT;

  const value = request.headers.get(headerName);
  const candidate = value?.split(',')[0]?.trim();
  if (!candidate || !isPlausibleIp(candidate)) return UNKNOWN_CLIENT_SUBJECT;
  return candidate;
}

/**
 * Terima IPv4/IPv6 literal saja. Header tepercaya pun tidak boleh memasukkan
 * string sembarang ke bucket rate limit.
 */
function isPlausibleIp(value: string): boolean {
  if (value.length === 0 || value.length > 45) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) {
    return value.split('.').every((part) => Number(part) <= 255);
  }
  // IPv6 ringkas: hanya heksadesimal, titik, dan titik dua.
  return /^[0-9a-fA-F:.]+$/.test(value) && value.includes(':');
}

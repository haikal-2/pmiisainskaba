import 'server-only';

import { Composio } from '@composio/core';

import config from '@/server/config';
import { AppError } from '@/server/errors';

/**
 * Klien Composio Platform.
 *
 * SDK membaca `COMPOSIO_API_KEY` dari environment, jadi kuncinya tidak pernah
 * dilewatkan inline, dicetak, atau disimpan di database. `allowTracking`
 * dimatikan agar metadata penggunaan SDK tidak dikirim ke pihak ketiga tanpa
 * keputusan eksplisit; nyalakan hanya bila tim memang menginginkannya.
 */

let cachedClient: Composio | null = null;

export function isComposioConfigured(): boolean {
  return config.composio.apiKey.length > 0;
}

export function getComposioClient(): Composio {
  if (!isComposioConfigured()) {
    throw new AppError(
      'DEPENDENCY_UNAVAILABLE',
      'Integrasi Composio belum dikonfigurasi: variabel COMPOSIO_API_KEY belum diisi.',
    );
  }
  if (!cachedClient) {
    cachedClient = new Composio({ allowTracking: false });
  }
  return cachedClient;
}

/** Dipakai pengujian agar klien tidak bertahan antar-kasus. */
export function resetComposioClient(): void {
  cachedClient = null;
}

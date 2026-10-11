import 'server-only';

import { timingSafeEqual, createHmac, randomBytes } from 'node:crypto';
import { query } from '@/server/db/pool';
import { getDatabase } from '@/server/db/database';
import config from '@/server/config';
import { AppError } from '@/server/errors';
import {
  deriveRateLimitHash as deriveRateLimitServiceHash,
  enforceRateLimit as enforceRateLimitService,
  RateLimitExceededError,
  type RateLimitPolicy,
} from './rate-limit-service';

export type { RateLimitPolicy } from './rate-limit-service';

/**
 * Hash identifier turunan dengan HMAC; nilai sumber tidak pernah disimpan/log.
 * Route publik boleh mengirim IP dari request untuk dihitung di memori, tetapi
 * database hanya menyimpan hash berkunci yang tidak dapat dibalik.
 */
export function deriveRateLimitHash(scope: string, subject: string): string {
  const key = config.rateLimit.hashSalt;
  if (!key || key.length < 16) {
    if (config.isProduction) throw new Error('RATE_LIMIT_HASH_SALT wajib diisi minimal 16 karakter di produksi.');
  }
  return deriveRateLimitServiceHash(key || 'dev-only-salt-change-me', scope, subject);
}

export async function enforceRateLimit(
  scope: string,
  subject: string,
  policy: RateLimitPolicy,
): Promise<void> {
  try {
    await enforceRateLimitService(getDatabase(), config.rateLimit.hashSalt, scope, subject, policy);
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      throw new AppError('RATE_LIMITED', 'Terlalu banyak percobaan. Silakan coba lagi nanti.');
    }
    throw error;
  }
}

/** Idempotency key berentropi tinggi, tersimpan sebagai hash saja. */
export function makeIdempotencyHash(key: string): string {
  return createHmac('sha256', config.rateLimit.hashSalt || 'dev-only-salt-change-me')
    .update(key)
    .digest('hex');
}

export function generateIdempotencyKey(): string {
  return randomBytes(24).toString('base64url');
}

export async function reserveIdempotency(
  scope: string,
  key: string,
  ttlSeconds = 60 * 60 * 24,
): Promise<boolean> {
  const hash = makeIdempotencyHash(key);
  const result = await query(
    `INSERT INTO submission_guard (scope, idempotency_hash, expires_at)
     VALUES ($1, $2, now() + ($3 * interval '1 second'))
     ON CONFLICT (scope, idempotency_hash) DO NOTHING
     RETURNING id`,
    [scope, hash, ttlSeconds],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function setIdempotencyResult(
  scope: string,
  key: string,
  kind: string,
  ref: string,
): Promise<void> {
  await query(
    `UPDATE submission_guard
     SET result_kind = $3, result_ref = $4
     WHERE scope = $1 AND idempotency_hash = $2`,
    [scope, makeIdempotencyHash(key), kind, ref],
  );
}

/** Compare HMAC digests timing-safely (for opaque draft tokens). */
export function constantTimeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

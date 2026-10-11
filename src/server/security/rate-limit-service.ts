import { createHmac } from 'node:crypto';

import type { Database, DbExecutor } from '../db/types';

export type RateLimitPolicy = {
  limit: number;
  windowSeconds: number;
  blockSeconds?: number;
};

export class RateLimitExceededError extends Error {
  constructor() {
    super('Terlalu banyak percobaan. Silakan coba lagi nanti.');
    this.name = 'RateLimitExceededError';
  }
}

export function deriveRateLimitHash(salt: string, scope: string, subject: string): string {
  return createHmac('sha256', salt)
    .update(scope)
    .update('\0')
    .update(subject)
    .digest('hex');
}

export async function enforceRateLimit(
  database: Database,
  salt: string,
  scope: string,
  subject: string,
  policy: RateLimitPolicy,
): Promise<void> {
  const now = Date.now();
  const windowMillis = policy.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMillis) * windowMillis);
  const blockedUntil = policy.blockSeconds ? new Date(now + policy.blockSeconds * 1000) : null;
  const hash = deriveRateLimitHash(salt, scope, subject);

  const result = await database.transaction(async (transaction: DbExecutor) => {
    const current = await transaction.query<{ hits: number; blocked_until: Date | string | null }>(
      `INSERT INTO rate_limit_counter (scope, subject_hash, window_start, hits, blocked_until)
       VALUES ($1, $2, $3, 1, NULL)
       ON CONFLICT (scope, subject_hash, window_start)
       DO UPDATE SET hits = rate_limit_counter.hits + 1
       RETURNING hits, blocked_until`,
      [scope, hash, windowStart],
    );
    const row = current.rows[0];
    if (!row) return false;
    if (row.blocked_until && new Date(row.blocked_until).getTime() > now) return false;
    if (row.hits > policy.limit) {
      if (blockedUntil) {
        await transaction.query(
          `UPDATE rate_limit_counter SET blocked_until = $4
           WHERE scope = $1 AND subject_hash = $2 AND window_start = $3`,
          [scope, hash, windowStart, blockedUntil],
        );
      }
      return false;
    }
    return true;
  });

  if (!result) throw new RateLimitExceededError();
}

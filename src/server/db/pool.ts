import 'server-only';

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import config from '@/server/config';

/**
 * Pool PostgreSQL untuk runtime serverless.
 *
 * - Ukuran pool kecil karena tiap instance fungsi membuka koneksinya sendiri;
 *   pooling sesungguhnya dilakukan oleh proxy penyedia (mis. PgBouncer Neon).
 * - Driver `pg` dipakai langsung (bukan ORM) agar tidak ada dependensi build
 *   engine, dan agar SQL migrasi dapat dikendalikan sepenuhnya.
 * - `server-only` menjamin modul ini tidak pernah masuk bundel browser.
 */

declare global {
  var __pmiiPool: Pool | undefined;
}

function createPool(): Pool {
  const useSsl = config.databaseSsl;
  const isLocal = /(^|@)(localhost|127\.0\.0\.1|\[::1\])/.test(config.databaseUrl);

  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'pmii-saintek-web',
    // SSL tidak dipakai untuk PostgreSQL loopback.
    ...(useSsl && !isLocal ? { ssl: { rejectUnauthorized: false } } : {}),
  });

  pool.on('error', (error) => {
    console.error('PostgreSQL idle client error', error);
  });

  return pool;
}

/** Singleton pool agar hot-reload dev tidak membocorkan koneksi. */
export function getPool(): Pool {
  if (!globalThis.__pmiiPool) {
    globalThis.__pmiiPool = createPool();
  }
  return globalThis.__pmiiPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as unknown[]);
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] ?? null;
}

/**
 * Jalankan beberapa statement dalam satu transaksi.
 *
 * Semua operasi bernilai (kuota, nomor unik, audit) harus lewat sini agar
 * rollback terjadi utuh saat salah satu langkah gagal.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('PostgreSQL transaction rollback failed', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Kesehatan database untuk endpoint status internal. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

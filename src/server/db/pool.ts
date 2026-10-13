import 'server-only';

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

import config from '@/server/config';
import type { Database } from './types';

/**
 * Jalur data tunggal untuk seluruh server.
 *
 * Sebelumnya service/route memakai `query`/`withTransaction` dari file ini sementara
 * test integrasi memakai objek `Database` yang lain. Akibatnya test alur MAPABA tidak
 * dapat berjalan tanpa menyentuh PostgreSQL nyata. Sekarang kedua jalur melewati
 * seam yang sama: produksi memakai pool `pg`, test boleh meng-inject database
 * terisolasi lewat `setDatabaseForTesting`.
 *
 * - Ukuran pool kecil karena tiap instance fungsi serverless membuka koneksinya
 *   sendiri; pooling sesungguhnya dilakukan proxy penyedia (mis. PgBouncer Neon).
 * - Driver `pg` dipakai langsung (bukan ORM) agar SQL migrasi terkendali penuh.
 * - `server-only` menjamin modul ini tidak pernah masuk bundel browser.
 */

declare global {
  var __pmiiPool: Pool | undefined;
  var __pmiiDbOverride: Database | undefined;
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

/**
 * Ganti database untuk test integrasi. Hanya test yang boleh memanggil ini.
 */
export function setDatabaseForTesting(database: Database | undefined): void {
  globalThis.__pmiiDbOverride = database;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  const override = globalThis.__pmiiDbOverride;
  if (override) {
    const result = await override.query<T>(text, params);
    return { rows: result.rows, rowCount: result.rowCount, command: '', oid: 0, fields: [] };
  }
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
 * Semua operasi bernilai (kuota, nomor unik, audit) harus lewat sini agar rollback
 * terjadi utuh saat salah satu langkah gagal.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const override = globalThis.__pmiiDbOverride;
  if (override) {
    // PoolClient dan DbExecutor sama-sama hanya butuh `query`; cast sempit di bawah
    // menjaga satu signature untuk pemanggil tanpa memaksa test memalsukan PoolClient.
    return override.transaction((transaction) => fn(transaction as unknown as PoolClient));
  }

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

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Database, DbExecutor } from '../../../src/server/db/types';

/**
 * Utilitas bersama untuk test integrasi baru (route + outbox + storage).
 *
 * Pola yang diikuti sama dengan `tests/mapaba/registration-flow.test.ts`:
 *   * PGlite in-memory + migrasi asli — tidak pernah menyentuh PostgreSQL nyata;
 *   * seam jalur data (`setDatabaseForTesting`) diarahkan ke PGlite;
 *   * seam jalur `getDatabase()` (dipakai rate limit & health) juga diarahkan,
 *     karena route mengakses dua seam berbeda.
 *
 * Modul ini sengaja bebas `server-only` dan hanya memuat dependency lewat
 * `await import()` agar konfigurasi server (yang dibaca saat impor) selalu melihat
 * environment test yang sudah disiapkan pemanggil.
 */

/** Direktori migrasi asli; jangan bergantung pada cwd yang diubah test storage lokal. */
export const MIGRATIONS_DIR = join(process.cwd(), 'src', 'server', 'db', 'migrations');

export type TestDatabase = Database & { close(): Promise<void> };

const globalWithDatabase = globalThis as typeof globalThis & {
  __pmiiDbOverride?: Database;
  __pmiiDatabase?: Database;
};

/** Arahkan kedua seam database ke PGlite terisolasi selama `run` berjalan. */
export async function withTestDatabase(run: (database: TestDatabase) => Promise<void>): Promise<void> {
  const { createPgliteDatabase } = await import('./pglite-database.js');
  const { runMigrations } = await import('../../../src/server/db/migrate.js');
  const { setDatabaseForTesting } = await import('../../../src/server/db/pool.js');

  const previousOverride = globalWithDatabase.__pmiiDbOverride;
  const previousDatabase = globalWithDatabase.__pmiiDatabase;

  const database = await createPgliteDatabase();
  setDatabaseForTesting(database);
  globalWithDatabase.__pmiiDatabase = database;
  try {
    await runMigrations(database, MIGRATIONS_DIR);
    await run(database);
  } finally {
    setDatabaseForTesting(previousOverride);
    globalWithDatabase.__pmiiDatabase = previousDatabase;
    await database.close();
  }
}

/** Jalankan `run` dengan cwd diarahkan ke direktori sementara (untuk driver storage lokal). */
export async function withTempCwd(run: () => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'pmii-integration-'));
  const previousCwd = process.cwd();
  process.chdir(directory);
  try {
    await run();
  } finally {
    process.chdir(previousCwd);
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

/** Database yang selalu gagal — untuk menguji jalur "dependency tidak sehat". */
export function failingDatabase(): Database {
  const executor: DbExecutor = {
    async query(): Promise<never> {
      throw new Error('database tidak tersedia');
    },
  };
  return {
    query: executor.query,
    async transaction() {
      throw new Error('database tidak tersedia');
    },
  };
}
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Database } from './types';

const DEFAULT_MIGRATIONS_DIRECTORY = resolve(process.cwd(), 'src/server/db/migrations');

export async function runMigrations(
  database: Database,
  migrationsDirectory = DEFAULT_MIGRATIONS_DIRECTORY,
): Promise<void> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const sql = await readFile(resolve(migrationsDirectory, file), 'utf8');
    const version = file.replace(/\.sql$/, '');
    const checksum = createHash('sha256').update(sql).digest('hex');
    let alreadyApplied = false;
    await database.transaction(async (transaction) => {
      await transaction.query('LOCK TABLE schema_migrations IN EXCLUSIVE MODE');
      const applied = await transaction.query<{ checksum: string }>(
        'SELECT checksum FROM schema_migrations WHERE version = $1',
        [version],
      );
      const previousChecksum = applied.rows[0]?.checksum;
      if (previousChecksum !== undefined) {
        if (previousChecksum !== checksum) {
          throw new Error(`Checksum migrasi ${version} berubah. Tambahkan migrasi baru; jangan edit yang sudah diterapkan.`);
        }
        alreadyApplied = true;
        return;
      }
      if (transaction.executeScript) await transaction.executeScript(sql);
      else await transaction.query(sql);
      await transaction.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
        [version, checksum],
      );
    });
    if (alreadyApplied) continue;
  }
}

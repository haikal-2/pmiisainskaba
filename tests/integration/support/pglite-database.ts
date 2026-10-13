import { PGlite } from '@electric-sql/pglite';

import type { Database, DbExecutor, DbResult } from '../../../src/server/db/types';

type PgliteResult<Row> = { rows: Row[]; affectedRows?: number };

export async function createPgliteDatabase(): Promise<Database & { close(): Promise<void> }> {
  const client = new PGlite();
  await client.waitReady;
  // PGlite menjalankan setiap query/exec di dalam "transaction slot" miliknya. Panggilan
  // bersarang saat transaksi masih terbuka akan langsung throw, jadi jalur transaksi harus
  // memakai API `client.transaction()` bawaan, bukan BEGIN/COMMIT manual di atas mutex pool.
  const executorFor = (queryable: {
    query<Row extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<PgliteResult<Row>>;
    exec(sql: string): Promise<unknown>;
  }): DbExecutor => ({
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<DbResult<Row>> {
      const result = await queryable.query<Row>(text, [...values]);
      return { rows: result.rows, rowCount: result.affectedRows ?? null };
    },
    // Migrasi berisi banyak statement; PGlite hanya menerima skrip multi-statement lewat exec().
    async executeScript(sql: string): Promise<void> {
      await queryable.exec(sql);
    },
  });

  return {
    query: executorFor(client).query,
    async executeScript(sql: string): Promise<void> {
      await client.exec(sql);
    },
    async transaction<T>(operation: (transaction: DbExecutor) => Promise<T>): Promise<T> {
      return client.transaction(async (transaction) => operation(executorFor(transaction)));
    },
    close: () => client.close(),
  };
}

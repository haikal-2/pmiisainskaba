import { PGlite } from '@electric-sql/pglite';

import type { Database, DbExecutor, DbResult } from '../../../src/server/db/types';

export async function createPgliteDatabase(): Promise<Database & { close(): Promise<void> }> {
  const client = new PGlite();
  await client.waitReady;
  const executor: DbExecutor = {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<DbResult<Row>> {
      const result = await client.query<Row>(text, [...values]);
      return { rows: result.rows, rowCount: result.affectedRows ?? null };
    },
    async executeScript(sql: string): Promise<void> {
      await client.exec(sql);
    },
  };
  return {
    ...executor,
    async transaction<T>(operation: (transaction: DbExecutor) => Promise<T>): Promise<T> {
      await client.exec('BEGIN');
      try {
        const result = await operation(executor);
        await client.exec('COMMIT');
        return result;
      } catch (error) {
        await client.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => client.close(),
  };
}

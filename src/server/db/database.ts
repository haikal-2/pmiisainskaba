import 'server-only';

import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import config from '@/server/config';
import type { Database, DbExecutor, DbResult } from './types';

declare global {
  var __pmiiDatabase: Database | undefined;
}

function executor(queryable: Pick<PoolClient, 'query'>): DbExecutor {
  return {
    async query<Row extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<DbResult<Row>> {
      const result = await queryable.query<Row & QueryResultRow>(text, [...values]);
      return { rows: result.rows, rowCount: result.rowCount };
    },
    async executeScript(sql: string): Promise<void> {
      await queryable.query(sql);
    },
  };
}

export function createPostgresDatabase(): Database {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    application_name: 'pmii-saintek-web',
    ...(config.databaseSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  });
  pool.on('error', (error) => {
    console.error('PostgreSQL idle client error', error);
  });
  const root = executor(pool);
  const database: Database = {
    ...root,
    async close(): Promise<void> {
      await pool.end();
      if (globalThis.__pmiiDatabase === database) globalThis.__pmiiDatabase = undefined;
    },
    async transaction<T>(operation: (transaction: DbExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await operation(executor(client));
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
    },
  };
  return database;
}

export function getDatabase(): Database {
  if (!globalThis.__pmiiDatabase) globalThis.__pmiiDatabase = createPostgresDatabase();
  return globalThis.__pmiiDatabase;
}

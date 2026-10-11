export type DbResult<Row> = {
  rows: Row[];
  rowCount: number | null;
};

export interface DbExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<DbResult<Row>>;
  executeScript?(sql: string): Promise<void>;
}

export interface Database extends DbExecutor {
  transaction<T>(operation: (transaction: DbExecutor) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

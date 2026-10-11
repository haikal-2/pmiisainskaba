import { createPgliteDatabase } from '../tests/integration/support/pglite-database';
import { runMigrations } from '../src/server/db/migrate';

async function main(): Promise<void> {
  const db = await createPgliteDatabase();
  try {
    await runMigrations(db);
    const result = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    console.log(`Tabel dibuat (${result.rows.length}):`);
    for (const row of result.rows) console.log(`  ${row.table_name}`);
  } finally {
    await db.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

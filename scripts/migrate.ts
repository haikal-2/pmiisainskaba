import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const [{ getDatabase }, { runMigrations }] = await Promise.all([
    import('../src/server/db/database'),
    import('../src/server/db/migrate'),
  ]);
  const database = getDatabase();
  try {
    await runMigrations(database);
    console.log('Database migrations are up to date.');
  } finally {
    await database.close?.();
  }
}

main().catch((error: unknown) => {
  console.error('Database migration failed.', error);
  process.exitCode = 1;
});

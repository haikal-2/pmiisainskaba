import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const [{ getDatabase }, { seedPublicContent }, { default: config }] = await Promise.all([
    import('../src/server/db/database'),
    import('../src/server/db/seed'),
    import('../src/server/config'),
  ]);
  const database = getDatabase();
  try {
    await seedPublicContent(database, undefined, config.mapaba);
    console.log('Public reference content is seeded without overwriting existing edits.');
  } finally {
    await database.close?.();
  }
}

main().catch((error: unknown) => {
  console.error('Public content seed failed.', error);
  process.exitCode = 1;
});

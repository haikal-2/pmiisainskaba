import { loadEnvConfig } from '@next/env';
import { stdout } from 'node:process';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const [{ getDatabase }, { default: config }, { revokeAllAdminSessions }, prompts] = await Promise.all([
    import('../src/server/db/database'),
    import('../src/server/config'),
    import('../src/server/auth/admin-operations'),
    import('./admin-cli'),
  ]);
  const database = getDatabase();
  try {
    await prompts.runAfterDatabaseConfirmation(
      config.databaseUrl,
      prompts.readLine,
      (message) => stdout.write(message),
      async () => {
        const revoked = await revokeAllAdminSessions(database);
        stdout.write(`${revoked} sesi admin dicabut.\n`);
      },
    );
  } finally {
    await database.close?.();
  }
}

main().catch((error: unknown) => {
  console.error(`Pencabutan sesi gagal: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'}`);
  process.exitCode = 1;
});

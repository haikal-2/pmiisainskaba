import { loadEnvConfig } from '@next/env';
import { stdout } from 'node:process';

loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const [{ getDatabase }, { default: config }, { resetAdminAccount }, { hashPassword }, prompts] = await Promise.all([
    import('../src/server/db/database'),
    import('../src/server/config'),
    import('../src/server/auth/admin-operations'),
    import('../src/server/auth/password'),
    import('./admin-cli'),
  ]);
  const database = getDatabase();
  try {
    await prompts.runAfterDatabaseConfirmation(
      config.databaseUrl,
      prompts.readLine,
      (message) => stdout.write(message),
      async () => {
        const username = await prompts.readLine('Username baru (kosong untuk tetap memakai username lama): ');
        const password = await prompts.readHidden('Password baru (tersembunyi): ');
        const confirmation = await prompts.readHidden('Ulangi password: ');
        if (password !== confirmation) throw new Error('Password tidak sama.');
        if (password.length < config.adminMinPasswordLength || password.length > 200) {
          throw new Error(`Password harus ${config.adminMinPasswordLength}–200 karakter.`);
        }
        const revoked = await resetAdminAccount(database, await hashPassword(password), username);
        stdout.write(`Password diperbarui; ${revoked} sesi admin dicabut.\n`);
      },
    );
  } finally {
    await database.close?.();
  }
}

main().catch((error: unknown) => {
  console.error(`Reset gagal: ${error instanceof Error ? error.message : 'Kesalahan tidak diketahui.'}`);
  process.exitCode = 1;
});

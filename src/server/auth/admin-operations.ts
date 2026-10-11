import type { Database } from '@/server/db/types';

const USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,64}$/;

function validateUsername(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Username harus 3–64 karakter: huruf, angka, titik, garis bawah, atau hubung.');
  }
}

export async function createAdminAccount(
  database: Database,
  username: string,
  passwordHash: string,
): Promise<void> {
  validateUsername(username);
  await database.transaction(async (transaction) => {
    const existing = await transaction.query('SELECT id FROM admin_account LIMIT 1');
    if (existing.rows.length > 0) {
      throw new Error('Admin account already exists. Use the admin reset command.');
    }
    try {
      await transaction.query(
        'INSERT INTO admin_account (id, username, password_hash, active) VALUES (1, $1, $2, true)',
        [username, passwordHash],
      );
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
        throw new Error('Admin account already exists. Use the admin reset command.');
      }
      throw error;
    }
  });
}

export async function resetAdminAccount(
  database: Database,
  passwordHash: string,
  replacementUsername: string,
): Promise<number> {
  const username = replacementUsername.trim();
  if (username) validateUsername(username);

  return database.transaction(async (transaction) => {
    const updated = await transaction.query(
      `UPDATE admin_account
       SET username = COALESCE(NULLIF($1, ''), username),
           password_hash = $2,
           updated_at = now()
       WHERE id = 1
       RETURNING id`,
      [username, passwordHash],
    );
    if (updated.rows.length === 0) {
      throw new Error('Admin account does not exist. Run the admin create command first.');
    }
    const sessions = await transaction.query(
      'UPDATE admin_session SET revoked_at = now() WHERE admin_id = 1 AND revoked_at IS NULL RETURNING id',
    );
    return sessions.rowCount ?? sessions.rows.length;
  });
}

export async function revokeAllAdminSessions(database: Database): Promise<number> {
  const result = await database.query(
    'UPDATE admin_session SET revoked_at = now() WHERE revoked_at IS NULL RETURNING id',
  );
  return result.rowCount ?? result.rows.length;
}

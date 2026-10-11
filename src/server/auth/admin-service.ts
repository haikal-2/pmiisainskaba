import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { verifyPassword } from './password';

export type AdminIdentity = { id: number; username: string };
type AdminAuthExecutor = {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: Row[]; rowCount: number | null }>;
};

export interface AdminAuthDatabase extends AdminAuthExecutor {
  transaction<T>(operation: (transaction: AdminAuthExecutor) => Promise<T>): Promise<T>;
}

export class AdminAuthenticationError extends Error {
  constructor() {
    super('Nama pengguna atau kata sandi tidak sesuai.');
    this.name = 'AdminAuthenticationError';
  }
}

export type AdminSession = {
  token: string;
  admin: AdminIdentity;
  expiresAt: Date;
};

export type AuthenticateAdminOptions = {
  sessionTtlSeconds: number;
  userAgent: string | null;
};

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$NZhtHHY6fOgRdmbgIK+sog$XLHxb/KS6ZY1jGJIHt1w0+CyDEJ9TUcTCkkHeeh6AWA';

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function authenticateAdmin(
  database: AdminAuthDatabase,
  username: string,
  password: string,
  options: AuthenticateAdminOptions,
): Promise<AdminSession> {
  const result = await database.query<{
    id: number;
    username: string;
    password_hash: string;
    active: boolean;
  }>(
    'SELECT id, username, password_hash, active FROM admin_account WHERE username = $1 LIMIT 1',
    [username],
  );
  const account = result.rows[0];
  const passwordValid = await verifyPassword(password, account?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!account || !passwordValid || !account.active) throw new AdminAuthenticationError();

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + options.sessionTtlSeconds * 1000);
  const sessionId = randomUUID();
  await database.transaction(async (transaction) => {
    const lockedAccount = await transaction.query<{ id: number; active: boolean }>(
      'SELECT id, active FROM admin_account WHERE id = $1 FOR UPDATE',
      [account.id],
    );
    if (!lockedAccount.rows[0]?.active) throw new AdminAuthenticationError();
    await transaction.query(
      'UPDATE admin_session SET revoked_at = now() WHERE admin_id = $1 AND revoked_at IS NULL',
      [account.id],
    );
    await transaction.query(
      `INSERT INTO admin_session (id, admin_id, token_hash, user_agent, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5)`,
      [sessionId, account.id, tokenHash, options.userAgent, expiresAt],
    );
  });

  return {
    token,
    admin: { id: account.id, username: account.username },
    expiresAt,
  };
}

export async function getCurrentAdmin(
  database: AdminAuthDatabase,
  token: string,
): Promise<AdminIdentity | null> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return null;
  const result = await database.query<{
    id: string;
    admin_id: number;
    username: string;
    active: boolean;
  }>(
    `SELECT s.id, s.admin_id, a.username, a.active
     FROM admin_session s
     JOIN admin_account a ON a.id = s.admin_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
     LIMIT 1`,
    [hashOpaqueToken(token)],
  );
  const session = result.rows[0];
  if (!session?.active) return null;

  await database.query(
    `UPDATE admin_session SET last_seen_at = now()
     WHERE id = $1::uuid AND last_seen_at < now() - interval '5 minutes'`,
    [session.id],
  );
  return { id: session.admin_id, username: session.username };
}

export async function revokeAdminSession(database: AdminAuthDatabase, token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(token)) return;
  await database.query(
    'UPDATE admin_session SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashOpaqueToken(token)],
  );
}

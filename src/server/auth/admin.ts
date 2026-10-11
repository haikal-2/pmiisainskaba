import 'server-only';

import { cookies, headers } from 'next/headers';

import config from '@/server/config';
import { getDatabase } from '@/server/db/database';
import { AppError } from '@/server/errors';
import {
  AdminAuthenticationError,
  authenticateAdmin as authenticateAdminService,
  getCurrentAdmin as getCurrentAdminService,
  hashOpaqueToken,
  revokeAdminSession,
} from './admin-service';
import { hashPassword, verifyPassword } from './password';
import { assertRequestOrigin, RequestOriginError } from './request-origin';

export { hashPassword, verifyPassword };
export const ADMIN_COOKIE_NAME = 'pmii_admin_session';

const cookieOptions = {
  httpOnly: true,
  secure: config.isProduction,
  sameSite: 'lax' as const,
  path: '/',
};

export { hashOpaqueToken };

export async function authenticateAdmin(username: string, password: string): Promise<void> {
  const requestHeaders = await headers();
  const userAgent = (requestHeaders.get('user-agent') ?? '').slice(0, 500) || null;
  try {
    const session = await authenticateAdminService(getDatabase(), username, password, {
      sessionTtlSeconds: config.adminSessionTtlSeconds,
      userAgent,
    });
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, session.token, {
      ...cookieOptions,
      expires: session.expiresAt,
    });
  } catch (error) {
    if (error instanceof AdminAuthenticationError) {
      throw AppError.unauthenticated('Nama pengguna atau kata sandi tidak sesuai.');
    }
    throw error;
  }
}

export async function getCurrentAdmin(): Promise<{ id: number; username: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;
  return getCurrentAdminService(getDatabase(), token);
}

export async function requireAdmin(): Promise<{ id: number; username: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) throw AppError.unauthenticated();
  return admin;
}

export async function assertSameOrigin(request: Request): Promise<void> {
  try {
    assertRequestOrigin(request, config.appUrl);
  } catch (error) {
    if (error instanceof RequestOriginError) {
      throw AppError.forbidden('Request lintas-origin ditolak.');
    }
    throw error;
  }
}

export async function logoutAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (token) await revokeAdminSession(getDatabase(), token);
  cookieStore.set(ADMIN_COOKIE_NAME, '', {
    ...cookieOptions,
    maxAge: 0,
  });
}

export async function revokeAllAdminSessions(): Promise<number> {
  const result = await getDatabase().query(
    'UPDATE admin_session SET revoked_at = now() WHERE revoked_at IS NULL RETURNING id',
  );
  return result.rowCount ?? 0;
}

export async function writeAuditEvent(
  adminId: number,
  action: string,
  resource: string,
  resourceId: string | null,
  outcome: 'success' | 'failure' = 'success',
): Promise<void> {
  await getDatabase().query(
    `INSERT INTO audit_event (admin_id, action, resource, resource_id, outcome)
     VALUES ($1, $2, $3, $4, $5)`,
    [adminId, action, resource, resourceId, outcome],
  );
}

import 'server-only';

import type { Database } from '@/server/db/types';
import { getComposioClient } from './client';
import { composioUserIdForAdmin } from './identity';
import {
  deleteComposioSession,
  findComposioSession,
  replaceComposioSessionToolkits,
  saveComposioSession,
} from './repository';
import type { ComposioSession } from './types';

/**
 * Siklus hidup sesi Composio untuk akun admin aplikasi.
 *
 * Sesi yang sudah ada dipakai ulang (`composio.use`) agar konfigurasi dan
 * koneksi tetap sama antar pemanggilan. Bila sesi itu sudah tidak ada di
 * Composio, sesi baru diterbitkan untuk `user_id` yang sama — koneksi aplikasi
 * menempel pada `user_id`, jadi pengguna tidak perlu otorisasi ulang.
 */

export async function getAdminComposioSession(
  database: Database,
  adminId: number,
): Promise<ComposioSession> {
  const composio = getComposioClient();
  const userId = composioUserIdForAdmin(adminId);
  const stored = await findComposioSession(database, adminId);

  if (stored) {
    if (stored.userId !== userId) {
      throw new Error('Sesi Composio tersimpan tidak cocok dengan identitas admin.');
    }
    try {
      return await composio.use(stored.sessionId);
    } catch {
      // Sesi dapat dihapus dari dashboard; lanjutkan ke pembuatan sesi baru.
    }
  }

  const session = await composio.create(userId);
  await saveComposioSession(database, {
    adminId,
    userId,
    sessionId: session.sessionId,
    toolkits: stored?.toolkits ?? [],
  });
  return session;
}

/**
 * Catat toolkit yang sudah dipakai admin. Murni informatif — pembatasan tool
 * tetap dilakukan sesi lewat penemuan runtime, bukan daftar ini.
 */
export async function rememberToolkit(
  database: Database,
  adminId: number,
  toolkit: string,
): Promise<void> {
  const slug = toolkit.trim().toLowerCase();
  if (!slug) return;
  const stored = await findComposioSession(database, adminId);
  if (!stored || stored.toolkits.includes(slug)) return;
  await replaceComposioSessionToolkits(
    database,
    adminId,
    [...stored.toolkits, slug].sort(),
  );
}

/** Lepas pemetaan sesi lokal; koneksi di sisi Composio tidak dihapus. */
export async function forgetAdminComposioSession(
  database: Database,
  adminId: number,
): Promise<boolean> {
  return deleteComposioSession(database, adminId);
}

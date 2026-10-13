import 'server-only';

import type { Database } from '@/server/db/types';
import type { ComposioSessionRecord } from './types';

/**
 * Akses tabel `composio_session`.
 *
 * Yang disimpan hanya ID sesi dan daftar toolkit; kredensial Composio tetap
 * di environment dan tidak pernah menyentuh database.
 */

type ComposioSessionRow = {
  admin_id: number;
  user_id: string;
  session_id: string;
  toolkits: string[];
  created_at: Date;
  updated_at: Date;
};

const SESSION_COLUMNS = 'admin_id, user_id, session_id, toolkits, created_at, updated_at';

function toRecord(row: ComposioSessionRow): ComposioSessionRecord {
  return {
    adminId: row.admin_id,
    userId: row.user_id,
    sessionId: row.session_id,
    toolkits: row.toolkits ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findComposioSession(
  database: Database,
  adminId: number,
): Promise<ComposioSessionRecord | null> {
  const result = await database.query<ComposioSessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM composio_session WHERE admin_id = $1`,
    [adminId],
  );
  const row = result.rows[0];
  return row ? toRecord(row) : null;
}

export async function saveComposioSession(
  database: Database,
  input: {
    adminId: number;
    userId: string;
    sessionId: string;
    toolkits: readonly string[];
  },
): Promise<ComposioSessionRecord> {
  const result = await database.query<ComposioSessionRow>(
    `INSERT INTO composio_session (admin_id, user_id, session_id, toolkits)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (admin_id) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           session_id = EXCLUDED.session_id,
           toolkits = EXCLUDED.toolkits,
           updated_at = now()
     RETURNING ${SESSION_COLUMNS}`,
    [input.adminId, input.userId, input.sessionId, [...input.toolkits]],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Gagal menyimpan sesi Composio.');
  return toRecord(row);
}

export async function replaceComposioSessionToolkits(
  database: Database,
  adminId: number,
  toolkits: readonly string[],
): Promise<void> {
  await database.query(
    'UPDATE composio_session SET toolkits = $2 WHERE admin_id = $1',
    [adminId, [...toolkits]],
  );
}

export async function deleteComposioSession(
  database: Database,
  adminId: number,
): Promise<boolean> {
  const result = await database.query(
    'DELETE FROM composio_session WHERE admin_id = $1',
    [adminId],
  );
  return (result.rowCount ?? result.rows.length) > 0;
}

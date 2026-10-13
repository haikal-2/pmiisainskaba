import { query } from '@/server/db/pool';
import { privateStorageDriver } from '@/server/storage/private-storage';
import { isComposioConfigured } from '@/server/integrations/composio/client';
import config from '@/server/config';
import { logEvent } from '@/server/observability/logger';
import { AppError } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Health check operasional.
 *
 * Melaporkan status tiap dependency secara terpisah (database, storage, cron,
 * Google Sheets, Composio) supaya operator tahu komponen mana yang gagal tanpa
 * harus membaca log. Tidak ada data pribadi, kredensial, atau URL yang dikembalikan.
 *
 * Selalu balas 200 dengan ringkasan status; 503 hanya bila dependency wajib
 * (database/storage) tidak sehat, sehingga probe platform bisa membedakan
 * "proses hidup" dari "siap melayani".
 */
type DependencyStatus = 'ok' | 'degraded' | 'unavailable' | 'disabled';

export async function GET(): Promise<Response> {
  const database = await checkDatabase();
  const storage = checkStorage();
  const sheets = checkSheets();
  const composio = checkComposio();
  const cron = checkCron();

  const critical = [database, storage];
  const healthy = critical.every((entry) => entry.status === 'ok' || entry.status === 'disabled');
  const body = {
    status: healthy ? 'ok' : 'unavailable',
    time: new Date().toISOString(),
    environment: config.isProduction ? 'production' : 'non-production',
    dependencies: { database, storage, cron, googleSheets: sheets, composio },
  };
  if (!healthy) {
    logEvent('error', 'health.degraded', { operation: 'health', component: 'internal' });
    return Response.json(body, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  return Response.json(body, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

async function checkDatabase(): Promise<{ status: DependencyStatus; latencyMs?: number }> {
  const startedAt = Date.now();
  try {
    // `SELECT 1` membuktikan koneksi hidup tanpa membaca data apa pun.
    await query('SELECT 1');
    return { status: 'ok', latencyMs: Date.now() - startedAt };
  } catch {
    return { status: 'unavailable' };
  }
}

function checkStorage(): { status: DependencyStatus; driver: string } {
  try {
    const driver = privateStorageDriver();
    return { status: 'ok', driver };
  } catch (error) {
    if (error instanceof AppError) {
      return { status: error.code === 'DEPENDENCY_UNAVAILABLE' ? 'unavailable' : 'degraded', driver: 'unavailable' };
    }
    return { status: 'degraded', driver: 'unknown' };
  }
}

function checkSheets(): { status: DependencyStatus } {
  const { mapabaWebhookUrl, advocacyWebhookUrl, spreadsheetId, clientEmail, privateKey } = config.googleSheets;
  const webhook = Boolean(mapabaWebhookUrl || advocacyWebhookUrl);
  const serviceAccount = Boolean(spreadsheetId && clientEmail && privateKey);
  return { status: webhook || serviceAccount ? 'ok' : 'disabled' };
}

function checkComposio(): { status: DependencyStatus } {
  return { status: isComposioConfigured() ? 'ok' : 'disabled' };
}

function checkCron(): { status: DependencyStatus } {
  return { status: config.cronSecret ? 'ok' : 'unavailable' };
}
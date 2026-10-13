import 'server-only';

import type {
  ComposioConnectLink,
  ComposioConnectionState,
  ComposioSession,
  ComposioToolMatch,
  ComposioToolRunResult,
} from './types';

/**
 * Operasi Composio yang dipakai aplikasi.
 *
 * Slug toolkit dan tool tidak pernah ditebak di sini: koneksi diperiksa lewat
 * `session.toolkits()` dan tool ditemukan lewat `session.search()`, sesuai
 * aturan SDK bahwa penemuan dilakukan saat runtime.
 */

export async function listToolkitConnections(
  session: ComposioSession,
  toolkits?: readonly string[],
): Promise<ComposioConnectionState[]> {
  const details = await session.toolkits(toolkits ? { toolkits: [...toolkits] } : undefined);
  return details.items.map((item) => ({
    toolkit: item.slug,
    name: item.name,
    isNoAuth: item.isNoAuth,
    isConnected: item.connection?.isActive ?? false,
    accountId: item.connection?.connectedAccount?.id ?? null,
    accountStatus: item.connection?.connectedAccount?.status ?? null,
  }));
}

/**
 * Minta tautan otorisasi untuk satu toolkit. Composio mengembalikan Connect
 * Link; aplikasi tidak pernah membangun alur OAuth sendiri.
 */
export async function beginToolkitConnection(
  session: ComposioSession,
  toolkit: string,
  callbackUrl?: string,
): Promise<ComposioConnectLink> {
  const request = await session.authorize(toolkit, callbackUrl ? { callbackUrl } : undefined);
  const redirectUrl = request.redirectUrl;
  if (!redirectUrl) {
    throw new Error(`Composio tidak mengembalikan tautan koneksi untuk toolkit "${toolkit}".`);
  }
  return { toolkit, requestId: request.id, redirectUrl };
}

export async function searchTools(
  session: ComposioSession,
  query: string,
  toolkits?: readonly string[],
): Promise<ComposioToolMatch[]> {
  const response = await session.search(toolkits ? { query, toolkits: [...toolkits] } : { query });
  const matches: ComposioToolMatch[] = [];
  const seen = new Set<string>();

  for (const result of response.results) {
    for (const slug of [...result.primaryToolSlugs, ...result.relatedToolSlugs]) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      const schema = response.toolSchemas[slug];
      matches.push({
        slug,
        toolkit: schema?.toolkit ?? '',
        description: schema?.description ?? '',
      });
    }
  }
  return matches;
}

export async function executeTool(
  session: ComposioSession,
  toolSlug: string,
  args: Record<string, unknown>,
  account?: string,
): Promise<ComposioToolRunResult> {
  const response = await session.execute(toolSlug, args, account ? { account } : undefined);
  return {
    toolSlug,
    logId: response.logId,
    successful: response.error === null,
    error: response.error,
    data: response.data,
  };
}

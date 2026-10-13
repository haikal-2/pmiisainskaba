import type { Composio } from '@composio/core';

/**
 * Tipe bersama untuk integrasi Composio Platform.
 *
 * Sesi diturunkan langsung dari SDK (`Composio['create']`) agar tidak ada
 * definisi paralel yang bisa menyimpang dari versi paket yang terpasang.
 */
export type ComposioSession = Awaited<ReturnType<Composio['create']>>;

/** Rekaman sesi Composio yang disimpan di database. */
export type ComposioSessionRecord = {
  adminId: number;
  userId: string;
  sessionId: string;
  toolkits: string[];
  createdAt: Date;
  updatedAt: Date;
};

/** Status koneksi satu toolkit untuk pengguna sesi. */
export type ComposioConnectionState = {
  toolkit: string;
  name: string;
  isNoAuth: boolean;
  isConnected: boolean;
  accountId: string | null;
  accountStatus: string | null;
};

/** Tautan otorisasi yang harus dibuka pengguna untuk menghubungkan aplikasi. */
export type ComposioConnectLink = {
  toolkit: string;
  requestId: string;
  redirectUrl: string;
};

/** Hasil pencarian tool lewat meta tool sesi (slug tidak pernah ditebak). */
export type ComposioToolMatch = {
  slug: string;
  toolkit: string;
  description: string;
};

/** Hasil satu eksekusi tool beserta log ID untuk penelusuran di dashboard. */
export type ComposioToolRunResult = {
  toolSlug: string;
  logId: string;
  successful: boolean;
  error: string | null;
  data: Record<string, unknown>;
};

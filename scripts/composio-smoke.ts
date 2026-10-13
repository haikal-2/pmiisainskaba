import { loadEnvConfig } from '@next/env';
import { stderr, stdout } from 'node:process';

import type { ComposioToolMatch } from '../src/server/integrations/composio/types';

loadEnvConfig(process.cwd());

/**
 * Titik masuk pertama integrasi Composio Platform.
 *
 * Alur: periksa konfigurasi → pakai/terbitkan sesi untuk akun admin →
 * periksa koneksi toolkit → temukan tool saat runtime → jalankan satu tool
 * baca-saja dan cetak log ID Composio.
 *
 * Contoh:
 *   npm run composio:smoke -- --toolkit hackernews \
 *     --tool HACKERNEWS_GET_USER --args "{\"username\":\"pg\"}"
 *   npm run composio:smoke -- --toolkit gmail
 *
 * Keluaran hanya ke terminal. COMPOSIO_API_KEY tidak pernah dicetak.
 */

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_TOOL_FAILED = 2;
const EXIT_CONNECTION_REQUIRED = 3;

/** Batas cetak hasil tool agar data pribadi tidak membanjiri terminal. */
const MAX_DATA_CHARS = 4000;

class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

type CliOptions = {
  toolkit: string;
  tool: string | null;
  args: Record<string, unknown>;
  query: string;
};

const VALUE_FLAGS = new Set(['--toolkit', '--tool', '--args', '--query']);

function write(line: string): void {
  stdout.write(`${line}\n`);
}

function printUsage(): void {
  write(`Penggunaan: npm run composio:smoke -- --toolkit <slug> [opsi]

Wajib:
  --toolkit <slug>   Slug toolkit Composio, mis. hackernews, gmail, github.

Opsi:
  --tool <SLUG>      Slug tool. Bila kosong, tool dicari lewat sesi.
  --args <json>      Argumen tool sebagai JSON, mis. {"username":"pg"}.
  --query <teks>     Kueri pencarian tool (dipakai bila --tool kosong).
  --help             Tampilkan bantuan ini.`);
}

function parseArguments(argv: readonly string[]): CliOptions {
  const values = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === undefined) continue;
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(EXIT_OK);
    }
    if (!VALUE_FLAGS.has(token)) {
      throw new UsageError(`Argumen tidak dikenal: ${token}`);
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`Argumen ${token} membutuhkan nilai.`);
    }
    values.set(token, value);
    index += 1;
  }

  const toolkit = (values.get('--toolkit') ?? '').trim().toLowerCase();
  if (!toolkit) throw new UsageError('Argumen --toolkit wajib diisi.');

  const tool = (values.get('--tool') ?? '').trim().toUpperCase() || null;
  const query = (values.get('--query') ?? '').trim() || `read data from ${toolkit}`;

  let args: Record<string, unknown> = {};
  const rawArgs = values.get('--args');
  if (rawArgs) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawArgs);
    } catch {
      throw new UsageError('--args harus berupa JSON yang valid.');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new UsageError('--args harus berupa objek JSON.');
    }
    args = parsed as Record<string, unknown>;
  }

  return { toolkit, tool, args, query };
}

function formatData(data: Record<string, unknown>): string {
  const json = JSON.stringify(data, null, 2) ?? 'null';
  if (json.length <= MAX_DATA_CHARS) return json;
  return `${json.slice(0, MAX_DATA_CHARS)}\n… dipotong (${json.length} karakter total)`;
}

function printMissingKeyInstructions(): void {
  write(`COMPOSIO_API_KEY belum diisi, jadi integrasi Composio tidak aktif.

1. Masuk ke https://dashboard.composio.dev → project → Getting Started,
   lalu salin project API key (berawalan "ak_").
2. Tambahkan ke .env.local (sudah diabaikan git) pada baris baru:
     COMPOSIO_API_KEY=ak_...
   Jangan menempelkan kunci ke chat atau commit.
3. Jalankan ulang:
     npm run composio:smoke -- --toolkit hackernews

Alternatif tanpa akun manusia: CLI Composio dapat membuat akun agen terpisah
(tidak memberi akses ke aplikasi akun pribadi Anda):
  bash -lc 'curl -fsSL https://composio.dev/install | sh && composio login --agent'`);
}

export async function main(argv: readonly string[]): Promise<number> {
  let options: CliOptions;
  try {
    options = parseArguments(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      stderr.write(`${error.message}\n\n`);
      printUsage();
      return EXIT_USAGE;
    }
    throw error;
  }

  const [{ default: config }, composioClient, sessionModule, operationsModule, databaseModule] =
    await Promise.all([
      import('../src/server/config'),
      import('../src/server/integrations/composio/client'),
      import('../src/server/integrations/composio/session'),
      import('../src/server/integrations/composio/operations'),
      import('../src/server/db/database'),
    ]);

  if (!composioClient.isComposioConfigured() || !config.composio.apiKey) {
    printMissingKeyInstructions();
    return EXIT_USAGE;
  }

  const database = databaseModule.getDatabase();
  try {
    const adminResult = await database.query<{ id: number; username: string }>(
      'SELECT id, username FROM admin_account ORDER BY id LIMIT 1',
    );
    const admin = adminResult.rows[0];
    if (!admin) {
      stderr.write('Belum ada akun admin. Jalankan dulu: npm run admin:create\n');
      return EXIT_USAGE;
    }

    const session = await sessionModule.getAdminComposioSession(database, admin.id);
    write(`Sesi Composio : ${session.sessionId} (handle, bukan kredensial)`);
    write(`Admin          : ${admin.username} → user_id Composio untuk ID ${admin.id}`);

    const connections = await operationsModule.listToolkitConnections(session, [options.toolkit]);
    const state = connections[0];
    if (!state) {
      stderr.write(`Toolkit "${options.toolkit}" tidak dikenali Composio.\n`);
      return EXIT_USAGE;
    }

    write(`Toolkit        : ${state.name} (${state.toolkit})`);
    write(`Koneksi        : ${state.isConnected ? `aktif (${state.accountId ?? 'tanpa akun'})` : 'belum terhubung'}${state.isNoAuth ? ' — tidak butuh auth' : ''}`);

    if (!state.isConnected && !state.isNoAuth) {
      const link = await operationsModule.beginToolkitConnection(session, options.toolkit);
      write('');
      write('Buka tautan berikut untuk memberi izin, lalu jalankan ulang perintah yang sama:');
      write(`  ${link.redirectUrl}`);
      write(`  (permintaan koneksi: ${link.requestId})`);
      return EXIT_CONNECTION_REQUIRED;
    }

    let toolSlug = options.tool;
    if (!toolSlug) {
      const matches: ComposioToolMatch[] = await operationsModule.searchTools(
        session,
        options.query,
        [options.toolkit],
      );
      if (matches.length === 0) {
        stderr.write(`Tidak ada tool yang cocok untuk "${options.query}". Coba --tool secara eksplisit.\n`);
        return EXIT_USAGE;
      }
      write(`Kandidat tool  : ${matches.slice(0, 5).map((match) => match.slug).join(', ')}`);
      const preferred = matches.find((match) => match.toolkit === options.toolkit);
      toolSlug = (preferred ?? matches[0])?.slug ?? null;
    }
    if (!toolSlug) {
      stderr.write('Tidak dapat menentukan slug tool.\n');
      return EXIT_USAGE;
    }

    write(`Tool           : ${toolSlug}`);
    write('');

    const result = await operationsModule.executeTool(session, toolSlug, options.args);
    write(`Log ID Composio: ${result.logId}`);
    write(`Status         : ${result.successful ? 'berhasil' : 'gagal'}`);
    if (result.error) write(`Error          : ${result.error}`);
    write('');
    write(formatData(result.data));

    await sessionModule.rememberToolkit(database, admin.id, options.toolkit);
    return result.successful ? EXIT_OK : EXIT_TOOL_FAILED;
  } finally {
    await database.close?.();
  }
}

if (process.argv[1]?.includes('composio-smoke')) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Kesalahan tidak diketahui.';
      stderr.write(`composio-smoke gagal: ${message}\n`);
      process.exitCode = EXIT_USAGE;
    });
}

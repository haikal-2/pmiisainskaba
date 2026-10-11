import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

export type Ask = (prompt: string) => Promise<string>;
export type Output = (message: string) => void;

function targetFromUrl(connectionString: string): { host: string; database: string; loopback: boolean } {
  const url = new URL(connectionString);
  const host = url.hostname;
  return {
    host,
    database: decodeURIComponent(url.pathname.slice(1)),
    loopback: ['localhost', '127.0.0.1', '::1'].includes(host),
  };
}

export async function runAfterDatabaseConfirmation(
  connectionString: string,
  ask: Ask,
  output: Output,
  operation: () => Promise<void>,
): Promise<boolean> {
  const target = targetFromUrl(connectionString);
  output(`Database target: ${target.host}/${target.database}\n`);
  if (!target.loopback && (await ask('Remote database: type YES to confirm this write target: ')) !== 'YES') {
    output('Operation cancelled; no database changes were made.\n');
    return false;
  }
  await operation();
  return true;
}

export function readLine(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Jalankan perintah admin dari terminal interaktif.');
  const terminal = createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => terminal.question(prompt, (answer) => {
    terminal.close();
    resolve(answer);
  }));
}

export function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Password hanya boleh dimasukkan lewat terminal interaktif.');
  }
  return new Promise((resolve, reject) => {
    const characters: string[] = [];
    const previousRawMode = stdin.isRaw;
    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(previousRawMode ?? false);
      stdin.pause();
      stdout.write('\n');
    };
    const onData = (buffer: Buffer) => {
      for (const char of buffer.toString('utf8')) {
        if (char === '\u0003') {
          cleanup();
          reject(new Error('Dibatalkan.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          resolve(characters.join(''));
          return;
        }
        if (char === '\u007f' || char === '\b') characters.pop();
        else if (char >= ' ') characters.push(char);
      }
    };
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

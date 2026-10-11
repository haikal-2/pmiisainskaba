export class RequestOriginError extends Error {
  constructor() {
    super('Request lintas-origin ditolak.');
    this.name = 'RequestOriginError';
  }
}

export function assertRequestOrigin(request: Request, expectedOrigin: string): void {
  const origin = request.headers.get('origin');
  if (!origin) throw new RequestOriginError();

  let actual: URL;
  let expected: URL;
  try {
    actual = new URL(origin);
    expected = new URL(expectedOrigin);
  } catch {
    throw new RequestOriginError();
  }
  if (
    !['http:', 'https:'].includes(actual.protocol) ||
    actual.origin !== expected.origin ||
    !['http:', 'https:'].includes(expected.protocol)
  ) {
    throw new RequestOriginError();
  }
}

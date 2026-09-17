import 'server-only';

// GoBTC Pay: every call is POST + JSON, responses wrapped in { result: { $case } }.
export const GOBTC_BASE_URL =
  process.env.GOBTC_BASE_URL || 'https://api.gobtcpay.com/public/api/v1.2';

export class GoBtcError extends Error {
  constructor(
    public path: string,
    message: string,
    public code?: string,
    public type?: string,
    public httpStatus?: number,
    public traceId?: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'GoBtcError';
  }
}

export async function gobtcPost<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GOBTC_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });
  } catch (e) {
    // Network failure: the caller must treat a write as "outcome unknown", not "failed".
    throw new GoBtcError(path, `network error: ${(e as Error).message}`, 'network_error');
  }

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GoBtcError(path, `non-JSON response (HTTP ${res.status})`, undefined, undefined, res.status);
  }

  const result = json?.result;
  if (result?.$case === 'success') return result.success as T;
  if (result?.$case === 'failure') {
    const f = result.failure ?? {};
    throw new GoBtcError(path, f.message ?? 'failure', f.code, f.data?.type, res.status, json.meta?.traceId);
  }
  throw new GoBtcError(path, json?.message ?? `HTTP ${res.status}`, undefined, undefined, res.status);
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see env.example)`);
  return v;
}

/** GoBTC returns sat amounts as strings (sometimes numbers). */
export function sats(v: string | number | null | undefined): number {
  const n = typeof v === 'number' ? v : Number.parseInt(v ?? '0', 10);
  if (!Number.isFinite(n)) throw new Error(`Invalid sats value: ${v}`);
  return n;
}

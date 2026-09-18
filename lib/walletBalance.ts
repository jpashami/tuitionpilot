import 'server-only';
import { getSpendableBalance } from './gobtc/instant';

export type CachedBalance = Awaited<ReturnType<typeof getSpendableBalance>>;

// GoBTC balance calls can take many seconds; keep one fresh-enough answer for every page.
const TTL_MS = 30_000;
let cached: { at: number; balance: CachedBalance } | null = null;

export async function cachedWalletBalance(): Promise<CachedBalance> {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    cached = { at: Date.now(), balance: await getSpendableBalance() };
  }
  return cached.balance;
}

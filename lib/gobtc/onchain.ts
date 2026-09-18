import 'server-only';

/**
 * Public blockchain view of an address (mempool.space, no key needed).
 * Used as a fallback when GoBTC's balance endpoint is unavailable. It shows what arrived on-chain,
 * not what GoBTC considers spendable, so only confirmed funds count.
 */
export async function onchainBalance(address: string) {
  const res = await fetch(`https://mempool.space/api/address/${address}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`mempool.space returned HTTP ${res.status}`);
  const j = await res.json();
  const confirmedSats = j.chain_stats.funded_txo_sum - j.chain_stats.spent_txo_sum;
  const pendingSats = j.mempool_stats.funded_txo_sum - j.mempool_stats.spent_txo_sum;
  return { confirmedSats, pendingSats };
}

"use client";

// Holder rewards (contracts/drop1 `pending_rewards_for_owner` / `claim_rewards`): on chain only, and only when the
// contract has them (the older ng57 testnet contract doesn't: the block stays hidden).

import { useEffect, useState } from "react";

import { fill, petPage } from "../../lib/copy";
import { claimAllRewards, getPendingRewards, yoctoToNear } from "../../lib/drop1";
import { connectedAccountId } from "../../lib/wallet";

export default function HolderRewards() {
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    const accountId = connectedAccountId();
    if (!accountId) return;
    let live = true;
    getPendingRewards(accountId).then((value) => live && setPending(value));
    return () => {
      live = false;
    };
  }, []);

  if (pending === null) return null;
  const claim = async () => {
    const accountId = connectedAccountId();
    if (!accountId || busy) return;
    setBusy(true);
    setLine(null);
    try {
      const paid = await claimAllRewards(accountId);
      setLine(fill(petPage.rewards.claimed, { n: yoctoToNear(paid) }));
      setPending(await getPendingRewards(accountId));
    } catch {
      setLine(petPage.rewards.failed);
    } finally {
      setBusy(false);
    }
  };
  const empty = BigInt(pending) === BigInt(0);

  return (
    <section className="pet-card-block" aria-labelledby="pet-rewards-title">
      <h2 id="pet-rewards-title" className="mint-subtitle">
        {petPage.rewards.title}
      </h2>
      <p className="mint-hint">{fill(petPage.rewards.pending, { n: yoctoToNear(pending) })}</p>
      <p className="mint-hint">{petPage.rewards.note}</p>
      <button type="button" className="button button-secondary" onClick={claim} disabled={busy || empty}>
        {busy ? petPage.rewards.claiming : petPage.rewards.claim}
      </button>
      {line ? (
        <p className="mint-hint" role="status">
          {line}
        </p>
      ) : null}
    </section>
  );
}

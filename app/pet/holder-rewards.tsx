"use client";

// Holder rewards of ONE token (contracts/drop1 `pending_rewards` / `claim_rewards`), task 068. Rendered only on chain and
// only for a pet /pet shows, i.e. a token the account holds on the current contract (lib/mocks.ts ownedBy). Hidden when
// the contract has no rewards (the older ng57 testnet contract).

import { useCallback, useEffect, useState } from "react";

import { fill, petPage } from "../../lib/copy";
import { claimTokenRewards, formatNear, getTokenRewards, type RewardsRead } from "../../lib/drop1";

type State = { kind: "loading" } | RewardsRead;

export default function HolderRewards({ tokenId }: { tokenId: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    setState(await getTokenRewards(tokenId));
  }, [tokenId]);

  useEffect(() => {
    let live = true;
    getTokenRewards(tokenId).then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, [tokenId]);

  if (state.kind === "unsupported") return null;
  const t = petPage.rewards;
  const empty = state.kind !== "ok" || BigInt(state.yocto) === BigInt(0);

  const claim = async () => {
    if (busy || empty) return;
    setBusy(true);
    setLine(null);
    try {
      const paid = await claimTokenRewards(tokenId);
      setLine(fill(t.claimed, { n: formatNear(paid) }));
      await load();
    } catch {
      setLine(t.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="pet-card-block pet-rewards" aria-labelledby="pet-rewards-title" aria-busy={state.kind === "loading" || undefined}>
      <h2 id="pet-rewards-title" className="mint-subtitle">
        {t.title}
      </h2>
      {state.kind === "loading" ? <p className="mint-hint">{t.loading}</p> : null}
      {state.kind === "error" ? (
        <p className="mint-hint" role="alert">
          {t.error}{" "}
          <button type="button" className="button-link" onClick={load}>
            {t.retry}
          </button>
        </p>
      ) : null}
      {state.kind === "ok" ? (
        <>
          <p className="pet-rewards-amount">{empty ? t.empty : fill(t.pending, { n: formatNear(state.yocto) })}</p>
          <p className="mint-hint">{t.note}</p>
          <button type="button" className="button button-secondary" onClick={claim} disabled={busy || empty} aria-describedby={empty ? "pet-rewards-title" : undefined}>
            {busy ? t.claiming : t.claim}
          </button>
        </>
      ) : null}
      {line ? (
        <p className="mint-hint" role="status">
          {line}
        </p>
      ) : null}
    </section>
  );
}

"use client";

import { useState, type Ref } from "react";

import { walletGate } from "../lib/copy";
import { connect } from "../lib/wallet";

type WalletGateProps = {
  /** Which line explains why: /pet ("your gotchis belong to an account") or /mint ("hatching needs an account"). */
  context: "pet" | "mint";
  /** /pet: the gate is the page, so it brings its own h1. /mint keeps its page h1 and shows no heading. */
  heading?: boolean;
  /** Runs after the account is connected (callers move focus to what replaces the gate). */
  onConnected?: () => void;
  /** The h1 (with `heading`), for focus. */
  ref?: Ref<HTMLHeadingElement>;
};

/** Shown instead of pets / the hatch button while no demo wallet is connected (docs/DEVLOG.md §2). */
export default function WalletGate({ context, heading = false, onConnected, ref }: WalletGateProps) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await connect();
      onConnected?.();
    } catch {
      // wallet modal closed without signing in
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={heading ? "wallet-gate is-page" : "wallet-gate"}>
      {heading ? (
        <h1 id="pet-title" ref={ref} className="mint-title" tabIndex={-1}>
          {walletGate.title}
        </h1>
      ) : null}
      <p className="mint-card-text">{walletGate[context]}</p>
      <button type="button" className="button button-primary wallet-gate-button" aria-disabled={busy || undefined} onClick={onClick}>
        {walletGate.button}
      </button>
      <p className="mint-hint">{walletGate.note}</p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { fill, header } from "../lib/copy";
import { useWallet } from "../lib/use-wallet";
import { DEMO_ACCOUNT_ID, connect, disconnect } from "../lib/wallet";

const NOTE_MS = 4000;

/**
 * Header + burger wallet (docs/DEVLOG.md §2). Disconnected: "connect wallet · demo" connects the
 * demo account in one click. Connected: the same button shows "you.demo" and opens a small panel with
 * "my gotchis" and "disconnect". Both labels share one grid cell, so the button never changes width
 * (and the server / first paint render the disconnected label). Mock only: nothing is signed.
 */
export default function WalletMenu({ variant = "header" }: { variant?: "header" | "burger" }) {
  const { account } = useWallet();
  const connected = account !== null;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const say = (text: string | null) => {
    if (noteTimer.current) clearTimeout(noteTimer.current);
    setNote(text);
    if (text) noteTimer.current = setTimeout(() => setNote(null), NOTE_MS);
  };

  useEffect(
    () => () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    },
    [],
  );

  // The panel closes on Esc (focus back to the chip) and, in the header, on a tap outside.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      // The burger also closes on Esc; stop it here so only the wallet panel closes.
      event.stopImmediatePropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (variant === "header" && !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, variant]);

  const onButton = async () => {
    if (connected) {
      say(null);
      setOpen((value) => !value);
      return;
    }
    try {
      const next = await connect();
      say(fill(header.wallet.connected, { account: next.accountId }));
    } catch {
      // wallet modal closed without signing in
    }
  };

  const onDisconnect = async () => {
    await disconnect();
    setOpen(false);
    say(header.wallet.disconnected);
    buttonRef.current?.focus();
  };

  const accountId = account?.accountId ?? DEMO_ACCOUNT_ID;

  return (
    <div ref={rootRef} className={`wallet-menu is-${variant}`}>
      <button
        ref={buttonRef}
        type="button"
        className="button button-secondary wallet-chip"
        aria-expanded={connected ? open : undefined}
        aria-controls={connected && open ? panelId : undefined}
        aria-label={connected ? fill(header.wallet.chipLabel, { account: accountId }) : undefined}
        onClick={onButton}
      >
        <span className="cta-labels">
          <span className={connected ? "cta-label is-off" : "cta-label"}>
            {header.wallet.label}
            <span className="wallet-tag">{header.wallet.tag}</span>
          </span>
          <span className={connected ? "cta-label wallet-account" : "cta-label wallet-account is-off"}>
            <span className="wallet-dot" aria-hidden="true" />
            {accountId}
            <span className={open ? "wallet-caret is-open" : "wallet-caret"} aria-hidden="true" />
          </span>
        </span>
      </button>
      {connected && open ? (
        <div id={panelId} className="wallet-panel">
          <p className="wallet-panel-note">{header.wallet.note}</p>
          <Link className="button button-secondary" href="/pet" onClick={() => setOpen(false)}>
            {header.wallet.myPets}
          </Link>
          <button type="button" className="button button-secondary" onClick={onDisconnect}>
            {header.wallet.disconnect}
          </button>
        </div>
      ) : null}
      <p className="wallet-note" role="status">
        {note}
      </p>
    </div>
  );
}

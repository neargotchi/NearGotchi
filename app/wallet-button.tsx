"use client";

import { useState } from "react";

import { header } from "../lib/copy";

// Mock only: toggles local UI state. No wallet library, no network.
export default function WalletButton({ noteId = "wallet-note" }: { noteId?: string }) {
  const [noteVisible, setNoteVisible] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button button-secondary"
        aria-describedby={noteVisible ? noteId : undefined}
        onClick={() => setNoteVisible((visible) => !visible)}
      >
        {header.wallet.label}
        <span className="wallet-tag">{header.wallet.tag}</span>
      </button>
      <p id={noteId} className="wallet-note" role="status" hidden={!noteVisible}>
        {header.wallet.note}
      </p>
    </>
  );
}

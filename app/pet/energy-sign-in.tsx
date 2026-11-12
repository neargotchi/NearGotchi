"use client";

import { useState } from "react";
import { petPage } from "../../lib/copy";
import { signIn } from "../../lib/energy-client";

/**
 * Mainnet only (task 081): energy is NEAR AI credits on the server, so /pet asks once for a NEP-413 signature
 * (no transaction, no cost) and gets a 24 h session. One click: the wallet opens a popup, which needs the gesture.
 * Task 088: shown as a fixed card in the bottom-right corner (bottom edge on phones), with a ✕.
 */
export default function EnergySignIn({
  onSignedIn,
  onClose,
  unavailable = false,
}: {
  onSignedIn: () => void;
  /** task 088: the ✕ hides the popup until "sign in" is clicked in a note (or the page reloads). */
  onClose: () => void;
  unavailable?: boolean;
}) {
  const [state, setState] = useState<"idle" | "busy" | "cancelled" | "failed" | "unavailable">(unavailable ? "unavailable" : "idle");
  /** task 082: which step failed, e.g. "verify: 401 bad_signature" (no keys, signatures or nonces) */
  const [detail, setDetail] = useState<string | null>(null);

  const run = async () => {
    setState("busy");
    setDetail(null);
    const result = await signIn();
    if (result.ok) {
      setState("idle");
      onSignedIn();
      return;
    }
    setDetail(result.detail);
    setState(result.reason === "cancelled" ? "cancelled" : result.reason === "unavailable" ? "unavailable" : "failed");
  };

  const note =
    state === "busy" ? petPage.signIn.busy : state === "cancelled" ? petPage.signIn.cancelled : state === "failed" ? petPage.signIn.failed : state === "unavailable" ? petPage.signIn.unavailable : null;

  return (
    <section className="energy-signin" aria-labelledby="energy-signin-title">
      <button type="button" className="energy-signin-close" onClick={onClose} aria-label={petPage.signIn.close}>
        <span aria-hidden="true">✕</span>
      </button>
      <p id="energy-signin-title" className="energy-signin-title">
        {petPage.signIn.title}
      </p>
      <p className="energy-signin-body">{petPage.signIn.body}</p>
      <button type="button" className="button button-primary energy-signin-button" onClick={run} disabled={state === "busy"}>
        {petPage.signIn.button}
      </button>
      {note ? (
        <p className="energy-signin-note" role="status">
          {note}
        </p>
      ) : null}
      {detail && state !== "busy" ? <p className="energy-signin-detail">({detail})</p> : null}
    </section>
  );
}

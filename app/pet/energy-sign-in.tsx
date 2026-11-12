"use client";

import { useState } from "react";
import { petPage } from "../../lib/copy";
import { signIn } from "../../lib/energy-client";

/**
 * Mainnet only (task 081): energy is NEAR AI credits on the server, so /pet asks once for a NEP-413 signature
 * (no transaction, no cost) and gets a 24 h session. One click: the wallet opens a popup, which needs the gesture.
 */
export default function EnergySignIn({ onSignedIn, unavailable = false }: { onSignedIn: () => void; unavailable?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "cancelled" | "failed" | "unavailable">(unavailable ? "unavailable" : "idle");

  const run = async () => {
    setState("busy");
    const result = await signIn();
    if (result.ok) {
      setState("idle");
      onSignedIn();
      return;
    }
    setState(result.reason === "cancelled" ? "cancelled" : result.reason === "unavailable" ? "unavailable" : "failed");
  };

  const note =
    state === "busy" ? petPage.signIn.busy : state === "cancelled" ? petPage.signIn.cancelled : state === "failed" ? petPage.signIn.failed : state === "unavailable" ? petPage.signIn.unavailable : null;

  return (
    <section className="energy-signin" aria-labelledby="energy-signin-title">
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
    </section>
  );
}

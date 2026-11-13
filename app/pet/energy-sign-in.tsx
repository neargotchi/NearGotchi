"use client";

import { useEffect, useRef, useState } from "react";
import { petPage } from "../../lib/copy";
import { signIn } from "../../lib/energy-client";

/**
 * Mainnet only (task 081): energy is NEAR AI credits on the server, so /pet asks once for a NEP-413 signature
 * (no transaction, no cost) and gets a 24 h session. One click: the wallet opens a popup, which needs the gesture.
 * Task 088: shown as a fixed card in the bottom-right corner (bottom edge on phones), with a ✕.
 * Task 100: while it is open, its height (+ its margin) is published as --energy-signin-space, so the page gets that much
 * room at the bottom and the chat field can always be scrolled above the card.
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
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const card = ref.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--energy-signin-space", `${Math.ceil(card.offsetHeight) + 24}px`);
    // at once too (not only from the observer), so the chat's scroll in the same commit already has the room
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(card);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--energy-signin-space");
    };
  }, []);

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
    <section ref={ref} className="energy-signin" aria-labelledby="energy-signin-title">
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { fill, mintPage } from "../../lib/copy";
import {
  DROP1_TOTAL,
  DropError,
  getDropStatus,
  hatchRandom,
  resetDrop,
  subscribeDrop,
  type Drop1Token,
} from "../../lib/drop1";
import {
  MintError,
  PET_NAME_MAX,
  findPet,
  getPet,
  isPersistent,
  mintPet,
  normalizePetName,
  petSpriteSrc,
  releasePet,
  renamePet,
  subscribePet,
  validatePetName,
  type DemoPet,
  type NameError,
} from "../../lib/mocks";
import { useWallet } from "../../lib/use-wallet";
import TokenCard, { TokenInfo } from "../pet/token-card";
import WalletGate from "../wallet-gate";
import HatchStage from "./hatch-stage";

/** loading → ready | soldOut | existing; ready → hatching (draw, animation, reveal) → /pet. */
type View = "loading" | "ready" | "soldOut" | "existing" | "hatching";
type Focus = "hatch" | "line" | "reveal" | "existing" | "confirm" | "soldOut" | null;
type Status = { minted: number; total: number; soldOut: boolean };

/** Name errors shown under the field (no_pet means the saved pet vanished, e.g. reset in another tab). */
type FieldError = NameError;

/**
 * Dev-only QA hook: /mint?debughatch=slow delays the draw by 3s (wobble loop), =fail makes it throw
 * (back to ready with the error). Compiled out of production builds.
 */
async function debugHatch() {
  if (process.env.NODE_ENV !== "development") return;
  const mode = new URLSearchParams(window.location.search).get("debughatch");
  if (mode === "slow") await new Promise((resolve) => setTimeout(resolve, 3000));
  if (mode === "fail") throw new Error("debughatch=fail");
}

/**
 * /mint (docs/DEVLOG.md §2): one random token from the 300 per hatch. The pet is saved as soon
 * as the token is drawn (with its own name), so leaving during the animation or the reveal keeps it;
 * the reveal's name field renames it. No pet picker: a `?pet=` parameter from old links is ignored.
 * Hatching needs the demo wallet (docs/DEVLOG.md §2): without it the hatch button is a connect gate.
 */
export default function MintFlow() {
  const router = useRouter();
  const { ready: walletReady, account } = useWallet();
  const [view, setView] = useState<View>("loading");
  const viewRef = useRef<View>("loading");
  const [status, setStatus] = useState<Status>({ minted: 0, total: DROP1_TOTAL, soldOut: false });
  const statusRef = useRef(status);
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [focus, setFocus] = useState<Focus>(null);

  // hatch
  const [hatchKey, setHatchKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [token, setToken] = useState<Drop1Token | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [line, setLine] = useState("");
  const [hatchError, setHatchError] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<FieldError | null>(null);
  const [leaving, setLeaving] = useState(false);

  const hatchRef = useRef<HTMLButtonElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const revealRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const existingRef = useRef<HTMLHeadingElement>(null);
  const confirmRef = useRef<HTMLParagraphElement>(null);
  const soldOutRef = useRef<HTMLHeadingElement>(null);

  const go = (next: View) => {
    viewRef.current = next;
    setView(next);
  };

  const applyStatus = (next: Status) => {
    statusRef.current = next;
    setStatus(next);
  };

  /** Where to land without a pet. */
  const idleView = (): View => (statusRef.current.soldOut ? "soldOut" : "ready");

  useEffect(() => {
    let live = true;
    setPersistent(isPersistent());

    // getPet first: migrating an old pet can claim a token, which the counter must include.
    getPet().then(async (saved) => {
      const next = await getDropStatus();
      if (!live || viewRef.current !== "loading") return;
      applyStatus(next);
      setPet(saved);
      go(saved ? "existing" : idleView());
    });

    // Other tabs (and this tab's own reset) keep the view in sync; a running hatch/reveal is left alone.
    const offPet = subscribePet((saved) => {
      if (!live || viewRef.current === "hatching" || viewRef.current === "loading") return;
      setPet(saved);
      setConfirming(false);
      go(saved ? "existing" : idleView());
    });
    const offDrop = subscribeDrop((next) => {
      if (!live) return;
      applyStatus(next);
      if (viewRef.current === "ready" && next.soldOut) go("soldOut");
      if (viewRef.current === "soldOut" && !next.soldOut) go("ready");
    });

    return () => {
      live = false;
      offPet();
      offDrop();
    };
  }, []);

  // Focus moves only after a user action, never on first load.
  useEffect(() => {
    if (!focus) return;
    const target = {
      hatch: hatchRef,
      line: lineRef,
      reveal: revealRef,
      existing: existingRef,
      confirm: confirmRef,
      soldOut: soldOutRef,
    }[focus].current;
    if (!target) return;
    target.focus();
    setFocus(null);
  }, [focus, view, confirming, revealed, started]);

  const resetHatch = () => {
    setStarted(false);
    setToken(null);
    setRevealed(false);
    setLine("");
    setName("");
    setNameError(null);
    setLeaving(false);
    setHatchKey((key) => key + 1);
  };

  const hatch = async () => {
    if (viewRef.current !== "ready" || !account) return;
    setHatchError(false);
    go("hatching");
    setStarted(true);
    setLine(mintPage.hatching);
    setFocus("line");
    try {
      await debugHatch();
      const drawn = await hatchRandom();
      setPet(await mintPet({ token: drawn }));
      setToken(drawn);
    } catch (error) {
      resetHatch();
      applyStatus(await getDropStatus());
      if (error instanceof DropError && error.code === "sold_out") {
        go("soldOut");
        setFocus("soldOut");
      } else {
        go("ready");
        setHatchError(true);
        setFocus("hatch");
      }
    }
  };

  const hatched = () => {
    if (!token) return;
    const profile = findPet(token.petId)!;
    setRevealed(true);
    setLine(fill(mintPage.hatched, { tier: token.tier, species: profile.species }));
    setFocus("reveal");
  };

  const nameCheck = (value: string, petId: string) => {
    if (!normalizePetName(value)) return null;
    const result = validatePetName(value, petId);
    return result.ok ? null : result.error;
  };

  const finish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || leaving) return;
    try {
      const saved = await renamePet(name);
      setPet(saved);
      setLeaving(true);
      router.push("/pet");
    } catch (error) {
      if (error instanceof MintError) setNameError(error.code === "no_wallet" ? "no_pet" : error.code);
      inputRef.current?.focus();
    }
  };

  const startOver = async () => {
    if (pet) await releasePet(pet.id);
    setConfirming(false);
    resetHatch();
    applyStatus(await getDropStatus());
    const next = idleView();
    go(next);
    setFocus(next === "soldOut" ? "soldOut" : "hatch");
  };

  const resetDemoDrop = async () => {
    await resetDrop();
    applyStatus(await getDropStatus());
    resetHatch();
    go("ready");
    setFocus("hatch");
  };

  const counter = fill(mintPage.counter, { minted: String(status.minted), total: String(status.total) });

  if (view === "existing" && pet) {
    const profile = findPet(pet.petId)!;
    return (
      <div className="mint-existing">
        <h2 ref={existingRef} className="mint-subtitle" tabIndex={-1}>
          {mintPage.existing.title}
        </h2>
        <div className={pet.token ? "mint-existing-body has-token" : "mint-existing-body"}>
          {pet.token ? (
            <TokenCard tokenId={pet.token.tokenId} heading="h3" />
          ) : (
            <div className="pet-card mint-existing-card">
              <div className="pet-sprite-wrap">
                <Image
                  className="pet-sprite"
                  src={petSpriteSrc(profile, "happy")}
                  alt=""
                  width={profile.spriteWidth}
                  height={profile.spriteHeight}
                />
              </div>
              <p className="mint-card-name">
                <span className="mint-card-title">{pet.name}</span>
              </p>
            </div>
          )}
          <div className="mint-existing-side">
            <p className="mint-card-text">{fill(mintPage.existing.body, { name: pet.name, species: pet.species })}</p>
            {confirming ? (
              <div className="mint-confirm" role="group" aria-labelledby="mint-confirm-text">
                <p id="mint-confirm-text" ref={confirmRef} tabIndex={-1}>
                  {fill(mintPage.confirm.text, { name: pet.name })}
                </p>
                <div className="mint-actions">
                  <button type="button" className="button button-secondary" onClick={startOver}>
                    {mintPage.confirm.yes}
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      setConfirming(false);
                      setFocus("existing");
                    }}
                  >
                    {fill(mintPage.confirm.keep, { name: pet.name })}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mint-actions">
                <Link className="button button-primary" href="/pet">
                  {mintPage.existing.go}
                </Link>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setConfirming(true);
                    setFocus("confirm");
                  }}
                >
                  {mintPage.existing.startOver}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === "soldOut") {
    return (
      <div className="mint-soldout">
        <h2 ref={soldOutRef} className="mint-subtitle" tabIndex={-1}>
          {fill(mintPage.soldOut.title, { total: String(status.total) })}
        </h2>
        <p className="mint-card-text">{mintPage.soldOut.body}</p>
        <p className="mint-counter">{counter}</p>
        <div className="mint-actions">
          <button type="button" className="button button-secondary" onClick={resetDemoDrop}>
            {mintPage.soldOut.reset}
          </button>
        </div>
        <p className="mint-hint">{fill(mintPage.soldOut.note, { total: String(status.total) })}</p>
      </div>
    );
  }

  // ready, hatching (incl. reveal) and the hidden first paint share one layout, so the egg never remounts.
  const profile = token ? findPet(token.petId)! : null;
  const typed = profile && validatePetName(name, profile.id);
  const goName = typed && typed.ok ? typed.name : (pet?.name ?? profile?.name ?? "");

  return (
    <>
      <noscript>
        <p className="mint-note">{mintPage.noscript}</p>
      </noscript>
      <div className={view === "loading" ? "mint-hatch is-loading" : "mint-hatch"} aria-busy={view === "loading" || undefined}>
        <HatchStage key={hatchKey} started={started} token={token} onWaiting={() => setLine(mintPage.waiting)} onHatched={hatched} />
        <div className="hatch-status" role="status">
          <p ref={lineRef} className="hatch-line" tabIndex={-1}>
            {line}
          </p>
        </div>

        {!started ? (
          <div className="mint-ready">
            <p className="mint-counter">{counter}</p>
            {walletReady && !account ? (
              <WalletGate context="mint" onConnected={() => getPet().then((saved) => setFocus(saved ? "existing" : "hatch"))} />
            ) : (
              <button ref={hatchRef} type="button" className="button button-primary mint-hatch-button" onClick={hatch}>
                {mintPage.hatchButton}
                <span className="mint-tag">{mintPage.hatchTag}</span>
              </button>
            )}
            {hatchError ? (
              <p className="mint-error" role="alert">
                {mintPage.hatchError}
              </p>
            ) : null}
            <p className="mint-hint">{mintPage.readyHint}</p>
          </div>
        ) : null}

        {revealed && token && profile ? (
          <form className="mint-reveal" noValidate onSubmit={finish}>
            <TokenInfo
              token={token}
              headingId="mint-reveal-title"
              headingText={fill(mintPage.reveal.title, { token: token.name })}
              headingRef={revealRef}
            />
            <div className="mint-name">
              <label className="mint-legend" htmlFor="mint-name">
                {mintPage.reveal.nameLabel}
              </label>
              <div className="mint-name-row">
                <input
                  ref={inputRef}
                  id="mint-name"
                  className="mint-input"
                  type="text"
                  name="name"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={PET_NAME_MAX * 2}
                  placeholder={profile.name}
                  value={name}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "mint-name-hint mint-name-error" : "mint-name-hint"}
                  onChange={(event) => {
                    setName(event.target.value);
                    // Clear a shown error as soon as the value is fixed; new errors wait for blur/submit.
                    if (nameError && !nameCheck(event.target.value, profile.id)) setNameError(null);
                  }}
                  onBlur={() => {
                    const normalized = normalizePetName(name);
                    setName(normalized);
                    setNameError(nameCheck(normalized, profile.id));
                  }}
                />
                <button type="submit" className="button button-primary" aria-disabled={leaving || undefined}>
                  {fill(mintPage.goTo, { name: goName })}
                </button>
              </div>
              <p id="mint-name-hint" className="mint-hint">
                {fill(mintPage.nameHint, { pet: profile.name })}
              </p>
              {nameError ? (
                <p id="mint-name-error" className="mint-error" role="alert">
                  {mintPage.errors[nameError]}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}

        {persistent ? null : <p className="mint-note">{mintPage.storageNote}</p>}
      </div>
    </>
  );
}

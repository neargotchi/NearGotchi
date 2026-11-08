"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import DropProgress from "../../components/DropProgress";
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
  getPets,
  isPersistent,
  mintPet,
  normalizePetName,
  renamePet,
  validatePetName,
  type DemoPet,
  type NameError,
} from "../../lib/mocks";
import { shareOnXUrl } from "../../lib/share";
import { useWallet } from "../../lib/use-wallet";
import { TokenInfo } from "../pet/token-card";
import WalletGate from "../wallet-gate";
import HatchStage from "./hatch-stage";

/** loading → ready | soldOut; ready → hatching (draw, animation, reveal) → /pet. */
type View = "loading" | "ready" | "soldOut" | "hatching";
type Focus = "hatch" | "line" | "reveal" | "soldOut" | null;
type Status = { minted: number; total: number; soldOut: boolean };

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

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * /mint v2 (docs/DEVLOG.md §2, step 3): one random token from the 300 per hatch, as many hatches as
 * the drop has eggs. Hatching needs the demo wallet (without it the hatch button is a connect gate). The
 * pet is saved as soon as the token is drawn (its own name, and it becomes the active pet), so leaving
 * during the animation or the reveal keeps it. The reveal names it ("play with {name}" → /pet) and links
 * a prefilled post on X. No pet picker: a `?pet=` parameter from old links is ignored.
 */
export default function MintFlow() {
  const router = useRouter();
  const { ready: walletReady, account } = useWallet();
  const [view, setView] = useState<View>("loading");
  const viewRef = useRef<View>("loading");
  const [status, setStatus] = useState<Status>({ minted: 0, total: DROP1_TOTAL, soldOut: false });
  const [persistent, setPersistent] = useState(true);
  const [focus, setFocus] = useState<Focus>(null);

  // hatch
  const [hatchKey, setHatchKey] = useState(0);
  const [started, setStarted] = useState(false);
  const [token, setToken] = useState<Drop1Token | null>(null);
  const [pet, setPet] = useState<DemoPet | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [line, setLine] = useState("");
  const [hatchError, setHatchError] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<NameError | null>(null);
  const [leaving, setLeaving] = useState(false);

  const hatchRef = useRef<HTMLButtonElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const revealRef = useRef<HTMLHeadingElement>(null);
  const revealFormRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const soldOutRef = useRef<HTMLHeadingElement>(null);

  const go = (next: View) => {
    viewRef.current = next;
    setView(next);
  };

  useEffect(() => {
    let live = true;
    setPersistent(isPersistent());

    // Pets first: migrating an old pet can claim a token, which the count must include.
    getPets().then(async () => {
      const next = await getDropStatus();
      if (!live || viewRef.current !== "loading") return;
      setStatus(next);
      go(next.soldOut ? "soldOut" : "ready");
    });

    // Other tabs keep the view in sync; a running hatch/reveal is left alone.
    const offDrop = subscribeDrop((next) => {
      if (!live) return;
      setStatus(next);
      if (viewRef.current === "ready" && next.soldOut) go("soldOut");
      if (viewRef.current === "soldOut" && !next.soldOut) go("ready");
    });

    return () => {
      live = false;
      offDrop();
    };
  }, []);

  // Focus moves only after a user action, never on first load.
  useEffect(() => {
    if (!focus) return;
    const target = { hatch: hatchRef, line: lineRef, reveal: revealRef, soldOut: soldOutRef }[focus].current;
    if (!target) return;
    if (focus === "reveal") {
      // At 1920×1080 the reveal card starts below the fold (QA 036): glide it into view, then focus without a jump.
      target.focus({ preventScroll: true });
      revealFormRef.current?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
    } else {
      target.focus();
    }
    setFocus(null);
  }, [focus, view, revealed, started]);

  const resetHatch = () => {
    setStarted(false);
    setToken(null);
    setPet(null);
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
      setStatus(await getDropStatus());
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

  /** "play with {name}": saves the name, then this pet's /pet (the games tab arrives in step 7). */
  const play = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !pet || leaving) return;
    try {
      await renamePet(name, pet.id);
      setLeaving(true);
      router.push(`/pet?id=${token.tokenId}&tab=games`);
    } catch (error) {
      if (error instanceof MintError) setNameError(error.code === "no_wallet" ? "no_pet" : error.code);
      inputRef.current?.focus();
    }
  };

  const resetDemoDrop = async () => {
    await resetDrop();
    setStatus(await getDropStatus());
    resetHatch();
    go("ready");
    setFocus("hatch");
  };

  if (view === "soldOut") {
    return (
      <div className="mint-soldout">
        <h2 ref={soldOutRef} className="mint-subtitle" tabIndex={-1}>
          {fill(mintPage.soldOut.title, { total: String(status.total) })}
        </h2>
        <p className="mint-card-text">{mintPage.soldOut.body}</p>
        <DropProgress className="mint-progress" />
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
  const playName = typed && typed.ok ? typed.name : (pet?.name ?? profile?.name ?? "");

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
            <DropProgress className="mint-progress" />
            {walletReady && !account ? (
              <WalletGate context="mint" onConnected={() => setFocus("hatch")} />
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
          <form ref={revealFormRef} className="mint-reveal" noValidate onSubmit={play}>
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
              <p id="mint-name-hint" className="mint-hint">
                {fill(mintPage.nameHint, { pet: profile.name })}
              </p>
              {nameError ? (
                <p id="mint-name-error" className="mint-error" role="alert">
                  {mintPage.errors[nameError]}
                </p>
              ) : null}
            </div>
            <div className="mint-actions mint-reveal-actions">
              <button type="submit" className="button button-primary" aria-disabled={leaving || undefined}>
                {fill(mintPage.reveal.play, { name: playName })}
              </button>
              <a className="button button-secondary" href={shareOnXUrl(token)} target="_blank" rel="noopener noreferrer">
                {mintPage.reveal.share}
                <span className="visually-hidden"> {mintPage.reveal.shareNewTab}</span>
              </a>
            </div>
          </form>
        ) : null}

        {persistent ? null : <p className="mint-note">{mintPage.storageNote}</p>}
      </div>
    </>
  );
}

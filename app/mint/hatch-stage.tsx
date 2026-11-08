"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import Sparkles from "../../components/Sparkles";
import type { Drop1Token } from "../../lib/drop1";

export type HatchPhase = "idle" | "shake" | "wait" | "crack" | "split" | "pet" | "hold";

/** Pixel crack across the egg, between the screen and the buttons of logo-transparent.png. */
const CRACK_Y = [66, 68];
const CRACK_X = [19, 27, 35, 43, 51, 59, 67, 75, 81];

/** Stair-step line (horizontal + vertical segments only, so edges stay crisp). */
function crackLine(xs: number[], fromEdge: boolean, offset = 0) {
  const points: [number, number][] = [];
  for (let i = 0; i < xs.length - 1; i++) {
    const y = CRACK_Y[i % 2] + offset;
    points.push([fromEdge && i === 0 ? 0 : xs[i], y]);
    points.push([fromEdge && i === xs.length - 2 ? 100 : xs[i + 1], y]);
  }
  return points;
}

const pts = (points: [number, number][]) => points.map(([x, y]) => `${x}% ${y}%`).join(", ");
const edge = crackLine(CRACK_X, true);
const TOP_CLIP = `polygon(0% 0%, 100% 0%, ${pts([...edge].reverse())})`;
const BOTTOM_CLIP = `polygon(${pts(edge)}, 100% 100%, 0% 100%)`;
const CRACK_CLIP = `polygon(${pts(crackLine(CRACK_X, false))}, ${pts(crackLine(CRACK_X, false, 1.4).reverse())})`;

/** The reveal waits at most this long for the webp to decode, then shows it anyway. */
const DECODE_WAIT_MS = 2000;

/** Resolves once the image is decoded (or failed, or took too long), so the split never shows an empty frame. */
function preload(src: string) {
  return new Promise<void>((resolve) => {
    const img = new window.Image();
    const timer = setTimeout(resolve, DECODE_WAIT_MS);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    img.src = src;
    img.decode().then(done, done);
  });
}

type HatchStageProps = {
  /** false: the egg sits still (ready view). true: the hatch runs. */
  started: boolean;
  /** The drawn token; null while the draw is pending (the egg keeps wobbling). */
  token: Drop1Token | null;
  /** Wobble loop started (the draw is slower than the 1s shake). */
  onWaiting?: () => void;
  /** The NFT is on screen. */
  onHatched: () => void;
};

/**
 * Hatch (docs/PLAN-MINT.md §4, random draw since task 036): wobble + hard shake 0–1000ms; if the token
 * (and its decoded webp) isn't there yet the egg wobbles in a loop; then crack 300ms, split + flash +
 * burst 300ms, the NFT appears and bobs. With reduced motion the egg swaps to the NFT as soon as it is ready.
 * There is no redirect: the reveal (name + go) follows below the stage.
 */
export default function HatchStage({ started, token, onWaiting, onHatched }: HatchStageProps) {
  const [phase, setPhase] = useState<HatchPhase>("idle");
  const [shaken, setShaken] = useState(false);
  const [ready, setReady] = useState<Drop1Token | null>(null);
  const callbacks = useRef({ onWaiting, onHatched });
  callbacks.current = { onWaiting, onHatched };
  const reduce = useRef(false);

  // Start: shake for 1s (skipped with reduced motion).
  useEffect(() => {
    if (!started) return;
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) {
      setShaken(true);
      return;
    }
    setPhase("shake");
    const timer = setTimeout(() => setShaken(true), 1000);
    return () => clearTimeout(timer);
  }, [started]);

  // Token drawn → wait for its webp to decode.
  useEffect(() => {
    if (!token) return;
    let live = true;
    preload(token.image).then(() => live && setReady(token));
    return () => {
      live = false;
    };
  }, [token]);

  // Shake done but nothing to show yet → wobble loop.
  useEffect(() => {
    if (shaken && !ready && !reduce.current) {
      setPhase("wait");
      callbacks.current.onWaiting?.();
    }
  }, [shaken, ready]);

  // Both ready → crack, split, NFT.
  useEffect(() => {
    if (!shaken || !ready) return;
    if (reduce.current) {
      setPhase("hold");
      callbacks.current.onHatched();
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    setPhase("crack");
    at(300, () => setPhase("split"));
    at(600, () => setPhase("pet"));
    at(1000, () => {
      setPhase("hold");
      callbacks.current.onHatched();
    });
    return () => timers.forEach(clearTimeout);
  }, [shaken, ready]);

  const burst = phase === "split" || phase === "pet" || phase === "hold";

  return (
    <div className={`hatch-stage is-${phase}`} aria-hidden="true">
      <div className="hatch-egg">
        <Image className="hatch-half hatch-top" src="/logo-transparent.png" alt="" width={1024} height={1024} style={{ clipPath: TOP_CLIP }} priority />
        <Image className="hatch-half hatch-bottom" src="/logo-transparent.png" alt="" width={1024} height={1024} style={{ clipPath: BOTTOM_CLIP }} priority />
        {/* the wrapper's clip-path grows the crack; the inner span carries the zig-zag shape */}
        <span className="hatch-crack">
          <span style={{ clipPath: CRACK_CLIP }} />
        </span>
      </div>
      {ready ? (
        // unoptimized: the same URL preload() decoded, so it comes from cache
        <Image className="hatch-pet hatch-nft" src={ready.image} alt="" width={512} height={512} unoptimized priority />
      ) : null}
      <span className="hatch-flash" />
      {burst && ready ? (
        <Sparkles
          count={8}
          colors={["var(--green)", "var(--sparkle-alt)"]}
          area={[
            { x: [6, 20], y: [8, 30] },
            { x: [80, 94], y: [8, 30] },
            { x: [4, 18], y: [50, 78] },
            { x: [82, 96], y: [50, 78] },
          ]}
          seed={`hatch-${ready.tokenId % 7}`}
          size={20}
          mode="burst"
        />
      ) : null}
    </div>
  );
}

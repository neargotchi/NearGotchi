"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import Sparkles from "../../components/Sparkles";
import { fill, mintPage } from "../../lib/copy";
import { petSpriteSrc, type PetProfile } from "../../lib/mocks";

type Phase = "shake" | "crack" | "split" | "pet" | "hold";

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

type HatchStageProps = { profile: PetProfile; name: string; onDone: () => void };

/**
 * Hatch (docs/PLAN-MINT.md §4): wobble 0–600ms, hard shake to 1000, crack 1000–1300, split + flash +
 * NEAR burst 1300–1600, happy pet 1600–2000, hold, redirect at 3200. Phase classes drive CSS steps();
 * with reduced motion the egg swaps to the pet at once and the redirect comes at 1500ms.
 */
export default function HatchStage({ profile, name, onDone }: HatchStageProps) {
  const [phase, setPhase] = useState<Phase>("shake");
  const [line, setLine] = useState(mintPage.hatching);
  const [showGo, setShowGo] = useState(false);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const goRef = useRef<HTMLAnchorElement>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    lineRef.current?.focus();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) => timers.push(setTimeout(run, ms));
    const hatched = () => {
      setPhase("hold");
      setLine(fill(mintPage.hatched, { name }));
      setShowGo(true);
    };
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      hatched();
      at(700, () => setLine(fill(mintPage.redirecting, { name })));
      at(1500, () => done.current());
    } else {
      at(1000, () => setPhase("crack"));
      at(1300, () => setPhase("split"));
      at(1600, () => setPhase("pet"));
      at(2000, hatched);
      at(2600, () => setLine(fill(mintPage.redirecting, { name })));
      at(3200, () => done.current());
    }
    return () => timers.forEach(clearTimeout);
  }, [name]);

  useEffect(() => {
    if (showGo) goRef.current?.focus();
  }, [showGo]);

  const burst = phase === "split" || phase === "pet" || phase === "hold";

  return (
    <div className="mint-hatch">
      <div className={`hatch-stage is-${phase}`} aria-hidden="true">
        <div className="hatch-egg">
          <Image className="hatch-half hatch-top" src="/logo-transparent.png" alt="" width={1024} height={1024} style={{ clipPath: TOP_CLIP }} priority />
          <Image className="hatch-half hatch-bottom" src="/logo-transparent.png" alt="" width={1024} height={1024} style={{ clipPath: BOTTOM_CLIP }} priority />
          {/* the wrapper's clip-path grows the crack; the inner span carries the zig-zag shape */}
          <span className="hatch-crack">
            <span style={{ clipPath: CRACK_CLIP }} />
          </span>
        </div>
        <Image className="hatch-pet" src={petSpriteSrc(profile, "happy")} alt="" width={profile.spriteWidth} height={profile.spriteHeight} priority />
        <span className="hatch-flash" />
        {burst ? (
          <Sparkles
            count={8}
            colors={["var(--green)", "var(--sparkle-alt)"]}
            area={[
              { x: [14, 30], y: [8, 30] },
              { x: [70, 86], y: [8, 30] },
              { x: [8, 24], y: [50, 78] },
              { x: [76, 92], y: [50, 78] },
            ]}
            seed={`hatch-${profile.id}`}
            size={20}
            mode="burst"
          />
        ) : null}
      </div>
      <div className="hatch-status" role="status">
        <p ref={lineRef} className="hatch-line" tabIndex={-1}>
          {line}
        </p>
      </div>
      {showGo ? (
        <Link ref={goRef} className="button button-primary hatch-go" href="/pet">
          {fill(mintPage.goTo, { name })}
        </Link>
      ) : null}
    </div>
  );
}

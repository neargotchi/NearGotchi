"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import Sparkles from "./Sparkles";

type MascotProps = {
  name: string;
  line: string;
  spriteFolder: string;
  className?: string;
};

const ACTIVE_MS = 1200;

/** Section mascot: small pet + pixel speech bubble. Click/Enter/Space → happy, hop, sparkle burst. */
export default function Mascot({ name, line, spriteFolder, className }: MascotProps) {
  const [run, setRun] = useState(0);
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const pet = () => {
    if (timer.current) clearTimeout(timer.current);
    setRun((value) => value + 1);
    setActive(true);
    timer.current = setTimeout(() => setActive(false), ACTIVE_MS);
  };

  return (
    <div className={className ? `mascot ${className}` : "mascot"}>
      <p className="mascot-bubble">{line}</p>
      <button
        type="button"
        className={active ? "mascot-button is-active" : "mascot-button"}
        aria-label={`pet ${name}`}
        onClick={pet}
      >
        {/* key restarts the hop + burst on every click */}
        <span key={run} className="mascot-figure">
          <Image
            className="mascot-sprite"
            src={`/pets/${spriteFolder}/${active ? "happy" : "normal"}.png`}
            alt=""
            width={489}
            height={431}
          />
          <Sparkles
            count={5}
            colors={["var(--green)", "var(--green-deep)"]}
            area={{ x: [-10, 100], y: [-20, 60] }}
            seed={`mascot-${name}`}
            size={12}
            mode="burst"
          />
        </span>
      </button>
    </div>
  );
}

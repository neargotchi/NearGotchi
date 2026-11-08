"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { fill, petPage } from "../../../lib/copy";

type Phase = "idle" | "show" | "input" | "wait" | "over";

const PADS = [0, 1, 2] as const;
const copy = petPage.games.simon;

const randomPad = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % 3;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type SimonProps = {
  /** false: blocked (hungry / asleep); the reason and "feed it first" show instead of "play". */
  canStart: boolean;
  blockedReason: string | null;
  /** The games tab is visible; leaving it mid-game stops the game (free). */
  active: boolean;
  /** Happy sprite of the pet, shown on the LCD after a game. */
  happySprite: { src: string; width: number; height: number };
  onStart: () => void;
  /** Game over with the length of the last sequence repeated correctly. */
  onEnd: (score: number) => void;
  onStop: () => void;
  onFeed: () => void;
};

/**
 * Simon on the three tamagotchi buttons (docs/DEVLOG.md §2): the pads light up in a sequence that
 * grows by one each round; repeat it with mouse, touch or keys 1/2/3. The first wrong press ends the game;
 * score = length of the last sequence repeated correctly. The sequence is announced in an aria-live line.
 * Reduced motion: slower, and a lit pad changes colour without the glow.
 */
export default function Simon({ canStart, blockedReason, active, happySprite, onStart, onEnd, onStop, onFeed }: SimonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lit, setLit] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<number | null>(null);
  const [live, setLive] = useState("");
  const phaseRef = useRef<Phase>("idle");
  const seq = useRef<number[]>([]);
  const step = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const deviceRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const later = (ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms));
  };

  useEffect(() => {
    const pending = timers;
    return () => pending.current.forEach(clearTimeout);
  }, []);

  /** Plays the sequence on the pads, then hands over. Faster each round (slow and steady with reduced motion). */
  const show = (sequence: number[]) => {
    go("show");
    setLit(null);
    setRound(sequence.length);
    setLive(fill(copy.round, { n: String(sequence.length) }));
    const slow = reducedMotion();
    const on = slow ? 750 : Math.max(260, 500 - sequence.length * 22);
    const off = slow ? 400 : Math.max(130, 230 - sequence.length * 9);
    let t = 600;
    sequence.forEach((pad) => {
      later(t, () => setLit(pad));
      later(t + on, () => setLit(null));
      t += on + off;
    });
    later(t, () => {
      step.current = 0;
      go("input");
      setLive(
        fill(copy.sequence, { n: String(sequence.length), seq: sequence.map((pad) => String(pad + 1)).join(", ") }),
      );
    });
  };

  const start = () => {
    if (!canStart) return;
    clear();
    seq.current = [randomPad()];
    setScore(0);
    setWrong(null);
    onStart();
    show(seq.current);
    // "play" is replaced by "stop": keep focus on the console (keys 1/2/3 work anywhere on the page).
    deviceRef.current?.focus({ preventScroll: true });
  };

  const stop = () => {
    clear();
    setLit(null);
    go("idle");
    setLive("");
    onStop();
  };

  const press = (pad: number) => {
    if (phaseRef.current !== "input") return;
    clear();
    setLit(pad);
    later(180, () => setLit(null));
    const expected = seq.current[step.current];
    if (pad !== expected) {
      const final = seq.current.length - 1;
      setWrong(expected);
      setScore(final);
      go("over");
      setLive(`${fill(copy.wrong, { n: String(expected + 1) })} ${copy.over}.`);
      onEnd(final);
      later(50, () => playRef.current?.focus({ preventScroll: true }));
      return;
    }
    step.current += 1;
    if (step.current === seq.current.length) {
      setScore(seq.current.length);
      go("wait");
      const next = [...seq.current, randomPad()];
      seq.current = next;
      later(650, () => show(next));
    }
  };

  // Keys 1 / 2 / 3 while a game runs (not while typing somewhere else).
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    const pad = ["1", "2", "3"].indexOf(event.key);
    if (pad === -1) return;
    event.preventDefault();
    press(pad);
  });
  const running = active && phase !== "idle" && phase !== "over";
  useEffect(() => {
    if (!running) return;
    const listener = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [running]);

  // Leaving the games tab mid-game stops it (no cost).
  const stopIfRunning = useEffectEvent(() => {
    if (phaseRef.current !== "idle" && phaseRef.current !== "over") stop();
  });
  useEffect(() => {
    if (!active) stopIfRunning();
  }, [active]);

  const playing = phase === "show" || phase === "input" || phase === "wait";
  const lcdTop = phase === "idle" ? copy.ready : phase === "over" ? copy.over : fill(copy.round, { n: String(round) });
  const lcdMain =
    phase === "show" ? copy.watch : phase === "input" ? copy.yourTurn : phase === "wait" ? copy.good : phase === "over" ? String(score) : "";

  return (
    <div className="simon">
      <div ref={deviceRef} className="simon-device" tabIndex={-1}>
        <div className={phase === "over" ? "simon-screen is-over" : "simon-screen"}>
          <p className="simon-lcd-top">{lcdTop}</p>
          {phase === "over" ? (
            <Image className="simon-happy" src={happySprite.src} alt="" width={happySprite.width} height={happySprite.height} />
          ) : null}
          <p className="simon-lcd-main" aria-hidden="true">
            {lcdMain}
          </p>
        </div>
        <div className="simon-pads" role="group" aria-label={copy.pads}>
          {PADS.map((pad) => (
            <button
              key={pad}
              type="button"
              className={[
                "simon-pad",
                lit === pad ? "is-lit" : "",
                phase === "over" && wrong === pad ? "is-wrong" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={fill(copy.pad, { n: String(pad + 1) })}
              aria-disabled={phase !== "input" || undefined}
              onPointerDown={(event) => {
                // Touch/mouse respond on press, not release (snappier); keyboard uses click below.
                if (event.pointerType !== "mouse" || event.button === 0) {
                  event.preventDefault();
                  press(pad);
                }
              }}
              onClick={(event) => {
                if (event.detail === 0) press(pad); // keyboard Enter/Space
              }}
            >
              <span aria-hidden="true">{pad + 1}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {live}
      </p>

      <div className="simon-controls">
        {playing ? (
          <button type="button" className="button button-secondary" onClick={stop}>
            {petPage.games.stop}
          </button>
        ) : canStart ? (
          <button ref={playRef} type="button" className="button button-primary" onClick={start}>
            {phase === "over" ? petPage.games.again : petPage.games.play}
          </button>
        ) : (
          <div className="game-blocked">
            <p className="snack-reason">{blockedReason}</p>
            <button ref={playRef} type="button" className="button button-primary" onClick={onFeed}>
              {petPage.games.feedFirst}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

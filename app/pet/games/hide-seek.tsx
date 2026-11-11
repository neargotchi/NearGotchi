"use client";

import Image from "next/image";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import { fill, petPage } from "../../../lib/copy";
import GameClose from "./game-close";
import { useGameModal } from "./use-game-modal";
import { HIDESEEK, finalSlots, isFound, makeRound, marks, steps4, viewAt, type Round, type SpotView } from "../../../lib/hideseek-game";
import SpotSprite, { SPOT_TOP } from "./hide-spots";

type Phase = "idle" | "run" | "paused" | "over";
type Reveal = { slot: number; found: boolean; t: number };
type Snap = { round: Round; t: number; reveal: Reveal | null; slow: boolean };

const copy = petPage.games.hideseek;
/** LCD is 5:3; the pet is 28% of its height; a spot is a square this wide (% of the LCD width). */
const LCD_RATIO = 5 / 3;
const PET_H = 28;
const spotWidth = (n: number) => (n <= 3 ? 22 : n === 4 ? 19 : 17);
const slotX = (slot: number, n: number) => ((slot + 0.5) / n) * 100;

const randomUnit = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
};

/** The idle scene: 3 spots, the pet in front of the middle one. */
const PREVIEW: Round = { round: 1, kinds: ["bush", "box", "tree"], petSpot: 1, swaps: [], swapMs: 700, showMs: 1000 };

type HideSeekProps = {
  canStart: boolean;
  blockedReason: string | null;
  active: boolean;
  petName: string;
  /** normal: hiding; happy: found, peeking with its tongue out and after the game. */
  sprites: { normal: string; happy: string; width: number; height: number };
  /** Mouth position in the sprite (0–1), for the tongue. */
  mouth: [number, number];
  onStart: () => void;
  onEnd: (score: number) => void;
  onStop: () => void;
  onFeed: () => void;
  children?: ReactNode;
};

/**
 * Hide & seek (task 051): the pet walks behind one of 3–5 pixel spots, the spots swap places in pairs,
 * then you pick one (click / tap, keys 1–5, or arrows + enter on the spot buttons). Found: it pops out
 * happy and the next round has more swaps, a bit faster, and one more spot every 2 rounds. Wrong: that
 * spot is empty, the pet peeks out of the right one with its tongue out, game over. Score = finds.
 * One rAF clock drives the whole round (rules + timeline in lib/hideseek-game.ts), so P can pause it;
 * a pause asked for mid-shuffle waits for the end of the round. Reduced motion: spots swap in place with
 * a short frame flash, no glide, no hop.
 */
export default function HideSeek({
  canStart,
  blockedReason,
  active,
  petName,
  sprites,
  mouth,
  onStart,
  onEnd,
  onStop,
  onFeed,
  children,
}: HideSeekProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [snap, setSnap] = useState<Snap>({ round: PREVIEW, t: 0, reveal: null, slow: false });
  const [pauseNext, setPauseNext] = useState(false);
  const [live, setLive] = useState("");
  const phaseRef = useRef<Phase>("idle");
  const deviceRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const spotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const frame = useRef<number | null>(null);
  const game = useRef({
    round: PREVIEW,
    t: 0,
    last: 0,
    score: 0,
    reveal: null as Reveal | null,
    pauseNext: false,
    told: false,
    slow: false,
  });

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  /** Copy what the LCD needs out of the game ref (render never reads the ref). */
  const redraw = () => {
    const g = game.current;
    setSnap({ round: g.round, t: g.t, reveal: g.reveal ? { ...g.reveal } : null, slow: g.slow });
  };

  const finish = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const final = game.current.score;
    go("over");
    setPauseNext(false);
    setLive(fill(copy.live.over, { n: String(final) }));
    onEnd(final);
    setTimeout(() => playRef.current?.focus({ preventScroll: true }), 50);
  };

  const beginRound = (round: number) => {
    const g = game.current;
    g.round = makeRound(round, randomUnit);
    g.t = 0;
    g.reveal = null;
    g.told = false;
    setLive(fill(copy.live.round, { n: String(round), name: petName, k: String(g.round.kinds.length) }));
  };

  const pauseNow = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    game.current.pauseNext = false;
    setPauseNext(false);
    go("paused");
    setLive(copy.live.paused);
  };

  const tick = (now: number) => {
    const g = game.current;
    const dt = Math.min(50, now - (g.last || now));
    g.last = now;
    if (g.reveal) {
      g.reveal.t += dt;
      if (g.reveal.t >= (g.reveal.found ? HIDESEEK.foundMs : HIDESEEK.missMs)) {
        if (!g.reveal.found) {
          redraw();
          finish();
          return;
        }
        beginRound(g.round.round + 1);
        if (g.pauseNext) {
          redraw();
          pauseNow();
          return;
        }
      }
    } else {
      const pickAt = marks(g.round).pick;
      g.t = Math.min(pickAt, g.t + dt);
      if (g.t >= pickAt && !g.told) {
        g.told = true;
        setLive(fill(copy.live.pick, { k: String(g.round.kinds.length) }));
        // Keyboard users land on the leftmost spot; arrows move along the row.
        setTimeout(() => focusSlot(0), 0);
        if (g.pauseNext) {
          redraw();
          pauseNow();
          return;
        }
      }
    }
    redraw();
    frame.current = requestAnimationFrame(tick);
  };

  const run = () => {
    game.current.last = 0;
    go("run");
    frame.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!canStart) return;
    game.current = { ...game.current, score: 0, pauseNext: false, slow: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    setScore(0);
    setPauseNext(false);
    onStart();
    beginRound(1);
    run();
    deviceRef.current?.focus({ preventScroll: true });
  };

  /** Pause: at once while waiting for a pick or between rounds; mid-round it waits for the round to end. */
  const pause = () => {
    if (phaseRef.current !== "run") return;
    const g = game.current;
    const waiting = !g.reveal && g.t >= marks(g.round).pick;
    if (waiting) {
      pauseNow();
      return;
    }
    g.pauseNext = !g.pauseNext;
    setPauseNext(g.pauseNext);
    if (g.pauseNext) setLive(copy.live.pauseNext);
  };

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    setLive(copy.live.resumed);
    run();
    deviceRef.current?.focus({ preventScroll: true });
  };

  const reset = (announce: boolean) => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    game.current = { ...game.current, round: PREVIEW, t: 0, reveal: null, score: 0, pauseNext: false };
    setScore(0);
    setPauseNext(false);
    go("idle");
    setLive("");
    redraw();
    if (announce) onStop();
  };

  /** Quit a running round (announces "stopped"). */
  const stop = () => reset(true);

  const canPick = () => {
    const g = game.current;
    return phaseRef.current === "run" && !g.reveal && g.t >= marks(g.round).pick;
  };

  const pick = (slot: number) => {
    if (!canPick()) return;
    const g = game.current;
    const r = g.round;
    const found = isFound(r, slot);
    const slots = finalSlots(r);
    const kindAt = (s: number) => copy.kinds[r.kinds[slots.indexOf(s)]];
    g.reveal = { slot, found, t: 0 };
    if (found) {
      g.score += 1;
      setScore(g.score);
      setLive(fill(copy.live.found, { name: petName, kind: kindAt(slot), n: String(g.score) }));
    } else {
      setLive(
        fill(copy.live.miss, { kind: kindAt(slot), name: petName, other: kindAt(slots[r.petSpot]), n: String(g.score) }),
      );
    }
    deviceRef.current?.focus({ preventScroll: true });
  };

  const focusSlot = (slot: number) => spotRefs.current[slot]?.focus({ preventScroll: true });

  // Keyboard: 1–5 pick that spot (left to right); P pauses / resumes.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    const n = game.current.round.kinds.length;
    if (/^[1-5]$/.test(key)) {
      const slot = Number(key) - 1;
      if (slot >= n) return;
      pick(slot);
    } else if (key === "p") {
      if (phaseRef.current === "run") pause();
      else if (phaseRef.current === "paused") resume();
    } else return;
    event.preventDefault();
  });
  const listening = active && (phase === "run" || phase === "paused");
  useEffect(() => {
    if (!listening) return;
    const down = (event: KeyboardEvent) => onKey(event);
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [listening]);

  /** Arrows move along the row of spots (in slot order). */
  const onSpotKey = (slot: number, n: number) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") focusSlot((slot + n - 1) % n);
    else if (event.key === "ArrowRight" || event.key === "ArrowDown") focusSlot((slot + 1) % n);
    else return;
    event.preventDefault();
  };

  // Hidden page → pause (at the end of the round, like P); leaving the games tab mid-game → stop (free).
  const onHidden = useEffectEvent(() => {
    if (document.visibilityState === "hidden" && phaseRef.current === "run") {
      if (canPick()) pauseNow();
      else if (!game.current.pauseNext) pause();
    }
  });
  useEffect(() => {
    const listener = () => onHidden();
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, []);
  const stopIfRunning = useEffectEvent(() => {
    if (phaseRef.current === "run" || phaseRef.current === "paused") stop();
  });
  useEffect(() => {
    if (!active) stopIfRunning();
  }, [active]);
  useEffect(() => {
    const pending = frame;
    return () => {
      if (pending.current !== null) cancelAnimationFrame(pending.current);
    };
  }, []);

  // ---------- what the LCD shows right now ----------
  const r = phase === "idle" ? PREVIEW : snap.round;
  const n = r.kinds.length;
  const slow = snap.slow;
  const reveal = phase === "idle" ? null : snap.reveal;
  const view = viewAt(r, phase === "idle" ? 0 : snap.t, slow);
  const waitingPick = phase === "run" && !reveal && view.stage === "pick";
  let spots: SpotView[] = view.spots;
  let pet = { ...view.pet, rise: 0, sprite: "normal" as "normal" | "happy", tongue: false, hop: 0 };
  if (reveal) {
    const slots = finalSlots(r);
    const p = steps4(Math.min(1, reveal.t / 280));
    spots = slots.map((slot) => ({ slot, lift: slot === reveal.slot ? p * 0.9 : 0, flash: false }));
    if (reveal.found) {
      const hop = slow ? 0 : Math.floor(reveal.t / 150) % 2;
      pet = { x: reveal.slot, visible: p > 0, behind: false, sink: 0, rise: 0, sprite: "happy", tongue: false, hop };
    } else {
      // Peek: stand behind the right spot so the head shows over its top, tongue out (blinking unless slow).
      const at = slots[r.petSpot];
      const spotTop = spotWidth(n) * LCD_RATIO * (1 - SPOT_TOP[r.kinds[r.petSpot]]);
      const rise = Math.max(0, spotTop - PET_H * 0.5) * steps4(Math.min(1, Math.max(0, reveal.t - 400) / 300));
      const tongue = reveal.t > 700 && (slow || Math.floor(reveal.t / 260) % 2 === 0);
      pet = { x: at, visible: reveal.t > 400, behind: true, sink: 0, rise, sprite: "happy", tongue, hop: 0 };
    }
  }
  const banner =
    phase === "idle"
      ? copy.ready
      : phase === "paused"
        ? petPage.games.snack.paused
        : reveal
          ? reveal.found
            ? copy.yay
            : copy.empty
          : waitingPick
            ? copy.pick
            : null;
  const order = spots.map((s, i) => i).sort((a, b) => spots[a].slot - spots[b].slot);
  /** The game opens as a big modal while a round is running, paused or showing its result (task 064). */
  const modal = phase !== "idle";
  const close = () => (phase === "over" ? reset(false) : stop());
  useGameModal(modal, close);
  const playing = phase === "run" || phase === "paused";
  const width = spotWidth(n);

  return (
    <div className={modal ? "simon catch hide is-modal" : "simon catch hide"} role={modal ? "dialog" : undefined} aria-modal={modal || undefined} aria-label={modal ? copy.title : undefined}>
      {modal ? (
        <GameClose onClick={close} />
      ) : null}
      <div ref={deviceRef} className="simon-device" tabIndex={-1}>
        <div className="catch-screen hide-screen">
          <div className="hide-field" style={{ "--spot-w": `${width}%`, "--pet-h": `${PET_H}%` } as CSSProperties}>
            <div className="hide-ground" aria-hidden="true" />
            <div className="hide-pet-clip" aria-hidden="true">
              {pet.visible ? (
                <span
                  className={pet.behind ? "hide-pet is-behind" : "hide-pet"}
                  style={
                    {
                      left: `${slotX(pet.x, n)}%`,
                      "--sink": pet.sink,
                      "--rise": `${pet.rise}%`,
                      "--hop": pet.hop,
                      "--mouth-x": mouth[0],
                      "--mouth-y": mouth[1],
                    } as CSSProperties
                  }
                >
                  <Image src={pet.sprite === "happy" ? sprites.happy : sprites.normal} alt="" width={sprites.width} height={sprites.height} sizes="(max-width: 640px) 45vw, 360px" />
                  {pet.tongue ? <i className="hide-tongue" /> : null}
                </span>
              ) : null}
            </div>
            {order.map((spot, slotIndex) => {
              const s = spots[spot];
              const kind = r.kinds[spot];
              const empty = reveal && !reveal.found && Math.round(s.slot) === reveal.slot;
              return (
                <button
                  key={`${r.round}-${spot}`}
                  ref={(el) => {
                    spotRefs.current[slotIndex] = el;
                  }}
                  type="button"
                  className={["hide-spot", s.flash ? "is-flash" : "", empty ? "is-empty" : ""].filter(Boolean).join(" ")}
                  style={{ left: `${slotX(s.slot, n)}%`, "--lift": s.lift } as CSSProperties}
                  aria-label={fill(copy.spot, { n: String(slotIndex + 1), kind: copy.kinds[kind] })}
                  aria-disabled={!waitingPick || undefined}
                  tabIndex={waitingPick ? 0 : -1}
                  onClick={() => pick(slotIndex)}
                  onKeyDown={onSpotKey(slotIndex, n)}
                >
                  <SpotSprite kind={kind} className="hide-spot-art" />
                  {waitingPick ? (
                    <span className="hide-spot-key" aria-hidden="true">
                      {slotIndex + 1}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="catch-hud" aria-hidden="true">
            <span>{fill(copy.round, { n: String(phase === "idle" ? 1 : r.round) })}</span>
            <span>{fill(copy.score, { n: String(score) })}</span>
          </div>
          {banner ? (
            <p key={banner} className={`catch-banner hide-banner${reveal ? (reveal.found ? " is-yay" : " is-empty") : ""}`} aria-hidden="true">
              {banner}
            </p>
          ) : null}
          {phase === "over" ? (
            <div className="catch-over">
              <p className="simon-lcd-top">{copy.over}</p>
              <Image className="simon-happy" src={sprites.happy} alt="" width={sprites.width} height={sprites.height} />
              <p className="simon-lcd-main">{score}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="catch-side">
        {children}

        <p className="visually-hidden" role="status" aria-live="polite">
          {live}
        </p>

        <div className="simon-controls">
          {playing ? (
            <div className="catch-controls">
              <button
                type="button"
                className="button button-secondary"
                aria-pressed={phase === "run" ? pauseNext : undefined}
                onClick={phase === "run" ? pause : resume}
              >
                {phase === "paused" ? petPage.games.snack.resume : pauseNext ? copy.pauseNext : petPage.games.snack.pause}
              </button>
              <button type="button" className="button button-secondary" onClick={stop}>
                {petPage.games.stop}
              </button>
            </div>
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
    </div>
  );
}

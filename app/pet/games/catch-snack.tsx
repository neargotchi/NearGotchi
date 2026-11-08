"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { fill, petPage } from "../../../lib/copy";
import { snackIds, type SnackId } from "../../../lib/shop";
import { snackPixels } from "../snack-sprites";

type Phase = "idle" | "run" | "paused" | "over";

const copy = petPage.games.snack;

/** Logical LCD: 128×96 "pixels", scaled up by CSS with image-rendering: pixelated (fixed 4:3 box, no CLS). */
const W = 128;
const H = 96;
const GROUND = H - 3;
const ROUND_MS = 20000;
const PET_H = 26;
const PET_SPEED = 90; // logical px / s
const LCD_INK = "#141414";
const LCD_SHADOW = "#9db088";

/** Speed steps every 5 s (4 steps, capped). Reduced motion: everything slower. */
function tempo(elapsed: number, slow: boolean) {
  const level = Math.min(3, Math.floor(elapsed / 5000));
  const factor = slow ? 0.65 : 1;
  return {
    fall: (28 + level * 9) * factor, // px / s
    spawnMs: (950 - level * 130) / factor,
  };
}

/** Cookies most often, star candy rarely. */
const SNACK_WEIGHTS: Record<SnackId, number> = { cookie: 5, berries: 3, noodles: 2, candy: 1 };

const randomInt = (max: number) => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
};

function randomSnack(): SnackId {
  const total = snackIds.reduce((sum, id) => sum + SNACK_WEIGHTS[id], 0);
  let pick = randomInt(total);
  for (const id of snackIds) {
    pick -= SNACK_WEIGHTS[id];
    if (pick < 0) return id;
  }
  return "cookie";
}

/** Each snack pre-drawn once on a small canvas (1 cell = 1 logical px). */
function snackCanvases() {
  const out = {} as Record<SnackId, HTMLCanvasElement>;
  for (const id of snackIds) {
    const { width, height, cells } = snackPixels(id);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    for (const [x, y, color] of cells) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
    out[id] = canvas;
  }
  return out;
}

type Falling = { id: SnackId; x: number; y: number };

type CatchSnackProps = {
  canStart: boolean;
  blockedReason: string | null;
  active: boolean;
  petName: string;
  /** Normal sprite walks the LCD; happy sprite shows after the round. */
  sprites: { normal: string; happy: string; width: number; height: number };
  onStart: () => void;
  onEnd: (score: number) => void;
  onStop: () => void;
  onFeed: () => void;
};

/**
 * Catch the snack (docs/DEVLOG.md §2, step 8): the pet walks along the bottom of a 128×96 pixel LCD
 * and catches falling shop snacks for 20 s. Arrows / A–D, the ◀ ▶ pads or holding the left / right half
 * of the screen move it; P pauses. Falling speed rises in 4 steps every 5 s (capped). A requestAnimationFrame
 * loop draws whole logical pixels on a canvas; React only re-renders the HUD (time, score). Reduced motion:
 * slower and no catch hop. Leaving the tab or hiding the page pauses / stops (no cost before the end).
 */
export default function CatchSnack({
  canStart,
  blockedReason,
  active,
  petName,
  sprites,
  onStart,
  onEnd,
  onStop,
  onFeed,
}: CatchSnackProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(ROUND_MS / 1000);
  const [live, setLive] = useState("");
  const phaseRef = useRef<Phase>("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const frame = useRef<number | null>(null);
  const game = useRef({
    petX: W / 2,
    snacks: [] as Falling[],
    elapsed: 0,
    spawnIn: 600,
    score: 0,
    hopUntil: 0,
    last: 0,
    keys: { left: false, right: false },
    pointer: 0,
    slow: false,
  });
  const assets = useRef<{ pet: HTMLImageElement | null; snacks: Record<SnackId, HTMLCanvasElement> | null }>({
    pet: null,
    snacks: null,
  });

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const g = game.current;
    ctx.clearRect(0, 0, W, H);
    // ground: a dotted pixel line
    ctx.fillStyle = LCD_SHADOW;
    for (let x = 0; x < W; x += 2) ctx.fillRect(x, GROUND + 1, 1, 1);
    const snacks = assets.current.snacks;
    if (snacks) for (const s of g.snacks) ctx.drawImage(snacks[s.id], Math.round(s.x), Math.round(s.y));
    const pet = assets.current.pet;
    if (pet && pet.complete && pet.naturalWidth) {
      const petW = Math.round((PET_H * sprites.width) / sprites.height);
      const hop = performance.now() < g.hopUntil ? 2 : 0;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(pet, Math.round(g.petX - petW / 2), GROUND - PET_H - hop, petW, PET_H);
    } else {
      ctx.fillStyle = LCD_INK;
      ctx.fillRect(Math.round(g.petX - 8), GROUND - 12, 16, 12);
    }
  };

  // Load the pet sprite and the snack pixels once (the component is keyed by pet); draw the idle scene.
  const init = useEffectEvent(() => {
    assets.current.snacks = snackCanvases();
    const img = new window.Image();
    img.onload = () => draw();
    img.src = sprites.normal;
    assets.current.pet = img;
    draw();
  });
  useEffect(() => {
    init();
    const pending = frame;
    return () => {
      if (pending.current !== null) cancelAnimationFrame(pending.current);
    };
  }, []);

  const finish = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const final = game.current.score;
    go("over");
    setLive(fill(copy.live.over, { n: String(final) }));
    onEnd(final);
    setTimeout(() => playRef.current?.focus({ preventScroll: true }), 50);
  };

  const tick = (now: number) => {
    const g = game.current;
    const dt = Math.min(50, now - (g.last || now));
    g.last = now;
    g.elapsed += dt;
    const { fall, spawnMs } = tempo(g.elapsed, g.slow);

    const dir = (g.keys.right ? 1 : 0) - (g.keys.left ? 1 : 0) + g.pointer;
    const move = Math.max(-1, Math.min(1, dir));
    const half = Math.round((PET_H * sprites.width) / sprites.height / 2);
    g.petX = Math.max(half, Math.min(W - half, g.petX + move * PET_SPEED * (dt / 1000)));

    g.spawnIn -= dt;
    if (g.spawnIn <= 0) {
      g.spawnIn += spawnMs;
      g.snacks.push({ id: randomSnack(), x: randomInt(W - 16), y: -12 });
    }

    const petTop = GROUND - PET_H + 6;
    const kept: Falling[] = [];
    for (const before of g.snacks) {
      const s = { ...before, y: before.y + fall * (dt / 1000) };
      const { width, height } = assets.current.snacks?.[s.id] ?? { width: 16, height: 12 };
      const bottom = s.y + height;
      const overlap = s.x + width - 3 > g.petX - half && s.x + 3 < g.petX + half;
      if (bottom >= petTop && bottom <= GROUND + 2 && overlap) {
        g.score += 1;
        if (!g.slow) g.hopUntil = now + 120;
        setScore(g.score);
        continue;
      }
      if (s.y < H) kept.push(s);
    }
    g.snacks = kept;

    const left = Math.max(0, ROUND_MS - g.elapsed);
    const whole = Math.ceil(left / 1000);
    setSeconds(whole);
    if (whole === 10 && left > 9900) setLive(fill(copy.live.ten, { n: String(g.score) }));
    draw();
    if (left <= 0) {
      finish();
      return;
    }
    frame.current = requestAnimationFrame(tick);
  };

  const run = () => {
    game.current.last = 0;
    go("run");
    frame.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (!canStart) return;
    game.current = {
      ...game.current,
      petX: W / 2,
      snacks: [],
      elapsed: 0,
      spawnIn: 600,
      score: 0,
      hopUntil: 0,
      last: 0,
      pointer: 0,
      slow: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    setScore(0);
    setSeconds(ROUND_MS / 1000);
    setLive(fill(copy.live.start, { name: petName }));
    onStart();
    run();
    deviceRef.current?.focus({ preventScroll: true });
  };

  const pause = () => {
    if (phaseRef.current !== "run") return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    game.current.pointer = 0;
    go("paused");
    setLive(copy.live.paused);
  };

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    setLive(copy.live.resumed);
    run();
    deviceRef.current?.focus({ preventScroll: true });
  };

  const stop = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    game.current.snacks = [];
    game.current.petX = W / 2;
    go("idle");
    setLive("");
    draw();
    onStop();
  };

  // Keyboard: ← → / A D held to move, P to pause or resume.
  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") game.current.keys.left = down;
    else if (key === "arrowright" || key === "d") game.current.keys.right = down;
    else if (key === "p" && down) {
      if (phaseRef.current === "run") pause();
      else if (phaseRef.current === "paused") resume();
    } else return;
    event.preventDefault();
  });
  const listening = active && (phase === "run" || phase === "paused");
  useEffect(() => {
    if (!listening) return;
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
      game.current.keys = { left: false, right: false };
    };
  }, [listening]);

  // Hidden page → pause; leaving the games tab mid-round → stop (free).
  const onHidden = useEffectEvent(() => {
    if (document.visibilityState === "hidden") pause();
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

  /** Holding the left / right half of the LCD (or a pad) moves the pet; letting go stops it. */
  const hold = (dir: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (phaseRef.current !== "run") return;
    event.preventDefault();
    game.current.pointer = dir;
    try {
      // Keep receiving pointerup even if the finger slides off the pad / screen.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // not an active pointer (e.g. synthetic): moving still works, release comes from pointerup
    }
  };
  const holdScreen = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    hold(event.clientX - rect.left < rect.width / 2 ? -1 : 1)(event);
  };
  const release = () => {
    game.current.pointer = 0;
  };

  const playing = phase === "run" || phase === "paused";
  const time = `0:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="simon catch">
      <div ref={deviceRef} className="simon-device" tabIndex={-1}>
        <div className="catch-screen">
          <canvas
            ref={canvasRef}
            className="catch-canvas"
            width={W}
            height={H}
            aria-hidden="true"
            onPointerDown={holdScreen}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
          />
          <div className="catch-hud" aria-hidden="true">
            <span>{fill(copy.time, { t: time })}</span>
            <span>{fill(copy.score, { n: String(score) })}</span>
          </div>
          {phase === "idle" ? <p className="catch-banner">{copy.ready}</p> : null}
          {phase === "paused" ? <p className="catch-banner">{copy.paused}</p> : null}
          {phase === "over" ? (
            <div className="catch-over">
              <p className="simon-lcd-top">{copy.over}</p>
              <Image className="simon-happy" src={sprites.happy} alt="" width={sprites.width} height={sprites.height} />
              <p className="simon-lcd-main">{score}</p>
            </div>
          ) : null}
        </div>
        <div className="simon-pads catch-pads" role="group" aria-label={copy.title}>
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              className="simon-pad catch-pad"
              aria-label={dir < 0 ? copy.left : copy.right}
              aria-disabled={phase !== "run" || undefined}
              onPointerDown={hold(dir)}
              onPointerUp={release}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onContextMenu={(event) => event.preventDefault()}
            >
              <span aria-hidden="true">
                <i className={dir < 0 ? "catch-arrow is-left" : "catch-arrow"} />
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {live}
      </p>

      <div className="simon-controls">
        {playing ? (
          <div className="catch-controls">
            <button type="button" className="button button-secondary" onClick={phase === "run" ? pause : resume}>
              {phase === "run" ? copy.pause : copy.resume}
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
  );
}

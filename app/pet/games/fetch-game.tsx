"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { fill, petPage } from "../../../lib/copy";
import {
  BALL_GROUND_Y,
  FETCH,
  HAND_Y,
  arcPoint,
  flightMs,
  isTired,
  landingX,
  nextZone,
  powerAt,
  runSpeed,
  scoreThrow,
  type ThrowKind,
} from "../../../lib/fetch-game";

type Phase = "idle" | "run" | "paused" | "over";
/** One throw: wait for a press → power swings while held → ball in the air → result → pet runs out → pet brings it back. */
type Stage = "aim" | "charge" | "flight" | "land" | "fetch" | "back";
type PetLook = "normal" | "happy" | "sad";

const copy = petPage.games.fetch;
const { W, H, ground: GROUND } = FETCH;
const PET_H = 28;
const BALL = 4;
const HOME_X = 34;
const LAND_PAUSE_MS = 450;
const LCD_INK = "#141414";
const LCD_SHADOW = "#9db088";

const randomUnit = () => {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
};

type Flash = { kind: ThrowKind; text: string; id: number };

type FetchGameProps = {
  canStart: boolean;
  blockedReason: string | null;
  active: boolean;
  petName: string;
  /** normal: idle / running; happy: after a hit and after the round; sad: after a miss (its hungry sprite). */
  sprites: { normal: string; happy: string; sad: string; width: number; height: number };
  onStart: () => void;
  onEnd: (score: number) => void;
  onStop: () => void;
  onFeed: () => void;
  /** Rules / cost text: beside the console on a wide card, above the play button otherwise. */
  children?: ReactNode;
};

/**
 * Fetch (task 050): you stand on the left with a ball, the pet sits next to you, a flag stands somewhere
 * on the field. Hold (space, the LCD or the throw pad) and the power bar swings 0 → 1 → 0; let go to throw.
 * The ball flies in an arc and lands: on the flag 3, close 1, a miss 0 (three hits in a row count double).
 * The pet runs out, picks the ball up and brings it back (happy after a hit, sad after a miss, slower
 * when tired). 8 throws or 45 s. Rules live in lib/fetch-game.ts. Reduced motion: no trail, no bob, no
 * burst, and the ball jumps along its arc in 4 steps instead of gliding.
 */
export default function FetchGame({
  canStart,
  blockedReason,
  active,
  petName,
  sprites,
  onStart,
  onEnd,
  onStop,
  onFeed,
  children,
}: FetchGameProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [score, setScore] = useState(0);
  const [seconds, setSeconds] = useState(FETCH.roundMs / 1000);
  const [ball, setBall] = useState(1);
  const [double, setDouble] = useState(false);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [live, setLive] = useState("");
  const phaseRef = useRef<Phase>("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const frame = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fresh = () => ({
    stage: "aim" as Stage,
    elapsed: 0,
    last: 0,
    stageAt: 0,
    throwsDone: 0,
    score: 0,
    streak: 0,
    zoneX: nextZone(randomUnit()),
    power: 0,
    fromX: FETCH.throwX as number,
    toX: FETCH.throwX as number,
    flightDur: 1,
    ballX: FETCH.throwX as number,
    ballY: HAND_Y as number,
    trail: [] as { x: number; y: number }[],
    petX: HOME_X,
    look: "normal" as PetLook,
    lastKind: null as ThrowKind | null,
    burstAt: -1,
    toldTired: false,
    slow: false,
  });
  const game = useRef(fresh());
  const images = useRef<Record<PetLook, HTMLImageElement> | null>(null);

  const go = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };

  const showFlash = (kind: ThrowKind, text: string) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash({ kind, text, id: Date.now() });
    flashTimer.current = setTimeout(() => setFlash(null), 900);
  };

  // ---------- drawing (whole logical pixels, 2 LCD colours) ----------
  const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w = 1, h = 1) => ctx.fillRect(Math.round(x), Math.round(y), w, h);

  const drawBall = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // 4×4 ball: ink ring, LCD-coloured middle (left clear), one shine pixel.
    ctx.fillStyle = LCD_INK;
    px(ctx, x + 1, y, 2, 1);
    px(ctx, x + 1, y + 3, 2, 1);
    px(ctx, x, y + 1, 1, 2);
    px(ctx, x + 3, y + 1, 1, 2);
    px(ctx, x + 2, y + 2);
  };

  const drawFlag = (ctx: CanvasRenderingContext2D, g: ReturnType<typeof fresh>) => {
    const x = Math.round(g.zoneX);
    // "close" band: light ticks; "hit" band: a solid ink strip on the ground.
    ctx.fillStyle = LCD_SHADOW;
    for (let dx = -FETCH.nearRange; dx <= FETCH.nearRange; dx += 2) px(ctx, x + dx, GROUND + 2, 1, 2);
    const blinking = g.lastKind === "hit" && (g.stage === "land" || g.stage === "fetch") && !g.slow;
    const hidden = blinking && Math.floor((g.elapsed - g.stageAt) / 110) % 2 === 1;
    if (hidden) return;
    ctx.fillStyle = LCD_INK;
    px(ctx, x - FETCH.hitRange, GROUND + 1, FETCH.hitRange * 2 + 1, 2);
    // pole + pennant pointing right
    px(ctx, x, GROUND - 13, 1, 13);
    px(ctx, x + 1, GROUND - 13, 6, 1);
    px(ctx, x + 1, GROUND - 12, 4, 1);
    px(ctx, x + 1, GROUND - 11, 2, 1);
    if (g.lastKind === "hit" && g.stage !== "aim" && g.stage !== "charge") {
      // a filled pennant once hit
      px(ctx, x + 1, GROUND - 12, 5, 1);
    }
  };

  const drawThrower = (ctx: CanvasRenderingContext2D, g: ReturnType<typeof fresh>) => {
    // Your arm reaching in from the left edge; it lifts with the power while you hold.
    const lift = g.stage === "charge" ? Math.round(g.power * 5) : 0;
    const y = HAND_Y + 4 - lift;
    ctx.fillStyle = LCD_INK;
    px(ctx, 0, y + 1, 7, 3); // sleeve
    px(ctx, 7, y, 1, 5); // cuff
    px(ctx, 8, y, 4, 1); // hand outline
    px(ctx, 8, y + 4, 4, 1);
    px(ctx, 12, y + 1, 1, 3);
    if (g.stage === "aim" || g.stage === "charge") drawBall(ctx, FETCH.throwX - 2, y - 4);
  };

  const drawPower = (ctx: CanvasRenderingContext2D, g: ReturnType<typeof fresh>) => {
    if (g.stage !== "aim" && g.stage !== "charge") return;
    // Vertical meter at the left: 2px outline, fill from the bottom.
    const x = 3;
    const top = 16;
    const h = 30;
    ctx.fillStyle = LCD_INK;
    px(ctx, x, top, 6, 1);
    px(ctx, x, top + h + 1, 6, 1);
    px(ctx, x, top, 1, h + 2);
    px(ctx, x + 5, top, 1, h + 2);
    const fillH = Math.round(g.power * h);
    if (fillH > 0) px(ctx, x + 2, top + 1 + (h - fillH), 2, fillH);
    // tick marks every quarter
    ctx.fillStyle = LCD_SHADOW;
    for (let i = 1; i < 4; i++) px(ctx, x + 1, top + 1 + Math.round((h * i) / 4), 1, 1);
  };

  const drawPet = (ctx: CanvasRenderingContext2D, g: ReturnType<typeof fresh>) => {
    const img = images.current?.[g.look];
    const running = g.stage === "fetch" || g.stage === "back";
    const bob = running && !g.slow ? Math.floor(g.elapsed / 110) % 2 : 0;
    const petW = Math.round((PET_H * sprites.width) / sprites.height);
    const left = Math.round(g.petX - petW / 2);
    const top = GROUND - PET_H - bob;
    // The sprites look left; running out to the ball (right) mirrors them.
    const facingRight = g.stage === "fetch";
    if (img && img.complete && img.naturalWidth) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      if (facingRight) {
        ctx.translate(left + petW, top);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, petW, PET_H);
      } else {
        ctx.drawImage(img, left, top, petW, PET_H);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = LCD_INK;
      px(ctx, left, GROUND - 12, petW, 12);
    }
    // Carrying the ball back: at its mouth (front = left side when walking home).
    if (g.stage === "back") drawBall(ctx, left - 1, top + Math.round(PET_H * 0.42));
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const g = game.current;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = LCD_SHADOW;
    for (let x = 0; x < W; x += 2) px(ctx, x, GROUND + 1);
    drawFlag(ctx, g);
    drawPower(ctx, g);
    drawThrower(ctx, g);
    // trail (normal motion only)
    if (!g.slow && g.stage === "flight") {
      ctx.fillStyle = LCD_SHADOW;
      for (const dot of g.trail) px(ctx, dot.x + 1, dot.y + 1, 2, 2);
    }
    if (g.stage === "flight" || g.stage === "land" || g.stage === "fetch") drawBall(ctx, g.ballX, g.ballY);
    // a burst of pixels around the flag right after a hit
    if (!g.slow && g.burstAt >= 0 && g.elapsed - g.burstAt < 420) {
      const r = 4 + ((g.elapsed - g.burstAt) / 420) * 10;
      ctx.fillStyle = LCD_INK;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        px(ctx, g.zoneX + Math.cos(a) * r, GROUND - 8 + Math.sin(a) * r * 0.7);
      }
    }
    drawPet(ctx, g);
  };

  // Sprites once per pet (the component is keyed by pet), then the idle scene.
  const init = useEffectEvent(() => {
    const load = (src: string) => {
      const img = new window.Image();
      img.onload = () => draw();
      img.src = src;
      return img;
    };
    images.current = { normal: load(sprites.normal), happy: load(sprites.happy), sad: load(sprites.sad) };
    draw();
  });
  useEffect(() => {
    init();
    const pending = frame;
    const timer = flashTimer;
    return () => {
      if (pending.current !== null) cancelAnimationFrame(pending.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // ---------- game loop ----------
  const finish = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    const final = game.current.score;
    game.current.look = "happy";
    go("over");
    setFlash(null);
    setLive(fill(copy.live.over, { n: String(final) }));
    onEnd(final);
    setTimeout(() => playRef.current?.focus({ preventScroll: true }), 50);
  };

  const setStage = (stage: Stage) => {
    const g = game.current;
    g.stage = stage;
    g.stageAt = g.elapsed;
  };

  const land = () => {
    const g = game.current;
    const result = scoreThrow(g.toX, g.zoneX, g.streak);
    g.streak = result.streak;
    g.score += result.points;
    g.lastKind = result.kind;
    g.ballX = g.toX - BALL / 2;
    g.ballY = BALL_GROUND_Y;
    g.trail = [];
    if (result.kind === "hit") g.burstAt = g.elapsed;
    setScore(g.score);
    setDouble(result.double);
    const n = String(result.points);
    const scoreText = String(g.score);
    if (result.kind === "hit") {
      showFlash("hit", result.double ? `${fill(copy.hit, { n })} ${copy.streak}` : fill(copy.hit, { n }));
      setLive(fill(result.double ? copy.live.double : copy.live.hit, { n, score: scoreText }));
    } else if (result.kind === "near") {
      showFlash("near", copy.near);
      setLive(fill(copy.live.near, { score: scoreText }));
    } else {
      showFlash("miss", copy.miss);
      setLive(fill(copy.live.miss, { name: petName, score: scoreText }));
    }
    setStage("land");
  };

  const tick = (now: number) => {
    const g = game.current;
    const dt = Math.min(50, now - (g.last || now));
    g.last = now;
    g.elapsed += dt;
    const msLeft = Math.max(0, FETCH.roundMs - g.elapsed);
    const since = g.elapsed - g.stageAt;
    const speed = runSpeed(g.throwsDone, msLeft) * (dt / 1000);

    if (g.stage === "charge") {
      g.power = powerAt(since);
    } else if (g.stage === "flight") {
      const raw = Math.min(1, since / g.flightDur);
      // Reduced motion: 4 jumps along the arc instead of a glide.
      const t = g.slow ? Math.min(1, Math.ceil(raw * 4) / 4) : raw;
      const p = arcPoint(g.fromX, g.toX, t);
      if (!g.slow) {
        g.trail.push({ x: g.ballX, y: g.ballY });
        if (g.trail.length > 4) g.trail.shift();
      }
      g.ballX = p.x - BALL / 2;
      g.ballY = p.y;
      if (raw >= 1) land();
    } else if (g.stage === "land") {
      if (since >= LAND_PAUSE_MS) setStage("fetch");
    } else if (g.stage === "fetch") {
      // stop where the ball is, but keep the whole sprite on the LCD
      const petW = (PET_H * sprites.width) / sprites.height;
      const target = Math.min(g.ballX + BALL / 2, W - petW / 2);
      g.petX = Math.min(target, g.petX + speed);
      if (g.petX >= target) {
        g.look = g.lastKind === "hit" ? "happy" : g.lastKind === "miss" ? "sad" : "normal";
        setStage("back");
      }
    } else if (g.stage === "back") {
      g.petX = Math.max(HOME_X, g.petX - speed);
      if (g.petX <= HOME_X) {
        if (g.throwsDone >= FETCH.throws) {
          draw();
          finish();
          return;
        }
        g.zoneX = nextZone(randomUnit(), g.zoneX);
        g.lastKind = null;
        g.power = 0;
        setStage("aim");
        setBall(g.throwsDone + 1);
      }
    }

    if (!g.toldTired && isTired(g.throwsDone, msLeft) && g.throwsDone > 0) {
      g.toldTired = true;
      if (g.stage === "aim") setLive(fill(copy.live.tired, { name: petName }));
    }

    setSeconds(Math.ceil(msLeft / 1000));
    draw();
    if (msLeft <= 0) {
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
    game.current = { ...fresh(), slow: window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    setScore(0);
    setSeconds(FETCH.roundMs / 1000);
    setBall(1);
    setDouble(false);
    setFlash(null);
    setLive(copy.live.start);
    onStart();
    run();
    deviceRef.current?.focus({ preventScroll: true });
  };

  /** Press: starts the swing (only while waiting for a throw). */
  const press = () => {
    if (phaseRef.current !== "run" || game.current.stage !== "aim") return;
    game.current.power = 0;
    game.current.look = "normal";
    setStage("charge");
  };
  /** Release: throws with the power at that moment. */
  const release = () => {
    const g = game.current;
    if (phaseRef.current !== "run" || g.stage !== "charge") return;
    g.fromX = FETCH.throwX;
    g.toX = landingX(g.power);
    g.flightDur = flightMs(g.fromX, g.toX);
    g.ballX = g.fromX - BALL / 2;
    g.ballY = HAND_Y;
    g.trail = [];
    g.throwsDone += 1;
    setBall(g.throwsDone);
    setStage("flight");
  };

  const pause = () => {
    if (phaseRef.current !== "run") return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    // A swing in progress is dropped (no throw); the ball is still in your hand.
    if (game.current.stage === "charge") {
      game.current.power = 0;
      setStage("aim");
    }
    go("paused");
    setLive(copy.live.paused);
    draw();
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
    game.current = fresh();
    setFlash(null);
    setScore(0);
    setBall(1);
    setDouble(false);
    setSeconds(FETCH.roundMs / 1000);
    go("idle");
    setLive("");
    draw();
    onStop();
  };

  // Keyboard: space held to swing, released to throw; P pauses / resumes.
  const onKey = useEffectEvent((event: KeyboardEvent, down: boolean) => {
    const target = event.target;
    if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if (key === " " || key === "spacebar") {
      // Space on a focused button (stop / pause) keeps its normal meaning.
      if (target instanceof Element && target.closest("button") && !target.closest(".fetch-pad")) return;
      if (down && !event.repeat) press();
      else if (!down) release();
    } else if (key === "p" && down) {
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

  /** Pointer on the LCD or the throw pad: down = swing, up = throw. */
  const pointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (phaseRef.current !== "run") return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // not an active pointer (synthetic): the throw still comes from pointerup
    }
    press();
  };

  const playing = phase === "run" || phase === "paused";
  const time = `0:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="simon catch fetch">
      <div ref={deviceRef} className="simon-device" tabIndex={-1}>
        <div className="catch-screen fetch-screen">
          <canvas
            ref={canvasRef}
            className="catch-canvas fetch-canvas"
            width={W}
            height={H}
            aria-hidden="true"
            onPointerDown={pointerDown}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
          />
          <div className="catch-hud" aria-hidden="true">
            <span>{fill(copy.throwNo, { n: String(ball) })}</span>
            <span>{fill(copy.time, { t: time })}</span>
            <span>
              {double ? <b className="fetch-streak">{copy.streak}</b> : null}
              {fill(copy.score, { n: String(score) })}
            </span>
          </div>
          {phase === "idle" ? <p className="catch-banner">{copy.ready}</p> : null}
          {phase === "paused" ? <p className="catch-banner">{petPage.games.snack.paused}</p> : null}
          {phase === "run" && flash ? (
            <p key={flash.id} className={`catch-banner fetch-flash is-${flash.kind}`} aria-hidden="true">
              {flash.text}
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
        <div className="simon-pads catch-pads" role="group" aria-label={copy.title}>
          <button
            type="button"
            className="simon-pad catch-pad fetch-pad"
            aria-label={copy.hold}
            aria-disabled={phase !== "run" || undefined}
            onPointerDown={pointerDown}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && !event.repeat) press();
            }}
            onKeyUp={(event) => {
              if (event.key === "Enter" || event.key === " ") release();
            }}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span aria-hidden="true">{copy.pad}</span>
          </button>
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
              <button type="button" className="button button-secondary" onClick={phase === "run" ? pause : resume}>
                {phase === "run" ? petPage.games.snack.pause : petPage.games.snack.resume}
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

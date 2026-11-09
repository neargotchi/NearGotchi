// Fetch (task 050): pure rules, no DOM, so scripts/check-drop1.mjs can test them. The component
// (app/pet/games/fetch-game.tsx) owns the canvas, input and timing; everything here is plain math.

/** Logical LCD is 160×96 "pixels" (5:3), scaled up with crisp pixels. x grows to the right. */
export const FETCH = {
  W: 160,
  H: 96,
  /** y of the ground line */
  ground: 86,
  /** where the ball leaves the hand */
  throwX: 12,
  /** power 0 → lands here … */
  minLand: 44,
  /** … power 1 → lands here */
  maxLand: 154,
  /** the flag stands somewhere in [zoneMin, zoneMax] */
  zoneMin: 58,
  zoneMax: 148,
  /** |landing − flag| ≤ hitRange → hit (3), ≤ nearRange → close (1), else miss (0) */
  hitRange: 6,
  nearRange: 16,
  hitPoints: 3,
  nearPoints: 1,
  /** from the 3rd hit in a row, a hit counts double */
  streakFrom: 3,
  throws: 8,
  roundMs: 45000,
  /** the power bar goes 0 → 1 → 0 in this time while held */
  powerPeriodMs: 1400,
  /** pet run speed in logical px / s: fresh … tired (last throws or the last 10 s) */
  runFast: 140,
  runTired: 92,
} as const;

/** Power while held: a triangle wave 0 → 1 → 0 (ping-pong), period `periodMs`. */
export function powerAt(heldMs: number, periodMs: number = FETCH.powerPeriodMs): number {
  if (!(heldMs > 0)) return 0;
  const phase = (heldMs % periodMs) / periodMs;
  return phase <= 0.5 ? phase * 2 : (1 - phase) * 2;
}

/** Where a throw with `power` (clamped 0–1) lands. */
export function landingX(power: number): number {
  const p = Math.min(1, Math.max(0, power));
  return FETCH.minLand + p * (FETCH.maxLand - FETCH.minLand);
}

/** A new flag position from a random number in [0, 1); at least 12px away from the last one. */
export function nextZone(random: number, previous?: number): number {
  const span = FETCH.zoneMax - FETCH.zoneMin;
  let x = Math.round(FETCH.zoneMin + Math.min(0.999999, Math.max(0, random)) * span);
  if (previous !== undefined && Math.abs(x - previous) < 12) {
    x = x + 24 <= FETCH.zoneMax ? x + 24 : x - 24;
  }
  return x;
}

export type ThrowKind = "hit" | "near" | "miss";
export type ThrowResult = { kind: ThrowKind; points: number; streak: number; double: boolean };

/** Score one landing. `streak` = hits in a row before this throw; a close or a miss resets it. */
export function scoreThrow(landX: number, zoneX: number, streak: number): ThrowResult {
  const off = Math.abs(landX - zoneX);
  if (off <= FETCH.hitRange) {
    const next = streak + 1;
    const double = next >= FETCH.streakFrom;
    return { kind: "hit", points: FETCH.hitPoints * (double ? 2 : 1), streak: next, double };
  }
  if (off <= FETCH.nearRange) return { kind: "near", points: FETCH.nearPoints, streak: 0, double: false };
  return { kind: "miss", points: 0, streak: 0, double: false };
}

/** Tired near the end: from the 7th throw or in the last 10 s the pet runs slower. */
export function isTired(throwsDone: number, msLeft: number): boolean {
  return throwsDone >= FETCH.throws - 2 || msLeft <= 10000;
}

export function runSpeed(throwsDone: number, msLeft: number): number {
  return isTired(throwsDone, msLeft) ? FETCH.runTired : FETCH.runFast;
}

/** Flight time grows with distance (ms). */
export function flightMs(fromX: number, toX: number): number {
  return Math.round(420 + Math.abs(toX - fromX) * 4.2);
}

/** y of the ball's top-left in the hand (the arc starts here) and on the ground (it ends here). */
export const HAND_Y = FETCH.ground - 18;
export const BALL_GROUND_Y = FETCH.ground - 4;

/** Ball position on its arc at t ∈ [0, 1]; the arc is higher for longer throws. */
export function arcPoint(fromX: number, toX: number, t: number): { x: number; y: number } {
  const k = Math.min(1, Math.max(0, t));
  const height = 14 + Math.abs(toX - fromX) * 0.3;
  const y = HAND_Y + (BALL_GROUND_Y - HAND_Y) * k - height * 4 * k * (1 - k);
  return { x: fromX + (toX - fromX) * k, y };
}

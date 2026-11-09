// Hide & seek (task 051): pure rules and the round timeline, no DOM, so scripts/check-drop1.mjs can
// test them. The component (app/pet/games/hide-seek.tsx) renders whatever `viewAt` says for a round time.

export const SPOT_KINDS = ["bush", "box", "tree", "rock", "barrel"] as const;
export type SpotKind = (typeof SPOT_KINDS)[number];

export const HIDESEEK = {
  startSpots: 3,
  maxSpots: 5,
  maxSwaps: 12,
  /** fastest swap (ms) */
  minSwapMs: 300,
  /** a swap moves for this share of its slot, then rests (so pairs read as separate moves) */
  moveShare: 0.78,
  /** pet in front of the spots, then it walks to its spot, ducks behind it, short pause, shuffle */
  showMsEasy: 1000,
  showMs: 650,
  walkMs: 600,
  sinkMs: 360,
  gapMs: 360,
  /** reveal after a pick */
  foundMs: 1400,
  missMs: 2200,
} as const;

/** Rounds 1–2: 3 spots, 3–4: 4, 5+: 5 (one more every 2 rounds). */
export function spotsFor(round: number): number {
  return Math.min(HIDESEEK.maxSpots, HIDESEEK.startSpots + Math.floor((Math.max(1, round) - 1) / 2));
}

/** 2 swaps in round 1, one more each round, at most 12. */
export function swapsFor(round: number): number {
  return Math.min(HIDESEEK.maxSwaps, Math.max(1, round) + 1);
}

/** Slow and readable in rounds 1–2 (760, 680 ms), then faster each round down to 300 ms. */
export function swapMsFor(round: number): number {
  const r = Math.max(1, round);
  const ms = r <= 2 ? 760 - (r - 1) * 80 : 600 - (r - 3) * 70;
  return Math.max(HIDESEEK.minSwapMs, ms);
}

export type Swap = [number, number];

/** `count` swaps of two different slots out of `n`; never the same pair twice in a row. */
export function makeSwaps(n: number, count: number, random: () => number): Swap[] {
  const out: Swap[] = [];
  for (let i = 0; i < count; i++) {
    for (let guard = 0; guard < 50; guard++) {
      const a = Math.floor(random() * n) % n;
      let b = Math.floor(random() * (n - 1)) % (n - 1);
      if (b >= a) b += 1;
      const pair: Swap = a < b ? [a, b] : [b, a];
      const last = out[out.length - 1];
      if (!last || last[0] !== pair[0] || last[1] !== pair[1] || guard === 49) {
        out.push(pair);
        break;
      }
    }
  }
  return out;
}

/** `slotOf[spot]` after swapping whatever stands in slots a and b. */
export function applySwap(slotOf: number[], [a, b]: Swap): number[] {
  return slotOf.map((slot) => (slot === a ? b : slot === b ? a : slot));
}

export type Round = {
  round: number;
  /** spot i is a SPOT_KINDS[i] */
  kinds: SpotKind[];
  /** the spot the pet is behind (follows it through the shuffle) */
  petSpot: number;
  swaps: Swap[];
  swapMs: number;
  showMs: number;
};

export function makeRound(round: number, random: () => number): Round {
  const n = spotsFor(round);
  return {
    round,
    kinds: SPOT_KINDS.slice(0, n) as SpotKind[],
    petSpot: Math.floor(random() * n) % n,
    swaps: makeSwaps(n, swapsFor(round), random),
    swapMs: swapMsFor(round),
    showMs: round <= 2 ? HIDESEEK.showMsEasy : HIDESEEK.showMs,
  };
}

/** Round time marks (ms from the round start). */
export function marks(r: Round) {
  const walk = r.showMs;
  const sink = walk + HIDESEEK.walkMs;
  const shuffle = sink + HIDESEEK.sinkMs + HIDESEEK.gapMs;
  const pick = shuffle + r.swaps.length * r.swapMs;
  return { walk, sink, shuffle, pick };
}

/** Steps easing: 4 pixel-ish steps (0, .25, .5, .75, 1). */
export const steps4 = (p: number) => (p >= 1 ? 1 : Math.floor(Math.max(0, p) * 4) / 4);

export type Stage = "show" | "walk" | "sink" | "shuffle" | "pick";
export type SpotView = { slot: number; lift: number; flash: boolean };
export type View = {
  stage: Stage;
  spots: SpotView[];
  /** pet: x in slots (−1 = in front of the middle), visible, behind the spots or not, sink 0–1 */
  pet: { x: number; visible: boolean; behind: boolean; sink: number };
};

/**
 * Everything on the LCD at round time `t` (before the pick). `slow` = reduced motion: no glide, no arc;
 * a swap swaps at once and both frames flash for the first 220 ms of it.
 */
export function viewAt(r: Round, t: number, slow: boolean): View {
  const n = r.kinds.length;
  const m = marks(r);
  const middle = (n - 1) / 2;
  let slotOf = r.kinds.map((_, i) => i);
  const spots: SpotView[] = slotOf.map((slot) => ({ slot, lift: 0, flash: false }));

  if (t < m.walk) return { stage: "show", spots, pet: { x: middle, visible: true, behind: false, sink: 0 } };
  if (t < m.sink) {
    const p = slow ? 1 : steps4((t - m.walk) / HIDESEEK.walkMs);
    return { stage: "walk", spots, pet: { x: middle + (r.petSpot - middle) * p, visible: true, behind: false, sink: 0 } };
  }
  if (t < m.shuffle) {
    const p = Math.min(1, (t - m.sink) / HIDESEEK.sinkMs);
    const sink = slow ? (p < 1 ? 0.5 : 1) : p < 0.5 ? 0.5 : 1;
    return { stage: "sink", spots, pet: { x: r.petSpot, visible: p < 1, behind: true, sink } };
  }

  const hidden = { x: r.petSpot, visible: false, behind: true, sink: 1 };
  const done = Math.min(r.swaps.length, Math.floor((t - m.shuffle) / r.swapMs));
  for (let k = 0; k < done; k++) slotOf = applySwap(slotOf, r.swaps[k]);
  const view = slotOf.map((slot) => ({ slot, lift: 0, flash: false }));
  if (t >= m.pick || done >= r.swaps.length) return { stage: "pick", spots: view, pet: hidden };

  const [a, b] = r.swaps[done];
  const local = t - m.shuffle - done * r.swapMs;
  const moverA = slotOf.indexOf(a);
  const moverB = slotOf.indexOf(b);
  if (slow) {
    const after = applySwap(slotOf, [a, b]);
    const flash = local < 220;
    return {
      stage: "shuffle",
      spots: after.map((slot, i) => ({ slot, lift: 0, flash: flash && (i === moverA || i === moverB) })),
      pet: hidden,
    };
  }
  const q = steps4(local / (r.swapMs * HIDESEEK.moveShare));
  view[moverA] = { slot: a + (b - a) * q, lift: Math.sin(Math.PI * q), flash: false };
  view[moverB] = { slot: b + (a - b) * q, lift: 0, flash: false };
  return { stage: "shuffle", spots: view, pet: hidden };
}

/** Slot of every spot once the shuffle is over. */
export function finalSlots(r: Round): number[] {
  return r.swaps.reduce((slotOf, swap) => applySwap(slotOf, swap), r.kinds.map((_, i) => i));
}

/** Picking slot `slot` after the shuffle: did it find the pet? */
export function isFound(r: Round, slot: number): boolean {
  return finalSlots(r)[r.petSpot] === slot;
}

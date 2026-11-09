import type { SpotKind } from "../../../lib/hideseek-game";

/**
 * Hide & seek spots as pixel art (task 051), drawn like the snacks: one cell per pixel, every filled cell
 * on the outline is ink, the inside takes its letter's colour. Fixed colours: they sit on the LCD in both
 * themes. All five share one 18×18 box and stand on its bottom row, so swapping them never shifts the ground.
 */
const INK = "#141414";
const COLORS: Record<string, string> = {
  G: "#00b877", // leaf
  L: "#5fe3a8", // leaf light
  T: "#c98a4b", // cardboard / wood
  D: "#8a5a2b", // trunk / dark wood
  S: "#b9b2a3", // stone
  W: "#e9e3d6", // stone light
  K: "#141414", // ink detail inside
};

const SPRITES: Record<SpotKind, string[]> = {
  bush: [
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "......GGGGG.......",
    "....GGLLGGGGG.....",
    "...GGLLGGGGLGGG...",
    "..GGLGGGGGLLGGGG..",
    ".GGGGGGLGGGGGGLGG.",
    ".GGLLGGGGGGGLGGGG.",
    "GGGLGGGGLLGGGGGGGG",
    "GGGGGGGGLGGGGLLGGG",
    "GGLGGGGGGGGGGLGGGG",
    "GGGGLLGGGGGLGGGGGG",
    ".GGGGGGGGGGGGGGGG.",
    "..GGGGGGGGGGGGGG..",
    "...GGGGGGGGGGGG...",
  ],
  box: [
    "..................",
    "..................",
    "..................",
    "..................",
    "..TTTTTTTTTTTTTT..",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTKTTTTTTTT.",
    ".TTTTTTTKTTTTTTTT.",
    ".KKKKKKKKKKKKKKKK.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTKKKKKKTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
    ".TTTTTTTTTTTTTTTT.",
  ],
  tree: [
    ".......GGGG.......",
    ".....GGLLGGGG.....",
    "....GGLGGGGLGG....",
    "...GGGGGGLGGGGG...",
    "..GGLGGGGGGGGLGG..",
    "..GGGGLLGGGGGGGG..",
    ".GGGGGGGGGGLGGGGG.",
    ".GGLGGGGGGGGGGLGG.",
    ".GGGGGGLGGGGGGGGG.",
    "..GGGGGGGGGLGGGG..",
    "...GGGGGGGGGGGG...",
    ".....GGGDDGGG.....",
    ".......DDDD.......",
    ".......DDDD.......",
    ".......DDDD.......",
    ".......DDDD.......",
    "......DDDDDD......",
    ".....DDDDDDDD.....",
  ],
  rock: [
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "..................",
    "......SSSSS.......",
    "....SSWWSSSSS.....",
    "...SSWWSSSSSSSS...",
    "..SSSWSSSSSSSSSS..",
    ".SSSSSSSSSSSWSSSS.",
    ".SSSSSSSSSSWWSSSS.",
    "SSSSSSSSSSSSSSSSSS",
    "SSSSKSSSSSSSSSSSSS",
    "SSSSSKSSSSSSSKSSSS",
    "SSSSSSSSSSSSSSSSSS",
    ".SSSSSSSSSSSSSSSS.",
  ],
  barrel: [
    "..................",
    "..................",
    "..................",
    "....TTTTTTTTTT....",
    "...TTTTTTTTTTTT...",
    "...KKKKKKKKKKKK...",
    "..TTTDTTTTTDTTTT..",
    "..TTTDTTTTTDTTTT..",
    "..TTTDTTTTTDTTTT..",
    "..KKKKKKKKKKKKKK..",
    "..TTTDTTTTTDTTTT..",
    "..TTTDTTTTTDTTTT..",
    "..TTTDTTTTTDTTTT..",
    "..KKKKKKKKKKKKKK..",
    "..TTTDTTTTTDTTTT..",
    "...TTDTTTTTDTTT...",
    "...TTTTTTTTTTTT...",
    "....TTTTTTTTTT....",
  ],
};

type Paths = { width: number; height: number; layers: [string, string][] };

function build(rows: string[]): Paths {
  const filled = (x: number, y: number) => y >= 0 && y < rows.length && x >= 0 && x < rows[y].length && rows[y][x] !== ".";
  const byColor = new Map<string, string>();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!filled(x, y)) continue;
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
      const color = edge ? INK : COLORS[row[x]];
      byColor.set(color, (byColor.get(color) ?? "") + `M${x} ${y}h1v1h-1z`);
    }
  });
  return { width: rows[0].length, height: rows.length, layers: [...byColor.entries()] };
}

/** Share of the box above each sprite's first pixel row (the pet peeks over the real top). */
export const SPOT_TOP = Object.fromEntries(
  Object.entries(SPRITES).map(([id, rows]) => [id, rows.findIndex((row) => /[^.]/.test(row)) / rows.length]),
) as Record<SpotKind, number>;

const BUILT = Object.fromEntries(Object.entries(SPRITES).map(([id, rows]) => [id, build(rows)])) as Record<SpotKind, Paths>;

/** Decorative pixel spot (aria-hidden); fills its box, bottom-aligned. */
export default function SpotSprite({ kind, className }: { kind: SpotKind; className?: string }) {
  const { width, height, layers } = BUILT[kind];
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" shapeRendering="crispEdges" preserveAspectRatio="xMidYMax meet">
      {layers.map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

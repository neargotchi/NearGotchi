import type { SnackId } from "../../lib/shop";

/**
 * Pixel snacks for the shop cards and the /pet feed animation, drawn like the original bone cookie:
 * one cell per pixel, every filled cell that touches the outside is ink, the inside takes its letter's
 * colour. Fixed colours (not theme tokens): they sit on the LCD and on cards in both themes.
 */
const INK = "#141414";
const COLORS: Record<string, string> = {
  C: "#fff6e5", // cream (cookie)
  R: "#d0342c", // berry red
  W: "#ffffff", // shine
  G: "#00b877", // leaf / bowl green
  Y: "#ffd04a", // noodles / candy gold
  O: "#ff9f2e", // candy orange
  P: "#ff6b9d", // candy pink
};

const SPRITES: Record<SnackId, string[]> = {
  cookie: [
    ".CC..........CC.",
    "CCCC........CCCC",
    "CCCCCCCCCCCCCCCC",
    ".CCCCCCCCCCCCCC.",
    ".CCCCCCCCCCCCCC.",
    "CCCCCCCCCCCCCCCC",
    "CCCC........CCCC",
    ".CC..........CC.",
  ],
  berries: [
    ".......GG.......",
    "......GGGG......",
    "......GGGG......",
    "....RRRGGRRR....",
    "...RRRRRRRRRR...",
    "...RWWRRRRWWR...",
    "...RWRRRRRWRR...",
    "...RRRRRRRRRR...",
    "....RRRRRRRR....",
    ".....RWWRRR.....",
    ".....RRRRRR.....",
    "......RRRR......",
  ],
  noodles: [
    "..........CC.CC.",
    ".........CC.CC..",
    "...YYYYYYYYYYY..",
    "..YYYYYYYYYYYYY.",
    ".GGGGGGGGGGGGGGG",
    ".GGGGGGGGGGGGGGG",
    ".GGGWWGGGGGGGGGG",
    "..GGGGGGGGGGGGG.",
    "...GGGGGGGGGGG..",
    "....GGGGGGGGG...",
    "....GGGGGGGGG...",
    ".....GGGGGGG....",
  ],
  candy: [
    ".......YY.......",
    "......YYYY......",
    "......YYYY......",
    ".....YYYYYY.....",
    "YYYYYYYWWYYYYYYY",
    ".YYYYYYWYYYYYYY.",
    "..YYYYYYYYYYYY..",
    "...YYYYPPYYYY...",
    "...YYYPPPPYYY...",
    "..YYYOO..OOYYY..",
    "..YYO......OYY..",
    ".YYO........OYY.",
  ],
};

type Paths = { width: number; height: number; layers: [string, string][] };

function build(rows: string[]): Paths {
  const filled = (x: number, y: number) => {
    const cell = rows[y]?.[x];
    return !!cell && cell !== ".";
  };
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

const BUILT = Object.fromEntries(Object.entries(SPRITES).map(([id, rows]) => [id, build(rows)])) as Record<SnackId, Paths>;

/** Decorative pixel snack (aria-hidden); sized by CSS, keeps its own aspect ratio. */
export default function SnackSprite({ id, className }: { id: SnackId; className?: string }) {
  const { width, height, layers } = BUILT[id];
  return (
    <svg className={className} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" shapeRendering="crispEdges">
      {layers.map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

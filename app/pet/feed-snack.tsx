/** 16×8 pixel bone cookie: ink outline (cells touching the outside), cream inside. 2px per cell → 32×16. */
const BONE = [
  ".XX..........XX.",
  "XXXX........XXXX",
  "XXXXXXXXXXXXXXXX",
  ".XXXXXXXXXXXXXX.",
  ".XXXXXXXXXXXXXX.",
  "XXXXXXXXXXXXXXXX",
  "XXXX........XXXX",
  ".XX..........XX.",
];

const filled = (x: number, y: number) => BONE[y]?.[x] === "X";

function paths() {
  let ink = "";
  let cream = "";
  BONE.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!filled(x, y)) continue;
      const edge = !filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1);
      const cell = `M${x} ${y}h1v1h-1z`;
      if (edge) ink += cell;
      else cream += cell;
    }
  });
  return { ink, cream };
}

const { ink, cream } = paths();

/** The snack sprite for the /pet feed animation (decorative). */
export default function FeedSnack() {
  return (
    <svg className="pet-snack-svg" viewBox="0 0 16 8" aria-hidden="true">
      <path d={ink} fill="#141414" />
      <path d={cream} fill="#fff6e5" />
    </svg>
  );
}

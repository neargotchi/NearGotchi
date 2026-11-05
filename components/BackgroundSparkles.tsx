import Sparkles, { type SparkleZone } from "./Sparkles";

const GREENS = ["var(--green)", "var(--green-deep)"];
const BANDS: [number, number][] = [[4, 20], [22, 38], [40, 56], [58, 74], [76, 94]];

// Viewport zones in %: the side margins outside the 1460px content column (5 bands per side);
// the few mid-page sparkles stay at opacity ≤ 0.3 because text scrolls past them.
const MARGINS: SparkleZone[] = BANDS.flatMap((y) => [
  { x: [1, 10], y },
  { x: [90, 99], y },
]);
const MIDDLE: SparkleZone[] = [
  { x: [30, 42], y: [10, 26] },
  { x: [58, 70], y: [14, 30] },
  { x: [36, 48], y: [44, 60] },
  { x: [52, 64], y: [62, 78] },
  { x: [28, 40], y: [80, 94] },
  { x: [60, 72], y: [82, 94] },
];

/** Page-wide, fixed, subtle sparkle layer behind all sections. */
export default function BackgroundSparkles() {
  return (
    <div className="bg-sparkles" aria-hidden="true">
      <Sparkles count={18} colors={GREENS} area={MARGINS} seed="bg-margins-a" size={20} mode="ambient" duration={[3, 6]} opacity={[0.4, 0.6]} />
      <Sparkles count={18} colors={GREENS} area={MARGINS} seed="bg-margins-b" size={15} mode="ambient" duration={[3, 6]} opacity={[0.3, 0.55]} />
      <Sparkles count={6} colors={GREENS} area={MIDDLE} seed="bg-middle" size={15} mode="ambient" duration={[4, 6]} opacity={[0.3, 0.3]} />
    </div>
  );
}

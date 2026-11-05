import Sparkles from "./Sparkles";

const GREENS = ["var(--green)", "var(--green-deep)"];

// Viewport zones in %: mostly the side margins outside the 1460px content column;
// the few mid-page sparkles stay at opacity ≤ 0.3 because text scrolls past them.
const MARGINS = [
  { x: [1, 9] as [number, number], y: [6, 30] as [number, number] },
  { x: [90, 98] as [number, number], y: [10, 34] as [number, number] },
  { x: [2, 10] as [number, number], y: [38, 62] as [number, number] },
  { x: [89, 97] as [number, number], y: [40, 64] as [number, number] },
  { x: [1, 9] as [number, number], y: [70, 94] as [number, number] },
  { x: [90, 98] as [number, number], y: [72, 94] as [number, number] },
];
const MIDDLE = [
  { x: [34, 46] as [number, number], y: [12, 30] as [number, number] },
  { x: [54, 66] as [number, number], y: [52, 70] as [number, number] },
  { x: [42, 58] as [number, number], y: [80, 94] as [number, number] },
];

/** Page-wide, fixed, very subtle sparkle layer behind all sections. */
export default function BackgroundSparkles() {
  return (
    <div className="bg-sparkles" aria-hidden="true">
      <Sparkles count={8} colors={GREENS} area={MARGINS} seed="bg-margins-a" size={20} mode="ambient" duration={[3, 6]} opacity={[0.35, 0.5]} />
      <Sparkles count={7} colors={GREENS} area={MARGINS} seed="bg-margins-b" size={15} mode="ambient" duration={[3, 6]} opacity={[0.25, 0.45]} />
      <Sparkles count={3} colors={GREENS} area={MIDDLE} seed="bg-middle" size={15} mode="ambient" duration={[4, 6]} opacity={[0.25, 0.3]} />
    </div>
  );
}

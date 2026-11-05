import Sparkles, { type SparkleZone } from "./Sparkles";

type TitleSparklesProps = {
  seed: string;
  /** Room below the title (no subtitle directly under it). */
  below?: boolean;
  /** Optional below-right zone when a subtitle is shorter than the title. */
  belowRight?: boolean;
};

const SIZE = 25; // same as the "near." sparkles

/**
 * 4–5 NEAR sparkles around a section title: above, both ends, below — never over letters.
 * The title must be the positioned host (see .section-title-host in globals.css).
 */
export default function TitleSparkles({ seed, below = false, belowRight = false }: TitleSparklesProps) {
  const area: SparkleZone[] = [
    { x: [2, 18], y: [-78, -62] },
    { x: [-34, -31], y: [-10, 40], unit: "px" },
    { x: [-29, -28], y: [-30, 10], unit: "px", from: "right" },
    { x: [32, 52], y: [-80, -64] },
  ];
  if (below) area.push({ x: [20, 60], y: [112, 124] });
  if (belowRight) area.push({ x: [88, 94], y: [112, 120] });

  return (
    <Sparkles
      count={area.length}
      colors={["var(--green)", "var(--green-deep)"]}
      area={area}
      seed={seed}
      size={SIZE}
    />
  );
}

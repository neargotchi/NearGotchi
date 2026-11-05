import type { CSSProperties } from "react";

/**
 * A rectangle in % of the host box (values outside 0–100 place sparkles around the host).
 * `unit: "px"` makes x absolute pixels; `from: "right"` measures x from the host's right edge.
 */
export type SparkleZone = {
  x: [number, number];
  y: [number, number];
  unit?: "%" | "px";
  from?: "left" | "right";
};

type SparklesProps = {
  /** Number of sparkles. */
  count: number;
  /** CSS colors, assigned in order (cycled). */
  colors: string[];
  /** Where sparkles may appear; several zones are used round-robin. */
  area: SparkleZone | SparkleZone[];
  /** Stable seed so positions are deterministic (same render on server and client). */
  seed: string;
  /** Sparkle size in px (multiple of 5 keeps the 5-unit plus shape on whole pixels). */
  size?: number;
  /**
   * "loop" twinkles forever; "ambient" twinkles forever but is visible only ~15% of each
   * cycle (page background); "burst" plays once when the host is hovered/activated.
   */
  mode?: "loop" | "ambient" | "burst";
  /** Optional opacity range; each sparkle gets a fixed value inside it. */
  opacity?: [number, number];
  /** Loop duration range in seconds. */
  duration?: [number, number];
};

function seededRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const between = (random: () => number, [min, max]: [number, number]) => min + random() * (max - min);

/**
 * NEAR-style pixel sparkles: blocky 4-point plus shapes that twinkle (scale 0 → 1 → 0 in steps).
 * Render inside a positioned host. Motion lives in globals.css behind prefers-reduced-motion.
 */
export default function Sparkles({
  count,
  colors,
  area,
  seed,
  size = 15,
  mode = "loop",
  duration = [1.6, 3],
  opacity,
}: SparklesProps) {
  const zones = Array.isArray(area) ? area : [area];
  const random = seededRandom(seed);

  return (
    <span className={`sparkles sparkles-${mode}`} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => {
        const zone = zones[index % zones.length];
        const loopDuration = between(random, duration);
        const loops = mode !== "burst";
        const style: CSSProperties = {
          [zone.from === "right" ? "right" : "left"]:
            zone.unit === "px"
              ? `calc(${between(random, zone.x).toFixed(1)}px * var(--ui-scale, 1))`
              : `${between(random, zone.x).toFixed(1)}%`,
          top: `${between(random, zone.y).toFixed(1)}%`,
          width: `calc(${size}px * var(--ui-scale, 1))`,
          height: `calc(${size}px * var(--ui-scale, 1))`,
          background: colors[index % colors.length],
          opacity: opacity ? Number(between(random, opacity).toFixed(2)) : undefined,
          animationDuration: loops ? `${loopDuration.toFixed(2)}s` : "0.6s",
          animationDelay:
            loops
              ? `${(random() * loopDuration).toFixed(2)}s`
              : `${(index * 0.06).toFixed(2)}s`,
        };
        return <span key={index} className="sparkle" style={style} />;
      })}
    </span>
  );
}

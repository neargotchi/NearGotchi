import type { CSSProperties } from "react";

/*
  Vaporwave floor under the hero scene (task 095): a grid in perspective that rides forward in a seamless loop.
  The scene PNG (public/hero/*.png, scripts/build_hero_scene.py) ends at the horizon; this draws everything below.
  All sizes are in units of the artwork's floor height (--fh in app/hero-header.css = eye height under the horizon),
  so the grid scales with the scene exactly like the old painted one did.
  - Rays (the lines running to the vanishing point): static SVG. A ray never moves while riding forward. Each one
    is a thin wedge from the vanishing point, RAY wide at the bottom edge, so it narrows with distance exactly like
    a painted strip on the floor would (a constant stroke merged the far rays into a green wash at the sides).
  - Cross lines: LINES strips on a plane laid flat by rotateX(90deg) under a CSS perspective whose origin is the
    centre of the horizon. One cycle moves the plane by exactly one tile (transform only), so line k ends where
    line k−1 started: the frame at the end of a cycle equals the first one. The farthest line sits under the fog
    (mask) near the horizon, the nearest leaves through the bottom edge.
  Grid cell = TILE × TILE floor heights (square cells), the ray spacing at the bottom edge is TILE as well.
*/
const TILE = 0.625; // = --floor-tile in app/hero-header.css
const LINES = 26;
// Rays out to ±35 floor heights at the bottom edge: they reach the sides of a 16:9 scene (±5.2 floor heights)
// from .15 floor heights under the horizon, inside the fog; farther ones would only thicken the green wash there.
const RAYS = 56;
const RAY = 0.028;

const rays = Array.from({ length: RAYS * 2 + 1 }, (_, i) => {
  const x = (i - RAYS) * TILE;
  return `0,0 ${+(x - RAY / 2).toFixed(4)},1 ${+(x + RAY / 2).toFixed(4)},1`;
});

export default function HeroFloor() {
  return (
    <>
      <div className="hero-floor" aria-hidden="true">
        <svg className="hero-floor-rays" viewBox="-6 0 12 1" preserveAspectRatio="none">
          {rays.map((points) => (
            <polygon key={points} points={points} />
          ))}
        </svg>
        <div className="hero-floor-depth">
          <div className="hero-floor-plane">
            {Array.from({ length: LINES + 1 }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
        </div>
      </div>
      <div className="hero-horizon" aria-hidden="true" />
    </>
  );
}

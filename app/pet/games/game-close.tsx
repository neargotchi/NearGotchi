import { petPage } from "../../../lib/copy";

/** 10×10 pixel ✕ (even grid, so it centres exactly), 2 px strokes; "#" = filled cell. */
const X = [
  "##......##",
  "###....###",
  ".###..###.",
  "..######..",
  "...####...",
  "...####...",
  "..######..",
  ".###..###.",
  "###....###",
  "##......##",
];

const X_PATH = X.map((row, y) =>
  [...row].map((cell, x) => (cell === "#" ? `M${x} ${y}h1v1h-1z` : "")).join(""),
).join("");

/**
 * Close button of a game modal (task 078): a square pixel button of the shared style (app/hero-header.css)
 * with a pixel ✕ instead of the "×" text glyph, which sat off-centre in a wide text button.
 */
export default function GameClose({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="game-modal-close button button-secondary" aria-label={petPage.games.close} onClick={onClick}>
      <svg viewBox="0 0 10 10" aria-hidden="true" shapeRendering="crispEdges">
        <path d={X_PATH} fill="currentColor" />
      </svg>
    </button>
  );
}

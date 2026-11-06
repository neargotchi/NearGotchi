"use client";

import { useEffect, useState } from "react";

import { applyTheme, readSavedTheme, saveTheme, type Theme } from "../lib/theme";

/** 10×10 pixel icons, one string per row ("#" = filled cell). */
const MOON = [
  "...###....",
  ".####.....",
  ".###......",
  "###.......",
  "###.......",
  "###.......",
  "####.....#",
  ".####..##.",
  ".########.",
  "...####...",
];

const SUN = [
  "....##....",
  ".#......#.",
  "....##....",
  "...####...",
  "#.######.#",
  "#.######.#",
  "...####...",
  "....##....",
  ".#......#.",
  "....##....",
];

function pixelPath(rows: string[]) {
  let d = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== "#") continue;
      let end = x;
      while (row[end + 1] === "#") end++;
      d += `M${x} ${y}h${end - x + 1}v1h-${end - x + 1}z`;
      x = end;
    }
  });
  return d;
}

const MOON_PATH = pixelPath(MOON);
const SUN_PATH = pixelPath(SUN);

const currentTheme = (): Theme =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";

/**
 * Pixel sun/moon button (header on desktop, burger panel on mobile). The icon shown is picked by
 * CSS from <html data-theme>, so it is right before hydration; labels follow once mounted.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const root = document.documentElement;
    setTheme(currentTheme());

    // Keep every toggle in sync with <html data-theme>.
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    // No saved choice: follow the system setting live.
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      if (!readSavedTheme()) applyTheme(system.matches ? "dark" : "light");
    };
    system.addEventListener("change", onSystem);

    return () => {
      observer.disconnect();
      system.removeEventListener("change", onSystem);
    };
  }, []);

  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? "switch to light mode" : "switch to dark mode"}
      aria-pressed={dark}
      onClick={() => {
        const next: Theme = currentTheme() === "dark" ? "light" : "dark";
        applyTheme(next);
        saveTheme(next);
      }}
    >
      <svg className="theme-icon theme-icon-moon" viewBox="0 0 10 10" aria-hidden="true">
        <path d={MOON_PATH} />
      </svg>
      <svg className="theme-icon theme-icon-sun" viewBox="0 0 10 10" aria-hidden="true">
        <path d={SUN_PATH} />
      </svg>
    </button>
  );
}

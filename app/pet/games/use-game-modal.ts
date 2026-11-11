"use client";

import { useEffect, useEffectEvent } from "react";

/**
 * While a game is open as a modal (task 064): locks the page scroll behind it and closes it on Esc.
 * `onEscape` is the game's own "close" (stop a running round, or leave the result screen).
 */
export function useGameModal(open: boolean, onEscape: () => void) {
  const escape = useEffectEvent(onEscape);
  useEffect(() => {
    if (!open) return;
    // Lock the root scroller, not <body>: overflow on body made it its own scroll container and the
    // sticky site header jumped off screen while a game was open (task 078, same fix as the burger).
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      escape();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
}

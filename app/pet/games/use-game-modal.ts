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
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      escape();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
}

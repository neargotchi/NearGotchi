"use client";

import { useEffect } from "react";

const DURATION = 180;

/**
 * Fallback FAQ expand/collapse for browsers without ::details-content.
 * Modern browsers animate in CSS; reduced motion keeps the native instant toggle.
 */
export default function FaqMotion() {
  useEffect(() => {
    if (CSS.supports("selector(::details-content)")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(document.querySelectorAll<HTMLDetailsElement>(".faq-item"));
    const cleanups = items.map((details) => {
      const summary = details.querySelector("summary");
      const answer = details.querySelector<HTMLElement>("p");
      if (!summary || !answer) return () => {};

      const onClick = (event: MouseEvent) => {
        event.preventDefault();
        const opening = !details.open;
        if (opening) details.open = true;
        const full = { height: `${answer.scrollHeight}px`, opacity: 1, paddingTop: "", paddingBottom: "" };
        const closed = { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px" };
        const style = getComputedStyle(answer);
        full.paddingTop = style.paddingTop;
        full.paddingBottom = style.paddingBottom;
        answer.style.overflow = "hidden";
        const animation = answer.animate(opening ? [closed, full] : [full, closed], {
          duration: DURATION,
          easing: "ease-out",
        });
        animation.onfinish = () => {
          answer.style.overflow = "";
          if (!opening) details.open = false;
        };
      };

      summary.addEventListener("click", onClick);
      return () => summary.removeEventListener("click", onClick);
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return null;
}

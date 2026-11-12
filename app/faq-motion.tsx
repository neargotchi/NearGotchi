"use client";

import { useEffect } from "react";

const DURATION = 180;

/**
 * FAQ accordion behaviour, plus the fallback expand/collapse for browsers without ::details-content.
 * Modern browsers animate in CSS; reduced motion keeps the native instant toggle.
 */
export default function FaqMotion() {
  // Accordion: opening one answer closes the others (the native `name` group does the same in
  // current browsers; this covers older ones and is a no-op where the group already did it).
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLDetailsElement>(".faq-item"));
    const onToggle = (event: Event) => {
      const opened = event.currentTarget as HTMLDetailsElement;
      if (!opened.open) return;
      items.forEach((details) => {
        if (details !== opened && details.open) details.open = false;
      });
    };
    items.forEach((details) => details.addEventListener("toggle", onToggle));
    return () => items.forEach((details) => details.removeEventListener("toggle", onToggle));
  }, []);

  // A link to one answer (/#fair-hatch, from /mint) opens it and scrolls to it.
  useEffect(() => {
    const openFromHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!(target instanceof HTMLDetailsElement) || !target.classList.contains("faq-item")) return;
      target.open = true;
      target.scrollIntoView({ block: "start" });
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, []);

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

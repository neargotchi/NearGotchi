"use client";

import { useSyncExternalStore } from "react";

import { header, navHref } from "../lib/copy";

/** Landing section ids in nav order ("#pets" → "pets"); other routes have none of them. */
const IDS = header.nav.map((link) => link.href.slice(1));

// One scroll watcher shared by the header nav and the burger panel nav.
let current: string | null = null;
let frame = 0;
let resize: ResizeObserver | null = null;
const listeners = new Set<() => void>();

/**
 * A section is current once its top passes the middle of the visible area under the header. The
 * last one also wins at the page bottom, since it can be shorter than a screen.
 */
function measure() {
  frame = 0;
  const sections = IDS.map((id) => document.getElementById(id)).filter((section) => section !== null);
  const top = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
  const marker = top + (window.innerHeight - top) / 2;
  let next = sections[0]?.id ?? null;
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= marker) next = section.id;
  }
  const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  if (sections.length && window.scrollY > 0 && atBottom) next = sections[sections.length - 1].id;
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    // Body height changes when fonts, images or a new route's content arrive.
    resize = new ResizeObserver(schedule);
    resize.observe(document.body);
  }
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    resize?.disconnect();
    resize = null;
    cancelAnimationFrame(frame);
    frame = 0;
  };
}

/** Section links (header bar and burger panel); the section in view gets .is-current. */
export default function SectionNav({ className }: { className?: string }) {
  const active = useSyncExternalStore(subscribe, () => current, () => null);

  return (
    <nav className={className} aria-label="sections">
      <ul>
        {header.nav.map((link) => {
          const isCurrent = link.href === `#${active}`;
          return (
            <li key={link.href}>
              <a
                href={navHref(link.href)}
                className={isCurrent ? "is-current" : undefined}
                aria-current={isCurrent ? "location" : undefined}
              >
                {link.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

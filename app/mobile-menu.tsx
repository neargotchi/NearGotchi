"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { header } from "../lib/copy";
import WalletButton from "./wallet-button";

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Mobile header menu (hidden on desktop by CSS): pixel burger + full-width panel under the
 * header. Closes on link click, Esc and outside tap (a scrim under the header catches the tap so
 * it doesn't also hit the page); focus stays inside burger + panel while open.
 */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== "Tab" || !panel || !buttonRef.current) return;
      const items = [buttonRef.current, ...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (!current || !items.includes(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel?.contains(target) || buttonRef.current?.contains(target)) return;
      if ((target as Element).closest?.(".mobile-menu-backdrop")) return; // closes on its click
      close(false);
    };

    // Back to desktop width: the panel is hidden by CSS, so drop the open state too.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onDesktop = () => desktop.matches && close(false);

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    desktop.addEventListener("change", onDesktop);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      desktop.removeEventListener("change", onDesktop);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "close menu" : "open menu"}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="menu-icon" aria-hidden="true" />
      </button>
      {open ? <div className="mobile-menu-backdrop" aria-hidden="true" onClick={() => close(false)} /> : null}
      <div
        ref={panelRef}
        id="mobile-menu"
        className="mobile-menu"
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) close(false);
        }}
      >
        <nav aria-label="sections">
          <ul>
            {header.nav.map((link) => (
              <li key={link.href}>
                <a href={`/${link.href}`}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mobile-menu-actions">
          <WalletButton noteId="wallet-note-mobile" />
          <Link className="button button-primary" href={header.cta.href}>
            {header.cta.label}
          </Link>
        </div>
      </div>
    </>
  );
}

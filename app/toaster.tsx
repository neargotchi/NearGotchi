"use client";

import { useEffect, useRef, useState } from "react";

import { subscribeToasts, type ToastItem } from "../lib/toast";

const SHOW_MS = 4000;
const MAX = 3;

/** Toasts bottom right, in the site's pixel style. One polite live region; each toast hides itself after ~4 s. */
export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const live = timers.current;
    const off = subscribeToasts((item) => {
      setItems((current) => [...current, item].slice(-MAX));
      live.set(
        item.id,
        setTimeout(() => {
          setItems((current) => current.filter((other) => other.id !== item.id));
          live.delete(item.id);
        }, SHOW_MS),
      );
    });
    return () => {
      off();
      live.forEach(clearTimeout);
      live.clear();
    };
  }, []);

  return (
    <div className="toaster" role="status" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <p key={item.id} className={item.kind === "error" ? "toast is-error" : "toast"}>
          {item.text}
        </p>
      ))}
    </div>
  );
}

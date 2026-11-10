"use client";

import { useEffect, useState } from "react";

import { dropProgress, fill } from "../lib/copy";
import { DROP1_TOTAL, PROGRESS_CELLS as CELLS, filledCells, getDropStatus, subscribeDrop } from "../lib/drop1";

type Status = { minted: number; total: number };

/**
 * "x / 300 hatched · y left · demo" (docs/DEVLOG.md §2). Fixed size from the first paint (the
 * server renders empty cells and "…"), filled after hydration from this browser's demo count, and kept
 * in sync with hatches here and in other tabs.
 */
export default function DropProgress({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  /** The contract could not be read: show "—", never a made-up 0. */
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getDropStatus().then((next) => {
      if (!live) return;
      if (next) setStatus(next);
      else setFailed(true);
    });
    const unsubscribe = subscribeDrop((next) => {
      if (!live) return;
      setStatus(next);
      setFailed(false);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  const total = status?.total ?? DROP1_TOTAL;
  const on = status ? filledCells(status) : 0;
  const label = fill(dropProgress.label, {
    minted: status ? String(status.minted) : failed ? dropProgress.unavailable : dropProgress.pending,
    total: String(total),
    left: status ? String(total - status.minted) : failed ? dropProgress.unavailable : dropProgress.pending,
  });

  return (
    <div className={["drop-progress", className].filter(Boolean).join(" ")} aria-busy={status || failed ? undefined : true}>
      <div className="drop-progress-bar" aria-hidden="true">
        {Array.from({ length: CELLS }, (_, index) => (
          <span key={index} className={index < on ? "is-on" : undefined} />
        ))}
      </div>
      <p className="drop-progress-label">{label}</p>
    </div>
  );
}

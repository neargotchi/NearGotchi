"use client";

import { useEffect, useEffectEvent, type RefObject } from "react";

/**
 * Crisp game LCDs (task 078). The games keep drawing in their logical pixels (W×H, e.g. 128×96), but
 * the canvas backing store is W×H times a whole-number scale that matches its size on screen ×
 * devicePixelRatio, with a matching transform. Before, the 128×96 bitmap was blown up by CSS, so the
 * pet sprite (489×431 source) was first squeezed to ~26 px with smoothing and then enlarged: blurry and
 * ragged. Now pixel shapes (snacks, ball, flag, HUD bars) stay hard-edged at any size and the pet is
 * downscaled once, straight to its final on-screen size. Logic, positions and hit boxes are unchanged
 * (same logical units). Redraws whenever the canvas changes size (card ↔ modal, rotation, zoom).
 */
export function useCrispCanvas(canvasRef: RefObject<HTMLCanvasElement | null>, width: number, height: number, redraw: () => void) {
  const repaint = useEffectEvent(redraw);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const apply = () => {
      const shown = canvas.getBoundingClientRect().width || width;
      const ratio = window.devicePixelRatio || 1;
      const scale = Math.max(1, Math.min(16, Math.ceil((shown * ratio) / width)));
      if (canvas.width !== width * scale || canvas.height !== height * scale) {
        canvas.width = width * scale;
        canvas.height = height * scale;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
      repaint();
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef, width, height]);
}

/** Draws a (large, smooth-edged) sprite down to its on-screen size, then back to hard pixels. */
export function drawSprite(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, w, h);
  ctx.imageSmoothingEnabled = false;
}

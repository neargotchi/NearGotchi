"""Hero scene backgrounds (task 095): public/hero/dark.png + darkmobile.png from the untouched sources in
assets-raw/hero/ (the 089/093 versions of the artwork). Repeatable: always reads the sources, never its own output.
  python3 scripts/build_hero_scene.py

1. Clouds: the green outline and the grey band inside each cloud are repainted in a natural palette, pixel by
   pixel (no smoothing): outline lavender-grey, inside white -> light lavender in hard bands, the grey band
   (the cloud's own shading, lower edge) becomes the soft lavender shadow. No green is left in the sky.
   A cloud's inside = sky pixels that a flood fill from open sky cannot reach through the outline (the clouds cut
   by the frame are closed by the image edge).
2. Floor: everything from the horizon line down is cleared to the sky colour; the grid is drawn and animated in
   CSS on top (app/hero-floor.tsx, app/hero-header.css), so the PNG keeps only the sky, clouds and hills.
3. Hills (and everything between the clouds and the horizon) are copied unchanged.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets-raw" / "hero"
OUT = ROOT / "public" / "hero"

# name: (horizon row = first row of the horizon line, last row that may hold clouds)
SCENES = {"dark.png": (781, 520), "darkmobile.png": (1410, 1100)}

OUTLINE = (0x7e, 0x76, 0xad)  # darker lavender-grey
FILL = [(0xf4, 0xf1, 0xff), (0xe4, 0xdf, 0xf9), (0xcf, 0xc8, 0xee)]  # top -> bottom bands
SHADOW = (0x9b, 0x92, 0xc9)  # the lower edge (was the grey band)


CLOSE = 3  # px: largest outline gap that still closes a cloud


def flood(passable, seeds):
    """4-connected flood fill over `passable` from `seeds`."""
    top, W = passable.shape
    reach = np.zeros((top, W), bool)
    q = deque(seeds)
    for y, x in seeds:
        reach[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < top and 0 <= nx < W and not reach[ny, nx] and passable[ny, nx]:
                reach[ny, nx] = True
                q.append((ny, nx))
    return reach


def hexc(c):
    return "#%02x%02x%02x" % c


def build(name, horizon, sky_bottom):
    a = np.asarray(Image.open(SRC / name).convert("RGB")).astype(int)
    H, W, _ = a.shape
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    lum = a.max(2)
    sky = a[2:12, W // 2 - 100 : W // 2 + 100].reshape(-1, 3).mean(0).round().astype(int)
    top = sky_bottom
    # Outline incl. its anti-aliased fringe: any pixel noticeably greener than red.
    outline = (g[:top] - r[:top]) > 24
    # The outline is drawn as stair blocks that often touch only at a corner or leave a 1–2 px gap, so the
    # flood runs against the outline grown by CLOSE px, then grows back up to CLOSE px towards the outline.
    barrier = outline.copy()
    for dy in range(-CLOSE, CLOSE + 1):
        for dx in range(-CLOSE, CLOSE + 1):
            barrier[max(0, dy) : top + min(0, dy), max(0, dx) : W + min(0, dx)] |= outline[
                max(0, -dy) : top + min(0, -dy), max(0, -dx) : W + min(0, -dx)]
    reach = flood(~barrier, [(4, W // 2)])
    for _ in range(CLOSE + 1):
        grow = reach.copy()
        grow[1:] |= reach[:-1]; grow[:-1] |= reach[1:]; grow[:, 1:] |= reach[:, :-1]; grow[:, :-1] |= reach[:, 1:]
        reach = grow & ~outline
    inside = ~reach & ~outline
    # Label the clouds (outline + inside, 8-connected) to band each one by its own height.
    cloud = inside | outline
    label = np.zeros((top, W), int)
    boxes = []
    for y0 in range(top):
        for x0 in range(W):
            if cloud[y0, x0] and not label[y0, x0]:
                n = len(boxes) + 1
                label[y0, x0] = n
                q = deque([(y0, x0)])
                ys, size = [y0, y0], 0
                while q:
                    y, x = q.popleft()
                    size += 1
                    ys[0], ys[1] = min(ys[0], y), max(ys[1], y)
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < top and 0 <= nx < W and cloud[ny, nx] and not label[ny, nx]:
                                label[ny, nx] = n
                                q.append((ny, nx))
                boxes.append((ys[0], ys[1], size))
    out = a.copy()
    grey = lum[:top] > (int(sky.max()) + 22)  # the shading band inside a cloud (sky ≈ 10, band ≈ 50–60)
    # Single noisy pixels in the band (lighter dots inside the shading) follow their 3x3 neighbourhood.
    near = np.zeros((top, W), int)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            near[max(0, dy) : top + min(0, dy), max(0, dx) : W + min(0, dx)] += grey[
                max(0, -dy) : top + min(0, -dy), max(0, -dx) : W + min(0, -dx)]
    grey = (grey & (near >= 3)) | (near >= 6)
    clouds = 0
    for n, (y0, y1, size) in enumerate(boxes, 1):
        if size < 200:  # specks: the sky stays sky
            out[:top][label == n] = sky
            continue
        clouds += 1
        m = label == n
        out[:top][m & outline] = OUTLINE
        body = m & inside
        out[:top][body & grey] = SHADOW
        rows = np.arange(top)[:, None].repeat(W, 1)
        t = (rows - y0) / max(1, y1 - y0)
        for i, color in enumerate(FILL):
            band = body & ~grey & (t >= i / 3) & (t < (i + 1) / 3 + (i == 2))
            out[:top][band] = color
    # Teal tint left in the dark halo around the old outline (e.g. rgb(1, 17, 26)) -> grey of the same lightness.
    skyband = out[:top]
    tint = (skyband[..., 1] - skyband[..., 0]) > 4
    skyband[tint] = skyband[tint].mean(1, keepdims=True).round()
    # Floor: from the horizon line down = plain sky colour; CSS draws the grid.
    out[horizon:] = sky
    # The row above holds the anti-aliased top of the old horizon line: repeat the hills' last clean row there.
    out[horizon - 1] = out[horizon - 2]
    still_green = int(((out[:top, :, 1] - out[:top, :, 0]) > 4).sum())
    Image.fromarray(out.astype(np.uint8)).save(OUT / name, optimize=True)
    print(f"{name}: {W}x{H}, {clouds} clouds, sky {hexc(tuple(sky))}, floor cleared from row {horizon} "
          f"({horizon / H:.4f}), green px left in the sky: {still_green}")


if __name__ == "__main__":
    for name, (horizon, sky_bottom) in SCENES.items():
        build(name, horizon, sky_bottom)

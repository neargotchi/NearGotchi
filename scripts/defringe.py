"""Remove the light halo left around sprites by background removal.
Floods from transparent pixels through light pixels ((lum > LUM) & (rgb.max(-1) - rgb.min(-1) < 60))  # light AND greyish = halo and makes them transparent.
The dark pixel outline of every sprite stops the flood.
RUN ONCE PER FRESH CUT: python3 scripts/cut_assets.py && python3 scripts/defringe.py
NOT idempotent: each pass floods DEPTH px deeper (a 2nd pass on clean files removed 1,212 more px in 17 files,
tested 2026-11-07). Never re-run it on sprites that are already clean, e.g. public/pets/*/nft.png."""
import numpy as np, glob, sys
from PIL import Image
from collections import deque
LUM = int(sys.argv[1]) if len(sys.argv) > 1 else 150
DEPTH = int(sys.argv[2]) if len(sys.argv) > 2 else 4  # max px into the sprite; outline gaps cannot leak further

def defringe(path):
    im = Image.open(path).convert("RGBA"); a = np.array(im)
    rgb = a[..., :3].astype(int); alpha = a[..., 3]
    lum = (0.299*rgb[...,0] + 0.587*rgb[...,1] + 0.114*rgb[...,2])
    H, W = alpha.shape
    passable = (alpha < 250) | ((lum > LUM) & (rgb.max(-1) - rgb.min(-1) < 60))  # light AND greyish = halo
    seen = np.zeros((H, W), bool); q = deque()
    for y in range(H):
        for x in range(W):
            if alpha[y, x] < 10:
                seen[y, x] = True; q.append((y, x, 0))
    removed = 0
    while q:
        y, x, d = q.popleft()
        if d >= DEPTH: continue
        for ny, nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
            if 0 <= ny < H and 0 <= nx < W and not seen[ny, nx] and passable[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx, d+1))
                if alpha[ny, nx] >= 10: removed += 1
    a[..., 3] = np.where(seen, 0, alpha)
    Image.fromarray(a).save(path)
    return removed

files = sorted(glob.glob("public/pets/*/*.png")) + sorted(glob.glob("public/items/*/*.png"))
for f in files:
    print(f, defringe(f))

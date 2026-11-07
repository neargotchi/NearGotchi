"""Dressed NFT poses: assets-raw/dressed/petN-<item>.png (white bg, 1024) ->
public/pets/petN/dressed/<item>.png (transparent, halo removed, aligned).
All outputs share one canvas: W x H, pet feet on baseline y=BASE, centered on the feet's x-center.
Run once per fresh set of raw files (the halo pass is not idempotent)."""
import numpy as np, glob, os, json
from PIL import Image, ImageDraw
from collections import deque
W, H, BASE = 720, 900, 880

def cut(path):
    im = Image.open(path).convert("RGB"); w, h = im.size
    pad = Image.new("RGB", (w+2, h+2), (255, 255, 255)); pad.paste(im, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), (255, 0, 255), thresh=40)
    a = np.array(pad)[1:-1, 1:-1]
    bg = (a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255)
    rgb = np.array(im).astype(int)
    lum = 0.299*rgb[..., 0] + 0.587*rgb[..., 1] + 0.114*rgb[..., 2]
    grey = (rgb.max(-1) - rgb.min(-1)) < 60
    passable = bg | ((lum > 150) & grey)
    seen = bg.copy(); q = deque((y, x, 0) for y, x in zip(*np.nonzero(bg)))
    while q:
        y, x, d = q.popleft()
        if d >= 4: continue
        for ny, nx in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
            if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and passable[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx, d+1))
    alpha = np.where(seen, 0, 255).astype(np.uint8)
    # drop tiny specks (noise outside the sprite)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), "RGBA")

def place(im):
    a = np.array(im.getchannel("A")) > 0
    ys, xs = np.nonzero(a); bottom = ys.max()
    feet = xs[ys > bottom - 60]; cx = int((feet.min() + feet.max()) / 2)
    can = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    can.alpha_composite(im, (W//2 - cx, BASE - bottom)) if (W//2-cx)>=0 and (BASE-bottom)>=0 else can.paste(im, (W//2 - cx, BASE - bottom), im)
    return can

report = {}
import sys
pat = sys.argv[1] if len(sys.argv) > 1 else "pet?-*"
for f in sorted(glob.glob(f"assets-raw/dressed/{pat}.png")):
    name = os.path.basename(f)[:-4]; pet, item = name.split("-", 1)
    out = place(cut(f)); os.makedirs(f"public/pets/{pet}/dressed", exist_ok=True)
    out.save(f"public/pets/{pet}/dressed/{item}.png"); report[name] = out.getchannel("A").getbbox()
print(json.dumps(report))

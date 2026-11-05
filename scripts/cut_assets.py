"""Cut NEARGOTCHI sheets into single transparent sprites. Re-runnable: python3 scripts/cut_assets.py"""
from PIL import Image, ImageDraw
import numpy as np, os
from collections import deque

RAW, OUT = "assets-raw", "public"
KEY = (255, 0, 255)

def remove_bg(im, thresh=40):
    im = im.convert("RGB")
    w, h = im.size
    pad = Image.new("RGB", (w + 2, h + 2), (255, 255, 255))
    pad.paste(im, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), KEY, thresh=thresh)
    a = np.array(pad)[1:-1, 1:-1]
    alpha = np.where((a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255), 0, 255).astype(np.uint8)
    rgba = np.dstack([np.array(im), alpha])
    return Image.fromarray(rgba, "RGBA")

def bbox(im):
    return im.getchannel("A").point(lambda v: 255 if v > 20 else 0).getbbox()

def flatten_alpha(im):
    # sheets saved as RGBA may already carry a white or transparent bg
    if im.mode == "RGBA":
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        return bg.convert("RGB")
    return im

PETS = {"pet1": "pet1", "pet2": "pet2", "pet3": "pet3"}
STATES = [("normal", 0, 0), ("hungry", 1, 0), ("happy", 0, 1), ("sleep", 1, 1)]

def cut_pets():
    crops = []
    for src, dst in PETS.items():
        im = remove_bg(flatten_alpha(Image.open(f"{RAW}/{src}.png")))
        w, h = im.size
        for name, cx, cy in STATES:
            q = im.crop((cx * w // 2, cy * h // 2, (cx + 1) * w // 2, (cy + 1) * h // 2))
            b = bbox(q)
            crops.append((dst, name, q.crop(b)))
    cw = max(c[2].width for c in crops) + 16
    ch = max(c[2].height for c in crops) + 16
    for dst, name, c in crops:
        canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        canvas.paste(c, ((cw - c.width) // 2, ch - 8 - c.height))  # shared baseline
        os.makedirs(f"{OUT}/pets/{dst}", exist_ok=True)
        canvas.save(f"{OUT}/pets/{dst}/{name}.png")
    return cw, ch

def components(im, scale=4, gap=6):
    a = np.array(im.getchannel("A").resize((im.width // scale, im.height // scale))) > 20
    H, W = a.shape
    # dilate so sparkles/parts of one item join
    d = a.copy()
    for _ in range(gap):
        n = d.copy()
        n[1:, :] |= d[:-1, :]; n[:-1, :] |= d[1:, :]; n[:, 1:] |= d[:, :-1]; n[:, :-1] |= d[:, 1:]
        d = n
    seen = np.zeros_like(d); boxes = []
    for y in range(H):
        for x in range(W):
            if d[y, x] and not seen[y, x]:
                q = deque([(y, x)]); seen[y, x] = 1; ys = [y]; xs = [x]
                while q:
                    cy, cx = q.popleft()
                    for ny, nx in ((cy+1,cx),(cy-1,cx),(cy,cx+1),(cy,cx-1)):
                        if 0 <= ny < H and 0 <= nx < W and d[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = 1; q.append((ny, nx)); ys.append(ny); xs.append(nx)
                if len(ys) > 30:
                    boxes.append((min(xs)*scale, min(ys)*scale, (max(xs)+1)*scale, (max(ys)+1)*scale))
    # reading order: rows, then x
    boxes.sort(key=lambda b: (round(((b[1]+b[3])/2) / 200), b[0]))
    return boxes

ITEMS1 = ["head/cap", "head/crown", "head/beanie", "head/keffiyeh", "head/tophat", "head/headphones", "head/halo"]
ITEMS2 = ["eyes/nerd", "eyes/sunglasses", "eyes/pixel", "eyes/mask", "neck/chain", "body/tshirt", "back/cape"]  # sheet has no laser item

def cut_items(src, names, gap):
    im = remove_bg(flatten_alpha(Image.open(f"{RAW}/{src}.png")))
    boxes = components(im, gap=gap)
    if len(boxes) != len(names):
        print(f"WARN {src}: found {len(boxes)} items, expected {len(names)}")
    for b, n in zip(boxes, names):
        if n is None: continue
        piece = im.crop(b); piece = piece.crop(bbox(piece))
        os.makedirs(os.path.dirname(f"{OUT}/items/{n}.png"), exist_ok=True)
        piece.save(f"{OUT}/items/{n}.png")
    return boxes

if __name__ == "__main__":
    print("pet canvas", cut_pets())
    print("sheet1", cut_items("accessories1", ITEMS1, 2))
    print("sheet2", cut_items("accessories2", ITEMS2, 1))

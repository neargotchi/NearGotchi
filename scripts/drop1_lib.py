"""Shared drop-1 compose code (docs/PLAN-COLLECTION.md, "Update: dressed poses").
Each token = background (1024², as drawn) + one dressed pose public/pets/<pet>/dressed/<item>.png (720×900, feet
on y=880). Render v2 (task 055, `compose_v2`): halo enclaves cleared, the pose reduced to a 128×128 pixel grid (×8),
centred on its body, feet on y=960, a 2-tone pixel shadow under it. Render v1 (`compose`, pasted 1× at (152, 80))
is kept for before/after sheets. Used by build_manifest.py, compose_drop1.py, build_metadata.py and contact_sheet.py.
(The layered-accessory anchors of task 032 were dropped by the owner on 2026-11-07; see git 59baf28 for that code.)"""
import os
from functools import lru_cache
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANVAS = 1024
DRESSED_W, DRESSED_H, DRESSED_BASELINE = 720, 900, 880
BASELINE_Y = 960
OFFSET = ((CANVAS - DRESSED_W) // 2, BASELINE_Y - DRESSED_BASELINE)   # (152, 80)
TIERS = ["common", "rare", "epic", "legendary"]
PETS = {  # mirrors lib/mocks.ts `pets`
    "pet1": {"name": "batman", "species": "corgi"},
    "pet2": {"name": "near dragon", "species": "dragon"},
    "pet3": {"name": "near kat", "species": "meerkat"},
}


def path(*p):
    return os.path.join(ROOT, *p)


@lru_cache(None)
def items():
    """Sorted item ids that exist as a dressed pose for EVERY pet (13 since task 033)."""
    sets = [{f[:-4] for f in os.listdir(path("public", "pets", p, "dressed")) if f.endswith(".png")} for p in PETS]
    common = set.intersection(*sets)
    assert all(s == common for s in sets), "dressed item sets differ between pets"
    return sorted(common)


@lru_cache(None)
def backgrounds():
    """{bg_id: tier} from assets-raw/backgrounds/<prefix><nn>-<name>.png."""
    tiers = {"c": "common", "r": "rare", "e": "epic", "l": "legendary"}
    return {f[:-4]: tiers[f[0]] for f in sorted(os.listdir(path("assets-raw", "backgrounds"))) if f.endswith(".png")}


@lru_cache(None)
def _img(rel):
    return Image.open(path(rel)).convert("RGBA")


def dressed_img(pet_id, item):
    im = _img(f"public/pets/{pet_id}/dressed/{item}.png")
    assert im.size == (DRESSED_W, DRESSED_H), f"{pet_id}/{item}: {im.size}"
    return im


def bg_img(bg_id):
    im = _img(f"assets-raw/backgrounds/{bg_id}.png")
    assert im.size == (CANVAS, CANVAS), f"{bg_id}: {im.size}"
    return im


def compose(pet_id, item, bg):
    """Render v1 (tasks 033–053, kept for before/after sheets): the dressed pose pasted 1× at OFFSET.
    bg: background id or an RGB tuple. Returns the 1024×1024 RGB image."""
    canvas = bg_img(bg).copy() if isinstance(bg, str) else Image.new("RGBA", (CANVAS, CANVAS), tuple(bg) + (255,))
    canvas.alpha_composite(dressed_img(pet_id, item), OFFSET)
    return canvas.convert("RGB")


def compose_token(token):
    """The shipped token image: render v2 since task 055 (pixel grid, body centre, shadow, halo enclaves)."""
    return compose_v2(token["petId"], token["accessory"], token["background"])[0]


# ---------------------------------------------------------------------------------------------------
# Render v2 (prototype task 054, shipped for all 300 since task 055 via compose_token).
# 1. enclaves: background white trapped inside a closed shape (the halo ring) becomes transparent
# 2. one pixel grid for the pet: the sprite is reduced to GRID×GRID logical pixels (colour mode per cell),
#    then drawn ×(1024/GRID); the background is kept as drawn (re-gridding it broke lines, task 055)
# 3. centering on the body (top 75% of the sprite, no tail / feet), snapped to the grid
# 4. a 2-tone pixel shadow under the feet
# ---------------------------------------------------------------------------------------------------
import numpy as np
from collections import deque

GRID = 128                      # logical pixels per side; 1024 / 128 = 8 px per pixel (task 054: 128 over 256, see PLAN-COLLECTION)
SPRITE_COLORS = 48              # light palette per sprite, applied to the logical pixels (fast octree, no dither)
BODY_SHARE = 0.75               # centering uses the top 75% of the sprite's height
ALPHA_SHARE = 0.4               # a cell is opaque when ≥ 40% of it is (keeps 1-pixel outlines on the silhouette)
DARK_WEIGHT = 1.8               # dark colours (outline, nose, eyes) win close votes; task 055: 1.25 → 1.8
SHADOW = (0.80, 0.64)           # outer / inner shadow: background × factor
# Enclaves: neutral white (min channel ≥ 236, chroma ≤ 4) areas of ≥ min_area px whose centre sits in the
# top `top` share of the sprite are background trapped inside the item (only the halo ring in drop 1:
# eye shines, glasses bridges and white fur are outside this rule; see docs/REPORT.md, task 054).
ENCLAVES = {"halo": {"top": 0.2, "min_area": 300}}


def _components(mask):
    h, w = mask.shape
    seen = np.zeros((h, w), bool)
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        q, pts = deque([(y0, x0)]), []
        while q:
            y, x = q.popleft()
            pts.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        yield np.array(pts)


def remove_enclaves(im, item):
    """RGBA sprite → copy with the item's trapped background made transparent. Returns (image, removed px)."""
    rule = ENCLAVES.get(item)
    if not rule:
        return im, 0
    a = np.array(im).copy()
    rgb, al = a[..., :3].astype(int), a[..., 3]
    ys = np.nonzero(al.max(1) > 0)[0]
    top, height = ys.min(), ys.max() - ys.min() + 1
    chroma = rgb.max(-1) - rgb.min(-1)
    white = (al > 0) & (rgb.min(-1) >= 236) & (chroma <= 4)
    removed = np.zeros(al.shape, bool)
    for pts in _components(white):
        if len(pts) < rule["min_area"] or pts[:, 0].mean() > top + rule["top"] * height:
            continue
        removed[pts[:, 0], pts[:, 1]] = True
    # take the light anti-aliased rim with it (2 px, only pale low-chroma pixels)
    pale = (al > 0) & (rgb.min(-1) >= 200) & (chroma <= 14)
    for _ in range(2):
        grow = removed.copy()
        grow[1:] |= removed[:-1]; grow[:-1] |= removed[1:]; grow[:, 1:] |= removed[:, :-1]; grow[:, :-1] |= removed[:, 1:]
        removed |= grow & pale
    a[removed, 3] = 0
    return Image.fromarray(a, "RGBA"), int(removed.sum())


def body_center_x(alpha):
    """x of the centre of mass of the opaque pixels in the top BODY_SHARE of the sprite (no tail, no feet)."""
    ys, xs = np.nonzero(alpha)
    cut = ys.min() + BODY_SHARE * (ys.max() - ys.min())
    return float(xs[ys <= cut].mean())


DARK_LUM = 100                  # "dark" = mean luminance below this (task 055: 60 → 100 keeps near kat's nose dark,
                                # it had turned into a light blob; docs/review/faces.png)


def _cell_mode(rgb, valid, cell, dark_weight=1.0):
    """Per cell: the most frequent colour (4 bits per channel, dark colours weighted), returned as the mean
    of the pixels in that colour bin, so small details keep their real colour (no global palette first)."""
    h = rgb.shape[0]
    g = h // cell
    q = (rgb.astype(np.int64) >> 4)
    key_bin = (q[..., 0] << 8) | (q[..., 1] << 4) | q[..., 2]
    cy, cx = np.divmod(np.arange(h * h).reshape(h, h), h)
    cell_id = (cy // cell) * g + (cx // cell)
    m = valid.ravel()
    ids, bins, px = cell_id.ravel()[m], key_bin.ravel()[m], rgb.reshape(-1, 3)[m].astype(float)
    key = ids * 4096 + bins
    order = np.argsort(key, kind="stable")
    key, px = key[order], px[order]
    uniq, start, count = np.unique(key, return_index=True, return_counts=True)
    sums = np.add.reduceat(px, start, axis=0)
    mean = sums / count[:, None]
    lum = mean @ np.array([0.299, 0.587, 0.114])
    cells = uniq // 4096
    score = count * np.where(lum < DARK_LUM, dark_weight, 1.0)
    # best bin per cell: sort by (cell, score) and take the last of each cell
    o = np.lexsort((score, cells))
    last = np.r_[cells[o][1:] != cells[o][:-1], True]
    pick = o[last]
    out = np.zeros((g * g, 3))
    out[cells[pick]] = mean[pick]
    return out.reshape(g, g, 3)


def _quantize(rgb, mask, colors):
    """Light palette (fast octree over the masked logical pixels, no dither); unmasked pixels untouched."""
    if mask.sum() == 0:
        return rgb
    pix = np.clip(rgb[mask].round(), 0, 255).astype(np.uint8)
    # fast octree keeps small saturated details (halo gold, ear pink) that median cut merges into the fur
    pal_img = Image.fromarray(pix.reshape(1, -1, 3), "RGB").quantize(colors=colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    mapped = np.array(Image.fromarray(pix.reshape(1, -1, 3), "RGB").quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGB"))
    out = rgb.copy()
    out[mask] = mapped.reshape(-1, 3)
    return out


def compose_v2(pet_id, item, bg, grid=GRID, shadow=True):
    """Prototype token render. Returns (1024×1024 RGB image, info dict)."""
    cell = CANVAS // grid
    sprite, removed = remove_enclaves(dressed_img(pet_id, item), item)
    sa = np.array(sprite)
    alpha = sa[..., 3] > 127
    cx = body_center_x(alpha)
    ox = int(round((CANVAS / 2 - cx) / cell)) * cell
    oy = OFFSET[1] // cell * cell
    layer = np.zeros((CANVAS, CANVAS, 4), np.uint8)
    layer[oy:oy + DRESSED_H, ox:ox + DRESSED_W] = sa
    op = layer[..., 3] > 127
    # sprite → grid
    s_alpha = op.reshape(grid, cell, grid, cell).mean((1, 3)) >= ALPHA_SHARE
    s_rgb = _quantize(_cell_mode(layer[..., :3], op, cell, DARK_WEIGHT), s_alpha, SPRITE_COLORS)
    # background stays as drawn (task 055: re-gridding broke c06's lines, c01's icons and r07's stars;
    # docs/review/backgrounds.png); only the shadow and the sprite are laid on it in whole grid cells
    b = np.array(bg_img(bg).convert("RGB") if isinstance(bg, str) else Image.new("RGB", (CANVAS, CANVAS), tuple(bg)))
    shade = np.ones((grid, grid))
    # shadow under the feet: 2-tone pixel ellipse, centred on the feet, on the baseline row
    rows = np.nonzero(s_alpha.any(1))[0]
    base = rows.max()
    feet = np.nonzero(s_alpha[base - max(1, grid // 64):base + 1].any(0))[0]
    if shadow and len(feet):
        fx = (feet.min() + feet.max() + 1) / 2
        rx = (feet.max() - feet.min() + 1) / 2 + grid / 64
        ry = max(1.5, rx * 0.16)
        yy, xx = np.mgrid[0:grid, 0:grid]
        d = ((xx + 0.5 - fx) / rx) ** 2 + ((yy + 0.5 - (base + 0.5)) / ry) ** 2
        shade[d <= 1] = SHADOW[0]
        inner = ((xx + 0.5 - fx) / (rx * 0.66)) ** 2 + ((yy + 0.5 - (base + 0.5)) / (ry * 0.66)) ** 2 <= 1
        shade[inner] = SHADOW[1]
    up = lambda m: np.repeat(np.repeat(m, cell, 0), cell, 1)
    out = b.astype(float) * up(shade)[..., None]
    big_alpha = up(s_alpha)
    out[big_alpha] = up(s_rgb)[big_alpha]
    info = {"removed": removed, "center_x": round(cx + ox, 1), "offset": (ox, oy), "grid": grid}
    return Image.fromarray(np.clip(out.round(), 0, 255).astype(np.uint8), "RGB"), info


def head_tilt_deg(pet_id, item):
    """Lean of the face: slope of the row mid-points of the opaque span in the 25–50% band of the sprite's
    height (under hats and ears, above the arms). Positive = leans right."""
    alpha = np.array(dressed_img(pet_id, item))[..., 3] > 127
    ys = np.nonzero(alpha.any(1))[0]
    top, h = ys.min(), ys.max() - ys.min()
    pts = []
    for y in range(int(top + 0.25 * h), int(top + 0.5 * h)):
        xs = np.nonzero(alpha[y])[0]
        if len(xs):
            pts.append((y, (xs.min() + xs.max()) / 2))
    p = np.array(pts)
    slope = np.polyfit(p[:, 0], p[:, 1], 1)[0]
    return float(np.degrees(np.arctan(slope)))

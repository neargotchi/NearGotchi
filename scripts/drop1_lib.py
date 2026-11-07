"""Shared drop-1 compose code (docs/PLAN-COLLECTION.md §2–3).
Used by check_anchors.py and (task C) compose_drop1.py; anchor-tuner.html mirrors place() in JS.
Coordinates in data/anchors.json are nft.png canvas pixels (601×762)."""
import json, math, os
from functools import lru_cache
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CANVAS = 1024
PET_W, PET_H, PET_BASELINE = 601, 762, 746      # shared nft.png canvas + baseline row
BASELINE_Y = 960                                 # where the pet baseline lands on the 1024 canvas
PET_OFFSET = ((CANVAS - PET_W) // 2, BASELINE_Y - PET_BASELINE)  # (211, 214), 1× native
SLOTS = ["head", "eyes", "neck", "body", "back"]
Z_ORDER = ["back", "pet", "body", "neck", "eyes", "head"]           # bottom → top
ALIGN = {"top": (0.5, 0.0), "center": (0.5, 0.5), "bottom": (0.5, 1.0)}
PETS = {  # mirrors lib/mocks.ts `pets`
    "pet1": {"name": "batman", "species": "corgi"},
    "pet2": {"name": "nightshade", "species": "dragon"},
    "pet3": {"name": "merk", "species": "meerkat"},
}


def path(*p):
    return os.path.join(ROOT, *p)


@lru_cache(None)
def items():
    """{item_id: slot} from public/items/<slot>/<id>.png (the 14 wardrobe items)."""
    out = {}
    for slot in SLOTS:
        for f in sorted(os.listdir(path("public", "items", slot))):
            if f.endswith(".png"):
                out[f[:-4]] = slot
    return out


@lru_cache(None)
def backgrounds():
    """{bg_id: tier} from assets-raw/backgrounds/<prefix><nn>-<name>.png."""
    tiers = {"c": "common", "r": "rare", "e": "epic", "l": "legendary"}
    return {f[:-4]: tiers[f[0]] for f in sorted(os.listdir(path("assets-raw", "backgrounds"))) if f.endswith(".png")}


@lru_cache(None)
def load_anchors():
    with open(path("data", "anchors.json")) as fh:
        return json.load(fh)


@lru_cache(None)
def _img(rel):
    return Image.open(path(rel)).convert("RGBA")


def pet_img(pet_id):
    return _img(f"public/pets/{pet_id}/nft.png")


def item_img(item_id):
    return _img(f"public/items/{items()[item_id]}/{item_id}.png")


def bg_img(bg_id):
    return _img(f"assets-raw/backgrounds/{bg_id}.png")


def rnd(v):
    """Round half up, like JS Math.round (anchor-tuner.html must match pixel for pixel)."""
    return math.floor(v + 0.5)


def placement(pet_id, item_id, anchors=None):
    """-> (x, y, w, h) of the scaled item in nft.png canvas coords.
    Slot anchor = where the item's align point lands; overrides: "<item>" (all pets) then "<pet>:<item>",
    each may add dx/dy and multiply scale."""
    a = anchors or load_anchors()
    slot = items()[item_id]
    base = a[pet_id][slot]
    x, y, s = base["x"], base["y"], base["scale"]
    ax, ay = ALIGN[base.get("align", "center")]
    for key in (item_id, f"{pet_id}:{item_id}"):
        o = a.get("overrides", {}).get(key)
        if o:
            x += o.get("dx", 0); y += o.get("dy", 0); s *= o.get("scale", 1)
            if "align" in o:
                ax, ay = ALIGN[o["align"]]
    src = item_img(item_id)
    w, h = max(1, rnd(src.width * s)), max(1, rnd(src.height * s))
    return rnd(x - ax * w), rnd(y - ay * h), w, h


def compose(pet_id, accessories, bg, anchors=None):
    """accessories: {slot: item_id}; bg: background id, an RGB(A) tuple, or an Image (1024²).
    Returns a 1024×1024 RGB image. Pet at 1× native, items NEAREST-scaled, fixed z-order."""
    if isinstance(bg, str):
        canvas = bg_img(bg).copy()
    elif isinstance(bg, Image.Image):
        canvas = bg.convert("RGBA").copy()
    else:
        canvas = Image.new("RGBA", (CANVAS, CANVAS), tuple(bg) + (255,) * (4 - len(bg)))
    by_slot = {items()[i]: i for i in accessories.values()}
    assert len(by_slot) == len(accessories), "max 1 item per slot"
    ox, oy = PET_OFFSET
    for layer in Z_ORDER:
        if layer == "pet":
            canvas.alpha_composite(pet_img(pet_id), (ox, oy))
        elif layer in by_slot:
            item_id = by_slot[layer]
            x, y, w, h = placement(pet_id, item_id, anchors)
            im = item_img(item_id).resize((w, h), Image.NEAREST)
            layer_img = Image.new("RGBA", canvas.size)
            layer_img.paste(im, (ox + x, oy + y))   # paste clips safely at canvas edges
            canvas.alpha_composite(layer_img)
    return canvas.convert("RGB")


def compose_token(token, anchors=None):
    return compose(token["petId"], token["accessories"], token["background"], anchors)

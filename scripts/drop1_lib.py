"""Shared drop-1 compose code (docs/PLAN-COLLECTION.md, "Update: dressed poses").
Each token = background (1024²) + one dressed pose public/pets/<pet>/dressed/<item>.png (720×900, feet on y=880),
pasted 1× (no resampling) at (152, 80) so the feet land on y=960. Used by build_manifest.py, compose_drop1.py,
build_metadata.py and contact_sheet.py.
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
    """bg: background id or an RGB tuple. Returns the 1024×1024 RGB token image (no scaling anywhere)."""
    canvas = bg_img(bg).copy() if isinstance(bg, str) else Image.new("RGBA", (CANVAS, CANVAS), tuple(bg) + (255,))
    canvas.alpha_composite(dressed_img(pet_id, item), OFFSET)
    return canvas.convert("RGB")


def compose_token(token):
    return compose(token["petId"], token["accessory"], token["background"])

"""Share images for /nft/[id] (task 046, docs/DEVLOG.md decision 2 = A): one 1200×630 card per drop-1 token.

Layout: tier colour background with the site's pixel grid, the token art (public/drop1/{id}.webp, 512² 1:1)
in an ink frame with a hard shadow on the left; logo + "NEARGOTCHI", the token name, "#id of 300", the tier
tag and "drop 1 · demo" on the right. Legendary gets rainbow pixel stripes. Fonts: assets-raw/fonts (Press
Start 2P + Space Grotesk, OFL). Deterministic: same inputs → same bytes. Written as JPEG (q 80, 4:2:0) because
PNG cards of the detailed art weigh > 80 KB.

  python3 scripts/build_og.py            # all 300 → public/og/drop1/{id}.jpg
  python3 scripts/build_og.py 1 181      # only these ids
"""
import json
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L  # noqa: E402
from build_metadata import WEARING  # noqa: E402  ("a cap", "a top hat", "headphones", …)

W, H = 1200, 630
INK = (20, 20, 20)
CREAM = (255, 246, 229)
OUT = L.path("public", "og", "drop1")
TIER_BG = {"common": (221, 213, 195), "rare": (255, 179, 64), "epic": (199, 155, 255), "legendary": (255, 208, 74)}
RAINBOW = [(208, 52, 44), (255, 159, 46), (255, 212, 59), (0, 184, 119), (77, 171, 247), (123, 63, 214)]

PIXEL = ImageFont.truetype(L.path("assets-raw", "fonts", "PressStart2P-latin.woff2"), 40)
PIXEL_S = ImageFont.truetype(L.path("assets-raw", "fonts", "PressStart2P-latin.woff2"), 22)
PIXEL_XS = ImageFont.truetype(L.path("assets-raw", "fonts", "PressStart2P-latin.woff2"), 18)
SANS = ImageFont.truetype(L.path("assets-raw", "fonts", "SpaceGrotesk-latin.woff2"), 30)


def darker(rgb, k=0.78):
    return tuple(int(c * k) for c in rgb)


def card(token, total):
    tier = token["tier"]
    bg = TIER_BG[tier]
    im = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(im)
    # pixel grid like the site's sections (every 48px, 2px lines)
    grid = darker(bg, 0.93)
    for x in range(0, W, 48):
        d.rectangle([x, 0, x + 1, H], fill=grid)
    for y in range(0, H, 48):
        d.rectangle([0, y, W, y + 1], fill=grid)
    # top / bottom stripes: rainbow for legendary, a darker band otherwise
    for y0 in (0, H - 18):
        if tier == "legendary":
            band = W // len(RAINBOW) + 1
            for i, c in enumerate(RAINBOW):
                d.rectangle([i * band, y0, (i + 1) * band, y0 + 17], fill=c)
        else:
            d.rectangle([0, y0, W, y0 + 17], fill=darker(bg))
    # token art: 512² at 1:1, ink frame + 12px hard shadow
    art = Image.open(L.path("public", "drop1", f"{token['tokenId']}.webp")).convert("RGB")
    ax, ay = 60, (H - 512) // 2
    d.rectangle([ax + 12, ay + 12, ax + 512 + 12 + 5, ay + 512 + 12 + 5], fill=INK)
    d.rectangle([ax - 6, ay - 6, ax + 512 + 5, ay + 512 + 5], fill=INK)
    im.paste(art, (ax, ay))
    # right column
    x = 640
    logo = Image.open(L.path("public", "logo-transparent.png")).convert("RGBA").resize((88, 88), Image.NEAREST)
    im.paste(logo, (x - 6, 70), logo)
    d.text((x + 96, 104), "NEARGOTCHI", font=PIXEL_S, fill=INK)
    name, number = token["name"].rsplit(" ", 1)
    d.text((x, 214), name, font=PIXEL, fill=INK)
    d.text((x, 270), number, font=PIXEL, fill=INK)
    d.text((x, 340), f"#{token['tokenId']:03d} of {total} · {token['species']}", font=SANS, fill=INK)
    d.text((x, 380), f"wearing {WEARING[token['accessory']]}", font=SANS, fill=INK)
    # tier tag: cream box, ink border, pixel label
    label = tier
    tw = d.textlength(label, font=PIXEL_S)
    d.rectangle([x + 6, 448 + 6, x + tw + 36 + 6, 448 + 52 + 6], fill=INK)
    d.rectangle([x, 448, x + tw + 36, 448 + 52], fill=CREAM, outline=INK, width=4)
    d.text((x + 18, 463), label, font=PIXEL_S, fill=INK)
    d.text((x, 542), "drop 1 · demo, not on chain", font=PIXEL_XS, fill=INK)
    return im


def main():
    with open(L.path("data", "collection-drop1.json")) as fh:
        manifest = json.load(fh)
    tokens = manifest["tokens"]
    wanted = {int(a) for a in sys.argv[1:]}
    os.makedirs(OUT, exist_ok=True)
    sizes = []
    for t in tokens:
        if wanted and t["tokenId"] not in wanted:
            continue
        path = os.path.join(OUT, f"{t['tokenId']}.jpg")
        card(t, manifest["count"]).save(path, "JPEG", quality=80, optimize=True, progressive=False, subsampling=2)
        sizes.append(os.path.getsize(path))
    if sizes:
        print(f"ok: {len(sizes)} cards → {os.path.relpath(OUT, L.ROOT)}, "
              f"avg {sum(sizes) / len(sizes) / 1024:.0f} KB, max {max(sizes) / 1024:.0f} KB, total {sum(sizes) / 1048576:.1f} MB")


if __name__ == "__main__":
    main()

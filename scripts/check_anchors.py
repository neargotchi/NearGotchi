"""Anchor check sheet → docs/anchors-check.png (docs/PLAN-COLLECTION.md §2, task 032).
Everything is drawn with drop1_lib.compose(), the same code the 300 renders will use.
  1. single items: 3 pets × 14 items on a flat mid-tone bg
  2. worst-case stack (headphones + mask + chain + tshirt + cape) per pet on mid / dark / light backgrounds,
     plus halo on l12-legendary-glow
  3. 9 real tokens from data/collection-drop1.json (per pet: first common, rare, legendary by id), full 1024 frame
Run: python3 scripts/check_anchors.py"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L

OUT = L.path("docs", "anchors-check.png")
MID = (118, 128, 148)
STACK = {"head": "headphones", "eyes": "mask", "neck": "chain", "body": "tshirt", "back": "cape"}
STACK_BGS = [("mid", "c01-lcd-dots"), ("dark", "r07-night-pixel"), ("dark", "e11-cosmic"),
             ("light", "c05-soft-sky"), ("light", "c06-cream-grid")]
CROP = (132, 0, 892, 1000)          # pet region of the 1024 frame (keeps tall hats and the baseline)
CELL = (304, 400)                   # CROP / 2.5
FULL = 400                          # full-frame thumbnail
GAP, PAD, HEAD_H, LBL = 8, 24, 56, 28   # LBL: label strip above each cell
BG, INK, MUTED = (24, 26, 32), (240, 240, 235), (160, 165, 175)
font = ImageFont.load_default(size=20)
font_h = ImageFont.load_default(size=30)


def cell(img, box=CROP, size=CELL):
    return img.crop(box).resize(size, Image.BOX)


def label(d, x, y, text, w):
    d.rectangle([x, y, x + w - 1, y + LBL - 1], fill=(0, 0, 0))
    d.text((x + 6, y + 3), text, font=font, fill=INK)


def main():
    with open(L.path("data", "collection-drop1.json")) as fh:
        tokens = json.load(fh)["tokens"]
    pets, item_ids = list(L.PETS), sorted(L.items(), key=lambda i: (L.SLOTS.index(L.items()[i]), i))
    cw, ch = CELL
    width = PAD * 2 + len(item_ids) * (cw + GAP)
    rows = []   # (kind, payload) collected first so the sheet height is exact

    # 1. singles
    rows.append(("h", "1 - single items on a flat mid bg (3 pets x 14 items). z-order: back < pet < body < neck < eyes < head"))
    for p in pets:
        rows.append(("cells", [(f"{p} {L.PETS[p]['name']} - {it}", cell(L.compose(p, {L.items()[it]: it}, MID)))
                               for it in item_ids]))
    # 2. worst-case stack + halo on l12
    rows.append(("h", "2 - worst-case stack (headphones + mask + chain + tshirt + cape) on mid / dark / light. last column: halo on l12"))
    for p in pets:
        r = [(f"{p} - {tone} - {bg}", cell(L.compose(p, STACK, bg))) for tone, bg in STACK_BGS]
        r.append((f"{p} - halo - l12-legendary-glow", cell(L.compose(p, {"head": "halo"}, "l12-legendary-glow"))))
        rows.append(("cells", r))
    # 3. sample tokens
    rows.append(("h", "3 - real tokens from data/collection-drop1.json (first common / rare / legendary per pet), full 1024 frame"))
    samples = []
    for p in pets:
        for tier in ("common", "rare", "legendary"):
            t = next(t for t in tokens if t["petId"] == p and t["tier"] == tier)
            samples.append((f"#{t['tokenId']:03d} {t['pet']} - {tier} - {t['background']}",
                            "+".join(t["accessories"].values()),
                            L.compose_token(t).resize((FULL, FULL), Image.BOX)))
    rows.append(("full", samples))

    height = PAD
    for kind, payload in rows:
        height += HEAD_H if kind == "h" else (LBL + ch + GAP if kind == "cells" else LBL + FULL + 30 + GAP)
    width = max(width, PAD * 2 + 9 * (FULL + GAP))
    sheet = Image.new("RGB", (width, height + PAD), BG)
    d = ImageDraw.Draw(sheet)
    y = PAD
    for kind, payload in rows:
        if kind == "h":
            d.text((PAD, y + 14), payload, font=font_h, fill=INK)
            y += HEAD_H
        elif kind == "cells":
            for i, (text, im) in enumerate(payload):
                x = PAD + i * (cw + GAP)
                label(d, x, y, text, cw); sheet.paste(im, (x, y + LBL))
            y += LBL + ch + GAP
        else:
            for i, (text, acc, im) in enumerate(payload):
                x = PAD + i * (FULL + GAP)
                label(d, x, y, text, FULL); sheet.paste(im, (x, y + LBL))
                d.text((x + 4, y + LBL + FULL + 4), acc, font=font, fill=MUTED)
            y += LBL + FULL + 30 + GAP
    sheet.save(OUT, optimize=True)
    print(f"{os.path.relpath(OUT, L.ROOT)} {sheet.size[0]}×{sheet.size[1]}, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()

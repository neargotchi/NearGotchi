"""Contact sheet of all drop-1 tokens → docs/drop1-preview.png (docs/PLAN-COLLECTION.md §5).
Sections legendary → epic → rare → common; inside a section sorted by pet, then background; label = token id.
Reads public/drop1/{id}.webp (run compose_drop1.py first). Run: python3 scripts/contact_sheet.py"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L

OUT = L.path("docs", "drop1-preview.png")
COLS, THUMB, GAP, PAD, LBL, HEAD = 20, 128, 6, 20, 22, 48
BG, INK, MUTED = (24, 26, 32), (240, 240, 235), (160, 165, 175)
font, font_h = ImageFont.load_default(size=16), ImageFont.load_default(size=26)


def main():
    with open(L.path("data", "collection-drop1.json")) as fh:
        tokens = json.load(fh)["tokens"]
    pet_order = list(L.PETS)
    sections = []
    for tier in reversed(L.TIERS):
        ts = sorted((t for t in tokens if t["tier"] == tier), key=lambda t: (pet_order.index(t["petId"]), t["background"], t["tokenId"]))
        sections.append((tier, ts))
    cell_h = THUMB + LBL
    width = PAD * 2 + COLS * THUMB + (COLS - 1) * GAP
    height = PAD + sum(HEAD + -(-len(ts) // COLS) * (cell_h + GAP) for _, ts in sections) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    d = ImageDraw.Draw(sheet)
    y = PAD
    for tier, ts in sections:
        per_pet = ", ".join(f"{L.PETS[p]['name']} {sum(t['petId'] == p for t in ts)}" for p in pet_order)
        d.text((PAD, y + 12), f"{tier} - {len(ts)}   ({per_pet})", font=font_h, fill=INK)
        y += HEAD
        for i, t in enumerate(ts):
            x, yy = PAD + (i % COLS) * (THUMB + GAP), y + (i // COLS) * (cell_h + GAP)
            im = Image.open(L.path("public", "drop1", f"{t['tokenId']}.webp")).convert("RGB").resize((THUMB, THUMB), Image.BOX)
            sheet.paste(im, (x, yy))
            d.text((x + 2, yy + THUMB + 3), f"#{t['tokenId']:03d} {t['accessory']}", font=font, fill=MUTED)
        y += -(-len(ts) // COLS) * (cell_h + GAP)
    sheet.save(OUT, optimize=True)
    print(f"{os.path.relpath(OUT, L.ROOT)} {width}x{height}, {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    main()

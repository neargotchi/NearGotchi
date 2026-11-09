"""Render drop-1 tokens (docs/PLAN-COLLECTION.md §3, dressed poses since task 033).
  python3 scripts/compose_drop1.py                 render all 300
  python3 scripts/compose_drop1.py --only 1,42,300 render some ids
  python3 scripts/compose_drop1.py --tier legendary
  python3 scripts/compose_drop1.py --check         re-render in memory, compare with metadata/hashes.json
  python3 scripts/compose_drop1.py --proto [--grid 128|256] [--only 3,8]   task 054 render-v2 prototype → docs/review/proto
Outputs: images/drop1/{id}.png (1024, gitignored, pinned to IPFS later), public/drop1/{id}.webp (512, site),
metadata/hashes.json (sha256 of every PNG; media_hash in the metadata is the base64 form of the same digest).
Deterministic only with the pinned Pillow in scripts/requirements.txt."""
import base64, hashlib, io, json, os, sys
from multiprocessing import Pool
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L

PNG_DIR = L.path("images", "drop1")
WEBP_DIR = L.path("public", "drop1")
HASHES = L.path("metadata", "hashes.json")


def load_tokens():
    with open(L.path("data", "collection-drop1.json")) as fh:
        return json.load(fh)["tokens"]


def png_bytes(token):
    buf = io.BytesIO()
    L.compose_token(token).save(buf, "PNG", optimize=True)
    return buf.getvalue()


def render(token):
    tid, data = token["tokenId"], png_bytes(token)
    with open(os.path.join(PNG_DIR, f"{tid}.png"), "wb") as fh:
        fh.write(data)
    small = Image.open(io.BytesIO(data)).resize((512, 512), Image.NEAREST)   # exactly 2× down
    small.save(os.path.join(WEBP_DIR, f"{tid}.webp"), "WEBP", quality=90, method=6)
    return tid, hashlib.sha256(data).hexdigest()


def check(token):
    return token["tokenId"], hashlib.sha256(png_bytes(token)).hexdigest()


def b64(hexdigest):
    return base64.b64encode(bytes.fromhex(hexdigest)).decode()


PROTO_DIR = L.path("docs", "review", "proto")
PROTO_IDS = [3, 8, 21, 39, 56, 2, 11, 12, 15, 41, 18, 36]


def proto(args):
    """Render v1 vs v2 for some tokens (tasks 054–055): docs/review/proto/{id}.png + docs/review/before-after.png.
    Never touches images/drop1, public/drop1, metadata or hashes."""
    from PIL import ImageDraw
    grid = int(args[args.index("--grid") + 1]) if "--grid" in args else L.GRID
    ids = [int(x) for x in args[args.index("--only") + 1].split(",")] if "--only" in args else PROTO_IDS
    by_id = {t["tokenId"]: t for t in load_tokens()}
    os.makedirs(PROTO_DIR, exist_ok=True)
    rows = []
    for tid in ids:
        t = by_id[tid]
        after, info = L.compose_v2(t["petId"], t["accessory"], t["background"], grid=grid)
        after.save(os.path.join(PROTO_DIR, f"{tid}.png"), optimize=True)
        before = L.compose(t["petId"], t["accessory"], t["background"])   # render v1
        rows.append((tid, t, before, after, info))
        print(f"  #{tid} {t['petId']}/{t['accessory']} on {t['background']}: body centre x {info['center_x']}, enclave px {info['removed']}")
    # before | after, 384 px each (nearest), red line at the canvas centre
    s, pad, head = 384, 8, 22
    sheet = Image.new("RGB", (pad + 2 * (s + pad), head + len(rows) * (s + pad) + pad), "white")
    d = ImageDraw.Draw(sheet)
    d.text((pad, 4), f"before | after (render v2, grid {grid}×{grid}, x{L.CANVAS // grid}); red = canvas centre", fill="black")
    for r, (tid, t, before, after, info) in enumerate(rows):
        y = head + r * (s + pad)
        for c, im in enumerate((before, after)):
            x = pad + c * (s + pad)
            sheet.paste(im.resize((s, s), Image.NEAREST), (x, y))
            d.line([(x + s // 2, y), (x + s // 2, y + s - 1)], fill=(255, 0, 0), width=1)
            d.text((x + 4, y + 4), f"#{tid} {L.PETS[t['petId']]['name']} · {t['accessory']}" + ("" if c == 0 else " · v2"), fill=(255, 0, 0))
    sheet.save(L.path("docs", "review", "before-after.png"), optimize=True)
    # enclaves + lean over every dressed pose
    print("enclaves removed (all dressed poses):")
    for pet in L.PETS:
        for item in L.items():
            _, n = L.remove_enclaves(L.dressed_img(pet, item), item)
            if n:
                print(f"  {pet}/{item}: {n} px")
    leans = [(pet, item, L.head_tilt_deg(pet, item)) for pet in L.PETS for item in L.items()]
    tilted = [f"{p}/{i} {a:+.1f}°" for p, i, a in leans if abs(a) > 2]
    print("lean > 2°:", ", ".join(tilted) if tilted else "none", f"(max {max(abs(a) for *_, a in leans):.1f}°)")
    print(f"wrote {len(rows)} → docs/review/proto/*.png + docs/review/before-after.png")


def main():
    tokens, args = load_tokens(), sys.argv[1:]
    if "--proto" in args:
        proto(args)
        return
    if "--only" in args:
        ids = {int(x) for x in args[args.index("--only") + 1].split(",")}
        tokens = [t for t in tokens if t["tokenId"] in ids]
    if "--tier" in args:
        tokens = [t for t in tokens if t["tier"] == args[args.index("--tier") + 1]]
    os.makedirs(PNG_DIR, exist_ok=True); os.makedirs(WEBP_DIR, exist_ok=True); os.makedirs(os.path.dirname(HASHES), exist_ok=True)
    hashes = {}
    if os.path.exists(HASHES):
        with open(HASHES) as fh:
            hashes = json.load(fh)
    with Pool() as pool:
        if "--check" in args:
            bad = [tid for tid, h in pool.imap_unordered(check, tokens) if hashes.get(str(tid)) != h]
            if bad:
                sys.exit(f"FAIL: {len(bad)} renders differ from metadata/hashes.json: {sorted(bad)[:20]}")
            print(f"ok: {len(tokens)} renders match metadata/hashes.json")
            return
        for n, (tid, h) in enumerate(pool.imap_unordered(render, tokens), 1):
            hashes[str(tid)] = h
            if n % 25 == 0 or n == len(tokens):
                print(f"  {n}/{len(tokens)}", flush=True)
    with open(HASHES, "w") as fh:
        json.dump(dict(sorted(hashes.items(), key=lambda kv: int(kv[0]))), fh, indent=0)
        fh.write("\n")
    print(f"rendered {len(tokens)} → images/drop1/*.png + public/drop1/*.webp, hashes in metadata/hashes.json")


if __name__ == "__main__":
    main()

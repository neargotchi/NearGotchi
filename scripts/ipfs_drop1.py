"""Drop 1 → IPFS (docs/MAINNET-RUNBOOK.md §4). Nothing here talks to the network except `verify-url`, which only
reads (GET) from a gateway. Upload is done by the owner on Pinata.

  python3 scripts/ipfs_drop1.py prepare            → ipfs/drop1/{id}.png + {id}.json (gitignored), checks every hash
  python3 scripts/ipfs_drop1.py verify-dir [DIR]   → re-checks a folder (default ipfs/drop1) against metadata/drop1
  python3 scripts/ipfs_drop1.py verify-url BASE [N] → downloads N tokens (default 12 + #1 + #300) from BASE
                                                     (e.g. https://gateway.pinata.cloud/ipfs/<CID>/) and checks them

What has to match: every token's on-chain `media` is "{id}.png" and `media_hash` is base64(sha256 of that PNG,
images/drop1/{id}.png, 1024 px). The wallet resolves base_uri + media, so the folder uploaded under the CID must
hold exactly these 300 PNGs at its root. The {id}.json files next to them are the same NEP-177 metadata the
contract stores (for people who browse the folder); the contract doesn't reference them (reference = null).
"""
import base64, hashlib, json, os, random, shutil, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, "metadata", "drop1")
IMAGES = os.path.join(ROOT, "images", "drop1")
OUT = os.path.join(ROOT, "ipfs", "drop1")
TOTAL = 300


def b64sha(data: bytes) -> str:
    return base64.b64encode(hashlib.sha256(data).digest()).decode()


def token_meta(tid: int) -> dict:
    with open(os.path.join(META, f"{tid}.json")) as fh:
        return json.load(fh)


def check(tid: int, png: bytes, errs: list):
    meta = token_meta(tid)
    if meta["media"] != f"{tid}.png":
        errs.append(f"#{tid}: media is {meta['media']!r}, expected '{tid}.png'")
    if b64sha(png) != meta["media_hash"]:
        errs.append(f"#{tid}: sha256 {b64sha(png)} != media_hash {meta['media_hash']}")
    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        errs.append(f"#{tid}: not a PNG")


def prepare():
    errs = []
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    total_bytes = 0
    for tid in range(1, TOTAL + 1):
        src = os.path.join(IMAGES, f"{tid}.png")
        if not os.path.exists(src):
            errs.append(f"#{tid}: missing {src}")
            continue
        with open(src, "rb") as fh:
            png = fh.read()
        check(tid, png, errs)
        shutil.copyfile(src, os.path.join(OUT, f"{tid}.png"))
        shutil.copyfile(os.path.join(META, f"{tid}.json"), os.path.join(OUT, f"{tid}.json"))
        total_bytes += len(png)
    if errs:
        print("\n".join(errs[:20]))
        sys.exit(f"FAILED: {len(errs)} problems")
    files = sorted(os.listdir(OUT))
    assert len(files) == 2 * TOTAL, len(files)
    print(f"ok: {OUT} — 300 PNG ({total_bytes / 1e6:.1f} MB) + 300 JSON, every PNG matches its media_hash")
    print("next: upload the FOLDER ipfs/drop1 to Pinata (as a folder, not 600 single files), note the CID,")
    print("      then: python3 scripts/ipfs_drop1.py verify-url https://gateway.pinata.cloud/ipfs/<CID>/")


def verify_dir(folder: str):
    errs = []
    for tid in range(1, TOTAL + 1):
        path = os.path.join(folder, f"{tid}.png")
        if not os.path.exists(path):
            errs.append(f"#{tid}: missing")
            continue
        with open(path, "rb") as fh:
            check(tid, fh.read(), errs)
    if errs:
        print("\n".join(errs[:20]))
        sys.exit(f"FAILED: {len(errs)} problems")
    print(f"ok: {folder} — all 300 PNG match media_hash")


def verify_url(base: str, n: int):
    if not base.endswith("/"):
        base += "/"
    ids = sorted({1, TOTAL, *random.sample(range(2, TOTAL), n)})
    errs = []
    for tid in ids:
        url = f"{base}{tid}.png"
        req = urllib.request.Request(url, headers={"User-Agent": "neargotchi-verify"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                png = resp.read()
        except Exception as error:  # noqa: BLE001 — report and continue
            errs.append(f"#{tid}: {url} → {error}")
            continue
        before = len(errs)
        check(tid, png, errs)
        print(f"  #{tid:>3} {'ok' if len(errs) == before else 'MISMATCH'}  {len(png)} B  {url}")
    if errs:
        print("\n".join(errs))
        sys.exit(f"FAILED: {len(errs)} of {len(ids)}")
    print(f"ok: {len(ids)} tokens under {base} match their media_hash")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "prepare":
        prepare()
    elif cmd == "verify-dir":
        verify_dir(sys.argv[2] if len(sys.argv) > 2 else OUT)
    elif cmd == "verify-url" and len(sys.argv) > 2:
        verify_url(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 12)
    else:
        sys.exit(__doc__)

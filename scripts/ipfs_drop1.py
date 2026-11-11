"""Drop 1 → IPFS (docs/MAINNET-RUNBOOK.md §4). Nothing here talks to the network except `verify-url`, which only
reads (GET) from a gateway. Upload is done by the owner on Pinata.

  python3 scripts/ipfs_drop1.py prepare            → ipfs/drop1/{id}.png + {id}.json (gitignored), checks every hash
  python3 scripts/ipfs_drop1.py verify-dir [DIR]   → re-checks a folder (default ipfs/drop1) against metadata/drop1
  python3 scripts/ipfs_drop1.py cid [DIR] [EXPECTED] → the folder's IPFS CID computed locally (kubo CIDv1 defaults), no network
  python3 scripts/ipfs_drop1.py verify-url BASE [N] → downloads N tokens (default 12 + #1 + #300) from BASE
                                                     (e.g. https://gateway.pinata.cloud/ipfs/<CID>/) and checks them
  python3 scripts/ipfs_drop1.py verify-url BASE all → all 300 PNG (sha256 == media_hash) + 300 JSON (== metadata/drop1),
                                                     IPFS_WORKERS (default 4) parallel requests, IPFS_DELAY s (0.25) apart per worker;
                                                     429 → waits (Retry-After, ≥ 30 s), 5 tries

What has to match: every token's on-chain `media` is "{id}.png" and `media_hash` is base64(sha256 of that PNG,
images/drop1/{id}.png, 1024 px). The wallet resolves base_uri + media, so the folder uploaded under the CID must
hold exactly these 300 PNGs at its root. The {id}.json files next to them are the same NEP-177 metadata the
contract stores (for people who browse the folder); the contract doesn't reference them (reference = null).
"""
import base64, hashlib, json, os, random, shutil, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

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


WORKERS = int(os.environ.get("IPFS_WORKERS", "4"))
DELAY = float(os.environ.get("IPFS_DELAY", "0.25"))


def fetch(url: str, tries: int = 5):
    """GET with retries. Gateways rate-limit: on 429 wait (Retry-After, at least 30 s, growing), on other errors 2/4/6… s.
    Returns (body, error, seconds)."""
    error = ""
    for attempt in range(tries):
        start = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "neargotchi-verify"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read(), "", time.time() - start
        except urllib.error.HTTPError as exc:
            error = f"HTTP {exc.code}"
            if exc.code == 429:
                retry = exc.headers.get("Retry-After", "0")
                wait = max(30 * (attempt + 1), int(retry) if retry.isdigit() else 0)
                time.sleep(min(wait, 900))
                continue
        except Exception as exc:  # noqa: BLE001 — report and retry
            error = str(exc)
        time.sleep(2 * (attempt + 1))
    return None, error, 0.0


def verify_url(base: str, n):
    base = base.rstrip("/") + "/"
    ids = list(range(1, TOTAL + 1)) if n == "all" else sorted({1, TOTAL, *random.sample(range(2, TOTAL), int(n))})
    with_json = n == "all"

    done = [0]

    def one(tid):
        time.sleep(DELAY)
        errs, times = [], []
        png, err, sec = fetch(f"{base}{tid}.png")
        if png is None:
            errs.append(f"#{tid}: {tid}.png → {err}")
        else:
            times.append(sec)
            check(tid, png, errs)
        if with_json:
            raw, err, sec = fetch(f"{base}{tid}.json")
            if raw is None:
                errs.append(f"#{tid}: {tid}.json → {err}")
            else:
                times.append(sec)
                try:
                    if json.loads(raw) != token_meta(tid):
                        errs.append(f"#{tid}: {tid}.json differs from metadata/drop1/{tid}.json")
                except ValueError:
                    errs.append(f"#{tid}: {tid}.json is not JSON")
        done[0] += 1
        if done[0] % 50 == 0:
            print(f"  … {done[0]}/{len(ids)} tokens, {time.time() - started:.0f} s", flush=True)
        return tid, errs, times

    started = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(one, ids))
    errs = [e for _, es, _ in results for e in es]
    times = sorted(t for _, _, ts in results for t in ts)
    bad = {tid for tid, es, _ in results if es}
    if times:
        print(f"  requests ok: {len(times)}, per file median {times[len(times) // 2]:.2f} s, p95 {times[int(len(times) * 0.95)]:.2f} s, "
              f"max {times[-1]:.2f} s, total {time.time() - started:.0f} s")
    if errs:
        print("\n".join(errs[:30]))
        sys.exit(f"FAILED: {len(bad)} of {len(ids)} tokens under {base}")
    print(f"ok: {len(ids)} tokens under {base} — PNG sha256 == media_hash" + (", JSON == metadata/drop1" if with_json else ""))


# ---------- local CID (no network): UnixFS import with kubo's CIDv1 defaults ----------
# raw leaves, fixed 256 KiB chunks, balanced DAG (≤ 174 links), sha2-256, plain dag-pb directory (no HAMT for 600
# entries). Matching the CID Pinata reports proves every byte of all 600 files without downloading them.

CHUNK = 262144


def _varint(n: int) -> bytes:
    out = bytearray()
    while True:
        b = n & 0x7F
        n >>= 7
        if n:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def _field(num: int, wire: int, payload) -> bytes:
    key = _varint((num << 3) | wire)
    return key + (_varint(payload) if wire == 0 else _varint(len(payload)) + payload)


def _cid(codec: int, data: bytes) -> bytes:
    return b"\x01" + _varint(codec) + b"\x12\x20" + hashlib.sha256(data).digest()


def _pbnode(links, data: bytes) -> bytes:
    out = b""
    for cid, name, tsize in links:  # PBLink: Hash=1, Name=2, Tsize=3; links come before Data in canonical dag-pb
        link = _field(1, 2, cid) + (_field(2, 2, name.encode()) if name is not None else b"") + _field(3, 0, tsize)
        out += _field(2, 2, link)
    return out + _field(1, 2, data)


def file_node(raw: bytes):
    """(cid bytes, cumulative size) of a file imported with raw leaves."""
    chunks = [raw[i:i + CHUNK] for i in range(0, len(raw), CHUNK)] or [b""]
    leaves = [(_cid(0x55, c), len(c)) for c in chunks]
    if len(leaves) == 1:
        return leaves[0]
    assert len(leaves) <= 174, "needs a deeper balanced tree"
    unixfs = _field(1, 0, 2) + _field(3, 0, len(raw)) + b"".join(_field(4, 0, len(c)) for c in chunks)
    node = _pbnode([(cid, "", size) for cid, size in leaves], unixfs)
    return _cid(0x70, node), len(node) + sum(size for _, size in leaves)


def dir_cid(folder: str) -> str:
    links = []
    for name in sorted(os.listdir(folder), key=lambda n: n.encode()):
        with open(os.path.join(folder, name), "rb") as fh:
            cid, tsize = file_node(fh.read())
        links.append((cid, name, tsize))
    node = _pbnode(links, _field(1, 0, 1))
    raw = _cid(0x70, node)
    return "b" + base64.b32encode(raw).decode().lower().rstrip("=")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "prepare":
        prepare()
    elif cmd == "verify-dir":
        verify_dir(sys.argv[2] if len(sys.argv) > 2 else OUT)
    elif cmd == "cid":
        folder = sys.argv[2] if len(sys.argv) > 2 else OUT
        cid = dir_cid(folder)
        print(cid)
        if len(sys.argv) > 3:
            sys.exit(0 if cid == sys.argv[3] else f"MISMATCH: expected {sys.argv[3]}")
    elif cmd == "verify-url" and len(sys.argv) > 2:
        verify_url(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] == "all" else int(sys.argv[3]) if len(sys.argv) > 3 else 12)
    else:
        sys.exit(__doc__)

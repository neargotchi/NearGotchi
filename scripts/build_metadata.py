"""NEP-177 metadata for drop 1 (docs/PLAN-COLLECTION.md §4; accessory = one dressed item since task 033).
  python3 scripts/build_metadata.py   → metadata/drop1/{id}.json + metadata/drop1/collection.json + lib/drop1-tokens.json
Needs metadata/hashes.json from compose_drop1.py (media_hash = base64 sha256 of images/drop1/{id}.png).
Copy rule: rarity only. The build fails if a title/description talks about value."""
import base64, hashlib, json, os, re, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L

OUT = L.path("metadata", "drop1")
SLIM = L.path("lib", "drop1-tokens.json")   # the site's token list (lib/drop1.ts, docs/DEVLOG.md §1)
SLIM_KEYS = ("tokenId", "petId", "tier", "background", "accessory", "name")
BASE_URI = "ipfs://TODO_CID"   # placeholder: hosting is decided later
WEARING = {"beanie": "a beanie", "cap": "a cap", "chain": "a chain", "crown": "a crown", "halo": "a halo",
           "headphones": "headphones", "keffiyeh": "a keffiyeh", "mask": "a mask", "nerd": "nerd glasses",
           "pixel": "pixel shades", "sunglasses": "sunglasses", "tophat": "a top hat", "tshirt": "a t-shirt"}
BANNED = re.compile(r"value|price|profit|moon|grow|invest|x\d", re.I)


def main():
    manifest_path = L.path("data", "collection-drop1.json")
    with open(manifest_path) as fh:
        manifest = json.load(fh)
    with open(L.path("metadata", "hashes.json")) as fh:
        hashes = json.load(fh)
    tokens, total = manifest["tokens"], manifest["count"]
    os.makedirs(OUT, exist_ok=True)
    errs = []
    for t in tokens:
        tid = t["tokenId"]
        if str(tid) not in hashes:
            errs.append(f"#{tid}: no render hash (run compose_drop1.py)"); continue
        extra = {"pet": t["pet"], "species": t["species"], "background": t["background"], "tier": t["tier"],
                 "accessory": t["accessory"], "drop": manifest["drop"]}
        meta = {
            "title": t["name"],
            "description": f"neargotchi drop {manifest['drop']} · #{tid:03d} of {total} · {t['tier']} {t['species']} "
                           f"wearing {WEARING[t['accessory']]}.",
            "media": f"{tid}.png",
            "media_hash": base64.b64encode(bytes.fromhex(hashes[str(tid)])).decode(),
            "copies": 1, "issued_at": None, "expires_at": None, "starts_at": None, "updated_at": None,
            "extra": json.dumps(extra, separators=(",", ":")),
            "reference": None, "reference_hash": None,
        }
        for field in ("title", "description"):
            if BANNED.search(meta[field]):
                errs.append(f"#{tid}: {field} breaks the copy rule: {meta[field]!r}")
        with open(os.path.join(OUT, f"{tid}.json"), "w") as fh:
            json.dump(meta, fh, indent=2, ensure_ascii=False); fh.write("\n")
    if errs:
        sys.exit("FAIL:\n  " + "\n  ".join(errs))
    with open(manifest_path, "rb") as fh:
        manifest_sha = hashlib.sha256(fh.read()).hexdigest()
    collection = {
        "contract_metadata": {   # NEP-177 NFTContractMetadata draft
            "spec": "nft-1.0.0", "name": "NEARGOTCHI", "symbol": "NGOTCHI", "icon": None,
            "base_uri": BASE_URI, "reference": None, "reference_hash": None,
        },
        "summary": {
            "drop": manifest["drop"], "count": total, "seed": manifest["seed"],
            "manifest": f"data/collection-drop1.json sha256:{manifest_sha}",
            "per_pet_tier": {p: dict(Counter(t["tier"] for t in tokens if t["petId"] == p)) for p in L.PETS},
            "per_background": dict(sorted(Counter(t["background"] for t in tokens).items())),
            "per_accessory": dict(sorted(Counter(t["accessory"] for t in tokens).items())),
        },
    }
    with open(os.path.join(OUT, "collection.json"), "w") as fh:
        json.dump(collection, fh, indent=2); fh.write("\n")
    slim = [{k: t[k] for k in SLIM_KEYS} for t in tokens]
    with open(SLIM, "w") as fh:   # one token per line: small diffs, ~35 KB
        fh.write("[\n" + ",\n".join(json.dumps(t, separators=(",", ":")) for t in slim) + "\n]\n")
    print(f"ok: {len(tokens)} token files + collection.json in metadata/drop1/ (base_uri placeholder {BASE_URI}), "
          f"slim list in {os.path.relpath(SLIM, L.ROOT)}")


if __name__ == "__main__":
    main()

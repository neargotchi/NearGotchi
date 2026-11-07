"""Build + validate the drop-1 manifest (docs/PLAN-COLLECTION.md §1).
  python3 scripts/build_manifest.py           build data/collection-drop1.json + docs/drop1-usage.txt
  python3 scripts/build_manifest.py --check   validate the committed manifest and confirm a rebuild is byte-identical
Config (seed, quotas, exclusions): data/collection-config.json. Same seed + same config + same script → same bytes."""
import hashlib, itertools, json, os, random, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L

CONFIG = L.path("data", "collection-config.json")
OUT = L.path("data", "collection-drop1.json")
USAGE = L.path("docs", "drop1-usage.txt")
TIERS = ["common", "rare", "epic", "legendary"]
FILL_ORDER = ["legendary", "epic", "rare", "common"]  # rarest first; single-item commons even out the spread last


def sha(path, n=12):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:n]


def load_config():
    with open(CONFIG) as fh:
        return json.load(fh)


def excluded(cfg, pet, item_set):
    ex = cfg["exclusions"]
    if any(f"{pet}:{i}" in ex["petItem"] for i in item_set):
        return True
    return any(set(pair) <= set(item_set) for pair in ex["itemPairs"])


def candidate_sets(cfg, pet, k):
    """All k-item sets with distinct slots and no excluded combo, sorted (deterministic)."""
    by_slot = {}
    for item, slot in L.items().items():
        by_slot.setdefault(slot, []).append(item)
    out = []
    for slots in itertools.combinations(L.SLOTS, k):
        for combo in itertools.product(*(sorted(by_slot[s]) for s in slots)):
            s = tuple(sorted(combo))
            if not excluded(cfg, pet, s):
                out.append(s)
    return sorted(out)


def bgs_by_tier():
    out = {t: [] for t in TIERS}
    for bg, tier in L.backgrounds().items():
        out[tier].append(bg)
    return out


def capacity(cfg):
    bgs = bgs_by_tier()
    rows, ok = [], True
    for pet in cfg["pets"]:
        for tier in TIERS:
            cap = len(candidate_sets(cfg, pet, cfg["accessoriesPerTier"][tier])) * len(bgs[tier])
            need = cfg["perPet"][tier]
            ok &= cap >= need
            rows.append(f"  {pet} {tier:<9} capacity {cap:>4}  need {need:>3}  {'ok' if cap >= need else 'TOO LOW'}")
    return ok, rows


def build(cfg):
    seed, bgs, slot_of = cfg["seed"], bgs_by_tier(), L.items()
    tokens = []
    for pet in cfg["pets"]:
        rng = random.Random(f"{seed}:{pet}")
        used, usage = set(), Counter()
        for tier in FILL_ORDER:
            cands = candidate_sets(cfg, pet, cfg["accessoriesPerTier"][tier])
            bg_cycle = sorted(bgs[tier]); rng.shuffle(bg_cycle)   # which bg gets the remainder is seeded
            for i in range(cfg["perPet"][tier]):
                bg = bg_cycle[i % len(bg_cycle)]
                free = [s for s in cands if (bg, s) not in used]
                best = min(sum(usage[it] for it in s) for s in free)
                pick = rng.choice([s for s in free if sum(usage[it] for it in s) == best])
                used.add((bg, pick)); usage.update(pick)
                acc = {slot: it for slot in L.SLOTS for it in pick if slot_of[it] == slot}
                tokens.append({"petId": pet, "pet": L.PETS[pet]["name"], "species": L.PETS[pet]["species"],
                               "tier": tier, "background": bg, "accessories": acc})
    attempt = 0
    while True:   # seeded shuffle + mix guard (no 5 same pet in a row, no legendary in ids 1–10)
        order = tokens[:]
        random.Random(f"{seed}:order:{attempt}").shuffle(order)
        runs = max(len(list(g)) for _, g in itertools.groupby(t["petId"] for t in order))
        if runs < 5 and all(t["tier"] != "legendary" for t in order[:10]):
            break
        attempt += 1
    out = []
    for n, t in enumerate(order, 1):
        out.append({"tokenId": n, **t, "name": f"{t['pet']} #{n:03d}"})
    return attempt, out


def serialize(cfg, attempt, tokens):
    head = {"drop": cfg["drop"], "seed": cfg["seed"], "orderAttempt": attempt, "count": len(tokens),
            "generator": f"scripts/build_manifest.py sha256:{sha(__file__)}",
            "config": f"data/collection-config.json sha256:{sha(CONFIG)}",
            "exclusions": cfg["exclusions"]}
    lines = ["{"] + [f"  {json.dumps(k)}: {json.dumps(v)}," for k, v in head.items()] + ['  "tokens": [']
    lines += [f"    {json.dumps(t)}{',' if i < len(tokens) - 1 else ''}" for i, t in enumerate(tokens)]
    return "\n".join(lines + ["  ]", "}", ""])


def validate(cfg, tokens):
    errs, slot_of, bgs = [], L.items(), L.backgrounds()
    if [t["tokenId"] for t in tokens] != list(range(1, sum(cfg["perPet"].values()) * len(cfg["pets"]) + 1)):
        errs.append("tokenIds are not exactly 1..N")
    counts = Counter((t["petId"], t["tier"]) for t in tokens)
    for pet in cfg["pets"]:
        for tier in TIERS:
            if counts[(pet, tier)] != cfg["perPet"][tier]:
                errs.append(f"{pet} {tier}: {counts[(pet, tier)]} != {cfg['perPet'][tier]}")
    seen = set()
    for t in tokens:
        tid, acc = t["tokenId"], t["accessories"]
        if bgs.get(t["background"]) != t["tier"]:
            errs.append(f"#{tid}: background {t['background']} is not {t['tier']}")
        if len(acc) != cfg["accessoriesPerTier"][t["tier"]]:
            errs.append(f"#{tid}: {len(acc)} accessories for {t['tier']}")
        if any(slot_of.get(it) != slot for slot, it in acc.items()):
            errs.append(f"#{tid}: item in wrong slot {acc}")
        key = (t["petId"], t["background"], tuple(sorted(acc.values())))
        if key in seen:
            errs.append(f"#{tid}: duplicate background + accessory set for {t['petId']}")
        seen.add(key)
        if excluded(cfg, t["petId"], tuple(acc.values())):
            errs.append(f"#{tid}: excluded combo {acc}")
        if t["name"] != f"{L.PETS[t['petId']]['name']} #{tid:03d}":
            errs.append(f"#{tid}: name {t['name']}")
    for pet in cfg["pets"]:   # spread over head+eyes items: overall ≤ 3, within a slot ≤ 2
        # single-item slots (neck/body/back) are report-only: exclusions can force them into most 3-item sets
        allowed = [i for i in slot_of if f"{pet}:{i}" not in cfg["exclusions"]["petItem"] and slot_of[i] in ("head", "eyes")]
        use = Counter(it for t in tokens if t["petId"] == pet for it in t["accessories"].values())
        vals = [use[i] for i in allowed]
        if max(vals) - min(vals) > 3:
            errs.append(f"{pet}: item spread {min(vals)}..{max(vals)} (> 3)")
        for slot in ("head", "eyes"):
            v = [use[i] for i in allowed if slot_of[i] == slot]
            if v and max(v) - min(v) > 2:
                errs.append(f"{pet}: {slot} spread {min(v)}..{max(v)} (> 2)")
    return errs


def usage_report(cfg, tokens, cap_rows):
    slot_of = L.items()
    lines = [f"drop 1 usage — seed {cfg['seed']}, {len(tokens)} tokens (generated by scripts/build_manifest.py)", "",
             "capacity (bg × valid accessory sets, after exclusions):"] + cap_rows + [""]
    for pet in cfg["pets"]:
        pt = [t for t in tokens if t["petId"] == pet]
        lines.append(f"{pet} ({L.PETS[pet]['name']}): " + ", ".join(f"{tier} {sum(t['tier'] == tier for t in pt)}" for tier in TIERS))
        lines.append(f"  {'item':<12}{'slot':<6}" + "".join(f"{t[:4]:>6}" for t in TIERS) + f"{'total':>7}")
        for item in sorted(slot_of, key=lambda i: (L.SLOTS.index(slot_of[i]), i)):
            row = [sum(item in t["accessories"].values() for t in pt if t["tier"] == tier) for tier in TIERS]
            lines.append(f"  {item:<12}{slot_of[item]:<6}" + "".join(f"{n:>6}" for n in row) + f"{sum(row):>7}")
        bgc = Counter(t["background"] for t in pt)
        lines.append("  backgrounds: " + ", ".join(f"{b} {bgc[b]}" for b in sorted(L.backgrounds())))
        lines.append("")
    tiers = Counter(t["tier"] for t in tokens)
    lines.append("all pets: " + ", ".join(f"{t} {tiers[t]}" for t in TIERS))
    return "\n".join(lines) + "\n"


def main():
    cfg = load_config()
    ok, cap_rows = capacity(cfg)
    print("\n".join(["capacity:"] + cap_rows))
    if not ok:
        sys.exit("FAIL: capacity below quota after exclusions")
    attempt, tokens = build(cfg)
    text = serialize(cfg, attempt, tokens)
    if "--check" in sys.argv:
        with open(OUT) as fh:
            committed = fh.read()
        tokens = json.loads(committed)["tokens"]
        errs = validate(cfg, tokens)
        if committed != text:
            errs.append("committed manifest differs from a fresh build (seed/config/script changed?)")
    else:
        errs = validate(cfg, tokens)
        if not errs:
            os.makedirs(os.path.dirname(OUT), exist_ok=True)
            with open(OUT, "w") as fh:
                fh.write(text)
    if errs:
        sys.exit("FAIL:\n  " + "\n  ".join(errs))
    with open(USAGE, "w") as fh:
        fh.write(usage_report(cfg, tokens, cap_rows))
    print(f"ok: {len(tokens)} tokens, seed {cfg['seed']}, order attempt {attempt} → "
          f"{os.path.relpath(OUT, L.ROOT)}, {os.path.relpath(USAGE, L.ROOT)}")


if __name__ == "__main__":
    main()

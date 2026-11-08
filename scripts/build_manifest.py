"""Build + validate the drop-1 manifest (docs/PLAN-COLLECTION.md, rules updated by task 033: one dressed accessory).
  python3 scripts/build_manifest.py           build data/collection-drop1.json + docs/drop1-usage.txt
  python3 scripts/build_manifest.py --check   validate the committed manifest and confirm a rebuild is byte-identical
Config (seed, quotas, exclusions.petItem / exclusions.petBackground): data/collection-config.json. Same seed + same config + same script → same bytes."""
import hashlib, itertools, json, os, random, sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import drop1_lib as L

CONFIG = L.path("data", "collection-config.json")
OUT = L.path("data", "collection-drop1.json")
USAGE = L.path("docs", "drop1-usage.txt")
TIERS = L.TIERS
FILL_ORDER = ["legendary", "epic", "rare", "common"]  # rarest first; commons (most bg × item room) even out the spread


def sha(path, n=12):
    with open(path, "rb") as fh:
        return hashlib.sha256(fh.read()).hexdigest()[:n]


def load_config():
    with open(CONFIG) as fh:
        return json.load(fh)


def allowed_items(cfg, pet):
    return [i for i in L.items() if f"{pet}:{i}" not in cfg["exclusions"]["petItem"]]


def bg_excluded(cfg, pet, bg):
    return [pet, bg] in cfg["exclusions"].get("petBackground", [])


def bgs_by_tier(cfg, pet):
    """{tier: [bg]} this pet may sit on, after exclusions.petBackground (task 034: pet2 × r09-near-green)."""
    out = {t: [] for t in TIERS}
    for bg, tier in L.backgrounds().items():
        if not bg_excluded(cfg, pet, bg):
            out[tier].append(bg)
    return out


def capacity(cfg):
    rows, ok = [], True
    for pet in cfg["pets"]:
        bgs = bgs_by_tier(cfg, pet)
        for tier in TIERS:
            cap, need = len(allowed_items(cfg, pet)) * len(bgs[tier]), cfg["perPet"][tier]
            ok &= cap >= need
            rows.append(f"  {pet} {tier:<9} capacity {cap:>3}  need {need:>3}  {'ok' if cap >= need else 'TOO LOW'}")
    return ok, rows


def build_pet(cfg, pet, attempt):
    """Greedy: per token take the least-used item (per pet) whose (bg, item) pair is still free; seeded ties."""
    rng, bgs = random.Random(f"{cfg['seed']}:{pet}:{attempt}"), bgs_by_tier(cfg, pet)
    items, used, usage, out = allowed_items(cfg, pet), set(), Counter(), []
    for tier in FILL_ORDER:
        bg_cycle = sorted(bgs[tier]); rng.shuffle(bg_cycle)       # which bg gets the remainder is seeded
        for i in range(cfg["perPet"][tier]):
            bg = bg_cycle[i % len(bg_cycle)]
            free = [it for it in items if (bg, it) not in used]
            low = min(usage[it] for it in free)
            pick = rng.choice([it for it in free if usage[it] == low])
            used.add((bg, pick)); usage[pick] += 1
            out.append({"petId": pet, "pet": L.PETS[pet]["name"], "species": L.PETS[pet]["species"],
                        "tier": tier, "background": bg, "accessory": pick})
    return out, usage


def build(cfg):
    tokens, attempts = [], {}
    for pet in cfg["pets"]:
        for attempt in range(100):   # retry (logged) only if a (bg, item) clash pushed the spread above 1
            pet_tokens, usage = build_pet(cfg, pet, attempt)
            vals = [usage[i] for i in allowed_items(cfg, pet)]
            if max(vals) - min(vals) <= 1:
                break
        attempts[pet] = attempt
        tokens += pet_tokens
    order_attempt = 0
    while True:   # seeded shuffle + mix guard (no 5 same pet in a row, no legendary in ids 1–10)
        order = tokens[:]
        random.Random(f"{cfg['seed']}:order:{order_attempt}").shuffle(order)
        runs = max(len(list(g)) for _, g in itertools.groupby(t["petId"] for t in order))
        if runs < 5 and all(t["tier"] != "legendary" for t in order[:10]):
            break
        order_attempt += 1
    out = [{"tokenId": n, **t, "name": f"{t['pet']} #{n:03d}"} for n, t in enumerate(order, 1)]
    return {"pets": attempts, "order": order_attempt}, out


def serialize(cfg, attempts, tokens):
    head = {"drop": cfg["drop"], "seed": cfg["seed"], "attempts": attempts, "count": len(tokens),
            "generator": f"scripts/build_manifest.py sha256:{sha(__file__)}",
            "config": f"data/collection-config.json sha256:{sha(CONFIG)}",
            "exclusions": cfg["exclusions"]}
    lines = ["{"] + [f"  {json.dumps(k)}: {json.dumps(v)}," for k, v in head.items()] + ['  "tokens": [']
    lines += [f"    {json.dumps(t)}{',' if i < len(tokens) - 1 else ''}" for i, t in enumerate(tokens)]
    return "\n".join(lines + ["  ]", "}", ""])


def validate(cfg, tokens):
    errs, bgs = [], L.backgrounds()
    if [t["tokenId"] for t in tokens] != list(range(1, sum(cfg["perPet"].values()) * len(cfg["pets"]) + 1)):
        errs.append("tokenIds are not exactly 1..N")
    counts = Counter((t["petId"], t["tier"]) for t in tokens)
    for pet in cfg["pets"]:
        for tier in TIERS:
            if counts[(pet, tier)] != cfg["perPet"][tier]:
                errs.append(f"{pet} {tier}: {counts[(pet, tier)]} != {cfg['perPet'][tier]}")
    seen = set()
    for t in tokens:
        tid = t["tokenId"]
        if bgs.get(t["background"]) != t["tier"]:
            errs.append(f"#{tid}: background {t['background']} is not {t['tier']}")
        if bg_excluded(cfg, t["petId"], t["background"]):
            errs.append(f"#{tid}: {t['petId']} on excluded background {t['background']}")
        if not isinstance(t["accessory"], str) or t["accessory"] not in allowed_items(cfg, t["petId"]):
            errs.append(f"#{tid}: accessory {t['accessory']!r} is not an allowed dressed item")
        key = (t["petId"], t["background"], t["accessory"])
        if key in seen:
            errs.append(f"#{tid}: duplicate background + accessory for {t['petId']}")
        seen.add(key)
        if t["name"] != f"{L.PETS[t['petId']]['name']} #{tid:03d}":
            errs.append(f"#{tid}: name {t['name']}")
    for pet in cfg["pets"]:   # spread: as even as possible (100 / 13 → every item 7 or 8 times)
        use = Counter(t["accessory"] for t in tokens if t["petId"] == pet)
        vals = [use[i] for i in allowed_items(cfg, pet)]
        if max(vals) - min(vals) > 1:
            errs.append(f"{pet}: item spread {min(vals)}..{max(vals)} (> 1)")
    return errs


def usage_report(cfg, tokens, cap_rows):
    lines = [f"drop 1 usage: seed {cfg['seed']}, {len(tokens)} tokens, 1 dressed accessory each "
             "(scripts/build_manifest.py)", "", "capacity (bg × allowed items, after exclusions):"] + cap_rows + [""]
    for pet in cfg["pets"]:
        pt = [t for t in tokens if t["petId"] == pet]
        lines.append(f"{pet} ({L.PETS[pet]['name']}): " + ", ".join(f"{tier} {sum(t['tier'] == tier for t in pt)}" for tier in TIERS))
        lines.append(f"  {'item':<12}" + "".join(f"{t[:4]:>6}" for t in TIERS) + f"{'total':>7}")
        for item in L.items():
            row = [sum(t["accessory"] == item for t in pt if t["tier"] == tier) for tier in TIERS]
            lines.append(f"  {item:<12}" + "".join(f"{n:>6}" for n in row) + f"{sum(row):>7}")
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
    attempts, tokens = build(cfg)
    text = serialize(cfg, attempts, tokens)
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
    print(f"ok: {len(tokens)} tokens, seed {cfg['seed']}, attempts {attempts} → "
          f"{os.path.relpath(OUT, L.ROOT)}, {os.path.relpath(USAGE, L.ROOT)}")


if __name__ == "__main__":
    main()

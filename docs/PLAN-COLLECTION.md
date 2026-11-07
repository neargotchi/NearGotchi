# Drop 1 collection: plan (300 tokens, offline pipeline)

Status: 2026-11-07 (task 031). This is a plan only, with no app or site changes. The site's random hatch will later read the same manifest, anchors and images.
Inputs: `public/pets/pet{1,2,3}/nft.png` (601×762 RGBA, shared baseline y=746), the 14 items in `public/items/<slot>/` (ids as in `lib/mocks.ts`), and the 12 backgrounds in `assets-raw/backgrounds/` (1024×1024 RGB, the filename prefix gives the tier).
Copy rule: rarity only ("#042 of 300", "legendary"). Never value or growth.

## 0. Asset pipeline order (from the planner note)
`python3 scripts/cut_assets.py` → `python3 scripts/defringe.py`, **once per fresh cut**. Defringe is not idempotent. A second pass on the current cleaned files removes another 1,212 px in 17 files (tested on a copy), because each pass floods 4 px deeper. So never re-run it on files that are already clean. Add a comment saying this to the top of `defringe.py` when the pipeline is next touched.

## 1. Manifest: `data/collection-drop1.json` + `scripts/build_manifest.py`
Config lives at the top of the script (or in `data/collection-config.json`): `seed`, the tier quotas and the exclusion list (§6).
- Tiers per pet: exactly 60 common / 25 rare / 12 epic / 3 legendary. Totals: 180 / 75 / 36 / 9.
- Backgrounds by tier: common c01–c06, rare r07–r09, epic e10–e11, legendary l12.
- Accessories by tier: common 1 / rare 2 / epic 3 / legendary 3, with at most 1 item per slot (slots: head 7, eyes 4, neck 1, body 1, back 1).
- Candidate pool per pet × tier = every (background, item set) pair with distinct slots and no excluded pet×item or item×item combo.
  Capacity per pet: common 6×14 = 84 ≥ 60; rare 3×64 = 192 ≥ 25; epic 2×118 = 236 ≥ 12; legendary 1×118 = 118 ≥ 3. (There are 118 three-slot sets.)
- Picking (seeded `random.Random(seed)`, never the global RNG):
  1. Backgrounds go round-robin within each tier, so they are spread evenly (common: 10 per bg per pet; rare: 9/8/8; epic: 6/6; legendary: 3).
  2. For each slot to fill, take the least-used item for that pet, breaking ties with the seeded RNG. This keeps the item spread roughly even. Reject a candidate if its (bg, sorted item set) pair has already been used for this pet.
- Order: take all 300 tokens and do a seeded shuffle, then assign `tokenId` 1–300. Then apply one guard: re-shuffle (seed+1, logged) if any 5 consecutive ids share a pet, or if any legendary falls in ids 1–10. That way pets and tiers look mixed.
- Token record:
  ```json
  { "tokenId": 42, "petId": "pet1", "pet": "batman", "species": "corgi", "tier": "legendary",
    "background": "l12-legendary-glow", "accessories": { "head": "crown", "eyes": "pixel", "back": "cape" },
    "name": "batman #042" }
  ```
  The file header holds `{ "drop": 1, "seed": 20261107, "generator": "build_manifest.py@<git sha>", "tokens": [...] }`.
- Name: `<pet name> #<tokenId padded to 3>`. The number is the global id, so it matches "#042 of 300" and is unique. (A per-pet number like "batman #007" would duplicate the global one, so I'm not using it.)
- Validation (`--check`, also runs after every build, exits non-zero on failure):
  - exact counts per pet × tier;
  - ids 1–300 with no gaps;
  - accessory count matches the tier, and no two accessories share a slot;
  - no duplicate (bg + set) per pet;
  - no excluded combo;
  - spread: per pet and slot, max item use − min ≤ 2 (common) and ≤ 3 overall. It prints a usage table.
- Re-running with the same seed gives a byte-identical file. Changing the seed is an owner decision, logged in the header.

## 2. Accessory anchors: `data/anchors.json`
Model (coordinates are nft.png canvas pixels, so they survive the move onto the 1024 canvas):
```json
{ "pet1": { "head":  { "x": 300, "y": 120, "scale": 1.0, "align": "bottom" },
            "eyes":  { "x": 300, "y": 300, "scale": 0.9, "align": "center" },
            "neck":  { "x": 300, "y": 430, "scale": 1.0, "align": "top" },
            "body":  { "x": 300, "y": 470, "scale": 1.1, "align": "top" },
            "back":  { "x": 300, "y": 380, "scale": 1.3, "align": "center" } },
  "overrides": { "pet2:halo": { "dy": -30 }, "pet1:keffiyeh": { "dy": 40, "scale": 1.05 } } }
```
(The numbers above are illustrative, not measured.)
- `x,y` is where the item's `align` point (its bottom-centre, centre or top-centre) lands. `scale` multiplies the item's PNG size. An override per `pet:item` adds `dx/dy/scale`. Some items need overrides because their shape differs from the rest of their slot: halo floats, headphones and keffiyeh wrap the head, beanie sits low.
- Z-order is fixed: `back < pet < body < neck < eyes < head`.
- Scale: items are resampled with NEAREST. Aim for the item's art-pixel size to match the pet's (about 12 px per art pixel in nft.png). Prefer scales that make the item pixel grid land on whole pixels; the tuner (below) shows the art-pixel ratio.
- Measuring: `scripts/anchor-tuner.html` is a tool page with no build, served via `python3 -m http.server`. Pick a pet and an item, drag it, nudge with arrow keys (1 px, or 10 px with shift), use `[`/`]` for scale and `0` to reset. It shows the pet on a checker, a dark and a light bg. "Copy JSON" copies the result to paste into `data/anchors.json`.
  First pass: set the 5 slot anchors per pet (15 values) using the most typical item of each slot (cap, sunglasses, chain, tshirt, cape). Then add overrides only where an item looks off.
- Check sheet: `scripts/check_anchors.py` → `docs/anchors-check.png`. It has 3 rows (pets) × 14 columns (items), each cell a 256 px crop on a mid-tone bg, using the compositor's own draw code. It adds 2 extra rows per pet: a worst-case stack (headphones + mask + chain + tshirt + cape), and the same stack on a dark and a light bg. The owner approves this sheet before any batch render.

## 3. Compositor: `scripts/compose_drop1.py`
- Per token, in this order:
  1. `bg` (1024×1024, as-is);
  2. `back` item;
  3. pet `nft.png` at **1× (native)**. 2× would be 1202 px, which doesn't fit. Any non-integer scale would make the art pixels uneven, so 1× is the only clean integer scale. The pet is centred at x = (1024−601)/2 = 211 with its top-left at y = 214, so the shared baseline (746) lands at y = 960 for all 3 pets. Pets are about 70% of the canvas height and ground-level on floor backgrounds;
  4. `body`, `neck`, `eyes`, `head` items, each at pet canvas offset + anchor, using `Image.alpha_composite`.
- Shared code lives in `scripts/drop1_lib.py` (`load_assets`, `place_item`, `compose(token) -> Image`). The tuner's export format, the check sheet and the compositor all use the same anchor math, so what the owner approves is what gets rendered.
- Outputs:
  - `images/drop1/{tokenId}.png`: 1024 RGB, optimized (`optimize=True`). These are about 300 files of roughly 1 MB each, so `images/` goes in `.gitignore` and the folder gets pinned to IPFS later.
  - `public/drop1/{tokenId}.webp`: 512 px (NEAREST down by exactly 2×), quality 90, about 30–60 KB each, roughly 10–15 MB in total. These are committed and used by the site.
- Flags: `--only 1,42,300`, `--tier legendary`, `--check` (re-render and compare sha256 against `metadata/hashes.json`). Deterministic: pin the Pillow version in `scripts/requirements.txt`.
- Rarity frame: **not baked in (confirmed)**.
  - The background already carries the tier.
  - Marketplaces draw their own card chrome, and a baked frame would clash with it and waste canvas.
  - The site frame can change later without re-minting or re-hashing media.
  - The frame stays a CSS layer on the site (tier colour + label).

## 4. Metadata: `scripts/build_metadata.py` → `metadata/drop1/{tokenId}.json` + `metadata/drop1/collection.json`
NEP-177 `TokenMetadata` per token:
```json
{ "title": "batman #042", "description": "neargotchi drop 1 · #042 of 300 · legendary corgi.",
  "media": "42.png", "media_hash": "<base64 sha256 of the png>", "copies": 1,
  "issued_at": null, "reference": null, "reference_hash": null,
  "extra": "{\"pet\":\"batman\",\"species\":\"corgi\",\"background\":\"l12-legendary-glow\",\"tier\":\"legendary\",\"accessories\":{\"head\":\"crown\",\"eyes\":\"pixel\",\"back\":\"cape\"},\"accessory_count\":3,\"drop\":1}" }
```
- `extra` is a JSON string, as NEP-177 requires (marketplaces parse it). `media` is relative to the contract's `base_uri`.
- `collection.json` has two parts:
  - the NEP-177 `NFTContractMetadata` draft: `spec "nft-1.0.0"`, `name "NEARGOTCHI"`, `symbol "NGOTCHI"`, `base_uri: "ipfs://TODO_CID"` (placeholder; hosting is decided later);
  - a summary: counts per pet × tier, per background, per item, the seed and the manifest sha256.
- Copy check: the build fails if any title or description matches `/value|price|profit|moon|grow|invest|x\d/i`.

## 5. Review output: `scripts/contact_sheet.py` → `docs/drop1-preview.png`
- 300 thumbnails at 128 px, from the 512 webps, in 4 sections in this order: legendary (9), epic (36), rare (75), common (180).
- Each section has a header ("legendary · 9"). Within a section, sort by pet, then background.
- 20 columns, so the sheet is about 2560 × 2400 px. Each thumbnail has a `#042` label underneath.
- Also `docs/drop1-usage.txt`: the item and background usage tables from `--check`.

## 6. Effort, risks, fallback
- Estimate, as 3 follow-up tasks:
  - **A**: manifest + validation (1–1.5 h).
  - **B**: anchors (tuner + check sheet + tuning, 2–4 h). The owner signs off on `anchors-check.png`.
  - **C**: compositor + metadata + contact sheet (1.5–2 h), then one owner review round (about 1 h of fixes).
  - Total about 6–8 h.
- **Riskiest step: anchors.** The 14 items were drawn for the wardrobe sprites (489×431), not this pose. Their art-pixel size, perspective and head width may not match each pet. The cases I expect trouble with:
  - pet1's tall ears with every head item;
  - pet2's horns and wings with cap/beanie/tophat and the cape (the cape sits behind the wings);
  - pet3's raised paws in front of the chest, which the tshirt would cover (body is above pet);
  - keffiyeh, mask and beanie overlapping each other on the face.
- Fallback, in order:
  1. Add a per-item override (dx/dy/scale).
  2. If an item still looks wrong on one pet, add a pet×item exclusion. If two items clash, add an item×item exclusion (e.g. `keffiyeh+mask`).
  3. Re-run `build_manifest.py` with the **same seed**, then re-run the validation and the capacity check (the script prints the capacity per pet × tier after exclusions and fails if any tier falls below its quota).
  Even dropping a whole slot for one pet leaves enough capacity: for example, without back, rare still has 3×51 ≥ 25.
- Further risks:
  - **Light backgrounds and items with a thin dark outline.** Check c05 and c06 in the check sheet.
  - **Legendary glow.** l12's bright centre sits behind the pet's head, so the halo could vanish. Check halo on l12 specifically.
  - **Media hash drift.** If Pillow is upgraded, the hashes must be re-computed, which is why the version is pinned.
- No exclusions are decided yet. The list starts empty in the config and gets filled from the B check sheet with the owner.

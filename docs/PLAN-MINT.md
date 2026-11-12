# /mint — plan (demo, frontend only)

Status: 2026-11-06 (task 024). Reuses: `.pet-card`, `.button-*`, `Sparkles` (burst), `Mascot`, theme tokens (light/dark), `--ui-scale`, ≤1279 burger / ≤1023 mobile rules, `prefers-reduced-motion` block. Nothing here is a real mint: no wallet, no network, no token.

## 1. Files
Add
- `app/mint/page.tsx`: server page with metadata and the section shell (grid ON, like the hero). Renders `<MintFlow />`.
- `app/mint/mint-flow.tsx`: client state machine `loading → existing | form → hatching → done`.
- `app/mint/pet-picker.tsx`: radio-group cards (the 3 drop-1 pets).
- `app/mint/hatch-stage.tsx`: hatch animation plus a live region.
- `app/pet/page.tsx`: minimal stub so the redirect and the nav link never 404. It shows the pet (happy sprite), its name and "start over", or "no pet yet" plus a link to /mint. The full /pet page is a later task.

Change
- `lib/mocks.ts`: `DemoPet` type, name rules, store functions (§2).
- `lib/copy.ts`: `mint` copy and nav item (§5).
- `app/site-header.tsx`, `app/mobile-menu.tsx`: nav hrefs that start with "/" are used as-is. Today every href renders as `/${href}`, so `/pet` would become `//pet`.
- `app/globals.css`: `.mint-*` block, `.pet-card.is-selected`, hatch keyframes (inside the reduced-motion block), header breakpoints (see the warning below).
- Header "mint your pet" CTAs (header, burger panel, hero) already point to `/mint`. No change, just verify.

Header width (needs your OK). Free space now: 11px at 1280, 15px at 1440. A 6th link "my pet" (~52px + gap, estimate) does not fit. Proposal:
- burger up to ≤1439;
- tight-gap band (021 values) at 1440–1599 (free ≈106px at 1440);
- full gaps from ≥1600 (free ≈87px).
I will re-measure after building.

## 2. Data model + interface (`lib/mocks.ts`)
```ts
export type DemoPet = {
  v: 1; id: string;            // "demo-" + petId + "-" + Date.now()
  petId: PetProfile["id"];     // "pet1" | "pet2" | "pet3"
  species: string; name: string;
  balance: number;             // 100 (demo $NEARGotchi, display only)
  hunger: number; energy: number; // 0–100; start 20 / 100
  mood: Mood;                  // "happy" right after hatch
  outfit: Partial<Record<Slot, Item["id"] | null>>; // {} at mint
  mintedAt: string;            // ISO
  demo: true;
};
export const PET_STORAGE_KEY = "neargotchi-pet"; // JSON DemoPet; theme key stays separate
export function validatePetName(raw: string, petId: string): { ok: true; name: string } | { ok: false; error: NameError };
export async function getPet(): Promise<DemoPet | null>;  // null if none / corrupt / wrong v / unknown petId (then clears)
export async function mintPet(input: { petId: string; name: string }): Promise<DemoPet>; // validates, throws MintError
export async function updatePet(patch: Partial<Omit<DemoPet, "v" | "id" | "demo">>): Promise<DemoPet>; // for /pet
export async function resetPet(): Promise<void>;
export function subscribePet(cb: (pet: DemoPet | null) => void): () => void; // storage event (other tabs)
export function isPersistent(): boolean; // false when localStorage is blocked
```
- The functions are async on purpose, so a future backend swaps the bodies and keeps the same calls.
- Every storage access is wrapped in try/catch. If storage is blocked, the module keeps the pet in a module-level variable: it survives client navigation to /pet and is lost on reload.

Name rules (`validatePetName`)
- trim, collapse inner spaces, lowercase;
- 2–12 chars; allowed `a–z 0–9 space - _`;
- empty → the pet's own name (batman / nightshade / merk).
- Errors: `too_short | too_long | bad_chars | no_pet`.
- The input has `maxLength=24` so a paste doesn't freeze anything; the message explains the 12-char limit.

## 3. Layout
One `<section class="mint-section">` under the header. Grid ON, sparkles page-wide. Content column = `.pets-content`.
```
1920  [h1 hatch your gotchi ✦ ][mascot nightshade + bubble]      [demo · no real mint, no wallet]
      sub line
      1. pick your pet   [card][card][card][soon][soon][soon]       (6-col, like pets-list)
      2. name it         [ name input 480px ][ mint · demo ]        (one row; error under input)
      hatch: the form area swaps in place for a 640px LCD stage (egg 320px, centered), same section
1280  same, cards 3×2 (existing ≤1280 rule); name + mint stay one row
375   h1 (mobile title size) / mascot row / demo pill / sub
      cards: horizontal snap row, next card peeking (existing mobile rule)
      name input 100% / error / mint 100% × 56px
      hatch stage 100% wide, egg clamp(160px, 30svh, 260px)
existing pet (all sizes): the form is replaced by one card (happy sprite, name, species) + [go to your pet] [start over]
```
Selected card: `--green` card background with ink text (same in light and dark, like the active mood button), a pixel "✓ picked" tag in the name row, and the happy sprite. Unselected: normal sprite. Locked cards are not inputs, have no hover, and use the existing `.pet-card-locked` style.

## 4. Hatch storyboard (total 3.2s; transform/opacity only, `steps()`, no rotation)
| t (ms) | frame | CSS |
|---|---|---|
| 0–600 | egg wobble ±4px x, 3 cycles | `translateX` keyframes, `steps(4)` per 200ms |
| 600–1000 | hard shake ±8px x, ±2px y | `steps(4)` per 100ms |
| 1000–1300 | crack: ink zig-zag line grows across the egg in 3 frames | overlay `clip-path` widths 33/66/100%, `steps(3)` |
| 1300–1600 | halves split: top −24px y, bottom +8px; flash (LCD → white → LCD) | 2 clip-path halves of logo-transparent, `steps(3)` |
| 1300–1900 | NEAR sparkle burst, 8 sparkles, green + `--sparkle-alt` | `<Sparkles mode="burst">` (existing keyframes, 0.6s) |
| 1600–2000 | happy pet appears where the egg was, halves fade out | opacity `steps(2)` + `pet-hop` (existing) |
| 2000–3200 | hold; live text "{name} hatched." → "taking you to {name}…" | then `router.push("/pet")` |
- The "go to {name}" button is shown from 2000ms in case the redirect is slow or blocked.
- Reduced motion: the egg is swapped for the happy pet instantly (no shake, crack or burst), the same live text plays, and the redirect happens after 1500ms.

## 5. New copy (lowercase, site tone) → `lib/copy.ts` `mint`, `header.nav`
- meta title `mint — NEARGOTCHI` · meta description `pick a gotchi, name it, watch it hatch. demo, no real mint.`
- h1 `hatch your gotchi` · sub `pick a pet. give it a name. watch it hatch.`
- demo label `demo · no real mint, no wallet`
- mascot (nightshade) `i hatched once. it was a lot.`
- step 1 legend `1. pick your pet` · picked tag `picked`
- step 2 label `2. name it` · hint `2–12 characters. letters, numbers, spaces, - and _.` · placeholder = the pet's name
- errors:
  - `too short. 2 characters at least.`
  - `too long. 12 characters max.`
  - `letters, numbers, spaces, - and _ only.`
  - `pick a pet first.`
- mint button `mint` + tag `demo` (same pill as connect wallet)
- hatch live text:
  - `hatching…`
  - `{name} hatched.`
  - `taking you to {name}…`
  - button `go to {name}`
- existing pet:
  - title `you already have a gotchi.`
  - body `{name} the {species} is waiting.`
  - buttons `go to your pet` / `start over`
- start-over confirm (inline, no browser dialog):
  - text `start over? {name} will be gone. it's a demo, so nothing real is lost.`
  - buttons `yes, start over` / `keep {name}`
- storage blocked note `this browser won't save your pet. it stays until you close the tab.`
- noscript `turn on javascript to hatch a pet.`
- nav `my pet` → `/pet`
- /pet stub (empty) `no pet yet.` + link `hatch one`

## 6. Edge cases
- **Pet already saved** → existing-pet view. "start over" asks for inline confirmation, then `resetPet()` and back to the form.
- **localStorage blocked or throws** → in-memory store plus the note; the flow still works and the redirect still shows the pet.
- **Corrupt JSON, wrong `v` or unknown petId** → `getPet()` clears the key and returns null, so the form shows. No crash.
- **Double-click / Enter spam on mint** → the state goes to `hatching` on the first call; the button is removed from the DOM, not just disabled.
- **Leaving mid-hatch** → the pet is already saved (`mintPet` runs before the animation); the timers are cleared on unmount.
- **Back button from /pet** → existing-pet view, not a second hatch.
- **Two tabs** → `subscribePet` updates the view; minting in one tab switches the other tab to existing-pet.
- **No pet picked** → `pick a pet first.` and focus moves to the first radio. Nothing is preselected, so the choice is explicit.
- **Uppercase, emoji, paste** → lowercased on blur and save; other characters get the `bad_chars` error (not silently stripped).
- **Empty name** → default name, shown as the placeholder so it's predictable.
- **SSR / hydration** → the server renders `loading` (a skeleton the size of the form), so there's no flash of the form before an existing pet is found.
- **JS off** → noscript note; the cards still render as static content.
- **/pet visited with no pet** → stub with `no pet yet.` + link to /mint.
- **Theme or size change mid-hatch** → tokens only; the stage is fluid and the animation keeps running.

## 7. Accessibility
- Picker = `<fieldset>` + `<legend>` with native visually-hidden `<input type="radio" name="pet">` inside each `<label class="pet-card">`. Arrow keys work natively. The focus ring is the pink outline on the card.
- Name `<input>`: `<label>`, `aria-describedby` for hint + error, `aria-invalid` on error. The error is shown on submit and on blur, not while typing.
- The hatch stage is a `role="status"` live region. Focus goes to the stage heading and then to "go to {name}".
- The existing-pet and confirm views move focus to their heading.
- Tap targets ≥44px; contrast as in 020 (ink on green, cream on surface).

## 8. Acceptance checklist
- [ ] Header + burger "mint your pet" → /mint; "my pet" in nav → /pet (no `//pet`); the header fits at 1024/1280/1366/1440/1600/1920.
- [ ] 1920 / 1280 / 375, light + dark: layout as in §3, no horizontal scroll, all copy as in §5, demo label visible above the fold.
- [ ] Tab reaches the radio group; arrows change the pet; the selected card is green with "picked" and the happy sprite.
- [ ] Names: "Batman!!" → bad_chars message; "a" → too short; 13 chars → too long; empty → default name; "  Big  Boi " → "big boi".
- [ ] Mint → wobble, shake, crack, split + flash, burst, happy pet, text, redirect to /pet at ~3.2s; double-click mints once.
- [ ] Reduced motion: instant swap, same text, redirect at 1.5s; nothing moves.
- [ ] Back to /mint → "you already have a gotchi."; start over → confirm → form; keep → stays.
- [ ] DevTools: localStorage `neargotchi-pet` holds a `DemoPet` with `demo: true`; editing it into garbage → form shows, key cleared.
- [ ] Storage blocked (private mode / blocked site data): the note shows, the hatch works, /pet shows the pet until reload.
- [ ] Screen reader: legend + "batman, radio, 1 of 3"; errors announced; hatch text announced; no console errors; no network requests besides page assets.

## PLANNER REVIEW (2026-11-06) — overrides the plan where they differ
1. Header: do NOT add a 6th nav link and do NOT change the approved header breakpoints (burger stays ≤1279). Instead the existing "mint your pet" CTA (header, burger panel) becomes "my pet" → /pet when a pet exists (getPet() on the client; render "mint your pet" on the server/first paint, swap after hydration with the same button width so there is no layout shift — size the button to the wider label). Hero CTA stays "mint your pet" → /mint (which shows the existing-pet view). Still fix the `//pet` href bug.
2. Deep link: `/mint?pet=pet1|pet2|pet3` preselects that pet (unknown value = nothing selected). Make the 3 real cards on the home "pick your gotchi" section link-able via a small "mint {name}" text link under the mood buttons → `/mint?pet=…` (copy: `mint {name}`, add to copy). Mood buttons keep working.
3. Balance 100 is shown on /pet later as "100 demo $NEARGotchi" — never as a plain number next to the ticker.
4. Everything else approved as written (data model, async interface, name rules, storyboard, copy, edge cases, a11y, checklist).

## Update: drop 1 random hatch (tasks 035–036, docs/DEVLOG.md) — overrides §1–§7 where they differ
- **No pet picker.** `app/mint/pet-picker.tsx` is gone; one hatch = one random token of the 300 (`hatchRandom()` in `lib/drop1.ts`). `/mint?pet=…` is ignored without an error; the home "mint {name}" links go to plain `/mint` (overrides review 2026-11-06 §2).
- **States** (`app/mint/mint-flow.tsx`): `loading → ready | soldOut | existing`; `ready → hatching` (draw + animation + reveal) `→ /pet`. Ready: egg in the LCD stage, counter "{minted} / 300 hatched · demo" (this browser only), "hatch" button, hint. soldOut: "all 300 hatched." + "reset demo drop" (clears the minted list). Existing: the NFT `TokenCard` (sprite card only for a pet without a token) + go / start over. Start over keeps the token minted.
- **Save timing:** `mintPet({ token })` saves the pet with its own name right after the draw, so leaving mid-hatch or mid-reveal keeps it; the reveal's name field calls `renamePet` (empty = the pet's name), then `/pet`. No auto-redirect.
- **Storyboard** (`app/mint/hatch-stage.tsx`): shake 0–1000ms; if the token or its decoded webp (max 2s wait) isn't there yet, `is-wait` wobble loop (±4px, 0.6s) + "almost… the egg is still wobbling."; then crack 300 → split + flash + burst 300 → NFT (320², ink border) appears and bobs. Reduced motion: no shake, straight to the NFT when ready.
- **Errors:** sold out mid-draw → soldOut view; any other failure → back to ready with "the egg didn't crack. try again." (focus on hatch). Dev-only QA: `/mint?debughatch=slow|fail`.
- **A11y:** the `role="status"` line goes hatching… → (waiting) → "it's out: {tier} {species}."; focus moves to it on hatch, then to the reveal heading "{token} hatched." (h2, tabIndex −1). Focus only moves after a user action.
- **Copy:** `mintPage` in `lib/copy.ts`; rarity only, checked by `npm run check:drop1` (value/price/growth regex over mintPage, petPage.token, tier and item labels).

## Update: demo v2 (tasks 038–048, docs/DEVLOG.md) — overrides the drop 1 update where they differ
- **Wallet gate:** /mint needs the demo wallet (`lib/wallet.ts`, account `you.demo`). Not connected → "connect a demo wallet to hatch" + connect button, the egg shown but disabled.
- **No "existing" view:** a connected account can always hatch another; every hatch is a new `DemoPet v4` owned by the account (`neargotchi-pets`). The ready view shows `DropProgress` "x / 300 hatched · y left · demo" (this browser only).
- **Reveal:** TokenInfo + name field, then "share on x" (`x.com/intent/tweet`, url `/nft/{id}`, rarity-only text, new tab `rel="noopener"`) and "play with {name}" → saves the name → `/pet?id={tokenId}&tab=games`.
- **/nft/[id]:** static share page for 1–300 (`dynamicParams = false`), TokenArt + TokenInfo + "demo token · not on chain" + "hatch your own"; 1200×630 OG per token; in the sitemap.
- **Balance** lives on the account (100 to start, refill demo), not on the pet. Sold out + "reset demo drop" unchanged.

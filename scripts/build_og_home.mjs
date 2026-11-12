// Link preview image for the home page (task 094): app/opengraph-image.png + app/twitter-image.png, 1200×630,
// in the dark site style. Builds one HTML page from local assets only (inlined as data URIs, so no server and no
// file:// font/CORS issues) and screenshots it with headless Chromium.
//   node scripts/build_og_home.mjs
// Chromium: $CHROME_BIN, else Playwright's cached chrome-headless-shell / chromium, else google-chrome / chromium on PATH.
// Content: the logo egg with the three drop-1 pets beside it, "NEARGOTCHI" (Press Start 2P, white), the subtitle in the
// one site green #01eba3 and a small "300 gotchis · live on near mainnet" line. No value claims, no NEAR / NEAR AI logos.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const at = (...parts) => join(ROOT, ...parts);
const dataUri = (path, type) => `data:${type};base64,${readFileSync(at(path)).toString("base64")}`;

function findChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const cache = join(homedir(), "Library", "Caches", "ms-playwright");
  const linuxCache = join(homedir(), ".cache", "ms-playwright");
  for (const base of [cache, linuxCache]) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base).filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d)).sort().reverse();
    for (const dir of dirs) {
      for (const rel of [
        "chrome-headless-shell-mac-x64/chrome-headless-shell",
        "chrome-headless-shell-mac-arm64/chrome-headless-shell",
        "chrome-headless-shell-linux64/chrome-headless-shell",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        "chrome-linux/chrome",
      ]) {
        const path = join(base, dir, rel);
        if (existsSync(path)) return path;
      }
    }
  }
  for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
    try {
      return execFileSync("which", [name]).toString().trim();
    } catch {
      // not on PATH
    }
  }
  throw new Error("no Chromium found: set CHROME_BIN");
}

const font = dataUri("assets-raw/fonts/PressStart2P-latin.woff2", "font/woff2");
const sans = dataUri("assets-raw/fonts/SpaceGrotesk-latin.woff2", "font/woff2");
const egg = dataUri("public/logo-transparent.png", "image/png");
const scene = dataUri("public/hero/dark.png", "image/png");
const pet = (n) => dataUri(`public/pets/pet${n}/nft.png`, "image/png");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Press Start 2P"; src: url(${font}) format("woff2"); }
@font-face { font-family: "Space Grotesk"; src: url(${sans}) format("woff2"); }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1200px; height: 630px; overflow: hidden; background: #0a0a0a; }
body { position: relative; color: #fff; font-family: "Press Start 2P", monospace; }
.scene { position: absolute; inset: 0; background: #0a0a0a url(${scene}) center 62% / cover no-repeat; opacity: .55; image-rendering: pixelated; }
.title { position: absolute; top: 46px; left: 0; right: 0; text-align: center; font-size: 64px; letter-spacing: -.02em; }
.sub { position: absolute; top: 136px; left: 0; right: 0; text-align: center; font-size: 22px; letter-spacing: .12em; color: #01eba3; text-transform: uppercase; }
.row { position: absolute; left: 0; right: 0; bottom: 78px; display: flex; align-items: flex-end; justify-content: center; gap: 18px; }
.row img { display: block; image-rendering: pixelated; }
.pet { height: 250px; }
.pet.small { height: 214px; }
.egg { width: 300px; height: 300px; margin: 0 14px -8px; }
.line { position: absolute; bottom: 32px; left: 0; right: 0; text-align: center; font-family: "Space Grotesk", sans-serif; font-weight: 500; font-size: 22px; color: rgba(255, 255, 255, .78); }
</style></head><body>
<div class="scene"></div>
<h1 class="title">NEARGOTCHI</h1>
<p class="sub">your ai companion on near</p>
<div class="row">
  <img class="pet small" src="${pet(3)}" alt="">
  <img class="pet" src="${pet(1)}" alt="">
  <img class="egg" src="${egg}" alt="">
  <img class="pet" src="${pet(2)}" alt="">
</div>
<p class="line">300 gotchis · live on near mainnet</p>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), "og-home-"));
const page = join(dir, "og.html");
const shot = join(dir, "og.png");
writeFileSync(page, html);
execFileSync(findChrome(), [
  "--headless",
  "--disable-gpu",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1200,630",
  "--virtual-time-budget=3000",
  `--screenshot=${shot}`,
  `file://${page}`,
], { stdio: "ignore" });
for (const out of ["app/opengraph-image.png", "app/twitter-image.png"]) copyFileSync(shot, at(out));
console.log("og image → app/opengraph-image.png, app/twitter-image.png (1200×630)");

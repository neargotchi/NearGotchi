// One green in the UI (task 089): the logo / egg green #01eba3. Scans app/, components/ and lib/ (CSS, TSX, TS)
// for any other colour in the green–teal band (hex, rgb(), hsl()) and for color-mix() that darkens the accent
// (mixes it with black). Fails with the list, so a dark or second green can't come back unnoticed. Allowed:
// lighter tints of the same hue (±4° of the accent's 161.5°, lightness ≥ 45 %).
//   node scripts/check-greens.mjs            (npm run check:greens)
// Allowed on purpose: the LCD screen tones of the logo egg (grey-green, not the accent) and the rarity
// rainbow (data colours). Pet / NFT / hero images are PNG and not scanned here.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ACCENT = "#01eba3";
const ALLOWED = new Map([
  ["#b7c9a0", "LCD screen of the logo egg (--lcd)"],
  ["#9db088", "LCD screen shade (--lcd-shadow)"],
  ["#d8e4c3", "LCD screen line (--lcd-line)"],
  ["#69db7c", "rarity rainbow (--tier-rainbow)"],
]);
const ROOTS = ["app", "components", "lib"];
const EXT = new Set([".css", ".tsx", ".ts"]);
const SKIP = /drop1-tokens\.json$/;

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return EXT.has(extname(path)) && !SKIP.test(path) ? [path] : [];
  });
}

function hsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (l > 0.5 ? 2 - max - min : max + min);
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}
const isGreen = ({ h, s }) => h >= 85 && h <= 200 && s > 0.15;
const ACCENT_HUE = 161.5;
const lighterTint = ({ h, l }) => Math.abs(h - ACCENT_HUE) <= 4 && l >= 0.45;
const bad = (c) => isGreen(c) && !lighterTint(c);

const found = [];
for (const file of ROOTS.flatMap(files)) {
  readFileSync(file, "utf8").split("\n").forEach((line, index) => {
    const at = `${file}:${index + 1}`;
    // 3/4-digit hex only in CSS (in TS/TSX "#181" is a token number in a comment, not a colour)
    const hexRe = file.endsWith(".css") ? /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi : /#([0-9a-f]{8}|[0-9a-f]{6})\b/gi;
    for (const match of line.matchAll(hexRe)) {
      let hex = match[1].toLowerCase();
      if (hex.length <= 4) hex = [...hex.slice(0, 3)].map((c) => c + c).join("");
      hex = `#${hex.slice(0, 6)}`;
      if (hex === ACCENT || ALLOWED.has(hex)) continue;
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i + 1, i + 3), 16) / 255);
      if (bad(hsl(r, g, b))) found.push(`${at}  ${match[0]}`);
    }
    for (const match of line.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/gi)) {
      const [r, g, b] = match.slice(1, 4).map((v) => Number(v) / 255);
      if (bad(hsl(r, g, b))) found.push(`${at}  ${match[0]})`);
    }
    for (const match of line.matchAll(/hsla?\(\s*(\d+(?:\.\d+)?)(?:deg)?[\s,]+(\d+(?:\.\d+)?)%/gi)) {
      const h = Number(match[1]), s = Number(match[2]) / 100;
      const l = Number(line.slice(match.index + match[0].length).match(/^[\s,]+(\d+(?:\.\d+)?)%/)?.[1] ?? 0) / 100;
      if (bad({ h, s, l })) found.push(`${at}  ${match[0]}`);
    }
    // the accent mixed with black = a dark green
    if (/color-mix\([^;]*var\(--(accent|green)[^;]*(#000\b|black)/i.test(line)) found.push(`${at}  accent darkened with color-mix`);
  });
}

if (found.length) {
  console.error(`check:greens — ${found.length} green(s) other than ${ACCENT}:`);
  for (const line of found) console.error(`  ${line}`);
  process.exit(1);
}
console.log(`check:greens — only ${ACCENT} (+ ${ALLOWED.size} allowed LCD / rarity colours): ok`);

// Task 101 QA: Meteor "Sign Out Request" on connect. Run against a mainnet build served by `next start -p 3099`:
//   node scripts/qa-wallet-signout.mjs [scenario …]   (URL0 overrides http://localhost:3099/; exits 1 if a connect opened a sign-out)
// window.open (the Meteor web popup) is stubbed: every opened action is recorded and answered.
import { createRequire } from "node:module";
// playwright: resolved from this repo, or from PLAYWRIGHT_FROM (a directory with node_modules/playwright)
const require = createRequire(process.env.PLAYWRIGHT_FROM ? `${process.env.PLAYWRIGHT_FROM}/` : import.meta.url);
const { chromium } = require("playwright");
const URL0 = process.env.URL0 || "http://localhost:3099/";
// a throwaway key pair for the fake "old.near" session (generated per run, never used on chain)
const { KeyPair } = await import("@near-js/crypto");
const pair = KeyPair.fromRandom("ed25519");
const KEY = pair.toString();
const PUB = pair.getPublicKey().toString();
const CONTRACT = "drop1.neargochi-dev.near";
const meteorAuth = (acc) => JSON.stringify({ accountId: acc, allKeys: [PUB], signedInContract: { contract_id: CONTRACT, public_key: PUB } });

const scenarios = {
  clean: { seed: {}, steps: ["connect:Meteor Wallet"] },
  // Meteor signed in (selector + SDK), user disconnects (approves), then connects with another account
  "meteor-disconnect-connect": {
    seed: { "near-wallet-selector:selectedWalletId": '"meteor-wallet"', "near-wallet-selector:contract": JSON.stringify({ contractId: CONTRACT, methodNames: [] }), default_meteor_wallet_auth_key: meteorAuth("old.near"), "_meteor_walletold.near:mainnet": KEY },
    steps: ["disconnect", "connect:Meteor Wallet"],
  },
  // same, but the user closes the Meteor sign-out popup
  "meteor-disconnect-closed-connect": {
    seed: { "near-wallet-selector:selectedWalletId": '"meteor-wallet"', "near-wallet-selector:contract": JSON.stringify({ contractId: CONTRACT, methodNames: [] }), default_meteor_wallet_auth_key: meteorAuth("old.near"), "_meteor_walletold.near:mainnet": KEY },
    logoutReply: "closed_window",
    steps: ["disconnect", "connect:Meteor Wallet", "disconnect", "reload", "connect:Meteor Wallet"],
  },
  // Meteor SDK still holds an old session, but the selector forgot it (selector keys gone)
  "meteor-sdk-stale": {
    seed: { default_meteor_wallet_auth_key: meteorAuth("old.near"), "_meteor_walletold.near:mainnet": KEY },
    steps: ["connect:Meteor Wallet"],
  },
  // Meteor SDK session without its key (selector validation fails → not signed in), selector still says meteor
  "meteor-sdk-nokey": {
    seed: { "near-wallet-selector:selectedWalletId": '"meteor-wallet"', default_meteor_wallet_auth_key: meteorAuth("old.near") },
    steps: ["connect:Meteor Wallet"],
  },
  // MyNearWallet signed in, Meteor SDK has an old session too; disconnect (MNW) then connect with Meteor
  "mnw-then-meteor": {
    seed: { "near-wallet-selector:selectedWalletId": '"my-near-wallet"', "near-wallet-selector:contract": JSON.stringify({ contractId: CONTRACT, methodNames: [] }), signedAccountId: "mnw.near", default_meteor_wallet_auth_key: meteorAuth("old.near"), "_meteor_walletold.near:mainnet": KEY },
    steps: ["disconnect", "connect:Meteor Wallet"],
  },
  // Meteor signed in on the selector; our own record says disconnected (desync)
  "desync-record": {
    seed: { "near-wallet-selector:selectedWalletId": '"meteor-wallet"', "near-wallet-selector:contract": JSON.stringify({ contractId: CONTRACT, methodNames: [] }), default_meteor_wallet_auth_key: meteorAuth("old.near"), "_meteor_walletold.near:mainnet": KEY, "neargotchi-wallet": JSON.stringify({ v: 1, accountId: "old.near", connected: false, connectedAt: "2026-11-12T10:00:00.000Z", balance: 100 }) },
    steps: ["connect:Meteor Wallet"],
  },
};
// One modal session, two wallets: MyNearWallet is clicked first (its popup answers after 3 s), then Meteor (answers
// at once). Meteor is signed in when MyNearWallet's answer arrives → core onWalletSignedIn signs the selected Meteor out.
scenarios["two-wallets-one-modal"] = { seed: {}, steps: ["connect2:MyNearWallet|Meteor Wallet"] };
const only = process.argv.slice(2);
const browser = await chromium.launch();
let failures = 0;
for (const [name, sc] of Object.entries(scenarios)) {
  if (only.length && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(({ seed, logoutReply }) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.clear();
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
      sessionStorage.setItem("seeded", "1");
    }
    const opened = JSON.parse(sessionStorage.getItem("opened") || "[]");
    window.__opened = opened;
    window.open = (url) => {
      const u = new URL(url, location.href);
      if (u.hostname.includes("mynearwallet")) {
        // MyNearWallet popup: answers "success" after 3 s (synthetic message with the wallet's origin)
        opened.push("mnw-login");
        sessionStorage.setItem("opened", JSON.stringify(opened));
        const fake = { closed: false, focus() {}, postMessage() {}, close() { fake.closed = true; } };
        setTimeout(() => window.dispatchEvent(new MessageEvent("message", { data: { status: "success", account_id: "mnw2.near", public_key: "" }, origin: u.origin })), 3000);
        return fake;
      }
      const action = u.pathname.split("/").pop();
      const uid = u.searchParams.get("connectionUid");
      opened.push(action);
      sessionStorage.setItem("opened", JSON.stringify(opened));
      console.log("OPEN", action);
      const reply = action === "logout" ? logoutReply || "closed_success" : "closed_success";
      const fake = { closed: false, focus() {}, postMessage() {} };
      setTimeout(() => {
        if (reply === "closed_window") fake.closed = true;
        window.postMessage({ uid, status: reply, payload: action === "login" ? { accountId: "new.near", allKeys: [] } : {}, endTags: [] }, "*");
      }, 300);
      return fake;
    };
  }, { seed: sc.seed, logoutReply: sc.logoutReply });
  await ctx.route(/fastnear|drpc|zan\.top|intea|rpc\./, async (route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.fulfill({ status: 200, body: "{}" });
    const body = JSON.parse(req.postData() || "{}");
    const p = body.params || {};
    let result = {};
    if (p.request_type === "call_function") result = { result: Array.from(Buffer.from("[]")), logs: [], block_height: 1, block_hash: "x" };
    if (p.request_type === "view_access_key") result = { nonce: 1, permission: "FullAccess", block_height: 1, block_hash: "x" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id: body.id, result }) });
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  pageerror", e.message.slice(0, 120)));
  const chip = page.locator(".wallet-menu.is-header .wallet-chip");
  const log = [];
  const opened = () => page.evaluate(() => [...window.__opened]);
  await page.goto(URL0, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  log.push(`load: chip="${(await chip.innerText()).replace(/\s+/g, " ").trim()}"`);
  for (const step of sc.steps) {
    const before = (await opened()).length;
    if (step === "reload") {
      await page.reload({ waitUntil: "load" });
      await page.waitForTimeout(2500);
    } else if (step === "disconnect") {
      await chip.click();
      await page.getByRole("button", { name: "disconnect" }).click();
      await page.waitForTimeout(1500);
    } else if (step.startsWith("connect2:")) {
      const [first, second] = step.slice(9).split("|");
      await chip.click();
      await page.waitForTimeout(1500);
      await page.getByText(first, { exact: true }).first().click();
      await page.waitForTimeout(400);
      await page.getByText(second, { exact: true }).first().click();
      await page.waitForTimeout(5000);
    } else if (step.startsWith("connect:")) {
      await chip.click();
      // a stale session makes connect reload the page once; the modal then opens by itself
      await page.waitForTimeout(3500);
      const option = page.getByText(step.slice(8), { exact: true }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        await page.waitForTimeout(2000);
      } else log.push("  (no wallet modal shown)");
    }
    const now = await opened();
    const fresh = now.slice(before);
    if (step.startsWith("connect") && fresh.includes("logout")) failures++;
    log.push(`${step}: opened [${fresh.join(", ")}] chip="${(await chip.innerText()).replace(/\s+/g, " ").trim()}"`);
  }
  log.push(`end: selector=${await page.evaluate(() => localStorage.getItem("near-wallet-selector:selectedWalletId"))} meteorAuth=${await page.evaluate(() => (localStorage.getItem("default_meteor_wallet_auth_key") || "").slice(0, 40))}`);
  console.log(`== ${name}\n  ${log.join("\n  ")}`);
  await ctx.close();
}
await browser.close();
console.log(failures ? `FAIL: ${failures} connect step(s) opened a Meteor sign-out` : "OK: no connect opened a Meteor sign-out");
process.exit(failures ? 1 : 0);

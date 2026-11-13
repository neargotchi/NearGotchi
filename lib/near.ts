// Wallet selector setup (testnet / mainnet only; imported lazily so the demo build never loads it).

import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

import { CONFIG_ERROR, CHAIN, DROP1_CONTRACT, RPC_URLS } from "./chain";

type Near = { selector: WalletSelector; modal: WalletSelectorModal };
let near: Promise<Near> | null = null;

export function getNear(): Promise<Near> {
  near ??= (async () => {
    if (CONFIG_ERROR) throw new Error(CONFIG_ERROR);
    const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/my-near-wallet"),
      import("@near-wallet-selector/meteor-wallet"),
    ]);
    const selector = await setupWalletSelector({
      network: CHAIN === "mainnet" ? "mainnet" : "testnet",
      // the same failover list as lib/chain.ts (the selector's own default is only FastNear)
      fallbackRpcUrls: RPC_URLS,
      modules: [setupMyNearWallet(), setupMeteorWallet()],
    });
    const modal = setupModal(selector, { contractId: DROP1_CONTRACT });
    await guardSignOut(selector);
    return { selector, modal };
  })().catch((error) => {
    near = null;
    throw error;
  });
  return near;
}

/** The signed-in account id, or null. */
export function activeAccountId(selector: WalletSelector): string | null {
  const accounts = selector.store.getState().accounts;
  return (accounts.find((account) => account.active) ?? accounts[0])?.accountId ?? null;
}

// ---------- Task 101: a wallet sign-out (Meteor: the "Sign Out Request" popup) only on an explicit disconnect ----------

/** The wallets this site offers (lib/near.ts modules). */
const WALLET_IDS = ["my-near-wallet", "meteor-wallet"] as const;
/**
 * What each wallet's own signOut() clears in this browser (Meteor SDK: its auth record; MyNearWallet: its account and
 * function-call key). The access keys' key pairs (`_meteor_wallet…`, `near-api-js:keystore:…`) are left alone, as the
 * wallets' signOut() leaves them; no key is added anywhere.
 */
const WALLET_STORAGE: Record<(typeof WALLET_IDS)[number], string[]> = {
  "meteor-wallet": ["default_meteor_wallet_auth_key"],
  "my-near-wallet": ["signedAccountId", "functionCallKey", "near_app_wallet_auth_key"],
};
/** wallet-selector's own session keys (core 10.1.4: PACKAGE_NAME + SELECTED_WALLET_ID / CONTRACT / the pending pair). */
const SELECTOR_STORAGE = ["selectedWalletId", "contract", "selectedWalletId:pending", "contract:pending"].map((key) => `near-wallet-selector:${key}`);

const removeKeys = (keys: string[]) => {
  try {
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing was persisted either
  }
};

/**
 * Forgets every wallet session of this site in this browser, locally: no wallet popup, no transaction. The selector
 * keeps its in-memory state until the next page load (it has no API to drop a session without the wallet's signOut).
 */
export function clearLocalSession() {
  removeKeys(SELECTOR_STORAGE);
  for (const id of WALLET_IDS) removeKeys(WALLET_STORAGE[id]);
}

let signOutAllowed = false;

/** disconnect() only: the selected wallet's real signOut() (Meteor shows its sign-out popup, as intended). */
export async function signOutOnPurpose(selector: WalletSelector): Promise<void> {
  signOutAllowed = true;
  try {
    await (await selector.wallet()).signOut();
  } finally {
    signOutAllowed = false;
  }
}

/**
 * wallet-selector core (10.1.4, onWalletSignedIn) calls signOut() on the previously selected wallet when a different
 * one signs in, i.e. during a connect; Meteor's signOut() opens its "Sign Out Request" popup. Every other signOut()
 * than disconnect's is made local: the wallet's own browser record is cleared and the core then switches wallets.
 */
async function guardSignOut(selector: WalletSelector) {
  for (const id of WALLET_IDS) {
    let wallet: Awaited<ReturnType<WalletSelector["wallet"]>>;
    try {
      wallet = await selector.wallet(id);
    } catch {
      continue;
    }
    const real = wallet.signOut;
    wallet.signOut = async () => {
      if (signOutAllowed) return real();
      removeKeys(WALLET_STORAGE[id]);
    };
  }
}

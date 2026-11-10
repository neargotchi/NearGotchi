// Wallet selector setup (testnet only; imported lazily so the demo build never loads it).

import type { WalletSelector } from "@near-wallet-selector/core";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";

import { DROP1_CONTRACT } from "./chain";

type Near = { selector: WalletSelector; modal: WalletSelectorModal };
let near: Promise<Near> | null = null;

export function getNear(): Promise<Near> {
  near ??= (async () => {
    const [{ setupWalletSelector }, { setupModal }, { setupMyNearWallet }, { setupMeteorWallet }] = await Promise.all([
      import("@near-wallet-selector/core"),
      import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/my-near-wallet"),
      import("@near-wallet-selector/meteor-wallet"),
    ]);
    const selector = await setupWalletSelector({ network: "testnet", modules: [setupMyNearWallet(), setupMeteorWallet()] });
    const modal = setupModal(selector, { contractId: DROP1_CONTRACT });
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

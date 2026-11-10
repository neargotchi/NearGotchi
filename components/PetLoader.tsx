import Image from "next/image";

import { petPage } from "../lib/copy";

/**
 * /pet while the wallet and the NFTs from the contract load (task 064): the egg and "loading your gotchi…" on the
 * page background, never an empty black screen. Also rendered by the server, so the first paint already has it.
 */
export default function PetLoader() {
  return (
    <div className="pet-loader" role="status" aria-live="polite">
      <Image className="pet-loader-egg" src="/logo-transparent.png" alt="" width={96} height={96} priority />
      <p className="pet-loader-text">
        {petPage.loading}
        <span className="pet-loader-dots" aria-hidden="true">
          <i>.</i>
          <i>.</i>
          <i>.</i>
        </span>
      </p>
    </div>
  );
}

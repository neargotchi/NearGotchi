import type { Metadata } from "next";

import { petPage } from "../../lib/copy";
import PetView from "./pet-view";

export const metadata: Metadata = { title: petPage.metaTitle };

/** /pet (docs/DEVLOG.md): demo pet with stats, feed and local chat. No wallet, no network. */
export default function PetPage() {
  return (
    <main className="mint-shell">
      <section className="mint-section" aria-labelledby="pet-title">
        <div className="pets-grid" aria-hidden="true" />
        <div className="pets-content">
          <PetView />
        </div>
      </section>
    </main>
  );
}

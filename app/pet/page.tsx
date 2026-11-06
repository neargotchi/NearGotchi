import type { Metadata } from "next";

import { petPage } from "../../lib/copy";
import { SITE_DESCRIPTION, pageMeta } from "../../lib/site";
import PetView from "./pet-view";

// Personal demo state: not indexed.
export const metadata: Metadata = pageMeta({ path: "/pet", title: petPage.metaTitle, description: SITE_DESCRIPTION, noindex: true });

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

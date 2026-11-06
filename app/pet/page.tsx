import type { Metadata } from "next";

import { petPage } from "../../lib/copy";
import PetStub from "./pet-stub";

export const metadata: Metadata = { title: petPage.metaTitle };

/** /pet stub until the full /pet task: the demo pet + start over, or "no pet yet". */
export default function PetPage() {
  return (
    <main className="mint-shell">
      <section className="mint-section" aria-labelledby="pet-title">
        <div className="pets-grid" aria-hidden="true" />
        <div className="pets-content">
          <PetStub />
        </div>
      </section>
    </main>
  );
}

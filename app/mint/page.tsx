import type { Metadata } from "next";

import Mascot from "../../components/Mascot";
import TitleSparkles from "../../components/TitleSparkles";
import { mintPage } from "../../lib/copy";
import MintFlow from "./mint-flow";

export const metadata: Metadata = {
  title: mintPage.metaTitle,
  description: mintPage.metaDescription,
};

/** /mint: demo hatch (docs/PLAN-MINT.md). No wallet, no network, no real mint. */
export default function MintPage() {
  return (
    <main className="mint-shell">
      <section className="mint-section" aria-labelledby="mint-title">
        <div className="pets-grid" aria-hidden="true" />
        <div className="pets-content">
          <header className="mint-head">
            <div className="section-head">
              <h1 id="mint-title" className="mint-title section-title-host">
                {mintPage.title}
                <TitleSparkles seed="title-mint" />
              </h1>
              <Mascot {...mintPage.mascot} />
            </div>
            <p className="mint-demo">{mintPage.demo}</p>
            <p className="mint-sub">{mintPage.sub}</p>
          </header>
          <MintFlow />
        </div>
      </section>
    </main>
  );
}

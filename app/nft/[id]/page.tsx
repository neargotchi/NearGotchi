import { readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fill, nftPage } from "../../../lib/copy";
import { DROP1_TOTAL, findToken } from "../../../lib/drop1";
import { findPet } from "../../../lib/mocks";
import { pageMeta } from "../../../lib/site";
import TokenCard from "../../pet/token-card";

/** Only /nft/1 … /nft/300 exist; anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: DROP1_TOTAL }, (_, index) => ({ id: String(index + 1) }));
}

type Props = { params: Promise<{ id: string }> };

const tokenOf = async (params: Props["params"]) => {
  const { id } = await params;
  return /^\d+$/.test(id) ? findToken(Number(id)) : null;
};

/** NEP-177 description written by scripts/build_metadata.py ("neargotchi drop 1 · #181 of 300 · rare dragon wearing a cap."). */
function description(tokenId: number) {
  const file = path.join(process.cwd(), "metadata", "drop1", `${tokenId}.json`);
  return (JSON.parse(readFileSync(file, "utf8")) as { description: string }).description;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const token = await tokenOf(params);
  if (!token) return {};
  const species = findPet(token.petId)?.species ?? "";
  return pageMeta({
    path: `/nft/${token.tokenId}`,
    title: fill(nftPage.metaTitle, { id: String(token.tokenId) }),
    description: description(token.tokenId),
    // 1200×630 card from scripts/build_og.py (summary_large_image on X).
    image: {
      url: `/og/drop1/${token.tokenId}.jpg`,
      width: 1200,
      height: 630,
      alt: fill(nftPage.imageAlt, { token: token.name, tier: token.tier, species }),
    },
  });
}

/**
 * Public page of one drop-1 token (docs/DEVLOG.md §2, step 9): the art and the token info, a demo
 * note and "hatch your own". Static (300 pages); it doesn't know who hatched it: the demo has no shared state.
 */
export default async function NftPage({ params }: Props) {
  const token = await tokenOf(params);
  if (!token) notFound();
  return (
    <main className="mint-shell">
      {/* Not a named landmark: the token card inside is the section named after the token. */}
      <div className="mint-section">
        <div className="pets-grid" aria-hidden="true" />
        <div className="pets-content nft-page">
          <TokenCard tokenId={token.tokenId} heading="h1" />
          <p className="nft-sub">{fill(nftPage.sub, { total: String(DROP1_TOTAL) })}</p>
          <div className="mint-actions">
            <Link className="button button-primary" href="/mint">
              {nftPage.cta}
            </Link>
            <Link className="button button-secondary" href="/#pets">
              {nftPage.pets}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

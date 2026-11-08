import type { MetadataRoute } from "next";

import { DROP1_TOTAL } from "../lib/drop1";
import { SITE_URL } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/mint`, changeFrequency: "monthly", priority: 0.8 },
    // The 300 public token pages (/nft/1 … /nft/300).
    ...Array.from({ length: DROP1_TOTAL }, (_, index) => ({
      url: `${SITE_URL}/nft/${index + 1}`,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    })),
  ];
}

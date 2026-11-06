import type { MetadataRoute } from "next";

import { SITE_URL } from "../lib/site";

/** Everything may be crawled; /pet (personal demo state) and the 404 carry a noindex meta instead. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

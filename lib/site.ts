import type { Metadata } from "next";

/** The one place for the public URL; NEXT_PUBLIC_SITE_URL overrides it for other deployments. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://neargotchi.com").replace(/\/+$/, "");
export const SITE_NAME = "NEARGOTCHI";
/** Default meta description. */
export const SITE_DESCRIPTION = "hatch one of 300 pixel pets. feed it, play with it, talk to it. on near.";

type ShareImage = { url: string; width: number; height: number; alt: string };
type PageMetaInput = { path: string; title: string; description: string; noindex?: boolean; image?: ShareImage };

/**
 * Canonical + Open Graph + Twitter for one page, always with the share image.
 */
/** app/opengraph-image.png + twitter-image.png (same picture); set explicitly because a page's own
    openGraph/twitter object replaces the images inherited from the root segment. */
const SHARE_IMAGE = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "NEARGOTCHI: your pet lives on near. pixel egg device with the near logo.",
};

export function pageMeta({ path, title, description, noindex = false, image }: PageMetaInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, url: path, title, description, images: [image ?? SHARE_IMAGE] },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image ?? { ...SHARE_IMAGE, url: "/twitter-image.png" }],
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

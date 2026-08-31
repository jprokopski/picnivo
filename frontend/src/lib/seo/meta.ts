import {
  OG_CARD_HEIGHT,
  OG_CARD_PATH,
  OG_CARD_WIDTH,
  SITE_NAME,
} from "./constants";

const TITLE_MAX = 60;
const DESCRIPTION_MAX = 160;

// Truncates on the last word boundary within `max` rather than mid-word —
// all four platforms (SERP, Facebook, X, LinkedIn) clip mid-word otherwise.
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const sliced = text.slice(0, max - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const boundary = lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced;
  return `${boundary}…`;
}

export type BuildMetaOptions = {
  title: string;
  description: string;
  path: string;
  origin: string;
  image?: string;
  imageAlt?: string;
  noindex?: boolean;
  type?: "website" | "article";
};

// Narrower than router-core's own `MetaDescriptor` union, which also
// includes a `'script:ld+json'` variant. That variant shares zero
// properties with the `MetaHTMLAttributes`-shaped type TanStack Router's
// `head()` actually expects for `meta`, so importing the full union here
// breaks assignability at every real `head()` call site even though
// buildMeta() never produces that variant.
export type SeoMetaTag =
  | { charSet: "utf-8" }
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

export type BuildMetaResult = {
  meta: SeoMetaTag[];
  links: Array<{ rel: string; href: string }>;
};

// Turns one options object into the complete `meta` and `links` arrays a
// TanStack route `head()` returns, so a route can never ship a card that
// works on Facebook but not X. See the tag table in the phase 2 plan for
// which platform consumes which entry.
export function buildMeta({
  title,
  description,
  path,
  origin,
  image = OG_CARD_PATH,
  imageAlt = SITE_NAME,
  noindex = false,
  type = "website",
}: BuildMetaOptions): BuildMetaResult {
  const truncatedTitle = truncate(title, TITLE_MAX);
  const truncatedDescription = truncate(description, DESCRIPTION_MAX);
  const url = new URL(path, origin).toString();
  const absoluteImage = new URL(image, origin).toString();

  const meta: SeoMetaTag[] = [
    { title: truncatedTitle },
    { name: "description", content: truncatedDescription },
    { property: "og:title", content: truncatedTitle },
    { property: "og:description", content: truncatedDescription },
    { property: "og:url", content: url },
    { property: "og:type", content: type },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "en_US" },
    { property: "og:image", content: absoluteImage },
    { property: "og:image:width", content: String(OG_CARD_WIDTH) },
    { property: "og:image:height", content: String(OG_CARD_HEIGHT) },
    { property: "og:image:alt", content: imageAlt },
    { property: "og:image:type", content: "image/png" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: truncatedTitle },
    { name: "twitter:description", content: truncatedDescription },
    { name: "twitter:image", content: absoluteImage },
    { name: "twitter:image:alt", content: imageAlt },
  ];

  if (noindex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  }

  return {
    meta,
    links: [{ rel: "canonical", href: url }],
  };
}

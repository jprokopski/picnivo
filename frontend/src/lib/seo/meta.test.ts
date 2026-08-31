import { describe, expect, it } from "vitest";
import type { MetaDescriptor } from "@tanstack/react-router";
import { buildMeta } from "./meta";

const BASE = {
  title: "Picnivo",
  description:
    "Pick a date together, split what to bring, and share one link with the group.",
  path: "/login",
  origin: "https://picnivo.app",
};

type NamedTag = { name: string; content: string };
type PropertyTag = { property: string; content: string };
type TitleTag = { title: string };

function isNamedTag(tag: MetaDescriptor): tag is NamedTag {
  return "name" in tag;
}
function isPropertyTag(tag: MetaDescriptor): tag is PropertyTag {
  return "property" in tag;
}
function isTitleTag(tag: MetaDescriptor): tag is TitleTag {
  return "title" in tag;
}

function findByName(meta: MetaDescriptor[], name: string) {
  return meta.find(
    (tag): tag is NamedTag => isNamedTag(tag) && tag.name === name,
  );
}
function findByProperty(meta: MetaDescriptor[], property: string) {
  return meta.find(
    (tag): tag is PropertyTag =>
      isPropertyTag(tag) && tag.property === property,
  );
}
function findTitle(meta: MetaDescriptor[]) {
  return meta.find((tag): tag is TitleTag => isTitleTag(tag));
}

describe("buildMeta", () => {
  it("emits the full tag vocabulary for a default call", () => {
    const { meta, links } = buildMeta(BASE);

    expect(findTitle(meta)?.title).toBe(BASE.title);
    expect(findByName(meta, "description")?.content).toBe(BASE.description);
    expect(findByProperty(meta, "og:title")).toBeDefined();
    expect(findByProperty(meta, "og:description")).toBeDefined();
    expect(findByProperty(meta, "og:url")).toBeDefined();
    expect(findByProperty(meta, "og:type")?.content).toBe("website");
    expect(findByProperty(meta, "og:site_name")).toBeDefined();
    expect(findByProperty(meta, "og:locale")).toBeDefined();
    expect(findByProperty(meta, "og:image")).toBeDefined();
    expect(findByProperty(meta, "og:image:width")?.content).toBe("1200");
    expect(findByProperty(meta, "og:image:height")?.content).toBe("630");
    expect(findByProperty(meta, "og:image:alt")).toBeDefined();
    expect(findByProperty(meta, "og:image:type")?.content).toBe("image/png");
    expect(findByName(meta, "twitter:card")?.content).toBe(
      "summary_large_image",
    );
    expect(findByName(meta, "twitter:title")).toBeDefined();
    expect(findByName(meta, "twitter:description")).toBeDefined();
    expect(findByName(meta, "twitter:image")).toBeDefined();
    expect(findByName(meta, "twitter:image:alt")).toBeDefined();
    expect(links).toEqual([
      { rel: "canonical", href: "https://picnivo.app/login" },
    ]);
  });

  it("builds absolute og:image and og:url from origin", () => {
    const { meta } = buildMeta(BASE);

    expect(findByProperty(meta, "og:image")?.content).toBe(
      "https://picnivo.app/og-card.png",
    );
    expect(findByProperty(meta, "og:url")?.content).toBe(
      "https://picnivo.app/login",
    );
  });

  it("omits robots by default and emits noindex,nofollow when requested", () => {
    expect(findByName(buildMeta(BASE).meta, "robots")).toBeUndefined();

    const withNoindex = buildMeta({ ...BASE, noindex: true }).meta;
    expect(findByName(withNoindex, "robots")?.content).toBe(
      "noindex, nofollow",
    );
  });

  it("truncates an over-length title on a word boundary", () => {
    const longTitle = `${"A".repeat(50)} ${"B".repeat(20)}`;
    const { meta } = buildMeta({ ...BASE, title: longTitle });
    const title = findTitle(meta)?.title ?? "";

    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toContain("B");
  });

  it("truncates an over-length description on a word boundary", () => {
    const longDescription = Array.from(
      { length: 40 },
      (_, i) => `word${i}`,
    ).join(" ");
    const { meta } = buildMeta({ ...BASE, description: longDescription });
    const description = findByName(meta, "description")?.content ?? "";

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
    expect(description.endsWith(" ")).toBe(false);
  });

  it("always emits twitter:card as summary_large_image", () => {
    expect(findByName(buildMeta(BASE).meta, "twitter:card")?.content).toBe(
      "summary_large_image",
    );
  });
});

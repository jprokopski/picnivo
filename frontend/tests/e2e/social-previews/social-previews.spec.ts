import { test, expect } from "@playwright/test";
import { wakeHydration } from "../setup/utils";

// Provenance
//   Risk:  context/foundation/test-plan.md — the core mechanic of this
//          change (PRD US-01: "they get a shareable link they can send to
//          friends") is worthless if the card social scrapers actually fetch
//          is broken. Scrapers never execute JavaScript, so any assertion
//          against the post-hydration DOM would pass while the real,
//          server-rendered card stays broken — this spec fetches raw HTML
//          over HTTP instead, exactly like a scraper would.
//   Seed:  tests/e2e/seed/seed.spec.ts (event-creation-via-UI pattern).

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayLabel(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

function head(html: string): string {
  const match = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return match ? match[1] : "";
}

function metaContent(
  headHtml: string,
  attr: "property" | "name",
  key: string,
): string | undefined {
  const attrFirst = new RegExp(
    `<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const contentFirst = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    "i",
  );
  return headHtml.match(attrFirst)?.[1] ?? headHtml.match(contentFirst)?.[1];
}

test("event page SSR head carries a working card and stays out of the index; /login carries the site card and is indexable", async ({
  page,
  browser,
  request,
}) => {
  const eventTitle = `Preview E2E Picnic ${Date.now()}`;
  const eventLocation = `Riverside Park ${Date.now()}`;
  const guestName = `Private Guest ${Date.now()}`;
  const dateLabel = dayLabel(1);

  // --- Organizer creates a single-date event with a location ---
  await page.goto("/create");

  const titleField = page.getByLabel("Event name");
  await wakeHydration(titleField);
  await titleField.fill(eventTitle);
  await page.getByLabel("Where").fill(eventLocation);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText(dateLabel, { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Create & get link" }).click();
  await expect(
    page.getByRole("heading", { name: "Your picnic is live!" }),
  ).toBeVisible();

  const shareUrl = await page.getByTestId("share-url-box").innerText();
  const token = shareUrl.trim().split("/e/")[1];

  // --- A guest joins so the privacy assertion below has a real name to
  // check for — proving the card omits it, not just that nobody happened to
  // pass one in. ---
  const guestContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/e/${token}`);
  const nameField = guestPage.getByRole("textbox", { name: "Your name" });
  await wakeHydration(nameField);
  await nameField.fill(guestName);
  await guestPage.getByRole("button", { name: "Join" }).click();
  // The join bar unmounts once `event.you` is set server-side (see
  // event-detail-view.tsx) — a real signal the join round-tripped, not just
  // optimistic client state. The guest's own name never renders on their own
  // page (it shows as "You"), so this is the join-succeeded check, not a
  // name-visibility one.
  await expect(
    guestPage.getByRole("button", { name: "Join" }),
  ).not.toBeVisible();
  await guestContext.close();

  // --- Fetch the event page's raw HTML, exactly as a scraper would — no
  // JavaScript execution, so anything only applied on hydration would be
  // invisible here and this assertion would still (wrongly) pass. ---
  const eventResponse = await request.get(`/e/${token}`);
  expect(eventResponse.ok()).toBe(true);
  const eventHead = head(await eventResponse.text());

  expect(metaContent(eventHead, "property", "og:title")).toContain(eventTitle);
  const ogImage = metaContent(eventHead, "property", "og:image");
  expect(ogImage).toMatch(/^https?:\/\//);
  expect(metaContent(eventHead, "name", "twitter:card")).toBe(
    "summary_large_image",
  );
  expect(metaContent(eventHead, "name", "robots")).toContain("noindex");

  // --- Privacy boundary: neither the guest nor the organizer's name may
  // ever reach a publicly-scraped card. ---
  expect(eventHead).not.toContain(guestName);
  expect(eventHead).not.toContain("E2E Organizer");

  // --- /login must carry the full tag set and must NOT be excluded from
  // the index — this is the page Google is meant to rank. ---
  const loginResponse = await request.get("/login");
  expect(loginResponse.ok()).toBe(true);
  const loginHead = head(await loginResponse.text());

  expect(metaContent(loginHead, "property", "og:image")).toMatch(
    /^https?:\/\//,
  );
  expect(metaContent(loginHead, "property", "og:title")).toBeTruthy();
  expect(metaContent(loginHead, "name", "twitter:card")).toBe(
    "summary_large_image",
  );
  expect(loginHead).toMatch(/<link[^>]*rel=["']canonical["']/i);
  expect(metaContent(loginHead, "name", "robots")).toBeUndefined();

  // --- Cleanup ---
  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Delete event" }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await confirmDialog.getByRole("button", { name: "Delete event" }).click();
  await page.waitForURL("/events");
});

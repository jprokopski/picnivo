import { test, expect } from "@playwright/test";
import { wakeHydration } from "./utils";

// Provenance
//   Risk:  context/foundation/test-plan.md §5 quality gate — "broken
//          end-to-end participant flow". A joined participant's vote on a date
//          can register optimistically client-side yet never reach the server,
//          so it silently vanishes the moment the page is reloaded.
//   Seed:  tests/e2e/seed.spec.ts (RSVP-survives-reload). This is its sibling
//          for the *voting* leg of the participant journey — and it needs a
//          MULTI-date event, because a single-date event is an "announcement"
//          (isAnnouncement = dateOptions.length === 1) and renders no vote
//          controls at all.

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

test("participant's date vote survives a page reload after voting via the share link", async ({
  page,
  browser,
}) => {
  const eventTitle = `Vote E2E Picnic ${Date.now()}`;
  const guestName = `Voter ${Date.now()}`;

  // The suggested pool offers tomorrow, +2, +3 — pick the first two so the
  // event has >1 date and voting opens.
  const firstDateLabel = dayLabel(1);
  const secondDateLabel = dayLabel(2);

  // --- Organizer creates a two-date event (so voting, not announcement, renders) ---
  await page.goto("/create");

  const titleField = page.getByLabel("Event name");
  await wakeHydration(titleField);
  await titleField.fill(eventTitle);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText(firstDateLabel, { exact: true }).click();
  await page.getByText(secondDateLabel, { exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Create & get link" }).click();
  await expect(
    page.getByRole("heading", { name: "Your picnic is live!" }),
  ).toBeVisible();

  const shareUrl = await page.getByTestId("share-url-box").innerText();
  const token = shareUrl.trim().split("/e/")[1];

  // --- Guest opens the link in a fresh, unauthenticated browser context ---
  // (an explicit empty storageState is required — newContext() otherwise
  // inherits the chromium project's organizer storageState by default).
  const guestContext = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const guestPage = await guestContext.newPage();
  await guestPage.goto(`/e/${token}`);

  // --- Guest joins (vote controls only render once you're a participant) ---
  const nameField = guestPage.getByRole("textbox", { name: "Your name" });
  await wakeHydration(nameField);
  await nameField.fill(guestName);
  await guestPage.getByRole("button", { name: "Join" }).click();

  // --- Guest votes Yes on the first date ---
  // Two vote groups exist per row (desktop + a display:none mobile clone);
  // the hidden one is out of the accessibility tree, so .first() is the first
  // *visible* Yes button — the earliest date's row.
  const firstYes = guestPage.getByRole("button", { name: "Yes" }).first();
  await firstYes.click();

  // The tally comes back from the server via router.invalidate(), so exactly
  // one row now reads "1 yes" (the other stays "0 yes") — a real round trip,
  // not just optimistic local state.
  await expect(guestPage.getByText("1 yes", { exact: true })).toBeVisible();
  await expect(firstYes).toHaveAttribute("aria-pressed", "true");

  // --- The reload is the risk check: a real SSR round trip against the real
  // backend/DB. If the vote was never persisted, "1 yes" reverts to "0 yes"
  // and the button loses its pressed state. ---
  await guestPage.reload();
  await expect(guestPage.getByText("1 yes", { exact: true })).toBeVisible();
  await expect(
    guestPage.getByRole("button", { name: "Yes" }).first(),
  ).toHaveAttribute("aria-pressed", "true");

  // --- Cleanup ---
  await guestContext.close();
  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Delete event" }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await confirmDialog.getByRole("button", { name: "Delete event" }).click();
  await page.waitForURL("/events");
});

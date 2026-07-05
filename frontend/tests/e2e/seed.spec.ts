import { test, expect } from "@playwright/test";
import { wakeHydration } from "./utils";

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

// Risk (context/foundation/test-plan.md, critical participant flow): a
// guest's RSVP could appear to succeed client-side but never actually reach
// the server, so it vanishes the moment they revisit the link.
test("participant's RSVP survives a page reload after joining via the share link", async ({
  page,
  browser,
}) => {
  const eventTitle = `Seed E2E Picnic ${Date.now()}`;
  const guestName = `Guest ${Date.now()}`;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateLabel = `${DOW[tomorrow.getDay()]}, ${MON[tomorrow.getMonth()]} ${tomorrow.getDate()}`;

  // --- Organizer creates a single-date event ---
  await page.goto("/create");

  const titleField = page.getByLabel("Event name");
  await wakeHydration(titleField);
  await titleField.fill(eventTitle);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByText(dateLabel, { exact: true }).click();
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

  const nameField = guestPage.getByRole("textbox", { name: "Your name" });
  await wakeHydration(nameField);
  await nameField.fill(guestName);
  await guestPage.getByRole("button", { name: "Join" }).click();

  // Two "I'm in" buttons render (attendance card + claim-items nudge) —
  // both call the same confirm-attendance action, so either is correct.
  await guestPage.getByRole("button", { name: "I'm in" }).first().click();
  await expect(guestPage.getByText("You're in")).toBeVisible();

  // The reload forces a real SSR round trip against the real backend/DB —
  // proving the RSVP is server-persisted, not just optimistic client state.
  await guestPage.reload();
  await expect(guestPage.getByText("You're in")).toBeVisible();

  // --- Cleanup ---
  await guestContext.close();
  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Delete event" }).click();
  const confirmDialog = page.getByRole("alertdialog");
  await confirmDialog.getByRole("button", { name: "Delete event" }).click();
  await page.waitForURL("/events");
});

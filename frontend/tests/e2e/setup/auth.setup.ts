import { test as setup } from "@playwright/test";
import { wakeHydration } from "./utils";

const authFile = "tests/e2e/setup/.auth/organizer.json";

// One organizer account per full test-suite run — signed up once here via the
// real UI, then every spec reuses the saved storageState instead of logging
// in through the UI itself (see e2e-quality-rules.md).
setup("authenticate as organizer", async ({ page }) => {
  const email = `e2e-organizer-${Date.now()}@picnivo.test`;

  await page.goto("/login?mode=signup");

  const nameField = page.getByLabel("Your name");
  await wakeHydration(nameField);
  await nameField.fill("E2E Organizer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("E2ePassword123!");
  await page.getByRole("button", { name: "Create account" }).click();

  await page.waitForURL("/events");

  await page.context().storageState({ path: authFile });
});

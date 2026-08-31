import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "@playwright/test";

const WIDTH = 1200;
const HEIGHT = 630;
const REQUIRED_FONTS = ["Bricolage Grotesque", "Hanken Grotesk"];

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.join(scriptsDir, "og-card.html");
const outputPath = path.join(scriptsDir, "..", "public", "og-card.png");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(`file://${templatePath}`);
  await page.evaluate(() => document.fonts.ready);

  const loadedFamilies = await page.evaluate(() =>
    Array.from(document.fonts).map((f) => f.family.replace(/(^"|"$)/g, "")),
  );
  const missing = REQUIRED_FONTS.filter(
    (name) => !loadedFamilies.includes(name),
  );
  if (missing.length > 0) {
    throw new Error(
      `og-card: required webfont(s) failed to load: ${missing.join(", ")}. ` +
        "Refusing to write a card with system-font fallback.",
    );
  }

  await page.screenshot({ path: outputPath });
} finally {
  await browser.close();
}

console.log(`og-card: wrote ${outputPath}`);

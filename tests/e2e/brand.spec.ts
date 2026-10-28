import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("brand comparison loads exact source and application SVG without social controls", async ({ page }) => {
  const reference = await readFile("docs/brand/reference.jpeg");
  const vector = await readFile("public/brand/cueva-symbol.svg");
  let html = await readFile("evidence/logo-comparison.html", "utf8");
  html = html.replace("../docs/brand/reference.jpeg", `data:image/jpeg;base64,${reference.toString("base64")}`)
    .replace("../public/brand/cueva-symbol.svg", `data:image/svg+xml;base64,${vector.toString("base64")}`);
  await page.setViewportSize({ width: 1120, height: 850 });
  await page.setContent(html);
  await expect(page.locator("img")).toHaveCount(2);
  expect(await page.locator("img").evaluateAll((images) => images.every((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  expect(vector.toString()).not.toMatch(/<text\b|<image\b|<script\b|foreignObject|instagram|seguir|compartir/i);
  await page.screenshot({ path: "evidence/runs/logo-comparison.png", fullPage: true });
});

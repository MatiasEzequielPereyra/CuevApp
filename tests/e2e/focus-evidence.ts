import type { Page, TestInfo } from "@playwright/test";

/** Evidence is best-effort; a closed page must never replace the failed assertion. */
export async function attachFocusEvidence(page: Pick<Page, "evaluate">, testInfo: Pick<TestInfo, "attach">) {
  try {
    const trace = await page.evaluate(() => Reflect.get(window, "cuevaFocusTrace"));
    await testInfo.attach("focus-events", { body: JSON.stringify(trace, null, 2), contentType: "application/json" });
  } catch (error) {
    await testInfo.attach("focus-evidence-unavailable", {
      body: error instanceof Error ? error.message : "Focus evidence unavailable",
      contentType: "text/plain",
    }).catch(() => {});
  }
}

import { expect, test, type Browser } from "@playwright/test";

const android = "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const safari = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const chromeIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1";

async function phone(browser: Browser, baseURL: string, userAgent: string) {
  const context = await browser.newContext({
    userAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(new URL("/ingresar", baseURL).href);
  return { context, page };
}

test("manifest incluye PNG 192/512 y Apple 180 del logotipo, sin tamaños arbitrarios", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json() as { display: string; start_url: string; icons: Array<{ src: string; sizes: string; type: string }> };
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/cuenta");
  for (const size of [192, 512]) {
    expect(manifest.icons).toContainEqual(expect.objectContaining({ src: `/api/pwa/icon/${size}`, sizes: `${size}x${size}`, type: "image/png" }));
  }
  for (const size of [180, 192, 512]) {
    const icon = await request.get(`/api/pwa/icon/${size}`);
    expect(icon.status()).toBe(200);
    expect(icon.headers()["content-type"]).toContain("image/png");
    const data = await icon.body();
    expect([...data.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(data.readUInt32BE(16)).toBe(size);
    expect(data.readUInt32BE(20)).toBe(size);
  }
  expect((await request.get("/api/pwa/icon/4096")).status()).toBe(404);
});

test("Android muestra ayuda en primera visita y respeta el descarte durante la semana", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Falta baseURL.");
  const { context, page } = await phone(browser, baseURL, android);
  try {
    const banner = page.getByTestId("pwa-install-prompt");
    await expect(banner).toBeVisible();
    await expect(page.getByRole("heading", { name: "Instalá CUEVA" })).toBeVisible();
    await page.getByRole("button", { name: "Cómo instalar" }).click();
    await expect(banner).toContainText("tres puntos");
    await expect(banner).toContainText("Instalar aplicación");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Ahora no" }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(banner).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("Android abre el diálogo nativo solo con gesto explícito y oculta al instalar", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Falta baseURL.");
  const { context, page } = await phone(browser, baseURL, android);
  try {
    const banner = page.getByTestId("pwa-install-prompt");
    await expect(banner).toBeVisible();
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.defineProperty(event, "prompt", { value: async () => {
        window.sessionStorage.setItem("pwa-test-prompt-used", "yes");
        return { outcome: "accepted" };
      } });
      window.dispatchEvent(event);
    });
    await page.getByRole("button", { name: "Instalar ahora" }).click();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem("pwa-test-prompt-used"))).toBe("yes");
    await expect(banner).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await page.reload();
    await expect(banner).toHaveCount(0);
  } finally {
    await context.close();
  }
});

for (const [browserName, agent, copy] of [
  ["Safari iOS", safari, "En Safari"],
  ["Chrome iOS", chromeIos, "En Chrome"],
] as const) {
  test(`${browserName} enseña cómo agregar a inicio sin prometer un diálogo nativo`, async ({ browser, baseURL }) => {
    if (!baseURL) throw new Error("Falta baseURL.");
    const { context, page } = await phone(browser, baseURL, agent);
    try {
      const banner = page.getByTestId("pwa-install-prompt");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(copy);
      await expect(banner).toContainText("Agregar a pantalla de inicio");
      await expect(page.getByRole("button", { name: "Instalar ahora" })).toHaveCount(0);
      await page.getByRole("button", { name: "Ya la instalé" }).click();
      await expect(banner).toHaveCount(0);
      await page.reload();
      await expect(banner).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}

test("no aparece en modo PWA instalada ni en escritorio", async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error("Falta baseURL.");
  const desktop = await browser.newPage();
  try {
    await desktop.goto(new URL("/ingresar", baseURL).href);
    await expect(desktop.getByTestId("pwa-install-prompt")).toHaveCount(0);
  } finally {
    await desktop.close();
  }
  const context = await browser.newContext({ userAgent: safari, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  try {
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
    });
    const page = await context.newPage();
    await page.goto(new URL("/ingresar", baseURL).href);
    await expect(page.getByTestId("pwa-install-prompt")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

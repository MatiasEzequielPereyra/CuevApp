import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";

const transpile = (path: string) => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const modules = {
  react: readFileSync("node_modules/react/cjs/react.development.js", "utf8"),
  "react/jsx-runtime": readFileSync("node_modules/react/cjs/react-jsx-runtime.development.js", "utf8"),
  "react-dom": readFileSync("node_modules/react-dom/cjs/react-dom.development.js", "utf8"),
  "react-dom/client": readFileSync("node_modules/react-dom/cjs/react-dom-client.development.js", "utf8"),
  scheduler: readFileSync("node_modules/scheduler/cjs/scheduler.development.js", "utf8"),
  "next/navigation": 'exports.useRouter = () => ({ refresh() { document.body.dataset.refreshed = "true"; } });',
  "@/lib/receipts/contracts": transpile("src/lib/receipts/contracts.ts"),
  upload: transpile("src/components/receipts/receipt-upload.tsx"),
  review: transpile("src/components/receipts/receipt-review.tsx"),
};
const id = "11111111-1111-4111-8111-111111111111";
const fixtureOrigin = "http://127.0.0.1:3000";
const css = readFileSync("src/app/globals.css", "utf8");

async function mount(page: Page, kind: "upload" | "review") {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route(`${fixtureOrigin}/__receipts-fixture`, route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="es-AR" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><main id="root" class="membership-card"></main></body></html>`,
  }));
  await page.goto(`${fixtureOrigin}/__receipts-fixture`);
  await page.addScriptTag({ content: `(() => {
    const process = { env: { NODE_ENV: "development" } };
    const modules = {${Object.entries(modules).map(([key, code]) => `${JSON.stringify(key)}: (require, module, exports) => {\n${code}\n}`).join(",\n")}};
    const cache = {};
    function require(id) {
      if (!modules[id]) throw new Error("Unexpected fixture import: " + id);
      if (!cache[id]) {
        cache[id] = { exports: {} };
        modules[id](require, cache[id], cache[id].exports);
      }
      return cache[id].exports;
    }
    require("react-dom/client").createRoot(document.getElementById("root")).render(
      require("react").createElement(require(${JSON.stringify(kind)})[${JSON.stringify(kind === "upload" ? "ReceiptUpload" : "ReceiptReview")}],
        { id: "${id}", period: "${id}", today: "2026-11-07" })
    );
  })();` });
}

test("el alumno reintenta una presentaci�n con la misma operaci�n y sin volver a subir los bytes", async ({ page }) => {
  let uploaded = false, transfers = 0, submitted = 0;
  const operations: string[] = [];
  await page.route(`${fixtureOrigin}/__receipts-upload`, async route => {
    transfers++;
    uploaded = true;
    await route.fulfill({ status: 200 });
  });
  await page.route("**/api/comprobantes", async route => {
    const body = route.request().postDataJSON();
    operations.push(body.id);
    if (body.action === "prepare") {
      await route.fulfill({ json: { uploadId: "55555555-5555-4555-8555-555555555555",
        ...(uploaded ? { uploaded: true } : { uploadUrl: `${fixtureOrigin}/__receipts-upload` }) } });
      return;
    }
    submitted++;
    await route.fulfill(submitted === 1
      ? { status: 503, json: { message: "No pudimos confirmar la presentaci�n." } }
      : { json: { submitted: true } });
  });
  await mount(page, "upload");
  await page.getByLabel("Archivo del comprobante").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  const button = page.getByRole("button", { name: "Presentar comprobante", exact: true });
  await button.click();
  await expect(page.getByRole("status")).toHaveText("No pudimos confirmar la presentaci�n.");
  await button.click();
  await expect(page.getByRole("status")).toContainText("Comprobante presentado");
  expect(transfers).toBe(1);
  expect(submitted).toBe(2);
  expect(new Set(operations).size).toBe(1);
  await expect(page.locator("body")).toHaveAttribute("data-refreshed", "true");
});

test("la bandeja env�a importe, fecha real y medio, y muestra un cierre sin efecto", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/comprobantes/revisar", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { state: "superseded" } });
  });
  await mount(page, "review");
  await page.getByLabel("Importe en pesos").fill("1234,50");
  await page.getByLabel("Fecha real del pago").fill("2026-11-06");
  await page.getByLabel("Medio de pago").selectOption("otro");
  await page.getByLabel("Descripci�n del medio").fill("Billetera");
  await page.getByRole("button", { name: "Confirmar y registrar pago" }).click();
  await expect(page.getByRole("status")).toHaveText("Sin efecto: per�odo ya saldado");
  expect(requests).toEqual([expect.objectContaining({
    id, action: "approve", amount: "1234,50", date: "2026-11-06", method: "otro", detail: "Billetera",
  })]);
  await expect(page.getByRole("button", { name: "Confirmar y registrar pago" })).toBeDisabled();
});

test("el rechazo exige motivo antes de enviar la revisi�n", async ({ page }) => {
  let reason: string | undefined;
  await page.route("**/api/comprobantes/revisar", async route => {
    reason = route.request().postDataJSON().reason;
    await route.fulfill({ json: { state: "rejected" } });
  });
  await mount(page, "review");
  await page.getByLabel("Decisi�n").selectOption("reject");
  const button = page.getByRole("button", { name: "Rechazar comprobante", exact: true });
  await button.click();
  await expect(page.getByLabel("Motivo visible para el alumno")).toBeFocused();
  expect(reason).toBeUndefined();
  await page.getByLabel("Motivo visible para el alumno").fill("Falta la fecha");
  await button.click();
  await expect(page.getByRole("status")).toHaveText("Rechazado");
  expect(reason).toBe("Falta la fecha");
});


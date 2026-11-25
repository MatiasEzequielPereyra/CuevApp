import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

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
  preview: transpile("src/components/receipts/receipt-preview.tsx"),
};
const id = "11111111-1111-4111-8111-111111111111";
const fixtureOrigin = "http://127.0.0.1:3000";
const css = readFileSync("src/app/globals.css", "utf8") + readFileSync("src/app/pagos/comprobantes/comprobantes.css", "utf8");

async function mount(page: Page, kind: "upload" | "review" | "preview", reload = false) {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route(`${fixtureOrigin}/__receipts-fixture`, route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="es-AR" data-theme="dark"><head><title>CUEVA</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="dashboard"><main class="receipts-page" id="root"></main></body></html>`,
  }));
  if (reload) await page.reload();
  else await page.goto(`${fixtureOrigin}/__receipts-fixture`);
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
      require("react").createElement(require(${JSON.stringify(kind)})[${JSON.stringify(kind === "upload" ? "ReceiptUpload" : kind === "review" ? "ReceiptReview" : "ReceiptPreview")}],
        { id: "${id}", period: "${id}", today: "2026-11-07" })
    );
  })();` });
}

test("la vista previa autoriza la imagen, reintenta y cierra sin descargar", async ({ page }) => {
  const downloads: string[] = [];
  page.on("download", download => downloads.push(download.suggestedFilename()));
  let calls = 0;
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=", "base64");
  await page.route("**/api/comprobantes?**", async route => {
    expect(new URL(route.request().url()).searchParams.get("preview")).toBe("1");
    calls++;
    await route.fulfill(calls === 1
      ? { status: 503, json: { message: "Servicio temporalmente no disponible." } }
      : { contentType: "image/png", body: image, headers: { "cache-control": "private, no-store", "content-disposition": "inline" } });
  });
  await mount(page, "preview");
  const trigger = page.getByRole("button", { name: "Ver comprobante", exact: true });
  for (const width of [360, 390, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const theme of ["light", "dark"]) {
      await page.locator("html").evaluate((element, value) => element.setAttribute("data-theme", value), theme);
      await trigger.focus();
      await trigger.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Vista previa del comprobante" });
      await expect(dialog.getByRole("button", { name: "Cerrar" })).toBeFocused();
      if (calls === 1) {
        await expect(dialog.getByRole("alert")).toContainText("No pudimos abrir");
        await dialog.getByRole("button", { name: "Reintentar" }).click();
      }
      const picture = dialog.getByRole("img", { name: "Comprobante de pago" });
      await expect(picture).toBeVisible();
      await expect.poll(() => picture.evaluate(element => element instanceof HTMLImageElement && element.naturalWidth)).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
      await expect(picture).toHaveCount(0);
    }
  }
  expect(downloads).toEqual([]);
});

test("la vista previa de PDF permite cerrar el visor dentro de la aplicación", async ({ page }) => {
  await page.route("**/api/comprobantes?**", route => route.fulfill({
    contentType: "application/pdf", body: "%PDF-1.4\n%%EOF",
  }));
  await mount(page, "preview");
  await page.getByRole("button", { name: "Ver comprobante", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator('iframe[title="Comprobante en PDF"]')).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Abrir PDF" })).toHaveAttribute("href", /^blob:/);
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).toBeHidden();
});

test("la API de vista previa conserva los permisos y entrega bytes inline privados", async () => {
  let authenticated = true;
  let visible = true;
  let storageCalls = 0;
  let signedCalls = 0;
  let mediaType = "image/png";
  const contents = new Uint8Array([137, 80, 78, 71]);
  const storage = {
    from: () => ({
      download: async () => { storageCalls++; return { data: new Blob([contents], { type: mediaType }), error: null }; },
      createSignedUrl: async (_path: string, _seconds: number, options: { download: string }) => {
        signedCalls++;
        expect(options).toEqual({ download: "comprobante.png" });
        return { data: { signedUrl: "https://storage.example.test/signed" }, error: null };
      },
    }),
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id } : null }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
      data: visible ? { object_path: "private/example.png", media_type: mediaType } : null, error: null,
    }) }) }) }),
  };
  const dependencies: Record<string, unknown> = {
    "node:crypto": { createHash },
    "next/server": { NextResponse },
    "@/lib/product-auth/server": { productConfig: () => ({}), userClient: async () => client },
    "@/lib/routines/request": {},
    "@/lib/routines/types": { uuid: /^[0-9a-f-]{36}$/i },
    "@/lib/receipts/contracts": {
      receiptExtensions: { "image/png": "png", "image/jpeg": "jpg", "application/pdf": "pdf" },
      receiptBucket: "cueva-payment-receipts", maxReceiptBytes: 10485760,
    },
    "@/lib/receipts/file": {},
    "@/lib/receipts/server": { receiptStorage: async () => storage },
  };
  const routeModule = { exports: {} as { GET: (request: Request) => Promise<Response> } };
  new Function("require", "module", "exports", transpile("src/app/api/comprobantes/route.ts"))(
    (name: string) => {
      if (!Object.hasOwn(dependencies, name)) throw new Error("Unexpected import " + name);
      return dependencies[name];
    }, routeModule, routeModule.exports,
  );
  const read = (preview = true) => routeModule.exports.GET(new Request(`${fixtureOrigin}/api/comprobantes?id=${id}${preview ? "&preview=1" : ""}`));
  for (const state of ["anonymous", "other-student"]) {
    authenticated = state !== "anonymous";
    visible = false;
    expect((await read()).status).toBe(403);
  }
  expect(storageCalls).toBe(0);
  authenticated = true;
  visible = true;
  const response = await read();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("content-disposition")).toBe('inline; filename="comprobante.png"');
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(contents);
  expect(signedCalls).toBe(0);
  const original = await read(false);
  expect(original.status).toBe(307);
  expect(signedCalls).toBe(1);
  mediaType = "text/html";
  expect((await read()).status).toBe(415);
});

test("el alumno reintenta una presentación con la misma operación y sin volver a subir los bytes", async ({ page }) => {
  let uploaded = false, transfers = 0, submitted = 0;
  const operations: string[] = [];
  let operationId: string;
  await page.route(`${fixtureOrigin}/__receipts-upload`, async route => {
    transfers++;
    uploaded = true;
    await route.fulfill({ status: 200 });
  });
  await page.route("**/api/comprobantes", async route => {
    const body = route.request().postDataJSON();
    operations.push(body.id);
    if (body.action === "prepare") {
      operationId ??= body.id;
      await route.fulfill({ json: { operationId, uploadId: "55555555-5555-4555-8555-555555555555",
        ...(uploaded ? { uploaded: true } : { uploadUrl: `${fixtureOrigin}/__receipts-upload` }) } });
      return;
    }
    submitted++;
    await route.fulfill(submitted === 1
      ? { status: 503, json: { message: "No pudimos confirmar la presentación." } }
      : { json: { submitted: true } });
  });
  await mount(page, "upload");
  await page.getByLabel("Archivo del comprobante").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  const button = page.getByRole("button", { name: "Presentar comprobante", exact: true });
  await button.click();
  await expect(page.getByRole("status")).toHaveText("No pudimos confirmar la presentación.");
  await button.click();
  await expect(page.getByRole("status")).toContainText("Comprobante presentado");
  expect(transfers).toBe(1);
  expect(submitted).toBe(2);
  expect(new Set(operations).size).toBe(1);
  await expect(page.locator("body")).toHaveAttribute("data-refreshed", "true");
});

test("la bandeja envía importe, fecha real y medio, y muestra un cierre sin efecto", async ({ page }) => {
  const requests: unknown[] = [];
  await page.route("**/api/comprobantes/revisar", async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { state: "superseded" } });
  });
  await mount(page, "review");
  await page.getByLabel("Importe en pesos").fill("1234,50");
  await page.getByLabel("Fecha real del pago").fill("2026-11-06");
  await page.getByLabel("Medio de pago").selectOption("otro");
  await page.getByLabel("Descripción del medio").fill("Billetera");
  await page.getByRole("button", { name: "Confirmar y registrar pago" }).click();
  await expect(page.getByRole("status")).toHaveText("Sin efecto: período ya saldado");
  expect(requests).toEqual([expect.objectContaining({
    id, action: "approve", amount: "1234,50", date: "2026-11-06", method: "otro", detail: "Billetera",
  })]);
  await expect(page.getByRole("button", { name: "Confirmar y registrar pago" })).toBeDisabled();
});

test("el rechazo exige motivo antes de enviar la revisión", async ({ page }) => {
  let reason: string | undefined;
  await page.route("**/api/comprobantes/revisar", async route => {
    reason = route.request().postDataJSON().reason;
    await route.fulfill({ json: { state: "rejected" } });
  });
  await mount(page, "review");
  await page.getByLabel("Decisión").selectOption("reject");
  const button = page.getByRole("button", { name: "Rechazar comprobante", exact: true });
  await button.click();
  await expect(page.getByLabel("Motivo visible para el alumno")).toBeFocused();
  expect(reason).toBeUndefined();
  await page.getByLabel("Motivo visible para el alumno").fill("Falta la fecha");
  await button.click();
  await expect(page.getByRole("status")).toHaveText("Rechazado");
  expect(reason).toBe("Falta la fecha");
});


for (const reset of ["recargar la pantalla", "volver a seleccionar el archivo"] as const) {
  test(`el alumno recupera la carga original al ${reset}`, async ({ page }) => {
    const uploadId = "55555555-5555-4555-8555-555555555555";
    const prepares: { id: string; hash: string; recover: boolean }[] = [];
    const submissions: { id: string; uploadId: string }[] = [];
    let transfers = 0;
    await page.route(`${fixtureOrigin}/__receipts-upload`, async route => {
      transfers++;
      await route.fulfill({ status: 200 });
    });
    await page.route("**/api/comprobantes", async route => {
      const body = route.request().postDataJSON();
      if (body.action === "prepare") {
        prepares.push(body);
        await route.fulfill({ json: {
          operationId: prepares[0]!.id, uploadId,
          ...(transfers ? { uploaded: true } : { uploadUrl: `${fixtureOrigin}/__receipts-upload` }),
        } });
        return;
      }
      submissions.push(body);
      await route.fulfill(submissions.length === 1
        ? { status: 503, json: { message: "Reintentá la presentación." } }
        : { json: { submitted: true } });
    });

    await mount(page, "upload");
    const input = page.getByLabel("Archivo del comprobante");
    const button = page.getByRole("button", { name: "Presentar comprobante", exact: true });
    const file = { name: "archivo.png", mimeType: "image/png", buffer: Buffer.from("mismos bytes") };
    await input.setInputFiles(file);
    await button.click();
    await expect(page.getByRole("status")).toHaveText("Reintentá la presentación.");
    if (reset === "recargar la pantalla") await mount(page, "upload", true);
    else await input.setInputFiles([]);
    await input.setInputFiles({ ...file, name: "mismo-comprobante.png" });
    await button.click();
    await expect(page.getByRole("status")).toContainText("Comprobante presentado");
    expect(prepares).toHaveLength(2);
    expect(prepares[1]!.id).not.toBe(prepares[0]!.id);
    expect(prepares[1]!.hash).toBe(prepares[0]!.hash);
    expect(prepares.every(prepare => prepare.recover)).toBe(true);
    expect(transfers).toBe(1);
    expect(submissions.map(submission => [submission.id, submission.uploadId]))
      .toEqual([[prepares[0]!.id, uploadId], [prepares[0]!.id, uploadId]]);
  });
}


import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";

const requireNode = createRequire(__filename);
const previewModule = { exports: {} };
const previewSource = ts.transpileModule(readFileSync("src/components/receipts/receipt-preview.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
new Function("require", "module", "exports", previewSource)(requireNode, previewModule, previewModule.exports);
const source = ts.transpileModule(readFileSync("src/app/pagos/comprobantes/page.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const style = readFileSync("src/app/globals.css", "utf8")
  + "\n" + readFileSync("src/app/pagos/comprobantes/comprobantes.css", "utf8");
const receiptId = "11111111-1111-4111-8111-111111111111";

async function renderQueue(state: "pending" | "rejected", options: { offset?: number; error?: boolean } = {}) {
  const receipt = {
    id: receiptId, state, submitted_at: "2026-11-17T20:01:00Z",
    resolved_at: state === "rejected" ? "2026-11-18T20:01:00Z" : null,
    rejection_reason: state === "rejected" ? "Fecha ilegible" : null,
    student: { first_name: "Alumno", last_name: "Ejemplo" },
    period: { month: "2026-11-01" },
  };
  const query = {
    select() { return this; }, order() { return this; }, range() { return this; },
    eq() { return Promise.resolve({ data: options.error ? null : [receipt], error: options.error ? { message: "fixture" } : null }); },
    neq() { return Promise.resolve({ data: options.error ? null : [receipt], error: options.error ? { message: "fixture" } : null }); },
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { email: "admin@example.test" } } }) },
    from: () => query,
  };
  const pageModule = { exports: {} as { default?: (props: { searchParams: Promise<Record<string, string>> }) => Promise<React.ReactNode> } };
  const fakeLink = ({ href, children, ...rest }: { href: string; children: React.ReactNode }) =>
    React.createElement("a", { ...rest, href }, children);
  const requireFixture = (id: string) => {
    if (id === "next/link") return { __esModule: true, default: fakeLink };
    if (id === "./comprobantes.css") return {};
    if (id === "@/components/dashboard/admin-dashboard") return {
      AdminShell: ({ children }: { children: React.ReactNode }) => React.createElement("div", { className: "dashboard" },
        React.createElement("div", { className: "dash-content" },
          React.createElement("main", { className: "dash-main" }, children))),
    };
    if (id === "@/components/brand/brand-mark") return { BrandMark: () => null };
    if (id === "@/components/theme/theme-picker") return { ThemePicker: () => null };
    if (id === "@/components/receipts/receipt-review") return {
      ReceiptReview: () => React.createElement("div", { className: "receipt-form" }, "Formulario de revisión"),
    };
    if (id === "@/components/receipts/receipt-preview") return previewModule.exports;
    if (id === "@/lib/students/server") return { studentAdmin: async () => client };
    if (id === "@/lib/students/date") return { buenosAiresDate: () => "2026-11-19" };
    if (id === "@/lib/receipts/contracts") return {
      receiptState: { pending: "Pendiente de revisión", approved: "Confirmado", rejected: "Rechazado", superseded: "Sin efecto: período ya saldado" },
    };
    return requireNode(id);
  };
  new Function("require", "module", "exports", source)(requireFixture, pageModule, pageModule.exports);
  const Queue = pageModule.exports.default;
  if (!Queue) throw new Error("No se cargó la página real de comprobantes.");
  const content = await Queue({ searchParams: Promise.resolve({
    ...(state === "rejected" ? { estado: "resueltos" } : {}),
    ...(options.offset ? { desde: String(options.offset) } : {}),
  }) });
  return renderToStaticMarkup(content as React.ReactElement);
}

async function mount(page: Page, baseURL: string, state: "pending" | "rejected", options: { offset?: number; error?: boolean; theme?: "light" | "dark" } = {}) {
  const html = await renderQueue(state, options);
  const url = new URL("/__receipts-queue-ui-fixture", baseURL).href;
  await page.route(url, route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: `<!doctype html><html lang="es-AR" data-theme="${options.theme ?? "light"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>CUEVA · Comprobantes de pago</title><style>${style}</style></head><body>${html}</body></html>`,
  }));
  await page.goto(url);
}

for (const viewport of [360, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`la bandeja usa botones y pestañas sin subrayado en ${viewport}px / ${theme}`, async ({ page, baseURL }) => {
      if (!baseURL) throw new Error("Se requiere un servidor de prueba.");
      await page.setViewportSize({ width: viewport, height: 840 });
      await mount(page, baseURL, "pending", { theme });
      await expect(page.getByRole("heading", { name: "Comprobantes de pago" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Estado de comprobantes" })
        .getByRole("link", { name: "Pendientes" })).toHaveAttribute("aria-current", "page");
      await expect(page.getByRole("navigation", { name: "Estado de comprobantes" })
        .getByRole("link", { name: "Resueltos" })).not.toHaveAttribute("aria-current", "page");

      const targets = page.locator(".receipts-back, .receipts-tab, .receipts-card-actions > button, .receipts-review > summary");
      await expect(targets).toHaveCount(5);
      for (let i = 0; i < await targets.count(); i++) {
        const target = targets.nth(i);
        await expect(target).toHaveCSS("text-decoration-line", "none");
        const bounds = await target.boundingBox();
        expect(bounds?.height).toBeGreaterThanOrEqual(44);
      }
      const open = page.getByRole("button", { name: "Ver comprobante", exact: true });
      await expect(open).toHaveAttribute("aria-haspopup", "dialog");
      await open.focus();
      await expect(open).toBeFocused();

      const hoverTarget = page.getByRole("link", { name: "Resueltos" });
      const resting = await hoverTarget.evaluate(element => getComputedStyle(element).backgroundColor);
      await hoverTarget.hover();
      await expect.poll(() => hoverTarget.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(resting);

      const summary = page.locator(".receipts-review > summary");
      await summary.click();
      await expect(page.locator(".receipts-review")).toHaveAttribute("open", "");
      await expect(page.getByText("Formulario de revisión")).toBeVisible();
      await summary.click();
      await expect(page.locator(".receipts-review")).not.toHaveAttribute("open");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    });
  }
}

test("Resueltos no permite revisión y conserva botones de archivo y paginación", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Se requiere un servidor de prueba.");
  await page.setViewportSize({ width: 390, height: 840 });
  await mount(page, baseURL, "rejected", { offset: 50 });
  await expect(page.getByRole("link", { name: "Resueltos" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Motivo del rechazo: Fecha ilegible")).toBeVisible();
  await expect(page.getByText("Revisar comprobante")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ver comprobante", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Página anterior" }))
    .toHaveAttribute("href", "/pagos/comprobantes?estado=resueltos&desde=0");
});

test("el error de carga mantiene Reintentar como control visible y accesible", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("Se requiere un servidor de prueba.");
  await mount(page, baseURL, "pending", { error: true });
  await expect(page.getByRole("alert")).toContainText("No pudimos cargar los comprobantes.");
  const retry = page.getByRole("link", { name: "Reintentar" });
  await expect(retry).toHaveCSS("text-decoration-line", "none");
  await expect(retry).toHaveAttribute("href", "/pagos/comprobantes?estado=pendientes&desde=0");
  expect((await retry.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});


import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { pesos } from "@/lib/payments/money";
import * as receiptContracts from "@/lib/receipts/contracts";

const fixtures = {
  active: true,
  last_paid_on: "2026-11-05",
  current: {
    month: "2026-11-01", due_on: "2026-11-09", cents: "1000000",
    paid: "400000", balance: "600000", status: "pending",
    payments: [{ paid_on: "2026-11-05", cents: "400000" }],
  },
  history: [{
    month: "2026-10-01", due_on: "2026-10-09", cents: "1000000",
    paid: "1000000", balance: "0", status: "paid",
    payments: [{ paid_on: "2026-10-08", cents: "1000000" }],
  }],
};
const localRequire = createRequire(__filename);
const link = ({ children, ...props }: React.ComponentProps<"a">) => React.createElement("a", props, children);

// Render the app's actual server page and navigation with synthetic responses.
function loadExport(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
  });
  const exported = {} as Record<string, unknown>;
  new Function("require", "exports", outputText)((id: string) => mocks[id] ?? localRequire(id), exported);
  return exported;
}

const shell = loadExport("src/components/routines/student-shell.tsx", {
  "next/link": { default: link },
  "@/components/brand/brand-mark": { BrandMark: () => "CUEVA" },
  "@/components/theme/theme-picker": { ThemePicker: () => null },
});
const upload = loadExport("src/components/receipts/receipt-upload.tsx", {
  "next/navigation": { useRouter: () => ({ refresh: () => undefined }) },
  "@/lib/receipts/contracts": receiptContracts,
});
const receiptPeriods = {
  "2026-11-01": {
    id: "11111111-1111-4111-8111-111111111111",
    receipts: [{ id: "22222222-2222-4222-8222-222222222222", state: "rejected",
      submitted_at: "2026-11-06T15:00:00Z", resolved_at: "2026-11-07T15:00:00Z",
      rejection_reason: "No se lee la fecha" }],
  },
  "2026-10-01": {
    id: "33333333-3333-4333-8333-333333333333",
    receipts: [{ id: "44444444-4444-4444-8444-444444444444", state: "approved",
      submitted_at: "2026-10-09T15:00:00Z", resolved_at: "2026-10-10T15:00:00Z",
      rejection_reason: null }],
  },
};
const { default: membershipPage } = loadExport("src/app/mi-membresia/page.tsx", {
  "next/link": { default: link },
  "@/components/routines/student-shell": shell,
  "@/lib/payments/money": { pesos },
  "@/components/receipts/receipt-upload": upload,
  "@/components/notifications/push-notification-settings": { PushNotificationSettings: () => null },
  "@/lib/receipts/contracts": receiptContracts,
  "@/lib/product-auth/server": {
    productConfig: () => ({}),
    userClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "fixture" } } }) },
      from: () => ({ select: () => ({ maybeSingle: async () => ({ data: { role: "alumno" } }) }) }),
      rpc: async (name: string) => ({ data: name === "cueva_receipt_periods" ? receiptPeriods : fixtures }),
    }),
  },
}) as { default: () => Promise<React.ReactElement> };

test("Mi Membresía muestra el pago, el vencimiento y el saldo en el celular", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const css = readFileSync("src/app/globals.css", "utf8");
  const markup = renderToStaticMarkup(await membershipPage());
  await page.setContent(`<!doctype html><html lang="es-AR" data-theme="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);

  await expect(page.getByRole("heading", { name: "Mi Membresía" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Navegación del alumno" });
  await expect(nav.getByRole("link", { name: "Mi Membresía" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Mi rutina" })).toBeVisible();
  await expect(page.locator('time[datetime="2026-11-05"]').first()).toBeVisible();
  await expect(page.locator('time[datetime="2026-11-09"]')).toBeVisible();
  await expect(page.getByText(pesos(fixtures.current.balance), { exact: true })).toBeVisible();
  await expect(page.getByText("Motivo del rechazo: No se lee la fecha")).toBeVisible();
  await expect(page.getByLabel("Archivo del comprobante")).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir comprobante", exact: true }).first())
    .toHaveAttribute("href", "/api/comprobantes?id=22222222-2222-4222-8222-222222222222");
  await page.getByText("octubre de 2026", { exact: true }).click();
  await expect(page.locator('time[datetime="2026-10-08"]')).toBeVisible();
  await expect(page.getByText("Confirmado", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Archivo del comprobante")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

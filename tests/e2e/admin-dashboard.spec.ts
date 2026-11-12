import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Render the real server component with synthetic props. No auth bypass route or real account is used.
const source = readFileSync("src/components/dashboard/admin-dashboard.tsx", "utf8");
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const componentModule = { exports: {} as { AdminDashboard: React.ComponentType<Record<string, unknown>>; AdminShell: React.ComponentType<Record<string, unknown>> } };
new Function("require", "module", "exports", output)(createRequire(__filename), componentModule, componentModule.exports);
const { AdminDashboard, AdminShell } = componentModule.exports;
const css = readFileSync("src/app/globals.css", "utf8");
const svg = readFileSync("public/brand/cueva-symbol.svg", "utf8");
const fixtureProps = {
  displayName: "Alex", email: "alex@example.test", role: "Administrador",
  logo: React.createElement("img", { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, alt: "CUEVA", width: 42, height: 42, className: "brand-mark" }),
  themePicker: React.createElement("div", { className: "theme-picker", role: "group", "aria-label": "Elegir tema" }, ["Claro", "Oscuro", "Sistema"].map((label) => React.createElement("button", { key: label, type: "button", "aria-pressed": label === "Sistema" }, label))),
  accountActions: React.createElement("p", null, "Las invitaciones y la recuperación de alumnos estarán disponibles cuando terminemos de configurar el correo del gimnasio."),
};
const fixture = renderToStaticMarkup(React.createElement(AdminDashboard, fixtureProps));
const routinesFixture = renderToStaticMarkup(React.createElement(AdminShell, {
  ...fixtureProps, active: "rutinas",
}, React.createElement("h1", null, "Rutinas")));

const exercisesFixture = renderToStaticMarkup(React.createElement(AdminShell, {
  ...fixtureProps, active: "ejercicios",
}, React.createElement("h1", null, "Ejercicios")));

const alertsFixture = renderToStaticMarkup(React.createElement(AdminShell, {
  ...fixtureProps, active: "alertas",
}, React.createElement("h1", null, "Alertas operativas")));

async function loadDashboard(page: Page, theme: "light" | "dark" = "dark", markup = fixture) {
  // A blank document prevents pending Next hydration from changing the synthetic fixture.
  await page.goto("about:blank");
  await page.setContent(`<!doctype html><html lang="es-AR" data-theme="${theme}" data-preference="system"><head><title>CUEVA · Panel de administración</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`);
  await expect(page).toHaveTitle("CUEVA · Panel de administración");
}

for (const width of [360, 390, 768, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`panel admin sintético ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      await loadDashboard(page, theme);
      await expect(page.getByRole("heading", { name: /Hola, Alex/ })).toBeVisible();
      await expect(page.locator(".dash-role").getByText("Administrador", { exact: true })).toBeVisible();
      await expect(page.getByText("Sin datos aún")).toHaveCount(2);
      await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(1);
      const navigation = page.getByRole("navigation", { name: width <= 680 ? "Navegación móvil" : "Navegación principal" });
      const exercises = navigation.getByRole("link", { name: "Ejercicios", exact: true });
      await expect(exercises).toBeVisible();
      await expect(exercises).toHaveAttribute("href", "/ejercicios");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
      mkdirSync("evidence/runs", { recursive: true });
      await page.screenshot({ path: `evidence/runs/admin-${width}-${theme}.png`, fullPage: true });
    });
  }
}

test("el panel permite navegar por teclado hasta cuenta y salir", async ({ page }) => {
  await loadDashboard(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.getByRole("link", { name: "Mi cuenta", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#cuenta$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).focus();
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeFocused();
});

test("la navegación móvil llega a Rutinas por teclado y marca la sección activa", async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadDashboard(page);
  if (!baseURL) throw new Error("La prueba requiere el servidor local configurado.");
  // Resolve the real absolute-path link from the isolated about:blank fixture.
  // Only this test adds a base; same-document account anchors stay unaffected.
  await page.evaluate(origin => {
    const base = document.createElement("base");
    base.href = origin;
    document.head.append(base);
  }, baseURL);
  const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
  const link = mobileNav.getByRole("link", { name: "Rutinas", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/rutinas");
  await expect(link).not.toHaveAttribute("aria-current", "page");
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new URL("/rutinas", baseURL).href);

  // No authenticated fixture is claimed: render the real shell's active state
  // with synthetic props, as the surrounding dashboard tests already do.
  await loadDashboard(page, "dark", routinesFixture);
  await expect(page.getByRole("heading", { name: "Rutinas", exact: true })).toBeVisible();
  await expect(mobileNav.getByRole("link", { name: "Rutinas", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(mobileNav.getByRole("link", { name: "Inicio", exact: true })).not.toHaveAttribute("aria-current", "page");
});

test("Ejercicios tiene su propia sección activa en la navegación móvil", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await loadDashboard(page, "light", exercisesFixture);
  const nav = page.getByRole("navigation", { name: "Navegación móvil" });
  await expect(nav.getByRole("link", { name: "Ejercicios", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Rutinas", exact: true })).not.toHaveAttribute("aria-current", "page");
});


test("Alertas operativas está disponible en escritorio y móvil y se marca como sección activa", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await loadDashboard(page, "dark", alertsFixture);
  const desktopNav = page.getByRole("navigation", { name: "Navegación principal" });
  const desktopAlerts = desktopNav.getByRole("link", { name: "Alertas", exact: true });
  await expect(desktopAlerts).toBeVisible();
  await expect(desktopAlerts).toHaveAttribute("href", "/alertas");
  await expect(desktopAlerts).toHaveAttribute("aria-current", "page");
  await expect(desktopNav.getByRole("link", { name: "Inicio", exact: true })).not.toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByRole("navigation", { name: "Navegación móvil" });
  const mobileAlerts = mobileNav.getByRole("link", { name: "Alertas", exact: true });
  await expect(mobileAlerts).toBeVisible();
  await expect(mobileAlerts).toHaveAttribute("href", "/alertas");
  await expect(mobileAlerts).toHaveAttribute("aria-current", "page");
  await expect(mobileNav.getByRole("link", { name: "Inicio", exact: true })).not.toHaveAttribute("aria-current", "page");
});

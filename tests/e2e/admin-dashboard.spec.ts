import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Render the real server component with synthetic props. No auth bypass route or real account is used.
const transpile = (path: string) => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const requireFixture = createRequire(__filename);
const menuModule = { exports: {} };
new Function("require", "module", "exports", transpile("src/components/dashboard/admin-profile-menu.tsx"))(
  (id: string) => id === "./admin-profile-menu.css" ? {} : requireFixture(id), menuModule, menuModule.exports,
);
const componentModule = { exports: {} as { AdminDashboard: React.ComponentType<Record<string, unknown>>; AdminShell: React.ComponentType<Record<string, unknown>> } };
new Function("require", "module", "exports", transpile("src/components/dashboard/admin-dashboard.tsx"))(
  (id: string) => id === "./admin-profile-menu" ? menuModule.exports : id === "./admin-home.css" ? {} : requireFixture(id), componentModule, componentModule.exports,
);
const { AdminDashboard, AdminShell } = componentModule.exports;
const css = ["src/app/globals.css", "src/components/dashboard/admin-profile-menu.css", "src/components/dashboard/admin-home.css"]
  .map(path => readFileSync(path, "utf8")).join("\n");
const svg = readFileSync("public/brand/cueva-symbol.svg", "utf8");
const fixtureProps = {
  displayName: "Alex", email: "alex@example.test", role: "Administrador",
  logo: React.createElement("img", { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`, alt: "CUEVA", width: 42, height: 42, className: "brand-mark" }),
  themePicker: React.createElement("div", { className: "theme-picker", role: "group", "aria-label": "Elegir tema" }, ["Claro", "Oscuro", "Sistema"].map((label) => React.createElement("button", { key: label, type: "button", "aria-pressed": label === "Sistema" }, label))),
  accountActions: React.createElement("p", null, "Las invitaciones y la recuperación de alumnos estarán disponibles cuando terminemos de configurar el correo del gimnasio."),
};
const fixture = renderToStaticMarkup(React.createElement(AdminDashboard, fixtureProps));
const longName = "Alejandra María AdministradoraNombreExtraordinariamenteLargo Fernández de la Cruz";
const longEmail = `${"administracion".repeat(5)}@gimnasio-ejemplo.test`;
const longFixture = renderToStaticMarkup(React.createElement(AdminDashboard, {
  ...fixtureProps, displayName: longName, email: longEmail,
}));
const routinesFixture = renderToStaticMarkup(React.createElement(AdminShell, {
  ...fixtureProps, active: "rutinas",
}, React.createElement("h1", null, "Rutinas")));

const exercisesFixture = renderToStaticMarkup(React.createElement(AdminShell, {
  ...fixtureProps, active: "ejercicios",
}, React.createElement("h1", null, "Ejercicios")));

const alertsFixture = renderToStaticMarkup(React.createElement(AdminShell, {
  ...fixtureProps, active: "alertas",
}, React.createElement("h1", null, "Alertas operativas")));

function dashboardHtml(theme: "light" | "dark", markup: string) {
  return `<!doctype html><html lang="es-AR" data-theme="${theme}" data-preference="system"><head><meta charset="utf-8"><title>CUEVA · Panel de administración</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${markup}</body></html>`;
}

async function loadDashboard(page: Page, theme: "light" | "dark" = "dark", markup = fixture) {
  // A blank document prevents pending Next hydration from changing the synthetic fixture.
  await page.goto("about:blank");
  await page.setContent(dashboardHtml(theme, markup));
  await expect(page).toHaveTitle("CUEVA · Panel de administración");
}

const sections = [
  ["Alumnos", "/alumnos"], ["Vencimientos", "/pagos?vista=vencimientos"],
  ["Pagos", "/pagos"], ["Comprobantes", "/pagos/comprobantes"],
  ["Rutinas", "/rutinas"], ["Ejercicios", "/ejercicios"], ["Alertas", "/alertas"],
] as const;

for (const width of [360, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`panel admin sintético ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      await loadDashboard(page, theme, longFixture);
      const greeting = page.getByRole("heading", { name: `Hola, ${longName}` });
      await expect(greeting).toBeVisible();
      const cards = page.getByRole("navigation", { name: "Secciones de administración" });
      await expect(cards.getByRole("link")).toHaveCount(sections.length);
      await expect(cards.getByRole("link", { name: "Alumnos" })).toBeInViewport();
      for (const [label, href] of sections) {
        const card = cards.getByRole("link", { name: label, exact: true });
        await expect(card).toHaveAttribute("href", href);
        await expect(card.locator("a, button")).toHaveCount(0);
      }
      await expect(page.getByText(longEmail, { exact: true })).toBeVisible();
      if (width < 681) {
        expect(await greeting.evaluate(element => element.clientHeight > parseFloat(getComputedStyle(element).lineHeight))).toBe(true);
      }
      expect(await cards.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length))
        .toBe(width < 681 ? 2 : 4);
      if (width > 680) {
        const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
        await expect(sidebar.getByRole("link", { name: "Vencimientos", exact: true })).toHaveAttribute("href", "/pagos?vista=vencimientos");
        await expect(sidebar.getByRole("link", { name: "Comprobantes", exact: true })).toHaveAttribute("href", "/pagos/comprobantes");
        await expect(sidebar.getByRole("link", { name: "Alertas", exact: true })).toHaveAttribute("href", "/alertas");
      }
      await expect(page.getByRole("heading", { name: "Tu perfil" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(1);
      const navigation = page.getByRole("navigation", { name: width <= 680 ? "Navegación móvil" : "Navegación principal" });
      const exercises = navigation.getByRole("link", { name: "Ejercicios", exact: true });
      await expect(exercises).toBeVisible();
      await expect(exercises).toHaveAttribute("href", "/ejercicios");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect(accessibility.violations).toEqual([]);
      mkdirSync("evidence/runs", { recursive: true });
      await page.screenshot({ path: `evidence/runs/admin-${test.info().project.name}-${width}-${theme}.png`, fullPage: true });
    });
  }
}

test("el panel permite navegar por teclado hasta cuenta y salir", async ({ page }) => {
  await loadDashboard(page);
  const skipLink = page.getByRole("link", { name: "Saltar al contenido" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
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


test("Alertas operativas está disponible y se marca como sección activa en escritorio y móvil", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await loadDashboard(page, "dark", alertsFixture);
  const sidebar = page.getByRole("navigation", { name: "Navegación principal" });
  const desktopAlerts = sidebar.getByRole("link", { name: "Alertas", exact: true });
  await expect(desktopAlerts).toBeVisible();
  await expect(desktopAlerts).toHaveAttribute("href", "/alertas");
  await expect(desktopAlerts).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 390, height: 844 });
  await loadDashboard(page, "dark", alertsFixture);
  const nav = page.getByRole("navigation", { name: "Navegación móvil" });
  const alerts = nav.getByRole("link", { name: "Alertas", exact: true });
  await expect(alerts).toBeVisible();
  await expect(alerts).toHaveAttribute("href", "/alertas");
  await expect(alerts).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Inicio", exact: true })).not.toHaveAttribute("aria-current", "page");
});

test.use({ hasTouch: true });

for (const { width, theme } of [{ width: 360, theme: "light" }, { width: 390, theme: "dark" }, { width: 1440, theme: "dark" }] as const) {
  test(`el menú de cuenta funciona desde una sección a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 840 });
    await loadDashboard(page, theme, routinesFixture);
    await expect(page.getByRole("heading", { name: "Tu perfil" })).toHaveCount(0);
    const navigation = page.getByRole("navigation", { name: width < 681 ? "Navegación móvil" : "Navegación principal" });
    await expect(navigation.getByRole("link", { name: width < 681 ? "Cuenta" : "Mi cuenta", exact: true }))
      .toHaveAttribute("href", "/cuenta#cuenta");

    const trigger = page.getByRole("button", { name: "Opciones de cuenta" });
    const popover = page.locator("#admin-profile-menu");
    const account = popover.getByRole("link", { name: "Ir a tu cuenta" });
    const signOut = popover.getByRole("button", { name: "Cerrar sesión" });
    await expect(popover).toBeHidden();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(popover).toBeVisible();
    await expect(account).toHaveAttribute("href", "/cuenta#cuenta");
    await page.keyboard.press("Tab");
    await expect(account).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(signOut).toBeFocused();
    expect(await signOut.evaluate(button => {
      const form = (button as HTMLButtonElement).form;
      return [form?.method, form?.getAttribute("action")];
    })).toEqual(["post", "/api/acceso/salir"]);
    expect(await popover.evaluate(menu => {
      const rect = menu.getBoundingClientRect();
      const button = document.querySelector(".dash-profile-trigger")!.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= document.documentElement.clientWidth
        && Math.abs(rect.right - button.right) <= 1
        && rect.top - button.bottom >= 8 && rect.top - button.bottom <= 12;
    })).toBe(true);
    await page.screenshot({ path: `evidence/runs/admin-menu-${test.info().project.name}-${width}-${theme}.png` });
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(popover).toBeVisible();
    const outside = page.getByRole("heading", { name: "Rutinas" });
    if (width < 681) await outside.tap({ position: { x: 8, y: 8 } });
    else await outside.click();
    await expect(popover).toBeHidden();
  });
}

for (const width of [360, 390]) {
  test(`el perfil queda por encima de la navegación inferior a ${width}px`, async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 740 });
    const accountUrl = `${baseURL}/cuenta`;
    const routinesUrl = `${baseURL}/rutinas`;
    await page.route(accountUrl, route => route.fulfill({ contentType: "text/html", body: dashboardHtml("dark", longFixture) }));
    await page.route(routinesUrl, route => route.fulfill({ contentType: "text/html", body: dashboardHtml("dark", routinesFixture) }));
    await page.goto(routinesUrl);
    await page.getByRole("button", { name: "Opciones de cuenta" }).tap();
    await page.getByRole("link", { name: "Ir a tu cuenta" }).tap();
    await expect(page).toHaveURL(`${accountUrl}#cuenta`);
    const profile = page.getByRole("region", { name: "Tu perfil" });
    await expect(profile).toBeInViewport({ ratio: 1 });
    const nav = page.getByRole("navigation", { name: "Navegación móvil" });
    await expect.poll(async () => (await nav.boundingBox())!.y - (await profile.boundingBox())!.y
      - (await profile.boundingBox())!.height).toBeGreaterThanOrEqual(8);
    await page.screenshot({ path: `evidence/runs/admin-profile-${test.info().project.name}-${width}.png` });
  });
}

test("una tarjeta completa navega desde el icono, el relleno y el teclado", async ({ page, baseURL, browserName }) => {
  if (!baseURL) throw new Error("La prueba requiere un origen local.");
  await page.setViewportSize({ width: 390, height: 740 });
  const dashboardUrl = new URL("/inicio-fixture", baseURL).href;
  await page.route(dashboardUrl, route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: dashboardHtml("dark", fixture),
  }));
  for (const [, href] of sections) {
    await page.route(new URL(href, baseURL).href, route => route.fulfill({ body: "Sección de prueba" }));
  }

  for (const source of ["icono", "relleno", "teclado"] as const) {
    await page.goto(dashboardUrl);
    const grid = page.getByRole("navigation", { name: "Secciones de administración" });
    const card = grid.getByRole("link", { name: "Vencimientos" });
    if (source === "icono") await card.locator("svg").tap();
    else if (source === "relleno") await card.tap({ position: { x: 4, y: 4 } });
    else {
      await grid.getByRole("link", { name: "Alumnos" }).focus();
      await page.keyboard.press("Tab");
      // WebKit’s default tab navigation skips links unless full keyboard access is enabled.
      if (browserName === "webkit") await card.focus();
      await expect(card).toBeFocused();
      await expect(card).toHaveCSS("outline-style", "solid");
      await expect(card).toHaveCSS("outline-width", "2px");
      await page.keyboard.press("Enter");
    }
    await expect(page).toHaveURL(new URL("/pagos?vista=vencimientos", baseURL).href);
  }
});

test("Cerrar sesión desde el menú envía un POST al flujo de acceso", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("La prueba requiere un origen local.");
  await page.route(`${baseURL}/cuenta-menu-fixture`, route => route.fulfill({
    contentType: "text/html; charset=utf-8",
    body: dashboardHtml("dark", routinesFixture),
  }));
  await page.route(`${baseURL}/api/acceso/salir`, route => route.fulfill({ body: "Solicitud recibida" }));

  await page.goto(`${baseURL}/cuenta-menu-fixture`);
  await page.getByRole("button", { name: "Opciones de cuenta" }).click();
  const request = page.waitForRequest(`${baseURL}/api/acceso/salir`);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  const signOut = await request;
  expect(signOut.method()).toBe("POST");
  expect(signOut.headers().origin).toBe(baseURL);
  await expect(page.getByText("Solicitud recibida")).toBeVisible();
});

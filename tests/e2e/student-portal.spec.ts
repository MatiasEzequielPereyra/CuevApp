import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { StudentIcon } from "../../src/components/routines/student-icon";
import { PasswordChangeForm } from "../../src/components/auth/password-change-form";

const localRequire = createRequire(__filename);
const link = ({ children, ...props }: React.ComponentProps<"a">) =>
  React.createElement("a", props, children);

function loadExport(path: string, mocks: Record<string, unknown>) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: false,
    },
  });
  const exported = {} as Record<string, unknown>;
  new Function("require", "exports", outputText)(
    (id: string) => mocks[id] ?? localRequire(id),
    exported,
  );
  return exported;
}

const shell = loadExport("src/components/routines/student-shell.tsx", {
  "./student-icon": { StudentIcon },
  "next/link": { default: link },
  "@/components/brand/brand-mark": {
    BrandMark: () => React.createElement("span", null, "CUEVA"),
  },
  "@/components/theme/theme-picker": { ThemePicker: () => null },
}) as { StudentShell: (props: { children?: React.ReactNode; active?: string }) => React.ReactElement };

const deniedClient = (role: "admin" | "alumno" = "admin") => ({
  auth: {
    getUser: async () => ({
      data: { user: { id: "admin-fixture", email: "admin@example.test", user_metadata: { full_name: "Admin Fixture" } } },
      error: null,
    }),
  },
  from: () => ({
    select: () => ({
      maybeSingle: async () => ({ data: { role }, error: null }),
    }),
  }),
});

function loadStudentPage(path: string, role: "admin" | "alumno" = "admin") {
  return loadExport(path, {
    "./mi-rutina.css": {},
    "next/link": { default: link },
    "@/components/routines/student-shell": shell,
    "@/components/routines/student-home": { StudentHome: () => null },
    "@/components/brand/brand-mark": { BrandMark: () => null },
    "@/components/theme/theme-picker": { ThemePicker: () => null },
    "@/components/dashboard/admin-dashboard": {
      AdminDashboard: () => React.createElement("div", { "data-testid": "admin-dashboard" }, "Panel administrativo"),
      AdminAccountActions: () => null,
    },
    "@/components/routines/plan-view": { PlanView: () => null, VideoLink: () => null },
    "@/components/notifications/notification-inbox": { NotificationInbox: () => null },
    "@/components/notifications/push-notification-settings": { PushNotificationSettings: () => null },
    "@/components/auth/password-change-form": { PasswordChangeForm },
    "@/lib/payments/money": { pesos: (value: string) => value },
    "@/lib/product-auth/server": {
      productConfig: () => ({ ownerOnly: true }),
      userClient: async () => deniedClient(role),
    },
  });
}

test("la navegación del alumno contiene las cinco secciones y marca la activa", async ({ page }) => {
  const markup = renderToStaticMarkup(
    React.createElement(
      shell.StudentShell,
      { active: "notificaciones" },
      React.createElement("h1", null, "Notificaciones"),
    ),
  );
  await page.setContent(markup);

  const nav = page.getByRole("navigation", { name: "Navegación del alumno" });
  const expected = [
    ["Inicio", "/cuenta"],
    ["Mi Membresía", "/mi-membresia"],
    ["Entrenamiento", "/mi-rutina"],
    ["Notificaciones", "/notificaciones"],
    ["Mi perfil", "/mi-perfil"],
  ] as const;

  for (const [label, href] of expected) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", href);
  }
  await expect(nav.getByRole("link", { name: "Notificaciones" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#contenido");
  await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
});

test("el menú completo entra a 320 px y deja visible el cierre de sesión", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 630 });
  const css = readFileSync("src/app/globals.css", "utf8");
  const markup = renderToStaticMarkup(React.createElement(
    shell.StudentShell, { active: "perfil" },
    React.createElement("div", { style: { minHeight: "760px" } }, React.createElement("h1", null, "Mi perfil")),
  ));
  await page.setContent(`<!doctype html><html lang="es-AR" data-theme="dark"><head><style>${css}</style></head><body>${markup}</body></html>`);
  const nav = page.getByRole("navigation", { name: "Navegación del alumno" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);
  const dock = await nav.boundingBox();
  expect(dock).toBeTruthy();
  expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBe(630);
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? -1) + (box?.width ?? 321)).toBeLessThanOrEqual(320);
  }
  await links.first().focus();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  const signout = page.getByRole("button", { name: "Cerrar sesión" });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(signout).toBeInViewport();
  expect((await signout.boundingBox())?.y).toBeLessThan(dock?.y ?? 0);
  await expect(page.locator('form[action="/api/acceso/salir"]')).toHaveAttribute("method", "post");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1024, 1440]) {
  for (const theme of ["light", "dark"]) {
    test(`Shift+Tab recupera un control visible y activable bajo la barra a ${width}px / ${theme}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 720 });
      const css = readFileSync("src/app/globals.css", "utf8");
      const markup = renderToStaticMarkup(React.createElement(
        shell.StudentShell, { active: "membresia" },
        React.createElement("div", { style: { minHeight: "1000px" } }, React.createElement("h1", null, "Mis cuotas")),
        React.createElement("section", { className: "membership-history" },
          React.createElement("details", { className: "membership-card" },
            React.createElement("summary", null, "Detalle del período"),
            React.createElement("p", null, "Período de prueba"),
          ),
        ),
        React.createElement("div", { style: { minHeight: "1000px" }, "aria-hidden": true }),
        React.createElement("button", { type: "button" }, "Continuar"),
      ));
      await page.setContent(`<!doctype html><html lang="es-AR" data-theme="${theme}"><head><style>${css}</style></head><body>${markup}</body></html>`);
      const control = page.locator(".membership-history summary");
      await page.getByRole("button", { name: "Continuar" }).focus();
      // Scroll while a later control retains focus, leaving the earlier one just above the viewport.
      await control.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top + 1));
      const hidden = await control.boundingBox();
      expect(hidden).not.toBeNull();
      expect(hidden!.y).toBeLessThan(0);

      await page.keyboard.press("Shift+Tab");
      await expect(control).toBeFocused();
      const header = await page.locator(".student-topbar").boundingBox();
      const focused = await control.boundingBox();
      expect(header).not.toBeNull();
      expect(focused).not.toBeNull();
      // Include the five pixels occupied by the visible focus outline.
      expect(focused!.y - 5).toBeGreaterThanOrEqual(header!.y + header!.height);
      expect(focused!.y + focused!.height + 5).toBeLessThanOrEqual(720);
      expect(await control.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + 1));
      })).toBe(true);
      await page.screenshot({ path: testInfo.outputPath("student-focus.png") });
      await page.keyboard.press("Enter");
      await expect(page.locator(".membership-history details")).toHaveAttribute("open", "");
      await expect(page.getByText("Período de prueba")).toBeVisible();
    });
  }
}

for (const [path, heading] of [
  ["src/app/mi-rutina/page.tsx", "Acceso restringido"],
  ["src/app/notificaciones/page.tsx", "Acceso restringido"],
  ["src/app/mi-perfil/page.tsx", "Acceso restringido"],
] as const) {
  test(`un administrador no accede al contenido de alumno en ${path}`, async ({ page }) => {
    const exported = loadStudentPage(path);
    const component = exported.default as () => Promise<React.ReactElement>;
    const markup = renderToStaticMarkup(await component());
    await page.setContent(markup);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación del alumno" })).toHaveCount(0);
    await expect(page.getByText("Tus ejercicios")).toHaveCount(0);
    await expect(page.getByText("Datos de acceso")).toHaveCount(0);
    await expect(page.locator('form[action="/api/acceso/cambiar-contrasena"]')).toHaveCount(0);
  });
}

test("el inicio conserva la rama administrativa para el rol admin", async ({ page }) => {
  const exported = loadStudentPage("src/app/cuenta/page.tsx");
  const component = exported.default as () => Promise<React.ReactElement>;
  const markup = renderToStaticMarkup(await component());
  await page.setContent(markup);
  await expect(page.getByTestId("admin-dashboard")).toContainText("Panel administrativo");
  await expect(page.getByRole("navigation", { name: "Navegación del alumno" })).toHaveCount(0);
});

for (const changed of [false, true]) {
  test(`el perfil de alumno conserva el diseño y la seguridad con resultado ${changed}`, async ({ page }) => {
    const exported = loadStudentPage("src/app/mi-perfil/page.tsx", "alumno");
    const component = exported.default as (props: { searchParams?: Promise<{ contrasena?: string }> }) => Promise<React.ReactElement>;
    const markup = renderToStaticMarkup(await component(changed ? { searchParams: Promise.resolve({ contrasena: "actualizada" }) } : {}));
    await page.setContent(markup);
    await expect(page.getByRole("heading", { name: "Mi perfil", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegación del alumno" })).toBeVisible();
    await expect(page.locator(".student-profile-header")).toBeVisible();
    await expect(page.getByRole("region", { name: "Seguridad de la cuenta" }).getByLabel("Contraseña actual", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Actualizar contraseña" })).toBeVisible();
    await expect(page.getByLabel("Nuevo correo electrónico", { exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(changed ? 1 : 0);
  });
}

test("el parámetro de correo no confirma Auth y conserva ambos formularios", async ({ page }) => {
  const exported = loadStudentPage("src/app/mi-perfil/page.tsx", "alumno");
  const component = exported.default as (props: { searchParams: Promise<{ correo: string }> }) => Promise<React.ReactElement>;
  await page.setContent(renderToStaticMarkup(await component({ searchParams: Promise.resolve({ correo: "confirmado" }) })));
  await expect(page.getByLabel("Nuevo correo electrónico", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Contraseña actual", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

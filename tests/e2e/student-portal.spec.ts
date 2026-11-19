import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { StudentIcon } from "../../src/components/routines/student-icon";
import { PasswordChangeForm } from "../../src/components/auth/password-change-form";
import { StudentEmailChangeForm } from "../../src/components/auth/student-email-change-form";
import { canSubmitEmailChange, canSubmitPasswordChange } from "../../src/lib/student-profile-form-validation";

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

const accountMenu = loadExport("src/components/routines/student-account-menu.tsx", {
  "next/link": { default: link },
  "./student-icon": { StudentIcon },
  "./student-account-menu.css": {},
  "@/lib/theme": {
    getPreference: () => "system",
    setPreference: () => undefined,
    subscribeToPreference: () => () => undefined,
  },
});

const shell = loadExport("src/components/routines/student-shell.tsx", {
  "./student-icon": { StudentIcon },
  "next/link": { default: link },
  "@/components/brand/brand-mark": {
    BrandMark: ({ size = 46, decorative = false }: { size?: number; decorative?: boolean }) =>
      React.createElement("img", {
        src: `data:image/svg+xml;base64,${Buffer.from(readFileSync("public/brand/cueva-symbol.svg")).toString("base64")}`,
        alt: decorative ? "" : "CUEVA", width: size, height: size, className: "brand-mark",
      }),
  },
  "./student-account-menu": accountMenu,
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
    "@/components/auth/student-email-change-form": { StudentEmailChangeForm },
    "@/lib/payments/money": { pesos: (value: string) => value },
    "@/lib/product-auth/server": {
      productConfig: () => ({ ownerOnly: true }),
      userClient: async () => deniedClient(role),
    },
  });
}

test("la navegación mantiene cuatro secciones y mueve la cuenta al icono superior", async ({ page }) => {
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
  ] as const;

  for (const [label, href] of expected) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", href);
  }
  await expect(nav.getByRole("link", { name: "Notificaciones" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link")).toHaveCount(4);
  await expect(nav.getByRole("link", { name: "Mi perfil" })).toHaveCount(0);
  await expect(nav.getByRole("link")).toHaveText(["Rutina", "Cuotas", "Inicio", "Avisos"]);
  await expect(nav.getByRole("link", { name: "Inicio" }).locator(".student-home-brand")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Saltar al contenido" })).toHaveAttribute("href", "#contenido");
  await expect(page.getByRole("button", { name: "Opciones de cuenta" })).toBeVisible();
  await expect(page.locator(".student-account-popover")).toBeHidden();
});

test("el desplegable por iconos funciona a 320 px con salida protegida y sin desbordar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 630 });
  const css = ["src/app/globals.css", "src/components/routines/student-account-menu.css"]
    .map(path => readFileSync(path, "utf8")).join("\n");
  const markup = renderToStaticMarkup(React.createElement(
    shell.StudentShell, { active: "perfil" },
    React.createElement("div", { style: { minHeight: "760px" } }, React.createElement("h1", null, "Mi perfil")),
  ));
  await page.setContent(`<!doctype html><html lang="es-AR" data-theme="dark" data-preference="system"><head><style>${css}</style></head><body>${markup}</body></html>`);
  const nav = page.getByRole("navigation", { name: "Navegación del alumno" });
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(4);
  const dock = await nav.boundingBox();
  expect(dock).toBeTruthy();
  expect((dock?.y ?? 0) + (dock?.height ?? 0)).toBe(630);
  for (const item of await links.all()) {
    const box = await item.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? -1) + (box?.width ?? 321)).toBeLessThanOrEqual(320);
  }
  await links.first().focus();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();

  const trigger = page.getByRole("button", { name: "Opciones de cuenta" });
  await trigger.click();
  const menu = page.locator(".student-account-popover");
  await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute("popover", "auto");
  const profile = menu.getByRole("link", { name: "Mi cuenta" });
  await expect(profile).toHaveAttribute("href", "/mi-perfil");
  await expect(profile).toHaveAttribute("aria-current", "page");
  const signout = menu.getByRole("button", { name: "Cerrar sesión" });
  await expect(signout).toBeInViewport();
  await signout.hover();
  await expect(signout).toHaveCSS("color", "rgb(255, 169, 182)");
  await expect(signout).toHaveCSS("background-color", "rgb(71, 36, 43)");
  await expect(menu.locator('form[action="/api/acceso/salir"]')).toHaveAttribute("method", "post");
  await expect(menu.getByRole("button", { name: "Tema claro" })).toHaveAttribute("aria-pressed", "false");
  await expect(menu.getByRole("button", { name: "Tema oscuro" })).toHaveAttribute("aria-pressed", "false");
  await expect(menu.getByRole("button", { name: "Tema del sistema" })).toHaveAttribute("aria-pressed", "true");
  expect(await menu.locator("a, button").allTextContents()).toEqual(["", "", "", "", ""]);
  const geometry = await menu.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const targets = [...element.querySelectorAll("a, button")].map(item => item.getBoundingClientRect());
    return {
      left: bounds.left, right: bounds.right,
      minWidth: Math.min(...targets.map(item => item.width)),
      minHeight: Math.min(...targets.map(item => item.height)),
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(320);
  expect(geometry.minWidth).toBeGreaterThanOrEqual(44);
  expect(geometry.minHeight).toBeGreaterThanOrEqual(44);
  const center = nav.getByRole("link", { name: "Inicio", exact: true });
  const logo = center.locator(".student-home-brand");
  await expect(logo).toBeVisible();
  const logoBounds = await logo.boundingBox();
  expect(logoBounds).toBeTruthy();
  expect(Math.abs((logoBounds!.x + logoBounds!.width / 2) - 160)).toBeLessThanOrEqual(1.5);
  const icon = nav.getByRole("link", { name: "Rutina de entrenamiento" }).locator(".student-icon");
  expect(logoBounds!.width).toBeGreaterThan((await icon.boundingBox())!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

for (const width of [360, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`el menú del alumno abre sin recortar iconos en ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 850 });
      const css = ["src/app/globals.css", "src/components/routines/student-account-menu.css"]
        .map(path => readFileSync(path, "utf8")).join("\n");
      const markup = renderToStaticMarkup(React.createElement(
        shell.StudentShell, { active: "rutina" }, React.createElement("h1", null, "Mi rutina"),
      ));
      await page.setContent(`<!doctype html><html lang="es-AR" data-theme="${theme}" data-preference="system"><head><style>${css}</style></head><body>${markup}</body></html>`);
      await page.getByRole("button", { name: "Opciones de cuenta" }).click();
      const menu = page.locator(".student-account-popover");
      await expect(menu).toBeVisible();
      await expect(menu.getByRole("link", { name: "Mi cuenta" })).not.toHaveAttribute("aria-current", "page");
      const box = await menu.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await menu.getByRole("link", { name: "Mi cuenta" }).focus();
      await page.keyboard.press("Tab");
      await expect(menu.getByRole("button", { name: "Cerrar sesión" })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    });
  }
}

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
    await expect(page.getByRole("button", { name: "Actualizar contraseña" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar verificación" })).toBeDisabled();
    await expect(page.locator('form[action="/api/acceso/cambiar-contrasena"]')).toHaveAttribute("method", "post");
    await expect(page.locator('form[action="/api/acceso/cambiar-correo"]')).toHaveAttribute("method", "post");
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
  await expect(page.getByRole("button", { name: "Enviar verificación" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Actualizar contraseña" })).toBeDisabled();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("los botones solo se habilitan para correos distintos y contraseñas confirmadas", () => {
  expect(canSubmitEmailChange("", "actual@example.test", false)).toBe(false);
  expect(canSubmitEmailChange("sin-arroba", "actual@example.test", false)).toBe(false);
  expect(canSubmitEmailChange("ACTUAL@example.test", "actual@example.test", true)).toBe(false);
  expect(canSubmitEmailChange("nuevo@example.test", "actual@example.test", true)).toBe(true);
  expect(canSubmitEmailChange("nuevo@example.test", "actual@example.test", false)).toBe(false);

  const oldPassword = "secreto-anterior";
  expect(canSubmitPasswordChange("", "clave-segura", "clave-segura", true)).toBe(false);
  expect(canSubmitPasswordChange(oldPassword, "corta", "corta", false)).toBe(false);
  expect(canSubmitPasswordChange(oldPassword, "clave-segura", "otra-clave", true)).toBe(false);
  expect(canSubmitPasswordChange(oldPassword, oldPassword, oldPassword, true)).toBe(false);
  expect(canSubmitPasswordChange(oldPassword, "clave-segura", "clave-segura", true)).toBe(true);
  expect(canSubmitPasswordChange(oldPassword, "clave-segura", "clave-segura", false)).toBe(false);
});

for (const theme of ["light", "dark"] as const) {
  test(`los botones de Mi perfil cambian visualmente al estar habilitados — ${theme}`, async ({ page }) => {
    const exported = loadStudentPage("src/app/mi-perfil/page.tsx", "alumno");
    const component = exported.default as () => Promise<React.ReactElement>;
    const css = readFileSync("src/app/globals.css", "utf8");
    const markup = renderToStaticMarkup(await component());
    await page.setContent(`<!doctype html><html lang="es-AR" data-theme="${theme}" data-preference="system"><head><style>${css}</style></head><body>${markup}</body></html>`);
    for (const name of ["Enviar verificación", "Actualizar contraseña"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeDisabled();
      await expect(button).toHaveCSS("cursor", "not-allowed");
      // The server-rendered fixture is static; emulate only the enabled state to audit CSS.
      await button.evaluate(element => element.removeAttribute("disabled"));
      await expect(button).toBeEnabled();
      await expect(button).toHaveCSS("cursor", "pointer");
      await button.hover();
      await expect(button).toHaveCSS("background-color", theme === "dark" ? "rgb(206, 204, 255)" : "rgb(73, 67, 215)");
    }
  });
}

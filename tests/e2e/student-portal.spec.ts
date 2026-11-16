import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

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
  "next/link": { default: link },
  "@/components/brand/brand-mark": {
    BrandMark: () => React.createElement("span", null, "CUEVA"),
  },
  "@/components/theme/theme-picker": { ThemePicker: () => null },
}) as { StudentShell: (props: { children?: React.ReactNode; active?: string }) => React.ReactElement };

const deniedClient = () => ({
  auth: {
    getUser: async () => ({
      data: { user: { id: "admin-fixture", email: "admin@example.test", user_metadata: { full_name: "Admin Fixture" } } },
      error: null,
    }),
  },
  from: () => ({
    select: () => ({
      maybeSingle: async () => ({ data: { role: "admin" }, error: null }),
    }),
  }),
});

function loadStudentPage(path: string) {
  return loadExport(path, {
    "next/link": { default: link },
    "@/components/routines/student-shell": shell,
    "./mi-rutina.css": {},
    "@/components/brand/brand-mark": { BrandMark: () => null },
    "@/components/theme/theme-picker": { ThemePicker: () => null },
    "@/components/dashboard/admin-dashboard": {
      AdminDashboard: () => React.createElement("div", { "data-testid": "admin-dashboard" }, "Panel administrativo"),
      AdminAccountActions: () => null,
    },
    "@/components/routines/plan-view": { PlanView: () => null, VideoLink: () => null },
    "@/components/notifications/notification-inbox": { NotificationInbox: () => null },
    "@/components/notifications/push-notification-settings": { PushNotificationSettings: () => null },
    "@/lib/payments/money": { pesos: (value: string) => value },
    "@/lib/product-auth/server": {
      productConfig: () => ({ ownerOnly: true }),
      userClient: async () => deniedClient(),
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
  await expect(page.locator('form[action="/api/acceso/salir"]')).toHaveAttribute("method", "post");
});

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

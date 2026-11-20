import { expect, test } from "@playwright/test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const localRequire = createRequire(__filename);
const link = ({ children, ...props }: React.ComponentProps<"a">) =>
  React.createElement("a", props, children);
const css = new Proxy({}, { get: (_target, property) => String(property) });
let enabled = true;
const config = () => ({ selfRegistrationEnabled: enabled, local: false });

function load(path: string) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: false },
  });
  const exported = {} as Record<string, unknown>;
  new Function("require", "exports", outputText)((id: string) => {
    if (id === "next/link") return { default: link };
    if (id === "@/components/brand/brand-mark") {
      return { BrandMark: () => React.createElement("span", null, "CUEVA") };
    }
    if (id === "@/components/theme/theme-picker") return { ThemePicker: () => null };
    if (id === "@/components/access/sign-in-form") return {
      SignInForm: () => React.createElement("form", null, "Ingreso con correo"),
    };
    if (id === "@/lib/product-auth/server") return { productConfig: config };
    if (id === "@/components/access/access.module.css") return { default: css };
    return localRequire(id);
  }, exported);
  return exported;
}
const login = load("src/app/ingresar/page.tsx") as {
  default: () => React.ReactElement;
};
const register = load("src/app/registrarse/page.tsx") as {
  default: (args?: { searchParams?: Promise<{ estado?: string }> }) => Promise<React.ReactElement>;
};

test("Ingresar ofrece Registrarse cuando el registro está habilitado", async ({ page }) => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    enabled = true;
    await page.setContent(renderToStaticMarkup(React.createElement(login.default)));
    const link = page.getByRole("link", { name: "Registrarse" });
    await expect(link).toHaveAttribute("href", "/registrarse");
    await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});

test("registro propio pide correo, nombre, apellido y contraseña dos veces", async ({ page }) => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    enabled = true;
    await page.setContent(renderToStaticMarkup(await register.default({ searchParams: Promise.resolve({}) })));
    await expect(page.getByRole("heading", { name: "Crear mi cuenta" })).toBeVisible();
    const form = page.locator('form[action="/api/acceso/registrarse"]');
    await expect(form).toHaveAttribute("method", "post");
    for (const name of ["first_name", "last_name", "email", "password", "confirm_password"]) {
      await expect(form.locator(`[name="${name}"][required]`)).toHaveCount(1);
    }
    await expect(form.getByRole("button", { name: /Registrarme y recibir el correo/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar");
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});

test("registro deshabilitado no ofrece envío público", async ({ page }) => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    enabled = false;
    await page.setContent(renderToStaticMarkup(React.createElement(login.default)));
    await expect(page.getByRole("link", { name: "Registrarse" })).toHaveCount(0);
    await page.setContent(renderToStaticMarkup(await register.default({ searchParams: Promise.resolve({}) })));
    await expect(page.locator('form[action="/api/acceso/registrarse"]')).toHaveCount(0);
    await expect(page.getByText(/registro personal todavía no está habilitado/)).toBeVisible();
  } finally {
    enabled = true;
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});

test("mensaje de confirmación no revela si el correo ya tenía cuenta", async ({ page }) => {
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = "production";
    enabled = true;
    const body = await register.default({ searchParams: Promise.resolve({ estado: "enviado" }) });
    await page.setContent(renderToStaticMarkup(body));
    await expect(page.getByRole("status")).toContainText("Si el correo puede registrarse");
    await expect(page.locator('form[action="/api/acceso/registrarse"]')).toHaveCount(0);
  } finally {
    if (previous === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  }
});

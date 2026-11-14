import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { once } from "node:events";
import { signIn, startStudentsApp, studentFixture } from "./admin-students-fixture";

test.describe.configure({ mode: "serial", timeout: 60_000 });
test.use({ hasTouch: true });
const longId = "33333333-3333-4333-8333-333333333333";
const firstName = "AlejandraMaríaAdministradoraNombreExtraordinariamenteLargo";
const lastName = "Fernández de la Cruz del Valle";
const longEmail = `${"administracion".repeat(4)}@${"gimnasio".repeat(6)}.example.test`;
const shortId = "44444444-4444-4444-8444-444444444444";
let origin: string;
let fixture: Awaited<ReturnType<typeof studentFixture>>;
let app: ReturnType<typeof startStudentsApp>;

test.beforeAll(async ({ browserName }) => {
  origin = `http://127.0.0.1:${browserName === "webkit" ? 3235 : 3234}`;
  fixture = await studentFixture();
  app = startStudentsApp(origin, fixture.endpoint, browserName);
  await expect.poll(async () => {
    if (app.exitCode !== null) throw new Error(`El servidor de Alumnos salió con código ${app.exitCode}.`);
    try { return (await fetch(`${origin}/alumnos`)).status; } catch { return 0; }
  }, { timeout: 55_000 }).toBe(200);
});

test.afterAll(async () => {
  if (app && app.exitCode === null && app.signalCode === null) {
    const stopped = once(app, "exit");
    app.kill();
    await stopped;
  }
  await fixture?.close();
});

test.beforeEach(async ({ context }) => {
  fixture.rows.clear();
  fixture.invitations.clear();
  fixture.protectedIds.clear();
  fixture.events.length = 0;
  fixture.setLoadError(false);
  fixture.setSaveError(false);
  fixture.rows.set(longId, { id: longId, first_name: firstName, last_name: lastName, email: longEmail, joined_on: "2026-01-12", dni: null, active: true });
  fixture.rows.set(shortId, { id: shortId, first_name: "Bruno", last_name: "Prueba", email: "bruno@example.test", joined_on: "2026-02-13", dni: "81234567", active: false });
  await signIn(context, origin);
});

function studentRow(page: Page) {
  return page.getByRole("list", { name: /fichas administrativas|resultados de búsqueda/i })
    .getByRole("link", { name: `${lastName}, ${firstName}`, exact: true });
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [360, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`listado, ficha y edición a ${width}px / ${theme}`, async ({ page, browserName }) => {
      await page.setViewportSize({ width, height: 820 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`${origin}/alumnos`);
      await expect(page.getByRole("heading", { name: "Alumnos", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Nuevo alumno" })).toBeInViewport();
      await expect(page.getByRole("textbox", { name: "Buscar alumnos" })).toBeInViewport();
      await expect(studentRow(page)).toHaveAccessibleDescription(`${longEmail} Activo`);
      await expect(page.getByRole("link", { name: "Prueba, Bruno" })).toHaveAccessibleDescription("bruno@example.test Inactivo");
      await expect(studentRow(page).locator("a, button")).toHaveCount(0);
      await noOverflow(page);
      const axe = () => new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
      expect((await axe()).violations).toEqual([]);
      await page.screenshot({ path: `evidence/runs/students-list-${browserName}-${width}-${theme}.png` });

      if (width < 681) await studentRow(page).getByText(longEmail, { exact: true }).tap();
      else await studentRow(page).click({ position: { x: 6, y: 6 } });
      await expect(page.getByRole("heading", { name: `${firstName} ${lastName}`, level: 1 })).toBeVisible();
      await expect(page.getByText("Invitación: No solicitada")).toBeVisible();
      await expect(page.getByText("Comprobantes: próximamente.")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Datos de la ficha" }).getByText(longEmail)).toBeVisible();
      await noOverflow(page);
      expect((await axe()).violations).toEqual([]);
      await page.screenshot({ path: `evidence/runs/students-profile-${browserName}-${width}-${theme}.png`, fullPage: true });

      await page.getByRole("link", { name: "Editar ficha" }).click();
      await expect(page.getByRole("heading", { name: "Editar ficha" })).toBeVisible();
      await expect(page.getByLabel("DNI (opcional)")).toHaveValue("");
      await expect(page.getByLabel("Correo electrónico")).toHaveValue(longEmail);
      await expect(page.getByRole("checkbox", { name: /Enviar invitación/ })).toHaveCount(0);
      await noOverflow(page);
      expect((await axe()).violations).toEqual([]);
      await page.screenshot({ path: `evidence/runs/students-edit-${browserName}-${width}-${theme}.png`, fullPage: true });
    });
  }
}

test("buscar, abrir con Tab y Enter, y llegar a Rutina y Pagos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto(`${origin}/alumnos`);
  const query = page.getByRole("textbox", { name: "Buscar alumnos" });
  await query.fill("gimnasio");
  await query.press("Enter");
  await expect(page).toHaveURL(`${origin}/alumnos?q=gimnasio`);
  await expect(page.getByRole("list", { name: "Resultados de búsqueda" }).getByRole("link")).toHaveCount(1);
  await page.getByRole("link", { name: "Limpiar búsqueda" }).focus();
  await page.keyboard.press("Tab");
  await expect(studentRow(page)).toBeFocused();
  await expect(studentRow(page)).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${origin}/alumnos?id=${longId}`);
  await page.getByRole("link", { name: "Rutina", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/rutinas?alumno=${longId}`);
  await expect(page.getByRole("heading", { name: `Rutina de ${firstName} ${lastName}` })).toBeVisible();
  await page.getByRole("link", { name: /Ficha del alumno/ }).click();
  await page.getByRole("link", { name: "Pagos y cuotas", exact: true }).click();
  await expect(page).toHaveURL(`${origin}/pagos?alumno=${longId}`);
  await expect(page.getByRole("heading", { name: "Pagos y cuotas", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: `${firstName} ${lastName}`, exact: true })).toBeVisible();
});

test("estados sin resultados, lista vacía, ficha ausente y reintento de carga", async ({ page }) => {
  await page.goto(`${origin}/alumnos?q=sin-coincidencia`);
  await expect(page.getByRole("heading", { name: "No encontramos coincidencias" })).toBeVisible();
  await page.getByRole("link", { name: "Limpiar búsqueda" }).click();
  await expect(studentRow(page)).toBeVisible();
  fixture.rows.clear();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Todavía no hay alumnos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo alumno" })).toBeVisible();
  await page.goto(`${origin}/alumnos?id=${longId}`);
  await expect(page.getByRole("heading", { name: "No se encontró la ficha" })).toBeVisible();

  fixture.setLoadError(true);
  await page.goto(`${origin}/alumnos?q=bruno`);
  await expect(page.getByRole("alert")).toContainText("No pudimos cargar los alumnos");
  await expect(page.getByRole("textbox", { name: "Buscar alumnos" })).toHaveValue("bruno");
  await expect(page.getByRole("link", { name: "Reintentar" })).toHaveAttribute("href", "/alumnos?q=bruno");
  fixture.setLoadError(false);
  await page.getByRole("link", { name: "Reintentar" }).click();
  await expect(page.getByRole("heading", { name: "No encontramos coincidencias" })).toBeVisible();
});

test("alta, error de guardado, edición e invitación con servicios sintéticos", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 820 });
  await page.goto(`${origin}/alumnos`);
  await page.getByRole("link", { name: "Nuevo alumno" }).tap();
  const invitation = page.getByRole("checkbox", { name: /Enviar invitación/ });
  await expect(invitation).toBeChecked();
  const email = "alta-nueva@example.test";
  await page.getByLabel("Nombre", { exact: true }).fill("Carla");
  await page.getByLabel("Apellido").fill("De Prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await noOverflow(page);
  fixture.setSaveError(true);
  await page.getByRole("button", { name: "Guardar ficha" }).tap();
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar");
  await expect(page.getByLabel("Correo electrónico")).toHaveValue(email);
  expect(fixture.events).toEqual([]);
  fixture.setSaveError(false);
  await page.getByRole("button", { name: "Guardar ficha" }).tap();
  await expect(page.getByText("Invitación: Enviada")).toBeVisible();
  await expect(page.getByText("Ficha guardada correctamente.")).toBeVisible();
  expect(fixture.events).toEqual(["insert", "create-access", "invite"]);
  const id = new URL(page.url()).searchParams.get("id")!;
  expect(fixture.rows.get(id)).toMatchObject({ first_name: "Carla", email, dni: null, active: true });

  await page.getByRole("link", { name: "Editar ficha" }).tap();
  await page.getByLabel("Estado administrativo").selectOption("false");
  await page.getByRole("button", { name: "Guardar ficha" }).tap();
  await expect(page.getByRole("region", { name: "Datos de la ficha" }).getByText("Inactivo")).toBeVisible();
  expect(fixture.rows.get(id)?.active).toBe(false);
  expect(fixture.events).toEqual(["insert", "create-access", "invite", "update"]);

  await page.goto(`${origin}/alumnos?id=${shortId}`);
  const access = page.getByRole("region", { name: "Acceso a CUEVA" });
  await access.getByRole("button", { name: "Enviar o reintentar invitación" }).tap();
  await expect(access.getByText("Invitación: Enviada")).toBeVisible();
  await expect(access.getByRole("button", { name: "Enviar o reintentar invitación" })).toHaveCount(0);
  expect(fixture.events.slice(-2)).toEqual(["create-access", "invite"]);
});

test("eliminación protegida y confirmación explícita de una ficha vacía", async ({ page }) => {
  fixture.protectedIds.add(longId);
  await page.goto(`${origin}/alumnos?id=${longId}`);
  await expect(page.getByRole("button", { name: "Eliminar alumno" })).toBeDisabled();
  await expect(page.getByText(/No se puede eliminar/)).toBeVisible();
  await page.goto(`${origin}/alumnos?id=${shortId}`);
  const remove = page.getByRole("button", { name: "Eliminar alumno" });
  await remove.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("bruno@example.test")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  expect(fixture.events).toEqual([]);
  await remove.click();
  await dialog.getByRole("button", { name: "Eliminar definitivamente" }).click();
  await expect(page).toHaveURL(`${origin}/alumnos?eliminado=1`);
  await expect(page.getByText("La ficha fue eliminada correctamente.")).toBeVisible();
  expect(fixture.rows.has(shortId)).toBe(false);
  expect(fixture.events).toEqual(["delete"]);
});

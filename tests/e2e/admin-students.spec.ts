import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn, startStudentsApp, studentFixture } from "./admin-students-fixture";
import { routineEditorFixture } from "./routine-editor-fixture";

test.describe.configure({ mode: "serial", timeout: 60_000 });
test.use({ hasTouch: true });
const longId = "33333333-3333-4333-8333-333333333333";
const firstName = "AlejandraMaríaAdministradoraNombreExtraordinariamenteLargo";
const lastName = "Fernández de la Cruz del Valle";
const longEmail = `${"administracion".repeat(4)}@${"gimnasio".repeat(6)}.example.test`;
const shortId = "44444444-4444-4444-8444-444444444444";
let origin: string;
let fixture: Awaited<ReturnType<typeof studentFixture>>;
let app: Awaited<ReturnType<typeof startStudentsApp>>;
const routines = routineEditorFixture();

test.beforeAll(async () => {
  origin = "http://127.0.0.1:3234";
  fixture = await studentFixture(routines.handle);
  app = startStudentsApp(origin, fixture.endpoint);
  await expect.poll(async () => {
    if (app.processHandle.exitCode !== null) throw new Error(`El servidor de Alumnos salió con código ${app.processHandle.exitCode}.`);
    try { return (await fetch(`${origin}/alumnos`)).status; } catch { return 0; }
  }, { timeout: 55_000 }).toBe(200);
});

test.afterAll(async () => {
  try { await app?.close(); } finally { await fixture?.close(); }
});

test.beforeEach(async ({ context }) => {
  routines.reset();
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

async function expectAccessible(page: Page) {
  await expect(page).toHaveTitle(/CUEVA/);
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(result.violations).toEqual([]);
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test("la entrada instalada abre el ingreso o la cuenta según la sesión", async ({ context, page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  const response = await context.request.get(`${origin}/manifest.webmanifest`);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ start_url: "/cuenta", scope: "/", display: "standalone" });
  const start = new URL(manifest.start_url, origin).href;

  await context.clearCookies();
  await page.goto(start);
  await expect(page).toHaveURL(`${origin}/ingresar`);
  await expect(page.getByRole("heading", { name: "Ingresá a tu cuenta" })).toBeVisible();

  await signIn(context, origin);
  await page.goto(start);
  await expect(page).toHaveURL(start);
  await expect(page.getByRole("heading", { name: "Hola, Admin de prueba" })).toBeVisible();

  await context.clearCookies();
  await signIn(context, origin, routines.studentUser);
  await page.goto(start);
  await expect(page).toHaveURL(start);
  await expect(page.getByRole("heading", { name: "Inicio" })).toBeVisible();
});

for (const width of [360, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`listado, ficha y edición a ${width}px / ${theme}`, async ({ page, browserName }) => {
      await page.setViewportSize({ width, height: 820 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`${origin}/alumnos`);
      await expect(page.getByRole("heading", { name: "Alumnos", exact: true })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.getByRole("link", { name: "Nuevo alumno" })).toBeInViewport();
      await expect(page.getByRole("textbox", { name: "Buscar alumnos" })).toBeInViewport();
      await expect(studentRow(page)).toHaveAccessibleDescription(`${longEmail} Activo`);
      await expect(page.getByRole("link", { name: "Prueba, Bruno" })).toHaveAccessibleDescription("bruno@example.test Inactivo");
      await expect(studentRow(page).locator("a, button")).toHaveCount(0);
      await noOverflow(page);
      await expectAccessible(page);
      await page.screenshot({ path: `evidence/runs/students-list-${browserName}-${width}-${theme}.png` });

      if (width < 681) await studentRow(page).getByText(longEmail, { exact: true }).tap();
      else await studentRow(page).click({ position: { x: 6, y: 6 } });
      await expect(page.getByRole("heading", { name: `${firstName} ${lastName}`, level: 1 })).toBeVisible();
      await expect(page.getByText("Invitación: No solicitada")).toBeVisible();
      await expect(page.getByText("Comprobantes: próximamente.")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Datos de la ficha" }).getByText(longEmail)).toBeVisible();
      await noOverflow(page);
      await expectAccessible(page);
      await page.screenshot({ path: `evidence/runs/students-profile-${browserName}-${width}-${theme}.png`, fullPage: true });

      await page.getByRole("link", { name: "Editar ficha" }).click();
      await expect(page.getByRole("heading", { name: "Editar ficha" })).toBeVisible();
      await expect(page.getByLabel("DNI (opcional)")).toHaveValue("");
      await expect(page.getByLabel("Correo electrónico")).toHaveValue(longEmail);
      await expect(page.getByRole("checkbox", { name: /Enviar invitación/ })).toHaveCount(0);
      await noOverflow(page);
      await expectAccessible(page);
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
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No pudimos cargar los alumnos");
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
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No se pudo guardar");
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

const workoutBlocks = [
  ["Sentadilla", "Press militar"],
  ["Plancha", "Remo", "Peso muerto"],
  ["Flexiones", "Press militar"],
  ["Remo", "Sentadilla", "Plancha"],
];

for (const width of [360, 390, 1440]) {
  for (const theme of ["light", "dark"] as const) {
    test(`rutina de cuatro bloques a ${width}px / ${theme}`, async ({ page, browser, browserName }) => {
      await page.setViewportSize({ width, height: 790 });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(`${origin}/rutinas?alumno=${shortId}`);
      const editor = page.getByRole("region", { name: "Editor de rutina" });
      await expect(editor.getByText("Usar plantilla")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const chooseDay = async (name: string) => {
        await editor.getByRole("button", { name: "+ Día", exact: true }).click();
        const input = editor.getByRole("textbox", { name: "Nombre del nuevo día" });
        await expect(input).toBeFocused();
        await input.fill(name);
        await input.press("Enter");
      };
      await chooseDay("Empuje");
      const addBlock = editor.getByRole("button", { name: "+ Bloque", exact: true });
      await expect(addBlock).toBeFocused();
      await addBlock.press("Enter");
      let picker = page.getByRole("dialog", { name: "Nuevo bloque" });
      const rounds = picker.getByRole("spinbutton", { name: "Vueltas del bloque" });
      const squatWeight = picker.getByRole("textbox", { name: "Peso (kg) de Sentadilla" });
      const squat = picker.getByRole("checkbox", { name: "Sentadilla", exact: true });
      await expect(rounds).toHaveValue("3");
      await rounds.fill("7");
      await squat.press("Space");
      await squatWeight.fill("90");
      await page.keyboard.press("Escape");
      await expect(picker).toHaveCount(0);
      await expect(addBlock).toBeFocused();
      await expect(editor.getByRole("region", { name: "Bloque 1", exact: true })).toHaveCount(0);

      for (const [index, names] of workoutBlocks.entries()) {
        if (width < 500) await addBlock.tap(); else await addBlock.click();
        picker = page.getByRole("dialog", { name: "Nuevo bloque" });
        const submit = picker.getByRole("button", { name: `Agregar ${names.length} ejercicios` });
        await expect(rounds).toHaveValue("3");
        if (index === 0) {
          await expect(squat).not.toBeChecked();
          await squat.check();
          await expect(squatWeight).toHaveValue("");
          await squatWeight.fill("42,5");
          await picker.getByRole("searchbox", { name: "Buscar ejercicio" }).fill("Press militar");
          await expect(picker.getByRole("list", { name: "Seleccionados fuera de la búsqueda" }).getByRole("textbox")).toHaveValue("42,5");
          await picker.getByRole("checkbox", { name: "Press militar", exact: true }).check();
          await rounds.fill("0");
          await expect(submit).toBeDisabled();
          await rounds.fill("5");
          await squatWeight.fill("42,555");
          await expect(submit).toBeDisabled();
          await squatWeight.fill("42,5");
          await picker.getByRole("textbox", { name: "Peso (kg) de Press militar" }).fill("0");
          await noOverflow(page);
        } else {
          for (const name of names) await picker.getByRole("checkbox", { name, exact: true }).check();
          if (index === 1) await picker.getByRole("textbox", { name: "Peso (kg) de Plancha" }).fill("0");
        }
        await submit.click();
        const card = editor.getByRole("region", { name: `Bloque ${index + 1}`, exact: true });
        await expect(card.getByText(index === 0 ? "5 vueltas" : "3 vueltas", { exact: true })).toBeVisible();
        const rows = card.getByRole("listitem");
        await expect(rows).toHaveCount(names.length);
        for (const [item, name] of names.entries()) await expect(rows.nth(item)).toContainText(name);
        if (index === 0) {
          await expect(rows.nth(0)).toContainText("42.5 kg");
          await expect(rows.nth(1)).toContainText("0 kg");
        }
        if (index === 1) {
          await expect(rows.nth(0)).toContainText("0 kg");
          await expect(rows.nth(1)).not.toContainText(" kg");
        }
        await expect(card.getByLabel("Tipo de objetivo")).toBeHidden();
        await expect(picker).toHaveCount(0);
      }
      const firstBlock = editor.getByRole("region", { name: "Bloque 1", exact: true });
      await firstBlock.getByRole("button", { name: /Sentadilla/ }).click();
      await expect(firstBlock.getByLabel("Peso objetivo (kg)")).toHaveValue("42.5");
      await firstBlock.getByRole("button", { name: /Press militar/ }).click();
      await firstBlock.getByLabel("Tipo de objetivo").selectOption("time");
      await firstBlock.getByLabel("Duración", { exact: true }).fill("45");
      await firstBlock.getByRole("button", { name: /Press militar/ }).click();
      await expect(firstBlock.getByText("45 s", { exact: true })).toBeVisible();
      await chooseDay("Tirón");
      await expect(firstBlock).toHaveCount(0);
      await editor.getByRole("button", { name: "Empuje", exact: true }).click();
      await expect(firstBlock).toBeVisible();
      await editor.getByText("Vista previa del borrador", { exact: true }).click();
      await expect(editor.getByText("45 segundos", { exact: true })).toBeVisible();
      await editor.getByText("Vista previa del borrador", { exact: true }).click();
      await noOverflow(page);

      const publish = editor.getByRole("button", { name: "Publicar rutina", exact: true });
      await expect(publish).toBeEnabled();
      await publish.click();
      await expect(editor.getByText("Rutina publicada.", { exact: true })).toBeVisible();
      expect(routines.operations.filter(step => step === "publish")).toHaveLength(1);
      await page.screenshot({ path: test.info().outputPath(`rutina-${browserName}-${width}-${theme}.png`), fullPage: true });

      if (width === 360 && theme === "light") {
        const learner = await browser.newContext({ viewport: { width, height: 790 } });
        try {
          await signIn(learner, origin, routines.studentUser);
          const studentPage = await learner.newPage();
          await studentPage.goto(`${origin}/mi-rutina`);
          await expect(studentPage.getByRole("heading", { name: "Mi rutina", exact: true })).toBeVisible();
          await expect(studentPage.getByText("5 vueltas", { exact: true })).toBeVisible();
          await expect(studentPage.getByText("42.5 kg", { exact: true })).toBeVisible();
          await expect(studentPage.getByText("0 kg", { exact: true })).toBeVisible();
          await expect(studentPage.getByText("45 segundos", { exact: true })).toBeVisible();
          await firstBlock.getByRole("button", { name: /Press militar/ }).click();
          await firstBlock.getByLabel("Duración", { exact: true }).fill("55");
          await expect(publish).toBeEnabled();
          await studentPage.reload();
          await expect(studentPage.getByText("45 segundos", { exact: true })).toBeVisible();
          await expect(studentPage.getByText("55 segundos", { exact: true })).toHaveCount(0);
          await publish.click();
          await expect(editor.getByText("Rutina publicada.", { exact: true })).toBeVisible();
          await studentPage.reload();
          await expect(studentPage.getByText("55 segundos", { exact: true })).toBeVisible();
          expect(routines.operations.filter(step => step === "publish")).toHaveLength(2);
        } finally {
          await learner.close();
        }
      }
    });
  }
}

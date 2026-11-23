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
  await expect(page.getByRole("heading", { name: "Hola, Bruno", exact: true, level: 1 })).toBeVisible();
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


test("aplicar una plantilla confirma antes de reemplazar un borrador solo de texto", async ({ page }) => {
  await page.goto(`${origin}/rutinas?alumno=${shortId}`);
  const editor = page.getByRole("region", { name: "Editor de rutina" });
  await editor.getByRole("button", { name: "Texto libre" }).click();
  const textarea = editor.getByRole("textbox", { name: "Rutina en texto libre" });
  await textarea.fill("Rutina personalizada que no debe perderse");
  await editor.getByText("Usar plantilla", { exact: true }).click();
  await editor.getByRole("combobox", { name: "Plantilla" }).selectOption("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  page.once("dialog", async dialog => {
    expect(dialog.message()).toContain("¿Reemplazar el contenido del borrador");
    await dialog.dismiss();
  });
  await editor.getByRole("button", { name: "Copiar al borrador" }).click();
  await expect(textarea).toHaveValue("Rutina personalizada que no debe perderse");
});

test("reintentar un guardado cuya respuesta se perdió reutiliza la misma operación", async ({ page }) => {
  await page.goto(`${origin}/rutinas?alumno=${shortId}`);
  const editor = page.getByRole("region", { name: "Editor de rutina" });
  await editor.getByRole("button", { name: "Texto libre" }).click();
  routines.loseNextSaveResponse();
  const textarea = editor.getByRole("textbox", { name: "Rutina en texto libre" });
  await textarea.fill("Rutina confirmada en servidor aunque se perdió la respuesta");
  await expect(editor.getByRole("alert")).toContainText("No se pudo guardar");
  await editor.getByRole("button", { name: "Reintentar guardado" }).click();
  await expect(editor.getByText("Borrador guardado", { exact: true })).toBeVisible();
  expect(routines.operations.filter(step => step === "draft")).toHaveLength(1);
  expect(routines.saveOperationIds).toHaveLength(2);
  expect(routines.saveOperationIds[1]).toBe(routines.saveOperationIds[0]);
  await expect(textarea).toHaveValue("Rutina confirmada en servidor aunque se perdió la respuesta");
});

test("texto libre vincula menciones por UUID y publica la instantánea visible para el alumno", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto(`${origin}/rutinas?alumno=${shortId}`);
  const editor = page.getByRole("region", { name: "Editor de rutina" });
  await expect(editor.getByText("Usar plantilla")).toBeVisible();
  await editor.getByRole("button", { name: "Texto libre" }).click();
  const textarea = editor.getByRole("textbox", { name: "Rutina en texto libre" });
  const exerciseSearchDiagnostics: Array<{ url: string; status: number; body: unknown }> = [];
  page.on("response", async response => {
    if (!response.url().includes("/api/ejercicios?q=Sentadilla")) return;
    let body: unknown = null;
    try { body = await response.json(); } catch { /* keep status when response is not JSON */ }
    exerciseSearchDiagnostics.push({ url: response.url(), status: response.status(), body });
  });
  await textarea.fill("@Sentadilla");
  await page.waitForTimeout(350);
  console.log("ADMIN_EXERCISE_SEARCH_DIAGNOSTICS", JSON.stringify(exerciseSearchDiagnostics));
  // The autocomplete list is rendered in a document.body portal, outside the editor region.
  const suggestion = page.getByRole("listbox", { name: "Ejercicios sugeridos" }).getByRole("option", { name: "Sentadilla", exact: true });
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  await expect(textarea).toHaveValue("Sentadilla");
  await textarea.press("End");
  await textarea.press("Enter");
  await textarea.type("@Remo");
  const directSuggestion = page.getByRole("listbox", { name: "Ejercicios sugeridos" }).getByRole("option", { name: "Remo", exact: true });
  await expect(directSuggestion).toBeVisible();
  await directSuggestion.click();
  await expect(textarea).toHaveValue("Sentadilla\nRemo");
  await expect(editor.getByText("2 menciones vinculadas")).toBeVisible();
  await expect.poll(() => routines.operations).toEqual(["draft"]);
  await editor.getByRole("button", { name: "Publicar rutina" }).click();
  await expect(editor.getByText("Rutina publicada.")).toBeVisible();
  await expect.poll(() => routines.operations).toEqual(["draft", "publish"]);
  await editor.getByText("Última rutina publicada").click();
  await expect(editor.locator("pre").last()).toHaveText("Sentadilla\nRemo");

  const learner = await browser.newContext();
  try {
    await signIn(learner, origin, routines.studentUser);
    const studentPage = await learner.newPage();
    await studentPage.goto(`${origin}/mi-rutina`);
    await expect(studentPage.getByRole("heading", { name: "Mi rutina", exact: true })).toBeVisible();
    const publishedText = studentPage.locator("section.my-routine-notes");
    await expect(publishedText).toContainText("Sentadilla");
    await expect(publishedText).toContainText("Remo");
    // The synthetic routine fixture verifies the published text snapshot.
    // Authenticated exercise-to-UUID rendering is covered by the local
    // Supabase routine-mentions integration test.
    await expect(publishedText.locator(".my-routine-text-content")).toContainText("Sentadilla");
    await expect(publishedText.locator(".my-routine-text-content")).toContainText("Remo");
  } finally {
    await learner.close();
  }
});


test("cargas mezcladas no habilitan guardar borradores ni plantillas", async ({ page }) => {
  await page.goto(`${origin}/rutinas?alumno=${shortId}`);
  const editor = page.getByRole("region", { name: "Editor de rutina" });
  await editor.getByRole("button", { name: "Texto libre" }).click();
  await editor.getByRole("textbox", { name: "Rutina en texto libre" }).fill("Revisión confirmada");
  await expect.poll(() => routines.operations).toEqual(["draft"]);
  routines.setStaleDraft(true);
  await page.reload();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No pudimos cargar la rutina");
  await expect(editor).toHaveCount(0);
  const comparison = await page.request.get(`${origin}/api/rutinas?id=${shortId}`);
  expect(comparison.status()).toBe(503);
  routines.setStaleDraft(false);
  routines.setStaleTemplate(true);
  await page.goto(`${origin}/rutinas/plantillas?id=cccccccc-cccc-4ccc-8ccc-cccccccccccc`);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No pudimos cargar las plantillas");
  await expect(editor).toHaveCount(0);
  expect((await page.request.get(`${origin}/api/rutinas?templates=1`)).status()).toBe(503);
});

test("una falla del documento publicado no muestra el formato anterior", async ({ page, browser }) => {
  await page.goto(`${origin}/rutinas?alumno=${shortId}`);
  const editor = page.getByRole("region", { name: "Editor de rutina" });
  await editor.getByRole("button", { name: "Texto libre" }).click();
  const text = editor.getByRole("textbox", { name: "Rutina en texto libre" });
  await text.fill("🙂 @Sentadilla");
  await page.getByRole("listbox", { name: "Ejercicios sugeridos" }).getByRole("option", { name: "Sentadilla", exact: true }).click();
  await expect(text).toHaveValue("🙂 Sentadilla");
  await expect.poll(() => routines.operations).toEqual(["draft"]);
  await editor.getByRole("button", { name: "Publicar rutina" }).click();
  await expect(editor.getByText("Rutina publicada.")).toBeVisible();
  const learner = await browser.newContext();
  try {
    await signIn(learner, origin, routines.studentUser);
    const studentPage = await learner.newPage();
    await studentPage.goto(`${origin}/mi-rutina`);
    await expect(studentPage.locator(".my-routine-mention")).toHaveText("Sentadilla");
    routines.setPublicationReadError(true);
    await studentPage.reload();
    await expect(studentPage.getByRole("heading", { name: "No pudimos cargar tu rutina" })).toBeVisible();
    await expect(studentPage.locator(".my-routine-notes")).toHaveCount(0);
    await expect(studentPage.getByRole("group", { name: "Día de entrenamiento" })).toHaveCount(0);
  } finally { await learner.close(); }
});


for (const interaction of ["teclado", "toque"] as const) {
  test(`sugerencias obsoletas no se insertan con ${interaction} mientras llega otra búsqueda`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1100 });
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let waiting = false;
    let intercepted = false;
    await page.route("**/api/ejercicios?*", async route => {
      const query = new URL(route.request().url()).searchParams.get("q")?.toLowerCase();
      if (query === "sent" && !intercepted) {
        intercepted = true;
        waiting = true;
        await held;
      }
      await route.continue().catch(() => {}); // A new query may abort this held response.
    });
    try {
      await page.goto(`${origin}/rutinas?alumno=${shortId}`);
      const editor = page.getByRole("region", { name: "Editor de rutina" });
      await editor.getByRole("button", { name: "Texto libre" }).click();
      const textarea = editor.getByRole("textbox", { name: "Rutina en texto libre" });
      await textarea.fill("@press");
      const previous = page.getByRole("listbox", { name: "Ejercicios sugeridos" }).getByRole("option", { name: "Press militar", exact: true });
      await expect(previous).toBeVisible();
      await previous.scrollIntoViewIfNeeded();
      const bounds = await previous.boundingBox();
      expect(bounds).not.toBeNull();
      await textarea.fill("@sent");
      await expect.poll(() => waiting).toBe(true);
      if (interaction === "teclado") {
        await textarea.press("Enter");
        await expect(textarea).toHaveValue("@sent\n");
        await textarea.fill("@sent");
      } else {
        // The previous option is intentionally removed as soon as the new query
        // starts. Tapping its former coordinates must not insert that stale item;
        // the outside tap closes the pending panel, so reopen the query afterward.
        await page.touchscreen.tap(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
        await expect(textarea).toHaveValue("@sent");
        await textarea.fill("@sent");
      }
      await expect(editor.getByText("0 menciones vinculadas")).toBeVisible();
      await expect(previous).toHaveCount(0);
      release();
      const current = page.getByRole("listbox", { name: "Ejercicios sugeridos" }).getByRole("option", { name: "Sentadilla", exact: true });
      await expect(current).toBeVisible();
      if (interaction === "teclado") {
        await textarea.focus();
        await textarea.press("ArrowDown");
        await textarea.press("Enter");
      } else await current.tap();
      await expect(textarea).toHaveValue("Sentadilla");
      await expect(editor.getByText("1 mención vinculada")).toBeVisible();
      await expect(previous).toHaveCount(0);
      await expect.poll(async () => {
        const response = await page.request.get(`${origin}/api/rutinas?id=${shortId}`);
        const data = await response.json();
        return data.note?.text_content === "Sentadilla" ? data.note.mentions?.map((mention: { exercise_id: string }) => mention.exercise_id) : [];
      }).toEqual(["bbbbbbbb-bbbb-4bbb-8bbb-000000000000"]);
    } finally { release(); }
  });
}

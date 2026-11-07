import { expect, test } from "@playwright/test";

const fixture = "/__test__/due-date";

test.beforeEach(async ({ page }) => {
  await page.goto(fixture);
  await expect(page.getByRole("heading", { name: "Vencimiento del alumno" })).toBeVisible();
});

test("previews next period by default and requires explicit confirmation for current period", async ({ page }) => {
  await expect(page.getByText("Alcance: próximo período y períodos futuros impagos existentes")).toBeVisible();
  const submit = page.getByRole("button", { name: "Guardar cambio de vencimiento" });
  await page.getByLabel("Nuevo día de vencimiento").fill("20");
  await page.getByLabel("Período actual · 2026-11").check();
  await expect(page.getByText("Alcance: período actual")).toBeVisible();
  await expect(submit).toBeDisabled();
  await page.getByLabel("Confirmo que quiero modificar el período actual.").check();
  await expect(submit).toBeEnabled();
});

test("submits the selected scope and previewed due day to the API", async ({ page }) => {
  let submitted: { op: string; p: Record<string, unknown> } | undefined;
  await page.route("**/api/pagos", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Operación registrada.", operation_not_applied: false }) });
  });
  await page.getByLabel("Nuevo día de vencimiento").fill("20");
  await page.getByLabel("Período actual · 2026-11").check();
  await page.getByLabel("Confirmo que quiero modificar el período actual.").check();
  await page.getByRole("button", { name: "Guardar cambio de vencimiento" }).click();
  await expect(page.getByText("Operación registrada.")).toBeVisible();
  expect(submitted?.p).toMatchObject({ kind: "due_day", due_day: "20", effective_month: "2026-11", scope: "current_period" });
  expect(submitted?.op).toMatch(/^[0-9a-f-]{36}$/i);
});

test("resumes the exact pending operation after reload without generating a new key", async ({ page }) => {
  const operationIds: string[] = [];
  let calls = 0;
  await page.route("**/api/pagos", async (route) => {
    calls += 1;
    operationIds.push(route.request().postDataJSON().op);
    if (calls === 1) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Resultado incierto.", operation_not_applied: false }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "Operación registrada.", operation_not_applied: false }) });
  });
  await page.getByLabel("Nuevo día de vencimiento").fill("21");
  await page.getByRole("button", { name: "Guardar cambio de vencimiento" }).click();
  await expect(page.getByText("Resultado incierto.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Operación registrada.")).toBeVisible();
  expect(calls).toBe(2);
  expect(operationIds[0]).toBe(operationIds[1]);
});

test("clears a definitively rejected operation so corrected data receives a new key", async ({ page }) => {
  const operationIds: string[] = [];
  let calls = 0;
  await page.route("**/api/pagos", async (route) => {
    calls += 1;
    operationIds.push(route.request().postDataJSON().op);
    const rejected = calls === 1;
    await route.fulfill({
      status: rejected ? 409 : 200,
      contentType: "application/json",
      body: JSON.stringify({ message: rejected ? "El cambio fue rechazado." : "Operación registrada.", operation_not_applied: rejected }),
    });
  });
  await page.getByLabel("Nuevo día de vencimiento").fill("0");
  // HTML validation prevents an invalid day from being submitted.
  await expect(page.getByRole("button", { name: "Guardar cambio de vencimiento" })).toBeDisabled();
  await page.getByLabel("Nuevo día de vencimiento").fill("19");
  await page.getByRole("button", { name: "Guardar cambio de vencimiento" }).click();
  await expect(page.getByText("El cambio fue rechazado.")).toBeVisible();
  await page.getByLabel("Nuevo día de vencimiento").fill("20");
  await page.getByRole("button", { name: "Guardar cambio de vencimiento" }).click();
  await expect(page.getByText("Operación registrada.")).toBeVisible();
  expect(calls).toBe(2);
  expect(operationIds[0]).not.toBe(operationIds[1]);
});

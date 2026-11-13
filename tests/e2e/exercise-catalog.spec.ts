import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";
import type { Exercise } from "@/lib/routines/types";
import { youtubeUrl } from "@/lib/routines/video";

// Mount the actual interactive components with the installed React runtime.
// Only HTTP responses are synthetic: this regression exercises React state,
// native URL validation and requests, without adding an auth bypass to the app.
const transpile = (path: string) => ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const modules = {
  react: readFileSync("node_modules/react/cjs/react.development.js", "utf8"),
  "react/jsx-runtime": readFileSync("node_modules/react/cjs/react-jsx-runtime.development.js", "utf8"),
  "react-dom": readFileSync("node_modules/react-dom/cjs/react-dom.development.js", "utf8"),
  "react-dom/client": readFileSync("node_modules/react-dom/cjs/react-dom-client.development.js", "utf8"),
  scheduler: readFileSync("node_modules/scheduler/cjs/scheduler.development.js", "utf8"),
  "@/components/routines/plan-view": transpile("src/components/routines/plan-view.tsx"),
  catalog: transpile("src/components/routines/exercise-catalog.tsx"),
};
const mountCatalog = `(() => {
  const process = { env: { NODE_ENV: "development" } };
  const modules = {${Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}: (require, module, exports) => {\n${code}\n}`).join(",\n")}};
  const cache = {};
  function require(id) {
    if (!modules[id]) throw new Error("Unexpected fixture import: " + id);
    if (!cache[id]) {
      cache[id] = { exports: {} };
      modules[id](require, cache[id], cache[id].exports);
    }
    return cache[id].exports;
  }
  require("react-dom/client").createRoot(document.getElementById("root"))
    .render(require("react").createElement(require("catalog").ExerciseCatalog, {
      videosOnly: new URLSearchParams(location.search).get("vista") === "videos",
    }));
})();`;
const css = readFileSync("src/app/globals.css", "utf8");
const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const youtube = "https://www.youtube.com/watch?v=abcdefghijk";
const videoBytes = Buffer.from("synthetic-gallery-bytes");

async function catalogFixture(page: Page, origin: string, theme: string, videosOnly = false, extraRows = 0, failFirstSearch = false) {
  const rows = new Map<string, Exercise>([
    [firstId, { id: firstId, name: "Sentadilla", description: "Inicial", revision: 1, active: true, video_url: null, video_path: null }],
    [secondId, { id: secondId, name: "Plancha", description: "Otra ficha", revision: 1, active: true, video_url: null, video_path: null }],
  ]);
  const writes: Exercise[] = [], uploads = new Map<string, Buffer>();
  let failedFirstSearch = false;
  for (let i = 1; i <= extraRows; i++) {
    const id = randomUUID();
    rows.set(id, { id, name: `Ejercicio de prueba ${i}`, description: "Descripción de ejemplo", revision: 1, active: true, video_url: null, video_path: null });
  }
  if (videosOnly) {
    rows.set(firstId, { ...rows.get(firstId)!, video_url: youtube });
    rows.set("33333333-3333-4333-8333-333333333333", {
      id: "33333333-3333-4333-8333-333333333333",
      name: "Remo", description: "", revision: 1, active: true, video_url: null,
      video_path: "33333333-3333-4333-8333-333333333333/fixture.webm",
    });
    uploads.set("33333333-3333-4333-8333-333333333333/fixture.webm", videoBytes);
  }
  await page.route(`${origin}/__catalog-regression*`, route => route.fulfill({
    contentType: "text/html",
    body: `<!doctype html><html lang="es" data-theme="${theme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ejercicios</title><style>${css}</style></head><body><div class="dashboard"><main class="exercises-page"><h1>Ejercicios</h1><div id="root"></div></main></div></body></html>`,
  }));
  await page.route(`${origin}/__gallery-upload/**`, async route => {
    uploads.set(new URL(route.request().url()).pathname.slice("/__gallery-upload/".length), route.request().postDataBuffer() ?? Buffer.alloc(0));
    await route.fulfill({ status: 200 });
  });
  await page.route(`${origin}/api/ejercicios**`, async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.pathname === "/api/ejercicios/video/upload") {
      const p = req.postDataJSON();
      const path = `${p.id}/${randomUUID()}.webm`;
      await route.fulfill({ json: { path, url: `${origin}/__gallery-upload/${path}` } });
    } else if (url.pathname === "/api/ejercicios/video") {
      const exercise = rows.get(url.searchParams.get("id") ?? "");
      const bytes = exercise?.video_path ? uploads.get(exercise.video_path) : undefined;
      if (!bytes && !exercise?.video_url) await route.fulfill({ status: 404, json: { message: "Sin video disponible." } });
      else if (url.searchParams.get("check") === "1") await route.fulfill({ json: { available: true } });
      else if (bytes) await route.fulfill({ contentType: "video/webm", body: bytes });
      else await route.fulfill({ status: 307, headers: { location: exercise!.video_url! } });
    } else if (req.method() === "GET") {
      if (failFirstSearch && !failedFirstSearch) {
        failedFirstSearch = true;
        await route.fulfill({ status: 503, json: { message: "No pudimos cargar el catálogo." } });
        return;
      }
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const exercises = [...rows.values()].filter(e =>
        e.name.toLowerCase().includes(q) &&
        (url.searchParams.get("videos") !== "1" || e.video_url || e.video_path)
      );
      await route.fulfill({ json: { exercises, next: null } });
    } else {
      const p: Exercise = req.postDataJSON(), current = rows.get(p.id);
      // Reject mixed sources, malformed URLs, missing uploads and stale revisions.
      // This is a component fixture, not evidence of DB/Storage authorization.
      if ((p.video_url !== null && !youtubeUrl(p.video_url)) ||
          (p.video_url && p.video_path) || (p.video_path && !uploads.has(p.video_path)) ||
          p.revision !== (current?.revision ?? 0)) {
        await route.fulfill({ status: 400, json: { message: "Invalid synthetic write" } });
        return;
      }
      const exercise = { ...p, revision: p.revision + 1 };
      rows.set(p.id, exercise); writes.push(exercise);
      await route.fulfill({ json: { exercise } });
    }
  });
  await page.goto(`${origin}/__catalog-regression${videosOnly ? "?vista=videos" : ""}`);
  await page.addScriptTag({ content: mountCatalog });
  if (!videosOnly && !failFirstSearch) await expect(page.getByRole("button", { name: "Sentadilla", exact: true })).toBeVisible();
  return { rows, writes };
}

for (const width of [390, 1440]) for (const theme of ["light", "dark"]) {
  test(`catalog gallery remains separate from YouTube after saves ${width}px / ${theme}`, async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("The fixture requires a local origin.");
    await page.setViewportSize({ width, height: 960 });
    const { rows, writes } = await catalogFixture(page, baseURL, theme);
    const dialogs: string[] = [];
    page.on("dialog", async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
    const input = page.getByLabel("Video de YouTube (opcional)");
    const save = async () => {
      const before = writes.length;
      await page.getByRole("button", { name: "Guardar ejercicio", exact: true }).click();
      await expect.poll(() => writes.length).toBe(before + 1);
      await expect(page.getByRole("status").filter({ hasText: "Ejercicio guardado." })).toBeVisible();
    };
    const upload = async () => {
      await page.getByLabel(/Subir video desde la galería/).setInputFiles({ name: "fixture.webm", mimeType: "video/webm", buffer: videoBytes });
      await expect(page.getByRole("status").filter({ hasText: "Video cargado." })).toBeVisible();
      await expect(input).toHaveValue("");
    };
    const open = async (name: string) => {
      const dialog = page.getByRole("dialog");
      if (await dialog.isVisible()) await dialog.getByRole("button", { name: "Cerrar" }).click();
      await page.getByRole("button", { name, exact: true }).click();
      await expect(dialog.getByLabel("Nombre del ejercicio")).toHaveValue(name);
      expect(dialogs).toEqual([]);
    };

    await open("Sentadilla");
    await upload();
    await save();
    const galleryPath = rows.get(firstId)!.video_path;
    expect(galleryPath).toBeTruthy();
    await expect(input).toHaveValue("");

    // The second save must work without reloading or clearing a polluted URL input.
    await page.getByLabel("Descripción del ejercicio").fill("Descripción actualizada");
    await save();
    expect(rows.get(firstId)).toMatchObject({ description: "Descripción actualizada", video_url: null, video_path: galleryPath });
    const item = page.locator(".exercise-results li").filter({ has: page.getByText("Sentadilla", { exact: true }) });
    await page.getByRole("button", { name: "Cerrar" }).click();
    await item.getByRole("link", { name: "Consultar video", exact: true }).click();
    const link = item.getByRole("link", { name: "Abrir video explicativo", exact: true });
    await expect(link).toBeVisible();
    const received = await page.evaluate(async href => [...new Uint8Array(await (await fetch(href!)).arrayBuffer())], await link.getAttribute("href"));
    expect(Buffer.from(received)).toEqual(videoBytes);

    await open("Plancha");
    await open("Sentadilla");
    await expect(page.getByLabel("Descripción del ejercicio")).toHaveValue("Descripción actualizada");
    await expect(input).toHaveValue("");
    await page.getByRole("button", { name: "Quitar asociación de video", exact: true }).click();
    await save();
    expect(rows.get(firstId)).toMatchObject({ video_url: null, video_path: null });
    await page.getByRole("button", { name: "Cerrar" }).click();
    await expect(item.getByText("Sin video disponible.", { exact: true })).toBeVisible();

    await open("Sentadilla");
    await input.fill(youtube);
    await save();
    expect(rows.get(firstId)).toMatchObject({ video_url: youtube, video_path: null });
    await expect(input).toHaveValue(youtube);
    await open("Plancha");
    await open("Sentadilla");
    await upload(); // YouTube -> gallery clears the URL before and after save.
    await save();
    await expect(input).toHaveValue("");
    expect(rows.get(firstId)!.video_path).toBeTruthy();
    expect(rows.get(firstId)!.video_url).toBeNull();
    await input.fill(youtube); // Gallery -> YouTube removes the Storage association.
    await expect(page.getByRole("button", { name: "Quitar asociación de video", exact: true })).toHaveCount(0);
    await save();
    expect(rows.get(firstId)).toMatchObject({ video_url: youtube, video_path: null });
    await input.fill("");
    await save();
    expect(rows.get(firstId)).toMatchObject({ video_url: null, video_path: null });
    await open("Plancha");
    expect(writes.every(e => !(e.video_path && e.video_url))).toBe(true);
  });
}

test("la biblioteca muestra videos de YouTube y galería y permite buscarlos", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("La prueba requiere un origen local.");
  await page.setViewportSize({ width: 360, height: 800 });
  await catalogFixture(page, baseURL, "dark", true);
  const library = page.getByRole("region", { name: "Biblioteca de videos" });
  await expect(library.getByRole("listitem")).toHaveCount(2);
  await expect(library.getByText("Plancha", { exact: true })).toHaveCount(0);
  await expect(library.getByRole("button", { name: /Guardar ejercicio|Editar/ })).toHaveCount(0);
  await expect(library.getByLabel(/Subir video/)).toHaveCount(0);
  const youtubeRow = library.getByRole("listitem").filter({ hasText: "Sentadilla" });
  await youtubeRow.getByRole("link", { name: "Consultar video" }).click();
  await expect(youtubeRow.getByRole("link", { name: "Abrir video explicativo" })).toBeVisible();

  await library.getByLabel("Buscar ejercicio").fill("remo");
  await library.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(library.getByRole("listitem")).toHaveCount(1);
  await expect(library.getByText("Remo", { exact: true })).toBeVisible();
  await library.getByRole("link", { name: "Consultar video" }).click();
  const video = library.getByRole("link", { name: "Abrir video explicativo" });
  await expect(video).toBeVisible();
  const received = await page.evaluate(async href => [...new Uint8Array(await (await fetch(href!)).arrayBuffer())], await video.getAttribute("href"));
  expect(Buffer.from(received)).toEqual(videoBytes);

  await library.getByLabel("Buscar ejercicio").fill("plancha");
  await library.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(library.getByText("No encontramos videos para esa búsqueda.")).toBeVisible();
});

for (const [width, theme] of [[360, "light"], [1440, "dark"]] as const) {
  test(`el nombre abre el editor y devuelve el foco en ${width}px / ${theme}`, async ({ page, baseURL }) => {
    if (!baseURL) throw new Error("La prueba requiere un origen local.");
    await page.setViewportSize({ width, height: 740 });
    await catalogFixture(page, baseURL, theme, false, 36);
    const row = page.getByRole("button", { name: "Ejercicio de prueba 36", exact: true });
    await expect(page.getByRole("button", { name: "Editar Ejercicio de prueba 36" })).toHaveCount(0);
    await expect(row).toHaveAttribute("aria-haspopup", "dialog");
    await row.focus();
    await page.keyboard.press("Enter");
    const editor = page.getByRole("dialog", { name: "Editar ejercicio" });
    const input = editor.getByLabel("Nombre del ejercicio");
    await expect(input).toBeFocused();
    await expect(input).toBeInViewport();
    await expect(input).toHaveValue("Ejercicio de prueba 36");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const audit = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(audit.violations).toEqual([]);
    await input.fill("Nombre modificado");
    page.once("dialog", async prompt => { await prompt.dismiss(); });
    await page.keyboard.press("Escape");
    await expect(editor).toBeVisible();
    await expect(input).toHaveValue("Nombre modificado");
    page.once("dialog", async prompt => { await prompt.accept(); });
    await editor.getByRole("button", { name: "Cerrar" }).click();
    await expect(editor).toBeHidden();
    await expect(row).toBeFocused();
    await row.click();
    await expect(input).toHaveValue("Ejercicio de prueba 36");
    await page.keyboard.press("Escape");
    await expect(row).toBeFocused();
  });
}

test("el catálogo reintenta una carga fallida y permite dar de alta un ejercicio", async ({ page, baseURL }) => {
  if (!baseURL) throw new Error("La prueba requiere un origen local.");
  const { writes } = await catalogFixture(page, baseURL, "light", false, 0, true);
  await expect(page.getByRole("alert")).toHaveText("No pudimos cargar el catálogo.");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sentadilla" })).toBeVisible();
  await page.getByLabel("Buscar ejercicio").fill("Sin coincidencias");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("No encontramos ejercicios para esa búsqueda.")).toBeVisible();
  const create = page.getByRole("button", { name: "Nuevo ejercicio" });
  await create.click();
  const editor = page.getByRole("dialog", { name: "Nuevo ejercicio" });
  await expect(editor.getByLabel("Nombre del ejercicio")).toBeFocused();
  await editor.getByLabel("Nombre del ejercicio").fill("Sin coincidencias");
  await editor.getByRole("button", { name: "Guardar ejercicio" }).click();
  await expect(page.getByRole("dialog", { name: "Editar ejercicio" }).getByRole("status")).toContainText("Ejercicio guardado.");
  expect(writes).toHaveLength(1);
  expect(writes[0]).toMatchObject({ name: "Sin coincidencias", revision: 1, video_url: null, video_path: null });
  await page.getByRole("button", { name: "Cerrar" }).click();
  await expect(create).toBeFocused();
  await expect(page.getByRole("button", { name: "Sin coincidencias", exact: true })).toBeVisible();
});

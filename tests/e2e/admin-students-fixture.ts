import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { BrowserContext } from "@playwright/test";
import type { Student } from "../../src/components/students/student-form";

const adminId = "11111111-1111-4111-8111-111111111111";
const invitedId = "22222222-2222-4222-8222-222222222222";
const sessionUser = { id: adminId, email: "admin@example.test", role: "authenticated", user_metadata: { full_name: "Admin de prueba" } };

function json(response: ServerResponse, body: unknown, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

type ExtraRoute = (request: IncomingMessage, url: URL) => Promise<{ body: unknown; status?: number } | undefined>;

export async function studentFixture(extraRoute?: ExtraRoute) {
  const rows = new Map<string, Student>();
  const invitations = new Map<string, string>();
  const protectedIds = new Set<string>();
  const events: string[] = [];
  let failLoad = false;
  let failSave = false;

  const service = createServer(async (request, response) => {
    const url = new URL(request.url!, "http://127.0.0.1");
    const path = url.pathname;
    const id = url.searchParams.get("id")?.slice(3) ?? "";
    const object = request.headers.accept?.includes("vnd.pgrst.object");
    try {
      const extra = await extraRoute?.(request, url);
      if (extra) return json(response, extra.body, extra.status);
      if (path === "/user") return json(response, { user: sessionUser });
      if (path === "/cueva_profiles") return json(response, [{ role: "admin" }]);
      if (path === "/cueva_students" && request.method === "GET") {
        if (failLoad) return json(response, { message: "Synthetic load failure" }, 400);
        const pattern = url.searchParams.get("or")?.match(/first_name\.ilike\."%([^"]*)%"/)?.[1]?.toLowerCase();
        const result = [...rows.values()].filter(row =>
          (!id || id === row.id) && (!pattern || [row.first_name, row.last_name, row.email, row.dni]
            .some(value => value?.toLowerCase().includes(pattern))));
        return json(response, object ? (result[0] ?? null) : result);
      }
      if (path === "/cueva_students" && (request.method === "POST" || request.method === "PATCH")) {
        if (failSave) return json(response, { message: "Synthetic save failure" }, 503);
        const student = await readJson(request) as Student;
        student.id = request.method === "POST" ? student.id : id;
        rows.set(student.id, student);
        events.push(request.method === "POST" ? "insert" : "update");
        return json(response, request.method === "POST" ? { id: student.id } : [{ id: student.id }]);
      }
      if (path === "/rpc/cueva_billing_snapshot") return json(response, { prices: [], periods: [] });
      if (["/cueva_due_schedules", "/cueva_due_date_audit", "/cueva_due_date_attempts", "/cueva_routine_templates"].includes(path)) {
        return json(response, []);
      }
      if (["/cueva_routine_drafts", "/cueva_routine_publications"].includes(path)) return json(response, []);
      if (path === "/cueva_student_invitations") {
        const state = invitations.get(url.searchParams.get("student_id")?.slice(3) ?? "");
        return json(response, state ? [{ state }] : []);
      }
      if (path === "/rpc/cueva_delete_empty_student") {
        const data = await readJson(request);
        if (protectedIds.has(data.p_student)) return json(response, "protected");
        if (!data.p_confirm) return json(response, "eligible");
        rows.delete(data.p_student);
        events.push("delete");
        return json(response, "deleted");
      }
      if (path === "/rpc/cueva_claim_student_invitation") {
        const { student } = await readJson(request);
        if (invitations.get(student) === "sent") return json(response, { claimed: false, state: "sent" });
        invitations.set(student, "processing");
        return json(response, { claimed: true, email: rows.get(student)?.email });
      }
      if (path === "/admin/users" || path === "/invite") {
        const { email } = await readJson(request);
        events.push(path === "/invite" ? "invite" : "create-access");
        return json(response, { user: { id: invitedId, email, role: "authenticated" } });
      }
      if (path === "/rpc/cueva_prepare_student_invitation") return json(response, true);
      if (path === "/rpc/cueva_finish_student_invitation") {
        const { student, outcome } = await readJson(request);
        invitations.set(student, outcome);
        return json(response, true);
      }
      return json(response, { message: `Unexpected synthetic request: ${path}` }, 404);
    } catch {
      return json(response, { message: "Synthetic fixture request failed" }, 500);
    }
  });
  await new Promise<void>((resolve, reject) => {
    service.once("error", reject).listen(0, "127.0.0.1", resolve);
  });
  const endpoint = `http://127.0.0.1:${(service.address() as { port: number }).port}`;
  return {
    rows, invitations, protectedIds, events, endpoint,
    setLoadError: (value: boolean) => { failLoad = value; },
    setSaveError: (value: boolean) => { failSave = value; },
    close: () => new Promise<void>((resolve, reject) => {
      service.close(error => error ? reject(error) : resolve());
      service.closeAllConnections();
    }),
  };
}

export async function signIn(context: BrowserContext, origin: string, user = sessionUser) {
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const access_token = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: user.id, exp: expires })}.synthetic`;
  const value = `base64-${encoded({ access_token, refresh_token: "synthetic", expires_at: expires, user })}`;
  await context.addCookies([{ name: "sb-127-auth-token", value, url: origin, httpOnly: true, sameSite: "Lax" }]);
}

export function startStudentsApp(origin: string, endpoint: string) {
  // Next's dev lock, generated types and caches belong to a project directory,
  // not a port. Snapshot the real sources so concurrent fixtures share no writes.
  const source = process.cwd();
  const parent = resolve(source, ".next", "fixture-apps");
  mkdirSync(parent, { recursive: true });
  const workspace = mkdtempSync(join(parent, "app-"));
  function removeWorkspace() {
    const owned = relative(parent, workspace);
    if (!owned.startsWith("app-") || owned.includes(sep) || resolve(parent, owned) !== workspace) {
      throw new Error("Refusing to remove a fixture directory outside its owned parent");
    }
    rmSync(workspace, { recursive: true, force: true });
  }
  try {
    for (const directory of ["src", "public"]) cpSync(join(source, directory), join(workspace, directory), { recursive: true });
    for (const file of ["package.json", "tsconfig.json", "next.config.ts"]) copyFileSync(join(source, file), join(workspace, file));
  } catch (error) { removeWorkspace(); throw error; }
  const entry = `
    const { createServer } = require("node:http");
    const next = require("next");
    const { hostname, port } = new URL(process.env.CUEVA_PRODUCT_ORIGIN);
    let handle;
    const server = createServer((request, response) => handle(request, response));
    (async () => {
      // The copied Next config is unchanged; cwd still resolves shared assets
      // and dependencies from the actual repository.
      const app = next({ dev: true, dir: process.env.CUEVA_FIXTURE_WORKSPACE,
        hostname, port: Number(port), httpServer: server });
      handle = app.getRequestHandler();
      server.on("error", error => { console.error(error); process.exit(1); });
      await app.prepare();
      server.listen(Number(port), hostname);
    })().catch(error => { console.error(error); process.exit(1); });
  `;
  const processHandle = spawn(process.execPath, ["-e", entry], {
    stdio: ["ignore", "inherit", "inherit"], windowsHide: true,
    env: {
      ...process.env,
      CUEVA_FIXTURE_WORKSPACE: workspace,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      CUEVA_PRODUCT_AUTH_LOCAL: "1",
      CUEVA_EMAIL_TEMPLATE_READY: "1",
      CUEVA_DEFAULT_MAIL_OWNER_TEST: "0",
      CUEVA_PRODUCT_ORIGIN: origin,
      CUEVA_SUPABASE_URL: endpoint,
      CUEVA_AUTH_URL: endpoint,
      CUEVA_REST_URL: endpoint,
      CUEVA_PUBLISHABLE_KEY: "synthetic-publishable",
      CUEVA_SERVICE_KEY: "synthetic-service",
    },
  });
  let closing: Promise<void> | undefined;
  return {
    processHandle,
    workspace,
    close() {
      closing ??= (async () => {
        if (processHandle.exitCode === null && processHandle.signalCode === null) {
          const stopped = once(processHandle, "exit");
          const force = setTimeout(() => processHandle.kill("SIGKILL"), 5_000);
          try { processHandle.kill(); await stopped; } finally { clearTimeout(force); }
        }
        removeWorkspace();
      })();
      return closing;
    },
  };
}

import type { IncomingMessage } from "node:http";
import type { Exercise, Note, Plan, Publication, Template } from "../../src/lib/routines/types";

const studentUser = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "bruno@example.test", role: "authenticated", user_metadata: { full_name: "Bruno Prueba" } };
const exerciseNames = ["Sentadilla", "Press militar", "Plancha", "Remo", "Peso muerto", "Flexiones"];
const exercises: Exercise[] = exerciseNames.map((name, index) => ({
  id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index).padStart(12, "0")}`, name,
  revision: 1, active: true, description: "", video_url: null, video_path: null,
}));
const starter: Template = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Base de empuje", content: "Descansá entre bloques.", revision: 1,
};

function isStudent(request: IncomingMessage) {
  const payload = request.headers.authorization?.split(".")[1];
  return !!payload && JSON.parse(Buffer.from(payload, "base64url").toString()).sub === studentUser.id;
}

export function routineEditorFixture() {
  let draft: Note = { content: "", revision: 0 };
  let publication: Publication | null = null;
  const operations: string[] = [];
  return {
    studentUser, operations,
    reset() {
      draft = { content: "", revision: 0 };
      publication = null;
      operations.length = 0;
    },
    async handle(request: IncomingMessage, url: URL): Promise<{ body: unknown; status?: number } | undefined> {
      const asRow = (row: unknown) => request.headers.accept?.includes("vnd.pgrst.object") ? row : row ? [row] : [];
      switch (url.pathname) {
        case "/user": return isStudent(request) ? { body: { user: studentUser } } : undefined;
        case "/cueva_profiles": return isStudent(request) ? { body: asRow({ role: "alumno" }) } : undefined;
        case "/cueva_routine_templates": return { body: [starter] };
        case "/cueva_routine_drafts": return { body: asRow(draft.revision ? draft : null) };
        case "/cueva_routine_publications": return { body: asRow(publication) };
        case "/cueva_exercises": {
          const query = url.searchParams.get("name")?.slice(7, -1).toLowerCase() ?? "";
          return { body: exercises.filter(exercise => exercise.name.toLowerCase().includes(query)) };
        }
        case "/rpc/cueva_routine_write": {
          const buffers: Buffer[] = [];
          for await (const chunk of request) buffers.push(Buffer.from(chunk));
          const { p_kind, p_revision, p_content, p_plan } = JSON.parse(Buffer.concat(buffers).toString()) as {
            p_kind: "draft" | "publish"; p_revision: number; p_content: string; p_plan: Plan | null;
          };
          if (p_revision !== draft.revision) return { body: { code: "40001", message: "Synthetic revision mismatch" }, status: 409 };
          if (p_kind === "draft") {
            draft = { content: p_content, plan: p_plan, revision: draft.revision + 1 };
            operations.push("draft");
            return { body: draft };
          }
          publication = {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", content: draft.content, plan: draft.plan ?? null,
            draft_revision: draft.revision, published_at: "2026-11-15T12:00:00Z",
          };
          operations.push("publish");
          return { body: publication };
        }
      }
    },
  };
}

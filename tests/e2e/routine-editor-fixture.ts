import type { IncomingMessage } from "node:http";
import type { Exercise, Note, Plan, Publication, Template } from "../../src/lib/routines/types";

const studentUser = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", email: "bruno@example.test", role: "authenticated", user_metadata: { full_name: "Bruno Prueba" } };
const exerciseNames = ["Sentadilla", "Press militar", "Plancha", "Remo", "Peso muerto", "Flexiones"];
const exercises: Exercise[] = exerciseNames.map((name, index) => ({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-" + String(index).padStart(12, "0"), name,
  revision: 1, active: true, description: "", video_url: null, video_path: null,
}));
const starter: Template = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Base de empuje", content: "Descansá entre bloques.", revision: 1,
};

type TextDocument = {
  format: "blocks" | "text";
  text_content: string;
  block_content: string;
  mentions: Array<{ exercise_id: string; start: number; end: number; text: string }>;
  revision: number;
  save_id?: string;
  publication_id?: string;
  student_id?: string;
};

function isStudent(request: IncomingMessage) {
  const payload = request.headers.authorization?.split(".")[1];
  return !!payload && JSON.parse(Buffer.from(payload, "base64url").toString()).sub === studentUser.id;
}

export function routineEditorFixture() {
  let draft: Note = { content: "", revision: 0 };
  let draftText: TextDocument | null = null;
  let publication: Publication | null = null;
  let publicationText: TextDocument | null = null;
  const operations: string[] = [];
  return {
    studentUser, operations,
    reset() {
      draft = { content: "", revision: 0 };
      draftText = null;
      publication = null;
      publicationText = null;
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
        case "/cueva_routine_text_drafts": {
          const kind = url.searchParams.get("kind")?.replace("eq.", "") ?? "draft";
          return { body: asRow(kind === "draft" ? draftText : null) };
        }
        case "/cueva_routine_text_publications": return { body: asRow(publicationText) };
        case "/rpc/cueva_my_routine_video_ids": return { body: [] };
        case "/rpc/cueva_student_mentioned_exercises": return { body: [] };
        case "/cueva_exercises": {
          const query = url.searchParams.get("name")?.slice(7, -1).toLowerCase() ?? "";
          return { body: exercises.filter(exercise => exercise.name.toLowerCase().includes(query)) };
        }
        case "/rpc/cueva_routine_text_write": {
          const buffers: Buffer[] = [];
          for await (const chunk of request) buffers.push(Buffer.from(chunk));
          const payload = JSON.parse(Buffer.concat(buffers).toString()) as {
            p_kind: "draft" | "publish"; p_revision: number; p_content: string; p_plan: Plan | null;
            p_format: "blocks" | "text"; p_text_content: string;
            p_mentions: TextDocument["mentions"]; p_operation: string;
          };
          if (payload.p_revision !== draft.revision) return { body: { code: "40001", message: "Synthetic revision mismatch" }, status: 409 };
          const baseContent = payload.p_format === "text" ? payload.p_text_content : payload.p_content;
          if (payload.p_kind === "draft") {
            draft = { content: baseContent, plan: payload.p_plan, revision: draft.revision + 1 };
            draftText = {
              format: payload.p_format, text_content: payload.p_text_content,
              block_content: payload.p_content, mentions: payload.p_mentions,
              revision: draft.revision, save_id: payload.p_operation,
            };
            operations.push("draft");
            return { body: { ...draft, ...draftText } };
          }
          publication = {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", content: baseContent, plan: draft.plan ?? null,
            draft_revision: draft.revision, published_at: "2026-11-15T12:00:00Z",
          };
          publicationText = {
            format: payload.p_format, text_content: payload.p_text_content,
            block_content: payload.p_content, mentions: payload.p_mentions,
            revision: draft.revision, save_id: payload.p_operation,
            publication_id: publication.id, student_id: "44444444-4444-4444-8444-444444444444",
          };
          operations.push("publish");
          return { body: { ...publication, ...publicationText } };
        }
      }
    },
  };
}

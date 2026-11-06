export type Note = { content: string; revision: number; title?: string };
export type Template = Note & { id: string; title: string };
export type Publication = { id: string; content: string; draft_revision: number; published_at: string };
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

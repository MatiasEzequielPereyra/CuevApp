export async function readRoutineJson(req: Request, limit = 350000) {
  if (!req.headers.get("content-type")?.startsWith("application/json")) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try { return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
  catch { return null; }
}

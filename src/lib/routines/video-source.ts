export type VideoSource =
  | { kind: "storage"; src: string }
  | { kind: "youtube"; id: string; url: string };

export function parseVideoSource(value: unknown): VideoSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;

  if (source.kind === "storage" && typeof source.src === "string") {
    try {
      const url = new URL(source.src);
      if ((url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1")) && url.hostname && !url.username && !url.password) {
        return { kind: "storage", src: url.toString() };
      }
    } catch {
      return null;
    }
    return null;
  }

  if (source.kind !== "youtube" || typeof source.id !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(source.id) || typeof source.url !== "string") {
    return null;
  }

  try {
    const url = new URL(source.url);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    const valid =
      ((url.hostname === "youtube.com" || url.hostname === "www.youtube.com") && url.pathname === "/watch" && url.searchParams.get("v") === source.id && url.searchParams.getAll("v").length === 1 && [...url.searchParams.keys()].every(key => key === "v")) ||
      ((url.hostname === "youtube.com" || url.hostname === "www.youtube.com") && (url.pathname === `/shorts/${source.id}` || url.pathname === `/embed/${source.id}`) && !url.search) ||
      (url.hostname === "youtu.be" && url.pathname === `/${source.id}` && !url.search);
    return valid ? { kind: "youtube", id: source.id, url: url.toString() } : null;
  } catch {
    return null;
  }
}

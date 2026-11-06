// The DB uses the same strict allowlist; no arbitrary redirects or embedded HTML.
export function youtubeUrl(value: string): string | null {
  if (!/^https:\/\/(?:(?:www\.)?youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[A-Za-z0-9_-]{11}$/.test(value)) return null;
  return value;
}

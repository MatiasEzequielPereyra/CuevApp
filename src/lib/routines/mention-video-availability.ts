export type MentionVideoAvailability = "available" | "unavailable" | "unknown";

export function resolveMentionVideoAvailability(
  exerciseId: string,
  videoIds: readonly string[] | null | undefined,
  lookupFailed: boolean,
): MentionVideoAvailability {
  if (lookupFailed || !Array.isArray(videoIds)) return "unknown";
  return videoIds.includes(exerciseId) ? "available" : "unavailable";
}

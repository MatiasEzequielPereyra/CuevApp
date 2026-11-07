export type Exercise = { id: string; name: string; revision: number; active: boolean; description: string; video_url: string | null; video_path: string | null };
export type LegacyTarget = { id: string; exercise_id: string; name: string; sets: number; reps: string; weight_kg: number | null; note: string };
export type LegacyBlock = { id: string; name: string; exercises: LegacyTarget[] };
export type Target = { id: string; exercise_id: string; name: string; note: string } & (
  { mode: "weight"; reps: string; weight_kg: number | null } |
  { mode: "time"; duration: number; unit: "seconds" | "minutes" }
);
export type Block = { id: string; name: string; rounds: number; exercises: Target[] };
export type Day = { id: string; name: string; blocks: Block[] };
export type PlanV2 = { version: 2; days: Day[] };
export type Plan = { version: 1; blocks: LegacyBlock[] } | PlanV2;
export type Note = { content: string; revision: number; title?: string; plan?: Plan | null };
export type Template = Note & { id: string; title: string };
export type Publication = { id: string; content: string; plan?: Plan | null; draft_revision: number; published_at: string };
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : value;
export const planKey = (plan?: Plan | null) => JSON.stringify(canonical(plan ?? null));
export const hasExercises = (plan?: Plan | null) => !!(plan?.version === 2 ? plan.days.flatMap(d => d.blocks) : plan?.blocks)?.some(b => b.exercises.length > 0);
export function copyPlan(plan: Plan): Plan {
  const blocks = <T extends LegacyBlock | Block>(items: T[]): T[] => items.map(b => ({ ...b, id: crypto.randomUUID(), exercises: b.exercises.map(e => ({ ...e, id: crypto.randomUUID() })) }));
  return plan.version === 1 ? { version: 1, blocks: blocks(plan.blocks) } : { version: 2, days: plan.days.map(d => ({ ...d, id: crypto.randomUUID(), blocks: blocks(d.blocks) })) };
}
// Contiguous groups preserve order and every legacy sets value. Conversion is explicit.
export function adaptLegacy(plan: Extract<Plan, { version: 1 }>): PlanV2 {
  return { version: 2, days: [{ id: crypto.randomUUID(), name: "Día 1", blocks: plan.blocks.flatMap(b => {
    const groups: Block[] = [];
    for (const { sets, ...e } of b.exercises) {
      if (groups.at(-1)?.rounds !== sets) groups.push({ id: crypto.randomUUID(), name: b.name, rounds: sets, exercises: [] });
      groups.at(-1)!.exercises.push({ ...e, mode: "weight" });
    }
    return groups.length ? groups : [{ id: crypto.randomUUID(), name: b.name, rounds: 1, exercises: [] }];
  }) }] };
}

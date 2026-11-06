import type { Plan } from "@/lib/routines/types";
export function PlanView({ plan }: { plan?: Plan | null | undefined }) {
  return <div className="routine-plan-view">{plan?.blocks.map(block => <section key={block.id}><h3>{block.name}</h3>{block.exercises.length ? <ol>{block.exercises.map(item => <li key={item.id}><strong>{item.name}</strong><p>{item.sets} series · {item.reps} repeticiones · {item.weight_kg === null ? "Peso sin definir" : `${item.weight_kg} kg objetivo`}</p>{item.note && <p>{item.note}</p>}</li>)}</ol> : <p>Bloque sin ejercicios.</p>}</section>)}</div>;
}

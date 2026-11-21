"use client";

import { useId, useState } from "react";

type WorkoutSet = { reps: string; weight: string };
type HistorySet = { set_number: number; reps: number; weight_kg: number };
type HistoryEntry = {
  id: string;
  performed_at: string;
  mode: "quick" | "sets";
  weight_kg: number | null;
  sets: HistorySet[];
};
type WorkoutHistory = { last_weight_kg: number | null; entries: HistoryEntry[] };

function parseWeight(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const weight = Number(normalized);
  return Number.isFinite(weight) && weight >= 0 && weight <= 2000 ? weight : null;
}

export function StudentWorkoutLogger({ publicationId, exerciseId, exerciseName, targetId }: {
  publicationId: string;
  exerciseId: string;
  exerciseName: string;
  targetId?: string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"quick" | "sets">("quick");
  const [weight, setWeight] = useState("");
  const [sets, setSets] = useState<WorkoutSet[]>([{ reps: "", weight: "" }]);
  const [history, setHistory] = useState<WorkoutHistory | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const response = await fetch("/api/entrenamientos?exercise_id=" + encodeURIComponent(exerciseId), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No pudimos cargar el historial.");
      const next = data.history as WorkoutHistory;
      setHistory(next);
      if (next.last_weight_kg !== null && next.last_weight_kg !== undefined) {
        setWeight(String(next.last_weight_kg));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos cargar el historial.");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);
    setMessage("");
    setError("");
    if (next && !history) await loadHistory();
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    setError("");
    let payloadSets: { reps: number; weight_kg: number }[] = [];
    let quickWeight: number | null = null;
    if (mode === "quick") {
      quickWeight = parseWeight(weight);
      if (quickWeight === null) {
        setError("Ingresá un peso entre 0 y 2000 kg, con hasta dos decimales.");
        setSaving(false);
        return;
      }
    } else {
      payloadSets = sets.map(item => ({
        reps: Number(item.reps),
        weight_kg: parseWeight(item.weight) ?? Number.NaN,
      }));
      if (!payloadSets.length || payloadSets.some(item => !Number.isInteger(item.reps) || item.reps < 1 || item.reps > 1000 || !Number.isFinite(item.weight_kg))) {
        setError("Completá las repeticiones y el peso de cada serie.");
        setSaving(false);
        return;
      }
    }
    try {
      const response = await fetch("/api/entrenamientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          id: crypto.randomUUID(),
          publication_id: publicationId,
          exercise_id: exerciseId,
          target_id: targetId ?? null,
          mode,
          weight_kg: quickWeight,
          sets: payloadSets,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No pudimos guardar el registro.");
      setMessage("Entrenamiento guardado.");
      await loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No pudimos guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-workout" aria-label={"Registro de " + exerciseName}>
      <button type="button" className="student-workout-toggle" aria-expanded={expanded} onClick={() => void toggleExpanded()}>
        {expanded ? "Cerrar registro" : "Registrar peso"}
      </button>
      {expanded && (
        <div className="student-workout-panel">
          <header>
            <strong>{exerciseName}</strong>
            <button type="button" onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen}>
              {historyOpen ? "Ocultar historial" : "Ver historial"}
            </button>
          </header>
          {loadingHistory && <p role="status">Consultando tu último registro…</p>}
          {history?.last_weight_kg !== null && history?.last_weight_kg !== undefined && (
            <p className="student-workout-last">
              Último peso: <strong>{history.last_weight_kg} kg</strong>
              <button type="button" onClick={() => { setMode("quick"); setWeight(String(history.last_weight_kg)); }}>Usar</button>
            </p>
          )}
          <div className="student-workout-modes" role="group" aria-label="Tipo de registro">
            <button type="button" aria-pressed={mode === "quick"} onClick={() => setMode("quick")}>Rápido</button>
            <button type="button" aria-pressed={mode === "sets"} onClick={() => setMode("sets")}>Por series</button>
          </div>
          {mode === "quick" ? (
            <label htmlFor={id + "-weight"}>Peso utilizado (kg)
              <input id={id + "-weight"} inputMode="decimal" value={weight} maxLength={10}
                onChange={event => setWeight(event.target.value)} placeholder="Ej. 40" />
            </label>
          ) : (
            <div className="student-workout-sets">
              {sets.map((item, index) => (
                <div className="student-workout-set" key={index}>
                  <strong>Serie {index + 1}</strong>
                  <label>Repeticiones
                    <input inputMode="numeric" value={item.reps} maxLength={4}
                      onChange={event => setSets(current => current.map((row, i) => i === index ? { ...row, reps: event.target.value } : row))} />
                  </label>
                  <label>Peso (kg)
                    <input inputMode="decimal" value={item.weight} maxLength={10}
                      onChange={event => setSets(current => current.map((row, i) => i === index ? { ...row, weight: event.target.value } : row))} />
                  </label>
                  {sets.length > 1 && <button type="button" onClick={() => setSets(current => current.filter((_, i) => i !== index))}>Quitar</button>}
                </div>
              ))}
              <button type="button" disabled={sets.length >= 30} onClick={() => setSets(current => [...current, { reps: "", weight: "" }])}>Agregar serie</button>
            </div>
          )}
          <button type="button" className="student-workout-save" disabled={saving || loadingHistory} onClick={() => void save()}>
            {saving ? "Guardando…" : "Guardar entrenamiento"}
          </button>
          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
          {historyOpen && (
            <div className="student-workout-history">
              <h4>Historial de este ejercicio</h4>
              {!history?.entries.length ? <p>Todavía no hay registros.</p> : (
                <ol>
                  {history.entries.map(entry => (
                    <li key={entry.id}>
                      <time dateTime={entry.performed_at}>{new Date(entry.performed_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</time>
                      {entry.mode === "quick" ? <strong>{entry.weight_kg} kg</strong> : (
                        <ul>{entry.sets.map(set => <li key={set.set_number}>{set.reps} rep. · {set.weight_kg} kg</li>)}</ul>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

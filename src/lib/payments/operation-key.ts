export type PendingOperation = { op: string; payload: string };

export function operationForSubmission(
  current: PendingOperation | null,
  payload: string,
  previousAttemptRejected: boolean,
  createId: () => string,
): PendingOperation {
  if (current && current.payload !== payload && !previousAttemptRejected) {
    throw new Error("Los datos cambiaron mientras el resultado anterior sigue siendo incierto. Reintentá sin modificar el formulario.");
  }
  if (current && current.payload === payload) return current;
  return { op: createId(), payload };
}

export function isDefinitiveDatabaseError(code: unknown): boolean {
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
}

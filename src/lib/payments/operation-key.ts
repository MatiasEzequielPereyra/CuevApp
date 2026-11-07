export type PendingOperation = { op: string; payload: string };

const DEFINITIVE_SQLSTATE_CLASSES = new Set([
  "22", // data exception
  "23", // integrity constraint violation
  "25", // invalid transaction state
  "28", // invalid authorization specification
  "40", // transaction rollback
  "42", // syntax or access rule violation
]);

export function operationForSubmission(
  current: PendingOperation | null,
  payload: string,
  previousAttemptRejected: boolean,
  createId: () => string,
): PendingOperation {
  if (current && !previousAttemptRejected) {
    if (current.payload !== payload) {
      throw new Error("Los datos cambiaron mientras el resultado anterior sigue siendo incierto. Reintentá sin modificar el formulario.");
    }
    return current;
  }
  return { op: createId(), payload };
}

export function isDefinitiveDatabaseError(code: unknown): boolean {
  if (typeof code !== "string" || !/^[0-9A-Z]{5}$/.test(code)) return false;
  return code === "P0001" || DEFINITIVE_SQLSTATE_CLASSES.has(code.slice(0, 2));
}

export function readPendingOperation(storageKey: string): PendingOperation | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<PendingOperation>;
    if (typeof candidate.op !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.op)) return null;
    if (typeof candidate.payload !== "string") return null;
    JSON.parse(candidate.payload);
    return { op: candidate.op, payload: candidate.payload };
  } catch {
    return null;
  }
}

export function persistPendingOperation(storageKey: string, operation: PendingOperation): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(operation));
}

export function clearPendingOperation(storageKey: string): void {
  window.sessionStorage.removeItem(storageKey);
}

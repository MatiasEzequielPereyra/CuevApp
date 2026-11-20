/**
 * UI readiness only. The authenticated backend remains the authority for both
 * identity and password mutations.
 */
export function canSubmitEmailChange(nextEmail: string, currentEmail: string, nativeValid: boolean): boolean {
  const next = nextEmail.trim().toLowerCase();
  const current = currentEmail.trim().toLowerCase();
  return nativeValid && next.length > 0 && next !== current;
}

export function canSubmitPasswordChange(
  current: string,
  next: string,
  confirmation: string,
  nativeValid: boolean,
): boolean {
  return nativeValid && current.length > 0 && next.length >= 8
    && next === confirmation && next !== current;
}

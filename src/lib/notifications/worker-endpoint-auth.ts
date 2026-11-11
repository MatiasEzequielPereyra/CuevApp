import { timingSafeEqual } from "node:crypto";

/**
 * The worker endpoint uses a dedicated high-entropy secret, separate from
 * receipt cleanup. Never include the supplied or expected value in errors.
 */
export function isAuthorizedNotificationWorkerRequest(
  request: Pick<Request, "headers">,
  secret: string | undefined,
): boolean {
  if (!secret || secret.length < 32 || secret.trim() !== secret) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return suppliedBytes.length === expectedBytes.length
    && timingSafeEqual(suppliedBytes, expectedBytes);
}

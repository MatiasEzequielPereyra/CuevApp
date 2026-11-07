import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { productConfig, serviceClient, userClient } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";
import { maxReceiptBytes, receiptBucket, receiptExtensions, receiptType } from "@/lib/receipts/contracts";
import { validReceiptBytes } from "@/lib/receipts/file";
import { receiptError, receiptServiceStorage, receiptStorage, removeExpiredReceiptUpload } from "@/lib/receipts/server";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const json = (data: object, status = 200) => NextResponse.json(data, { status, headers });
const failure = (message: string, status: number) => json({ message }, status);
const denied = () => failure("Comprobante no disponible para esta cuenta.", 403);

export async function POST(req: Request) {
  const cfg = productConfig();
  if (!cfg || req.headers.get("origin") !== cfg.origin) return denied();
  const client = await userClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return denied();

  const p = await readRoutineJson(req, 4096);
  if (!p || !["prepare", "submit"].includes(p.action) || typeof p.period !== "string" || !uuid.test(p.period)
    || (p.action === "submit" && (typeof p.uploadId !== "string" || !uuid.test(p.uploadId)))
    || typeof p.id !== "string" || !uuid.test(p.id) || typeof p.hash !== "string" || !/^[a-f0-9]{64}$/.test(p.hash)) {
    return failure("Datos de carga inv?lidos.", 400);
  }
  const type = typeof p.extension === "string" ? receiptType(`archivo.${p.extension}`) : null;
  if (!type || p.type !== type) return failure("Eleg? un archivo JPG, PNG o PDF.", 415);
  if (!Number.isSafeInteger(p.size) || p.size < 1 || p.size > maxReceiptBytes) {
    return failure("El archivo debe pesar hasta 10 MB y no estar vac?o.", 413);
  }
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const session = claims?.claims.session_id;
  if (claimsError || claims?.claims.sub !== user.id || typeof session !== "string" || !uuid.test(session)) return denied();
  const parameters = {
    p_period: p.period.toLowerCase(), p_id: p.id.toLowerCase(), p_type: type, p_size: p.size, p_hash: p.hash,
    p_actor: user.id, p_session: session, p_upload: p.action === "submit" ? p.uploadId : null,
  };

  try {
    const db = serviceClient();
    const reserve = () => db.rpc("cueva_receipt_reserve", parameters);
    let reserved = await reserve();
    if (reserved.data?.status === "expired" && p.action === "prepare") {
      if (!await removeExpiredReceiptUpload(db, receiptServiceStorage(), reserved.data)) {
        return failure("No pudimos liberar la carga anterior. Reintent�.", 503);
      }
      reserved = await reserve();
    }
    if (reserved.error) {
      const mapped = receiptError(reserved.error);
      return failure(mapped.message, mapped.status);
    }
    const lease = reserved.data;
    if (lease?.status === "submitted") return json({ submitted: true });
    if (lease?.status === "invalid") return failure("El archivo fue rechazado. La reserva se libera al vencer el permiso de carga.", 422);
    if (lease?.status === "expired") return failure("La carga venci�. Volv� a presentar el comprobante.", 409);
    if (lease?.status !== "reserved") return failure("No pudimos reservar la carga.", 503);
    const storage = receiptServiceStorage();
    if (p.action === "prepare") {
      const existing = await storage.exists(lease.path);
      if (existing.error) return failure("No pudimos verificar la carga. Reintent�.", 503);
      if (existing.data) return json({ uploaded: true, uploadId: lease.id });
      const signed = await storage.createSignedUploadUrl(lease.path, { upsert: false });
      if (signed.error || !signed.data) return failure("No pudimos preparar la carga. Reintent�.", 503);
      return json({ uploadUrl: signed.data.signedUrl, uploadId: lease.id });
    }

    const { data: file, error: downloadError } = await storage.download(lease.path);
    if (downloadError || !file) return failure("No pudimos confirmar la carga del archivo. Reintent�.", 503);
    let valid = false;
    if (file.size === p.size && file.type.split(";")[0] === type) {
      const bytes = Buffer.from(await file.arrayBuffer());
      valid = createHash("sha256").update(bytes).digest("hex") === p.hash && await validReceiptBytes(bytes, type);
    }
    if (!valid) {
      const retired = await db.rpc("cueva_receipt_retire_upload", { p_upload: lease.id, p_invalid: true });
      if (retired.error) return failure("No pudimos registrar el archivo inv�lido. Reintent�.", 503);
      return failure("El archivo es inv�lido. Pod�s elegir otro cuando venza la reserva de carga.", 422);
    }

    const submitted = await db.rpc("cueva_receipt_submit", parameters);
    if (submitted.error) {
      const mapped = receiptError(submitted.error);
      return failure(mapped.message, mapped.status);
    }
    if (submitted.data !== parameters.p_id) return failure("No pudimos confirmar la presentaci?n. Reintent?.", 503);
    return json({ submitted: true });
  } catch {
    return failure("No pudimos confirmar la operaci?n. Pod?s reintentar.", 503);
  }
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!productConfig() || !id || !uuid.test(id)) return denied();
  const client = await userClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return denied();

  try {
    const row = await client.from("cueva_payment_receipts").select("object_path,media_type").eq("id", id).maybeSingle();
    if (row.error || !row.data) return denied();
    const type = row.data.media_type as keyof typeof receiptExtensions;
    const fileName = `comprobante.${receiptExtensions[type]}`;
    const signed = await (await receiptStorage(client)).from(receiptBucket)
      .createSignedUrl(row.data.object_path, 60, { download: fileName });
    if (signed.error || !signed.data) return failure("Archivo temporalmente no disponible.", 503);
    return NextResponse.redirect(signed.data.signedUrl, { status: 307, headers });
  } catch {
    return failure("Archivo temporalmente no disponible.", 503);
  }
}



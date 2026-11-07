import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { productConfig, serviceClient, userClient } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";
import { maxReceiptBytes, receiptBucket, receiptExtensions, receiptType } from "@/lib/receipts/contracts";
import { validReceiptBytes } from "@/lib/receipts/file";
import { receiptError, receiptStorage } from "@/lib/receipts/server";

export const runtime = "nodejs";
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
    || typeof p.id !== "string" || !uuid.test(p.id) || typeof p.hash !== "string" || !/^[a-f0-9]{64}$/.test(p.hash)) {
    return failure("Datos de carga inválidos.", 400);
  }
  const type = typeof p.extension === "string" ? receiptType(`archivo.${p.extension}`) : null;
  if (!type || p.type !== type) return failure("Elegí un archivo JPG, PNG o PDF.", 415);
  if (!Number.isSafeInteger(p.size) || p.size < 1 || p.size > maxReceiptBytes) {
    return failure("El archivo debe pesar hasta 10 MB y no estar vacío.", 413);
  }
  const parameters = { p_period: p.period.toLowerCase(), p_id: p.id.toLowerCase(), p_type: type, p_size: p.size, p_hash: p.hash };

  try {
    const eligible = await client.rpc("cueva_receipt_prepare", parameters);
    if (eligible.error) {
      const mapped = receiptError(eligible.error);
      return failure(mapped.message, mapped.status);
    }
    if (eligible.data === "submitted") return json({ submitted: true });
    if (eligible.data !== "eligible") return failure("No pudimos verificar el período.", 503);

    // The server derives the path. No client-controlled bucket, path or actor.
    const path = `${user.id}/${parameters.p_period}/${parameters.p_id}.${receiptExtensions[type]}`;
    const storage = (await receiptStorage(client, true)).from(receiptBucket);
    if (p.action === "prepare") {
      const existing = await storage.exists(path);
      if (existing.data) return json({ uploaded: true });
      const signed = await storage.createSignedUploadUrl(path, { upsert: false });
      if (signed.error || !signed.data) return failure("No pudimos preparar la carga. Reintentá.", 503);
      return json({ uploadUrl: signed.data.signedUrl });
    }

    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const session = claims?.claims.session_id;
    if (claimsError || claims?.claims.sub !== user.id || typeof session !== "string" || !uuid.test(session)) return denied();

    const { data: file, error: downloadError } = await storage.download(path);
    if (downloadError || !file) return failure("No pudimos confirmar la carga del archivo. Reintentá.", 503);
    if (file.size !== p.size || file.type.split(";")[0] !== type) return failure("El archivo recibido no coincide con el seleccionado.", 422);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== p.hash || !(await validReceiptBytes(bytes, type))) {
      return failure("El archivo está corrupto o su formato no coincide. Seleccioná otro.", 422);
    }

    const submitted = await serviceClient().rpc("cueva_receipt_submit", {
      ...parameters, p_actor: user.id, p_session: session,
    });
    if (submitted.error) {
      const mapped = receiptError(submitted.error);
      return failure(mapped.message, mapped.status);
    }
    if (submitted.data !== parameters.p_id) return failure("No pudimos confirmar la presentación. Reintentá.", 503);
    return json({ submitted: true });
  } catch {
    return failure("No pudimos confirmar la operación. Podés reintentar.", 503);
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

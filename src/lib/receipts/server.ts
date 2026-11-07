import "server-only";
import { createClient } from "@supabase/supabase-js";
import { productConfig, serviceClient, userClient } from "@/lib/product-auth/server";
import { receiptBucket } from "@/lib/receipts/contracts";

function localStorage(key: string, token: string) {
  const origin = process.env.CUEVA_LAB_STORAGE_ORIGIN;
  const url = new URL(origin ?? "");
  if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port) {
    throw new Error("Storage local no disponible");
  }
  return createClient(origin, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
}

export async function receiptStorage(client: Awaited<ReturnType<typeof userClient>>) {
  const cfg = productConfig();
  if (!cfg?.local) return client.storage;
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Sesión requerida");
  return localStorage(cfg.key, session.access_token);
}

export function receiptServiceStorage() {
  const cfg = productConfig();
  return (cfg?.local ? localStorage(cfg.serviceKey, cfg.serviceKey) : serviceClient().storage).from(receiptBucket);
}

export async function removeExpiredReceiptUpload(
  db: ReturnType<typeof serviceClient>, storage: ReturnType<typeof receiptServiceStorage>, lease: { id: string; path: string },
) {
  const removed = await storage.remove([lease.path]);
  if (removed.error) return false;
  const retired = await db.rpc("cueva_receipt_retire_upload", { p_upload: lease.id, p_invalid: false });
  return !retired.error;
}

export function receiptError(error: { code: string }) {
  if (error.code === "42501") return { status: 403, message: "Comprobante o per�odo no disponible para esta cuenta." };
  if (error.code === "55P03") return { status: 409, message: "Ya hay una carga reservada para este período. Reintentá con el mismo archivo." };
  if (error.code === "23505") return { status: 409, message: "Ya hay un comprobante pendiente o la operaci�n ya fue utilizada." };
  if (error.code === "40001") return { status: 409, message: "El comprobante ya fue revisado. Actualiz� la bandeja." };
  if (error.code === "P0001") return { status: 409, message: "La cuota est� saldada o el importe supera el saldo disponible." };
  if (error.code.startsWith("22") || error.code === "23514") return { status: 400, message: "Revis� los datos del comprobante." };
  return { status: 503, message: "No pudimos confirmar la operaci�n. Pod�s reintentar." };
}


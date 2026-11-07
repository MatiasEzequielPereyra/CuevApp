import "server-only";
import { createClient } from "@supabase/supabase-js";
import { productConfig, serviceClient, userClient } from "@/lib/product-auth/server";

export async function receiptStorage(client: Awaited<ReturnType<typeof userClient>>, privileged = false) {
  const cfg = productConfig();
  if (!cfg?.local) return privileged ? serviceClient().storage : client.storage;
  // Reuse the explicit loopback Storage gateway of the disposable lab.
  const origin = process.env.CUEVA_LAB_STORAGE_ORIGIN;
  const url = new URL(origin ?? "");
  if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port) {
    throw new Error("Storage local no disponible");
  }
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Sesión requerida");
  const key = privileged ? cfg.serviceKey : cfg.key;
  return createClient(origin, key, {
    global: { headers: { Authorization: `Bearer ${privileged ? key : session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
}

export function receiptError(error: { code: string }) {
  if (error.code === "42501") return { status: 403, message: "Comprobante o período no disponible para esta cuenta." };
  if (error.code === "23505") return { status: 409, message: "Ya hay un comprobante pendiente o la operación ya fue utilizada." };
  if (error.code === "40001") return { status: 409, message: "El comprobante ya fue revisado. Actualizá la bandeja." };
  if (error.code === "P0001") return { status: 409, message: "La cuota está saldada o el importe supera el saldo disponible." };
  if (error.code.startsWith("22") || error.code === "23514") return { status: 400, message: "Revisá los datos del comprobante." };
  return { status: 503, message: "No pudimos confirmar la operación. Podés reintentar." };
}

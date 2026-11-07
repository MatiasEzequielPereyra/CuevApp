import "server-only";
import { createClient } from "@supabase/supabase-js";
import { productConfig, userClient } from "@/lib/product-auth/server";
// Production uses the authenticated existing client. Only the disposable lab may
// route Storage through its explicit loopback gateway; no service key is used.
export async function exerciseStorage(client: Awaited<ReturnType<typeof userClient>>) {
  const cfg = productConfig();
  if (!cfg?.local) return client.storage;
  const origin = process.env.CUEVA_LAB_STORAGE_ORIGIN;
  if (!origin) throw new Error("Storage local no configurado");
  const url = new URL(origin);
  if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !url.port) throw new Error("Storage local inválido");
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Sesión requerida");
  return createClient(origin, cfg.key, { global: { headers: { Authorization: `Bearer ${session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } }).storage;
}

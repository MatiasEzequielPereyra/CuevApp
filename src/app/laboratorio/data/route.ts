import { client, config } from "@/lib/lab-auth/server";

export const dynamic = "force-dynamic";
const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const reply = (status: number, html: string) => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><main>${html}</main></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "strict-origin" } });
export async function GET() {
  if (!config()) return reply(404, "No disponible");
  const auth = await client();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return reply(401, "Ingresá para continuar");
  const result = await auth.from("lab_records").select("id,content");
  if (result.error) return reply(503, "Datos no disponibles");
  const rows = result.data.map(({ id, content }) => `<li data-record-id="${escape(String(id))}">${escape(String(content))}</li>`).join("");
  return reply(200, `<h1>Datos de prueba</h1><p>Registros visibles: ${result.data.length}</p><ul>${rows}</ul><form method="post" action="/laboratorio/action/logout"><button>Salir</button></form>`);
}

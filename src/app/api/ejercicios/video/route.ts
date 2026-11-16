import { exerciseStorage } from "@/lib/routines/storage-server";
import { NextResponse } from "next/server";
import { userClient, productConfig } from "@/lib/product-auth/server";
import { uuid } from "@/lib/routines/types";
import { youtubeUrl } from "@/lib/routines/video";
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const id = params.get("id") ?? "";
  const player = params.get("player") === "1";
  const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  if (!uuid.test(id)) return reply("Identificador inválido.", 400);
  if (!productConfig()) return reply("Acceso no disponible.", 404);
  const client = await userClient();
  if (!client) return reply("Acceso restringido.", 403);
  const { data, error } = await client.rpc("cueva_exercise_resource", { p_id: id });
  if (error) return reply("Recurso no disponible para esta cuenta.", 403);
  const json = (body: object) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
  if (data?.video_path) {
    const signed = await (async () => {
      const storage = await exerciseStorage(client);
      const result = await storage.from("cueva-exercise-videos").createSignedUrl(data.video_path, 60);
      return result.error ? null : result.data;
    })().catch(() => null);
    if (!signed) return reply("Video temporalmente no disponible.", 503);
    if (player) return json({ kind: "storage", src: signed.signedUrl });
    if (params.get("check") === "1") return json({ available: true });
    const response = NextResponse.redirect(signed.signedUrl, 307); response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); return response;
  }
  if (!data?.video_url || !youtubeUrl(data.video_url)) return reply("Sin video disponible.", 404);
  if (params.get("check") === "1") return json({ available: true });
  if (player) return json({ kind: "youtube", id: data.video_url.slice(-11), url: data.video_url });
  const response = NextResponse.redirect(data.video_url, 307);
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); return response;
}

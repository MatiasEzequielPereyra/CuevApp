import { exerciseStorage } from "@/lib/routines/storage-server";
import { NextResponse } from "next/server";
import { userClient, productConfig } from "@/lib/product-auth/server";
import { uuid } from "@/lib/routines/types";
import { youtubeUrl } from "@/lib/routines/video";
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const id = params.get("id") ?? "";
  const reply = (message: string, status: number) => NextResponse.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
  if (!uuid.test(id)) return reply("Identificador inválido.", 400);
  if (!productConfig()) return reply("Acceso no disponible.", 404);
  const client = await userClient();
  if (!client) return reply("Acceso restringido.", 403);
  const { data, error } = await client.rpc("cueva_exercise_resource", { p_id: id });
  if (error) return reply("Recurso no disponible para esta cuenta.", 403);
  if (data?.video_path) {
    const { data: signed, error: failed } = await (await exerciseStorage(client)).from("cueva-exercise-videos").createSignedUrl(data.video_path, 60);
    if (failed || !signed) return reply("Video temporalmente no disponible.", 503);
    if (params.get("check") === "1") return NextResponse.json({ available: true }, { headers: { "Cache-Control": "no-store" } });
    const response = NextResponse.redirect(signed.signedUrl, 307); response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); return response;
  }
  if (!data?.video_url || !youtubeUrl(data.video_url)) return reply("Sin video disponible.", 404);
  if (params.get("check") === "1") return NextResponse.json({ available: true }, { headers: { "Cache-Control": "no-store" } });
  const response = NextResponse.redirect(data.video_url, 307);
  response.headers.set("Cache-Control", "no-store"); response.headers.set("Referrer-Policy", "no-referrer"); return response;
}

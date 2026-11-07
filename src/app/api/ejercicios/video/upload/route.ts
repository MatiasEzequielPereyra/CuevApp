import { exerciseStorage } from "@/lib/routines/storage-server";
import { NextResponse } from "next/server";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";
export async function POST(req: Request) {
  const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const cfg = productConfig();
  if (!cfg || req.headers.get("origin") !== cfg.origin) return reply({ message: "Solicitud no permitida." }, 403);
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);
  const p = await readRoutineJson(req, 4096);
  const extension = new Map([["video/mp4", "mp4"], ["video/quicktime", "mov"], ["video/webm", "webm"]]).get(p?.type);
  if (!p || typeof p.id !== "string" || !uuid.test(p.id) || !extension || !Number.isSafeInteger(p.size) || p.size < 1 || p.size > 50 * 1024 * 1024) return reply({ message: "Elegí un video MP4, MOV o WebM de hasta 50 MB." }, 400);
  const path = `${p.id.toLowerCase()}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await (await exerciseStorage(client)).from("cueva-exercise-videos").createSignedUploadUrl(path, { upsert: false });
  if (error) return reply({ message: "No pudimos preparar la carga. El video anterior se conserva." }, 503);
  return reply({ path, url: data.signedUrl });
}

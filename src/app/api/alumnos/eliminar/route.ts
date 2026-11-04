import { NextResponse } from "next/server";
import { productConfig } from "@/lib/product-auth/server";
import { studentAdmin } from "@/lib/students/server";

export const dynamic = "force-dynamic";
const reply = (message: string, status: number) => NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});

export async function POST(req: Request) {
  const cfg=productConfig();
  if(!cfg)return reply("Acceso no disponible.",404);
  if(req.headers.get("origin")!==cfg.origin)return reply("Solicitud no permitida.",403);
  const client=await studentAdmin();
  if(!client)return reply("No tenés permiso para eliminar alumnos.",403);
  if(!/^application\/json(?:\s*;|\s*$)/i.test(req.headers.get("content-type")??""))return reply("Formato inválido.",415);
  const reader=req.body?.getReader();
  if(!reader)return reply("Datos inválidos.",400);
  const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512){await reader.cancel();return reply("Solicitud demasiado extensa.",413);}chunks.push(value);}
  } catch {return reply("Datos inválidos.",400);} finally {reader.releaseLock();}
  let data;
  try {data=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));} catch {return reply("Datos inválidos.",400);}
  if(!data||typeof data!=="object"||data.confirmed!==true||typeof data.id!=="string"||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(data.id)||typeof data.email!=="string"||data.email.length>254)return reply("Confirmá la ficha que querés eliminar.",400);
  const result=await client.rpc("cueva_delete_empty_student",{p_student:data.id,p_expected_email:data.email,p_confirm:true});
  if(result.error)return reply("La eliminación no está disponible. No confirmamos ningún borrado; revisá el listado antes de reintentar.",503);
  if(result.data==="protected")return reply("No se puede eliminar: tiene cuotas, pagos, una invitación en curso o una cuenta asociada. Podés marcarla Inactiva desde Editar ficha.",409);
  if(result.data==="changed")return reply("La ficha cambió. Cerrá esta confirmación y recargá antes de continuar.",409);
  if(result.data!=="deleted"&&result.data!=="not_found")return reply("No pudimos confirmar el resultado. Revisá el listado.",503);
  return NextResponse.json({deleted:true},{headers:{"Cache-Control":"no-store"}});
}

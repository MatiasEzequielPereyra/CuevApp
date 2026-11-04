import { NextResponse } from "next/server";
import { productConfig } from "@/lib/product-auth/server";
import { studentAdmin } from "@/lib/students/server";
export const dynamic = "force-dynamic";
const reply = (message: string, status: number) => NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
export async function POST(req: Request) {
 const cfg=productConfig();
 if(!cfg) return reply("Acceso no disponible.",404);
 if(req.headers.get("origin")!==cfg.origin) return reply("Solicitud no permitida.",403);
 const client=await studentAdmin();
 if(!client) return reply("No tenés permiso para guardar alumnos.",403);
 if(!req.headers.get("content-type")?.startsWith("application/json")) return reply("Formato inválido.",415);
 let raw="";const reader=req.body?.getReader();if(!reader)return reply("Datos inválidos.",400);
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply("La ficha es demasiado extensa.",413);}chunks.push(value);}
 raw=new TextDecoder().decode(Buffer.concat(chunks));
 let data;try{data=JSON.parse(raw);}catch{return reply("Datos inválidos.",400);}
 if(!data || typeof data!=="object")return reply("Datos inválidos.",400);
 const first_name=typeof data.first_name==="string"?data.first_name.trim():"";
 const last_name=typeof data.last_name==="string"?data.last_name.trim():"";
 const email=typeof data.email==="string"?data.email.trim().toLowerCase():"";
 const dni=typeof data.dni==="string"?data.dni.trim():"";
 const joined_on=typeof data.joined_on==="string"?data.joined_on:"";
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id??"") || !first_name || first_name.length>80 || !last_name || last_name.length>80 || email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (dni&&!/^\d{6,10}$/.test(dni)) || !/^\d{4}-\d{2}-\d{2}$/.test(joined_on) || joined_on<"1900-01-01" || joined_on>"2100-12-31" || (!Number.isFinite(Date.parse(joined_on)) || new Date(joined_on).toISOString().slice(0,10)!==joined_on) || typeof data.active!=="boolean")return reply("Revisá nombre, apellido, correo, DNI y fecha.",400);
 const row={id:data.id,first_name,last_name,email,dni:dni||null,joined_on,active:data.active};
 const {id:studentId,...changes}=row;
 const result=data.edit===true?await client.from("cueva_students").update(changes).eq("id",studentId).select("id").maybeSingle():await client.from("cueva_students").insert(row).select("id").single();
 if(result.error){if(result.error.code==="23505")return reply("Ya existe una ficha con ese correo, DNI o identificador. Revisá el listado antes de volver a guardar.",409);return reply("No se pudo guardar. La gestión puede estar pendiente de habilitación. Conservamos tus datos para reintentar.",503);}
 if(!result.data)return reply("No se encontró la ficha o no tenés permiso.",404);
 return NextResponse.json({id:result.data.id},{headers:{"Cache-Control":"no-store"}});
}

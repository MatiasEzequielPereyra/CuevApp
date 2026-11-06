import { NextResponse } from "next/server";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
export async function POST(req:Request){
 const reply=(message:string,status:number)=>NextResponse.json({message,operation_not_applied:true},{status,headers:{"Cache-Control":"no-store"}});
 const cfg=productConfig();if(!cfg)return reply("Acceso no disponible.",404);
 if(req.headers.get("origin")!==cfg.origin)return reply("Solicitud no permitida.",403);
 const client=await studentAdmin();if(!client)return reply("Acceso restringido.",403);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return reply("Formato inválido.",415);
 const reader=req.body?.getReader();if(!reader)return reply("Datos inválidos.",400);
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply("Solicitud demasiado extensa.",413);}chunks.push(value);}
 let data;try{data=JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));}catch{return reply("Datos inválidos.",400);}
 if(!data||typeof data.op!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.op)||!data.p||typeof data.p!=="object")return reply("Datos inválidos.",400);
 const {error}=await client.rpc("cueva_billing_write",{op:data.op,p:data.p});
 if(error){const known=error.code==="P0001";const duplicate=error.code==="23505";return reply(known?error.message:duplicate?"Ya existe ese período, precio o anulación. Revisá el historial.":"No se pudo guardar. Revisá los datos o intentá nuevamente; la migración puede estar pendiente.",known||duplicate?409:503);}
 return reply("Operación registrada.",200);
}

import "server-only";
import {createHash,randomBytes,randomUUID} from "node:crypto";
import {productConfig,serviceClient} from "@/lib/product-auth/server";
import type {studentAdmin} from "@/lib/students/server";
export type InvitationResult={state:string;message:string};
export async function inviteStudent(client:NonNullable<Awaited<ReturnType<typeof studentAdmin>>>,student:string):Promise<InvitationResult>{
 const cfg=productConfig();
 if(!cfg)return {state:"unavailable",message:"Ficha guardada; acceso no disponible."};
 if(cfg.ownerOnly){const queued=await client.rpc("cueva_queue_student_invitation",{student});if(queued.error||queued.data!==true)return {state:"unavailable",message:"Ficha guardada. No se pudo registrar la invitación pendiente; podés reintentar desde la ficha."};return {state:"blocked",message:"Ficha guardada. La invitación queda pendiente: el correo general todavía no está habilitado."};}
 const claim=randomUUID();
 const reserved=await client.rpc("cueva_claim_student_invitation",{student,claim});
 if(reserved.error||!reserved.data)return {state:"unavailable",message:"Ficha guardada. No se pudo preparar la invitación; podés reintentar desde la ficha."};
 if(!reserved.data.claimed){const state=String(reserved.data.state);return {state,message:state==="sent"?"Invitación ya enviada. No se envió otro correo.":state==="existing"?"Ya existe una cuenta con ese correo. La asociación requiere revisión; no se vinculó automáticamente.":"El envío está en proceso o requiere revisión. No se reenviará para evitar duplicados."};}
 const service=serviceClient();
 const finish=async(outcome:string)=>service.rpc("cueva_finish_student_invitation",{student,claim,outcome});
 try{
  // Explicit provisioning, never adopt an existing account by an email match.
  const created=await service.auth.admin.createUser({email:reserved.data.email,email_confirm:false});
  if(created.error||!created.data.user){await finish("failed");return {state:"failed",message:"Ficha guardada; no se pudo crear el acceso. Podés reintentar. Si existe una cuenta previa se pedirá revisión."};}
  const nonce=randomBytes(32).toString("hex");
  const prepared=await service.rpc("cueva_prepare_student_invitation",{student,claim,created_user:created.data.user.id,nonce_hash:createHash("sha256").update(nonce).digest("hex")});
  if(prepared.error||prepared.data!==true){await finish("review");return {state:"review",message:"Ficha guardada. La preparación del acceso requiere revisión; no se envió la invitación."};}
  const url=new URL("/aceptar-invitacion",cfg.origin);url.search=new URLSearchParams({nonce,generation:"1",type:"invite"}).toString();
  const invited=await service.auth.admin.inviteUserByEmail(reserved.data.email,{redirectTo:url.href});
  if(invited.error||invited.data.user?.id!==created.data.user.id){await finish("review");return {state:"review",message:"Ficha guardada. No pudimos confirmar el envío; requiere revisión antes de reenviar."};}
  const done=await finish("sent");
  if(done.error||done.data!==true)return {state:"review",message:"El proveedor aceptó el envío, pero no pudimos confirmar su registro. Revisá antes de reenviar."};
  return {state:"sent",message:"Ficha guardada e invitación enviada. La recepción depende del proveedor de correo."};
 }catch{return {state:"review",message:"Ficha guardada. El resultado del envío es incierto; revisá antes de reenviar."};}
}

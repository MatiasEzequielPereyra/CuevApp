"use client";
import {useRef,useState} from "react";
import {useRouter} from "next/navigation";
export function InvitationAction({id,state}:{id:string;state?:string}){
 const [message,setMessage]=useState("");const [pending,setPending]=useState(false);const busy=useRef(false);const router=useRouter();
 if(state==="sent")return <p>La invitación ya fue enviada; no se enviará otro correo desde esta acción.</p>;
 if(state==="review"||state==="processing")return <p>Este estado requiere revisión administrativa antes de otro envío.</p>;
 return <div><button className="dash-signout" disabled={pending} onClick={async()=>{if(busy.current)return;busy.current=true;setPending(true);try{const r=await fetch("/api/alumnos/invitacion",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})});const data=await r.json();setMessage(data.message??"No se pudo consultar el envío.");router.refresh();}catch{setMessage("Resultado no confirmado. Revisá el estado antes de reintentar.");}finally{busy.current=false;setPending(false);}}}>{pending?"Procesando…":"Enviar o reintentar invitación"}</button>{message&&<p role="status">{message}</p>}</div>;
}

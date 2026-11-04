"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteStudentAction({id,email,name,eligibility}:{id:string;email:string;name:string;eligibility:string}) {
  const dialog=useRef<HTMLDialogElement>(null),cancel=useRef<HTMLButtonElement>(null),confirm=useRef<HTMLButtonElement>(null),busy=useRef(false);
  const [pending,setPending]=useState(false),[message,setMessage]=useState("");
  const router=useRouter();
  const eligible=eligibility==="eligible";
  return <div className="student-delete">
    <button type="button" className="dash-signout student-delete-trigger" disabled={!eligible} onClick={()=>{setMessage("");dialog.current?.showModal();cancel.current?.focus();}}>Eliminar alumno</button>
    {!eligible&&<p>{eligibility==="protected"?"Esta ficha tiene historial, una invitación en curso o una cuenta asociada. No se puede eliminar; podés marcarla Inactiva desde Editar ficha.":"La eliminación no está disponible para esta ficha. Recargá antes de continuar."}</p>}
    <dialog ref={dialog} className="student-delete-dialog" aria-labelledby={`delete-title-${id}`} onCancel={event=>{if(busy.current)event.preventDefault();}} onKeyDown={event=>{
      if(event.key!=="Tab")return;
      if(busy.current){event.preventDefault();return;}
      if(event.shiftKey&&event.target===cancel.current){event.preventDefault();confirm.current?.focus();}
      else if(!event.shiftKey&&event.target===confirm.current){event.preventDefault();cancel.current?.focus();}
    }}>
      <form onSubmit={async event=>{
        event.preventDefault();if(busy.current)return;
        busy.current=true;setPending(true);setMessage("");
        try {
          const response=await fetch("/api/alumnos/eliminar",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id,email,confirmed:true})});
          const data=await response.json();
          if(!response.ok||data.deleted!==true){setMessage(data.message??"No se pudo confirmar la eliminación.");return;}
          dialog.current?.close();router.replace("/alumnos?eliminado=1");router.refresh();
        } catch {setMessage("No pudimos confirmar el resultado. Cerrá y revisá el listado antes de reintentar.");}
        finally {busy.current=false;setPending(false);}
      }}>
        <h2 id={`delete-title-${id}`}>¿Eliminar a {name}?</h2>
        <p>{email}</p><p>Se eliminará definitivamente esta ficha creada por error. Esta acción no se puede deshacer.</p>
        <p>Solo se permite si no tiene cuotas, pagos ni cuenta. Se volverá a comprobar al confirmar.</p>
        {message&&<p role="alert">{message}</p>}
        <div className="student-delete-buttons"><button ref={cancel} type="button" className="dash-signout" disabled={pending} onClick={()=>dialog.current?.close()}>Cancelar</button><button ref={confirm} type="submit" className="dash-signout student-delete-trigger" disabled={pending}>{pending?"Eliminando…":"Eliminar definitivamente"}</button></div>
      </form>
    </dialog>
  </div>;
}

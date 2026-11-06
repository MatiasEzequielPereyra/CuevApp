"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type AuditEntry = {
 id: string; actor: string; old_due_day: number; new_due_day: number;
 effective_month: string; scope: "current_period" | "next_period";
 reason: string | null; result: string; recorded_at: string;
};
function monthAfter(month: string) {
 const [year, value] = month.split("-").map(Number);
 const date = new Date(Date.UTC(year, value, 1));
 return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`;
}
function dueDate(day: number, month: string) {
 const [year, value] = month.split("-").map(Number);
 const last = new Date(Date.UTC(year, value, 0)).getUTCDate();
 return `${year}-${String(value).padStart(2,"0")}-${String(Math.min(day,last)).padStart(2,"0")}`;
}
function dateLabel(value: string) {
 const [year,month,day] = value.split("-").map(Number);
 return new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,day)));
}
export function DueDateManager({
 studentId, currentMonth, currentDay, nextDay, currentDueOn, nextDueOn, history,
}: {
 studentId:string; currentMonth:string; currentDay:number; nextDay:number;
 currentDueOn:string|null; nextDueOn:string|null; history:AuditEntry[];
}) {
 const router=useRouter();
 const [scope,setScope]=useState<"next_period"|"current_period">("next_period");
 const [day,setDay]=useState(String(nextDay));
 const [reason,setReason]=useState("");
 const [confirmed,setConfirmed]=useState(false);
 const [pending,setPending]=useState(false);
 const [message,setMessage]=useState("");
 const busy=useRef(false);
 const operation=useRef<{op:string;payload:string}|null>(null);
 const effectiveMonth=scope==="current_period"?currentMonth:monthAfter(currentMonth);
 const oldDay=scope==="current_period"?currentDay:nextDay;
 const existingDue=scope==="current_period"?currentDueOn:nextDueOn;
 const oldDate=existingDue??dueDate(oldDay,effectiveMonth);
 const newDate=dueDate(Number(day),effectiveMonth);
 const validDay=/^(?:[1-9]|[12][0-9]|3[01])$/.test(day);
 const validReason=!reason.trim()||(reason.trim().length>=3&&reason.trim().length<=300);
 const canSave=validDay&&validReason&&!pending&&(scope!=="current_period"||confirmed);
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  if(busy.current||!canSave)return;
  busy.current=true;setPending(true);setMessage("");
  try {
   const p={kind:"due_day",student_id:studentId,due_day:day,effective_month:effectiveMonth,scope,...(reason.trim()?{reason:reason.trim()}:{})};
   const payload=JSON.stringify(p);
   if(operation.current&&operation.current.payload!==payload)throw new Error("Los datos cambiaron tras un intento. Revisá el historial antes de iniciar una nueva operación.");
   operation.current??={op:crypto.randomUUID(),payload};
   const response=await fetch("/api/pagos",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({op:operation.current.op,p})});
   const result=await response.json();
   setMessage(result.message??"No se pudo guardar.");
   if(response.ok){operation.current=null;setReason("");setConfirmed(false);router.refresh();}
  } catch(error) {setMessage(error instanceof Error?error.message:"No se pudo conectar. Conservamos los datos.");}
  finally {busy.current=false;setPending(false);}
 }
 return <section className="due-date-manager" aria-labelledby="due-date-title">
  <div><p className="dash-kicker">CALENDARIO INDIVIDUAL</p><h2 id="due-date-title">Vencimiento del alumno</h2>
   <p>Día de referencia actual: <strong>{currentDay}</strong>. Si un mes no tiene ese día, se utiliza su último día y se recupera la referencia original al mes siguiente.</p>
  </div>
  <form className="due-date-form" onSubmit={submit}>
   <fieldset><legend>¿Desde cuándo debe aplicarse?</legend>
    <label className="due-date-choice"><input type="radio" name="scope" checked={scope==="next_period"} onChange={()=>{setScope("next_period");setConfirmed(false);setDay(String(nextDay));}}/> Próximo período · {monthAfter(currentMonth)} (predeterminado)</label>
    <label className="due-date-choice"><input type="radio" name="scope" checked={scope==="current_period"} onChange={()=>{setScope("current_period");setConfirmed(false);setDay(String(currentDay));}}/> Período actual · {currentMonth}</label>
   </fieldset>
   <label>Nuevo día de vencimiento<input type="number" min="1" max="31" step="1" inputMode="numeric" value={day} onChange={event=>setDay(event.target.value)} required/></label>
   <div className="due-date-preview" aria-live="polite">
    <p>Vista previa · {effectiveMonth}</p>
    <div><span>Fecha anterior</span><strong>{dateLabel(oldDate)}</strong></div>
    <div><span>Fecha nueva</span><strong>{validDay?dateLabel(newDate):"Ingresá un día entre 1 y 31"}</strong></div>
    <p>Alcance: {scope==="current_period"?"período actual":"próximo período y períodos futuros impagos existentes"}</p>
   </div>
   <label>Motivo (opcional)<textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={3} maxLength={300} rows={2} placeholder="Podés dejarlo vacío."/></label>
   {scope==="current_period"&&<label className="due-date-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> Confirmo que quiero modificar el período actual.</label>}
   {message&&<p role="status">{message}</p>}
   <button type="submit" disabled={!canSave}>{pending?"Guardando…":"Guardar cambio de vencimiento"}</button>
  </form>
  <div className="due-date-history"><h3>Historial de cambios</h3>
   {!history.length?<p>Todavía no hay cambios administrativos de vencimiento.</p>:<ol>{history.map(item=><li key={item.id}>
    <strong>{item.old_due_day} → {item.new_due_day} · desde {item.effective_month.slice(0,7)}</strong>
    <p>{item.scope==="current_period"?"Período actual":"Próximo período"} · {item.result==="applied"?"Aplicado":"Resultado no disponible"}</p>
    {item.reason&&<p>Motivo: {item.reason}</p>}
    <p>Administrador: {item.actor} · {new Date(item.recorded_at).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</p>
   </li>)}</ol>}
  </div>
 </section>;
}

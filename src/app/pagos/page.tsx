import Link from "next/link";
import {studentAdmin} from "@/lib/students/server";
import {studentSearchFilter} from "@/lib/students/search";
import {buenosAiresDate} from "@/lib/students/date";
import {AdminShell} from "@/components/dashboard/admin-dashboard";
import {BrandMark} from "@/components/brand/brand-mark";
import {ThemePicker} from "@/components/theme/theme-picker";
import {BillingForm} from "@/components/payments/billing-form";
import {pesos,type Snapshot} from "@/lib/payments/money";
export const dynamic="force-dynamic";
export default async function Payments({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const client=await studentAdmin();if(!client)return <main className="shell"><h1>Acceso restringido</h1><Link href="/cuenta">Volver a mi cuenta</Link></main>;
 const {data:{user}}=await client.auth.getUser();if(!user)return null;
 const params=await searchParams;const student=typeof params.alumno==="string"&&/^[0-9a-f-]{36}$/i.test(params.alumno)?params.alumno:null;
 const q=typeof params.q==="string"?params.q.slice(0,100):"";
 let query=client.from("cueva_students").select("id,first_name,last_name,active").order("last_name").limit(101);if(q)query=query.or(studentSearchFilter(q));if(student)query=query.eq("id",student);
 const students=await query;
 const snapshot=await client.rpc("cueva_billing_snapshot",{student});const data=snapshot.data as Snapshot|null;
 const today=buenosAiresDate();const month=today.slice(0,7);
 return <AdminShell displayName={user.email??"Cuenta CUEVA"} email={user.email??""} role="Administrador" logo={<BrandMark size={42}/>} themePicker={<ThemePicker/>} active="pagos">
 <h1>Pagos y cuotas</h1><p>Gestión administrativa · importes en pesos argentinos · fechas de Buenos Aires.</p>
 <p><Link href="/pagos/comprobantes">Revisar comprobantes de pago</Link></p>
 {students.error||snapshot.error||!data?<section className="dash-account"><h2>Pagos no disponibles</h2><p>No pudimos consultar las cuotas. La migración puede estar pendiente.</p><Link href="/pagos">Reintentar</Link></section>:<>
 <details><summary>Configurar precio mensual general</summary>{data.prices.length?<ul>{data.prices.map(price=><li key={price.month}>{price.month.slice(0,7)}: {pesos(price.cents)}</li>)}</ul>:<p>Sin precio configurado.</p>}<BillingForm kind="price" month={month} today={today}/></details>
 <form className="student-search"><label>Buscar alumno<input name="q" defaultValue={q}/></label><button>Buscar</button></form>
 {!student?<><h2>Seleccioná un alumno</h2>{students.data?.length?<ul className="student-list">{students.data.slice(0,100).map(s=><li key={s.id}><Link href={`/pagos?alumno=${s.id}`}>{s.last_name}, {s.first_name} · {s.active?"Activo":"Inactivo"} (administrativo)</Link></li>)}</ul>:<p>No encontramos alumnos.</p>}{(students.data?.length??0)>100&&<p>Refiná la búsqueda: mostramos los primeros 100.</p>}</>:!students.data?.length?<p>No se encontró el alumno.</p>:<><h2>{students.data[0]!.first_name} {students.data[0]!.last_name}</h2><Link href={`/alumnos?id=${student}`}>Ver ficha administrativa</Link><BillingForm key={`period-${student}`} kind="period" studentId={student} month={month} today={today}/>
 {data.periods.length===0&&<p>Todavía no hay períodos creados para este alumno.</p>}
 {data.periods.map(period=><section className="dash-account" key={period.id}><div className="billing-period"><h2>Período {period.month.slice(0,7)}</h2><p>Vencimiento: {period.due_on}</p><p>Total: {pesos(period.cents)} · Pagado: {pesos(period.paid)} · Saldo: <strong>{pesos((BigInt(period.cents)-BigInt(period.paid)).toString())}</strong></p>
 {BigInt(period.paid)<BigInt(period.cents)&&<details><summary>Registrar pago</summary><BillingForm kind="payment" studentId={student} periodId={period.id} month={month} today={today}/></details>}
 <h3>Historial de movimientos</h3>{!period.payments.length?<p>No hay pagos registrados.</p>:<ul className="student-list">{period.payments.map(payment=><li key={payment.id}><div className="billing-movement"><strong>{pesos(payment.cents)} · {payment.reversal?"Anulado":"Confirmado"}</strong><p>{payment.paid_on} · {payment.method}</p><p>Confirmó: {payment.actor}</p><p>Registrado: {new Date(payment.recorded_at).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</p>{payment.reversal?<><p>Motivo: {payment.reversal.reason}</p><p>Anuló: {payment.reversal.actor} · {new Date(payment.reversal.recorded_at).toLocaleString("es-AR",{timeZone:"America/Argentina/Buenos_Aires"})}</p></>:<details><summary>Corregir mediante anulación</summary><BillingForm kind="reverse" studentId={student} paymentId={payment.id} month={month} today={today}/></details>}</div></li>)}</ul>}</div></section>)}
 </>}
 </>}
 </AdminShell>;
}

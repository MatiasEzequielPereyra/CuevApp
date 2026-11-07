"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { receiptPaymentMethods, receiptState, type Receipt } from "@/lib/receipts/contracts";

export function ReceiptReview({ id, today }: { id: string; today: string }) {
  const router = useRouter();
  const [action, setAction] = useState("approve");
  const [method, setMethod] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");
  const busy = useRef(false);
  const operation = useRef<{ payload: string; id: string } | null>(null);

  async function review(form: FormData) {
    if (busy.current || done) return;
    const data = Object.fromEntries(form);
    const payload = JSON.stringify({ ...data, id, action });
    if (operation.current?.payload !== payload) operation.current = { payload, id: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/comprobantes/revisar", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ ...data, id, action, operation: operation.current.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "No pudimos confirmar la revisión.");
        return;
      }
      const state = result.state as Receipt["state"];
      if (state === "pending" || !Object.hasOwn(receiptState, state)) {
        setMessage("No pudimos confirmar la revisión. Podés reintentar.");
        return;
      }
      setDone(true);
      setMessage(receiptState[state]);
      router.refresh();
    } catch {
      setMessage("No pudimos confirmar la revisión. Podés reintentar.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <form className="student-form receipt-form" onSubmit={event => {
    event.preventDefault();
    void review(new FormData(event.currentTarget));
  }}>
    <fieldset disabled={pending || done}>
      <label>Decisión<select value={action} onChange={event => setAction(event.target.value)}>
        <option value="approve">Confirmar pago</option>
        <option value="reject">Rechazar comprobante</option>
      </select></label>
      {action === "approve" ? <>
        <label>Importe en pesos<input name="amount" inputMode="decimal" required maxLength={13} /></label>
        <label>Fecha real del pago<input name="date" type="date" required max={today} min="1900-01-01" /></label>
        <label>Medio de pago<select name="method" required value={method} onChange={event => setMethod(event.target.value)}>
          <option value="">Elegí un medio</option>
          {Object.entries(receiptPaymentMethods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        {method === "otro" && <label>Descripción del medio<input name="detail" required maxLength={120} /></label>}
      </> : <label>Motivo visible para el alumno<textarea name="reason" required maxLength={300} /></label>}
      <button>{pending ? "Guardando revisión" : action === "approve" ? "Confirmar y registrar pago" : "Rechazar comprobante"}</button>
    </fieldset>
    {message && <p role="status">{message}</p>}
  </form>;
}

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { maxReceiptBytes, receiptType } from "@/lib/receipts/contracts";

export function ReceiptUpload({ period }: { period: string }) {
  const router = useRouter();
  const operation = useRef<string | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file: File) {
    if (busy.current || done) return;
    const type = receiptType(file.name);
    if (!type || (file.type && file.type !== type)) {
      setMessage("Eleg� un archivo JPG, PNG o PDF.");
      return;
    }
    if (!file.size || file.size > maxReceiptBytes) {
      setMessage("El archivo debe pesar hasta 10 MB y no estar vac�o.");
      return;
    }

    busy.current = true;
    setPending(true);
    setMessage("Preparando comprobante.");
    operation.current ??= crypto.randomUUID();
    try {
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
      const hash = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
      const payload = { id: operation.current, period, extension: file.name.split(".").at(-1), type, size: file.size, hash };
      const request = async (action: "prepare" | "submit", uploadId?: string) => {
        const response = await fetch("/api/comprobantes", {
          method: "POST", headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(60000), body: JSON.stringify({ ...payload, action, uploadId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "No pudimos confirmar la carga.");
        return result;
      };
      const prepared = await request("prepare");
      if (!prepared.submitted) {
        if (!prepared.uploaded) {
          if (typeof prepared.uploadUrl !== "string") throw new Error("No pudimos preparar la carga.");
          setMessage("Subiendo comprobante.");
          const sent = await fetch(prepared.uploadUrl, {
            method: "PUT", headers: { "Content-Type": type, "x-upsert": "false" },
            body: file, signal: AbortSignal.timeout(180000),
          });
          // A concurrent retry may have created the immutable object already.
          if (!sent.ok && sent.status !== 409 && sent.status !== 400) throw new Error("Fall� la carga. Pod�s reintentar.");
        }
        setMessage("Verificando el archivo.");
        const submitted = await request("submit", prepared.uploadId);
        if (!submitted.submitted) throw new Error("No pudimos confirmar la presentaci�n.");
      }
      setDone(true);
      setMessage("Comprobante presentado. El gimnasio lo va a revisar.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se confirm� la carga. Pod�s reintentar.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return <form className="student-form receipt-form" onSubmit={event => {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get("receipt");
    if (file instanceof File) void upload(file);
  }}>
    <label>Archivo del comprobante
      <input name="receipt" type="file" required accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        disabled={pending || done} onChange={() => { operation.current = null; setMessage(""); }}/>
    </label>
    <p>JPG, PNG o PDF de hasta 10 MB.</p>
    <button disabled={pending || done}>{pending ? "Procesando comprobante" : "Presentar comprobante"}</button>
    {message && <p role="status">{message}</p>}
  </form>;
}


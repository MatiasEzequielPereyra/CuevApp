"use client";

import { useEffect, useId, useRef, useState } from "react";

type Preview = { url: string; type: "image/jpeg" | "image/png" | "application/pdf" };

export function ReceiptPreview({ id }: { id: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const request = useRef<AbortController | null>(null);
  const objectUrl = useRef<string | null>(null);
  const titleId = useId();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function clearFile() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }

  useEffect(() => () => {
    request.current?.abort();
    clearFile();
  }, []);

  async function load() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    clearFile();
    setPreview(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/comprobantes?id=${encodeURIComponent(id)}&preview=1`, {
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      });
      if (!response.ok) throw new Error("Archivo no disponible.");
      const type = response.headers.get("content-type")?.split(";")[0];
      if (type !== "image/jpeg" && type !== "image/png" && type !== "application/pdf") {
        throw new Error("Formato no disponible.");
      }
      const file = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file);
      objectUrl.current = url;
      setPreview({ url, type });
    } catch {
      if (!controller.signal.aborted) setError("No pudimos abrir el comprobante. Intentá nuevamente.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  function close() {
    // A native close event can arrive after the trigger has reopened the dialog.
    if (dialog.current?.open) return;
    request.current?.abort();
    clearFile();
    setPreview(null);
    setError("");
    setLoading(false);
    trigger.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={trigger} type="button" className="receipts-action receipts-action-secondary" aria-haspopup="dialog"
      onClick={() => { dialog.current?.showModal(); void load(); }}>
      Ver comprobante
    </button>
    <dialog ref={dialog} className="receipt-preview" aria-labelledby={titleId} onClose={close}>
      <header className="receipt-preview-header">
        <h2 id={titleId}>Vista previa del comprobante</h2>
        <form method="dialog"><button type="submit" className="receipts-control">Cerrar</button></form>
      </header>
      {loading && <p role="status">Cargando comprobante…</p>}
      {error && <div className="receipt-preview-error">
        <p role="alert">{error}</p>
        <button type="button" className="receipts-control" onClick={() => void load()}>Reintentar</button>
      </div>}
      {preview && !error && (preview.type === "application/pdf"
        ? <div className="receipt-preview-pdf">
          <iframe src={preview.url} title="Comprobante en PDF" />
          <a className="receipts-control" href={preview.url} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
        </div>
        // The authorized file is a short-lived local Blob URL.
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={preview.url} alt="Comprobante de pago" onError={() => setError("No pudimos mostrar la imagen. Intentá nuevamente.")} />)}
    </dialog>
  </>;
}

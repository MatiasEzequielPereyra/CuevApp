export const receiptBucket = "cueva-payment-receipts";
export const maxReceiptBytes = 10 * 1024 * 1024;
export const receiptExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const;
export type ReceiptMediaType = keyof typeof receiptExtensions;

export function receiptType(name: string): ReceiptMediaType | null {
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.pdf$/i.test(name)) return "application/pdf";
  return null;
}

export type Receipt = {
  id: string;
  state: "pending" | "approved" | "rejected" | "superseded";
  submitted_at: string;
  resolved_at: string | null;
  rejection_reason: string | null;
};

export const receiptState: Record<Receipt["state"], string> = {
  pending: "Pendiente de revisión",
  approved: "Confirmado",
  rejected: "Rechazado",
  superseded: "Sin efecto: período ya saldado",
};

export const receiptPaymentMethods = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Tarjeta de débito",
  credito: "Tarjeta de crédito",
  otro: "Otro",
} as const;

import { NextResponse } from "next/server";
import { studentAdmin } from "@/lib/students/server";
import { productConfig } from "@/lib/product-auth/server";
import { toCents } from "@/lib/payments/money";
import { readRoutineJson } from "@/lib/routines/request";
import { uuid } from "@/lib/routines/types";
import { receiptPaymentMethods } from "@/lib/receipts/contracts";
import { receiptError } from "@/lib/receipts/server";

export async function POST(req: Request) {
  const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
  const cfg = productConfig();
  if (!cfg || req.headers.get("origin") !== cfg.origin) return reply({ message: "Acceso restringido." }, 403);
  const client = await studentAdmin();
  if (!client) return reply({ message: "Acceso restringido." }, 403);

  const p = await readRoutineJson(req, 4096);
  if (!p || typeof p.id !== "string" || !uuid.test(p.id) || typeof p.operation !== "string" || !uuid.test(p.operation)
    || (p.action !== "approve" && p.action !== "reject")) {
    return reply({ message: "Datos de revisión inválidos." }, 400);
  }

  let cents: string | null = null, paidOn: string | null = null, method: string | null = null;
  let detail: string | null = null, reason: string | null = null;
  if (p.action === "approve") {
    if (typeof p.amount !== "string" || typeof p.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)
      || typeof p.method !== "string" || !Object.hasOwn(receiptPaymentMethods, p.method)) {
      return reply({ message: "Completá importe, fecha real y medio de pago." }, 400);
    }
    try { cents = toCents(p.amount); }
    catch (err) { return reply({ message: err instanceof Error ? err.message : "Importe inválido." }, 400); }
    paidOn = p.date;
    method = p.method;
    if (method === "otro") {
      detail = typeof p.detail === "string" ? p.detail.trim() : "";
      if (!detail || detail.length > 120) return reply({ message: "Describí el otro medio de pago." }, 400);
    }
  } else {
    reason = typeof p.reason === "string" ? p.reason.trim() : "";
    if (!reason || reason.length > 300) return reply({ message: "Indicá un motivo de rechazo." }, 400);
  }

  const { data, error } = await client.rpc("cueva_receipt_review", {
    p_id: p.id, p_operation: p.operation, p_action: p.action, p_cents: cents,
    p_paid_on: paidOn, p_method: method, p_detail: detail, p_reason: reason,
  });
  if (error) {
    const mapped = receiptError(error);
    return reply({ message: mapped.message }, mapped.status);
  }
  if (!["approved", "rejected", "superseded"].includes(data)) return reply({ message: "No pudimos confirmar la revisión. Reintentá." }, 503);
  return reply({ state: data });
}

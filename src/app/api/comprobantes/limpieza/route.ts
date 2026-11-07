import { timingSafeEqual } from "node:crypto";
import { serviceClient } from "@/lib/product-auth/server";
import { receiptServiceStorage, removeExpiredReceiptUpload } from "@/lib/receipts/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  const headers = { "Cache-Control": "private, no-store" };
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response(null, { status: 403, headers });
  }
  try {
    const db = serviceClient();
    const { data, error } = await db.rpc("cueva_receipt_expired_uploads");
    if (error || !Array.isArray(data)) return new Response(null, { status: 503, headers });
    const storage = receiptServiceStorage();
    let removed = 0;
    for (let i = 0; i < data.length; i += 10) {
      const batch = await Promise.all(data.slice(i, i + 10).map(lease => removeExpiredReceiptUpload(db, storage, lease)));
      removed += batch.filter(Boolean).length;
    }
    return Response.json({ removed }, { status: removed === data.length ? 200 : 503, headers });
  } catch {
    return new Response(null, { status: 503, headers });
  }
}

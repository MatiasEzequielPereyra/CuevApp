import { notFound } from "next/navigation";
import { DueDateManager } from "@/components/payments/due-date-manager";
import { BillingForm } from "@/components/payments/billing-form";

export const dynamic = "force-dynamic";

export default function DueDateFixture() {
  if (process.env.CUEVA_E2E_FIXTURES !== "1") notFound();
  return <main className="shell">
    <DueDateManager
      studentId="e2000000-0000-4000-8000-000000000001"
      actorId="e1000000-0000-4000-8000-000000000001"
      currentMonth="2026-11"
      currentDay={12}
      nextDay={12}
      currentDueOn="2026-11-12"
      nextDueOn="2026-12-12"
      history={[]}
      attempts={[]}
    />
    <BillingForm kind="payment" studentId="e2000000-0000-4000-8000-000000000001" periodId="e3000000-0000-4000-8000-000000000001" month="2026-11" today="2026-11-06" actorId="e1000000-0000-4000-8000-000000000001" />
  </main>;
}

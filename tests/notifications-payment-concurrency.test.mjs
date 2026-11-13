import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.CUEVA_TEST_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = new Client({ connectionString, application_name: "cueva-payment-notification-test-admin" });
const payment = new Client({ connectionString, application_name: "cueva-payment-notification-test-payment" });
const worker = new Client({ connectionString, application_name: "cueva-payment-notification-test-worker" });

const userId = randomUUID();
const sessionId = randomUUID();
const studentIds = [randomUUID(), randomUUID()];
const periodIds = [randomUUID(), randomUUID()];
const notificationIds = [randomUUID(), randomUUID()];
const deliveryIds = [randomUUID(), randomUUID()];
const leaseTokens = [randomUUID(), randomUUID()];
const priceId = randomUUID();
const paymentOperationIds = [randomUUID(), randomUUID()];
let connected = false;
let paymentTransactionOpen = false;
let workerTransactionOpen = false;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForLockWait(applicationName) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const { rows } = await admin.query(
      `select wait_event_type
         from pg_stat_activity
        where application_name = $1
          and state = 'active'`,
      [applicationName],
    );
    if (rows.some(row => row.wait_event_type === "Lock")) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for PostgreSQL lock: ${applicationName}`);
}

async function createPendingEmailScenario(index, month, localDate, dueDate) {
  await admin.query(
    `insert into public.cueva_periods(id,student_id,month,due_on,cents,price_id,actor)
     values($1,$2,$3::date,$4::date,10000,$5,$6)`,
    [periodIds[index], studentIds[index], month, dueDate, priceId, userId],
  );
  await admin.query(
    `insert into public.cueva_notifications(id,period_id,reminder_days,due_on,scheduled_at)
     values($1,$2,5,$3::date,now()-interval '1 minute')`,
    [notificationIds[index], periodIds[index], dueDate],
  );
  await admin.query(
    `insert into public.cueva_notification_deliveries(
       id,notification_id,channel,status,attempt_count,next_attempt_at,
       last_attempt_at,lease_token,lease_expires_at
     ) values($1,$2,'email','processing',1,now(),now(),$3,now()+interval '5 minutes')`,
    [deliveryIds[index], notificationIds[index], leaseTokens[index]],
  );
}

async function recordFullPayment(index, localDate) {
  return payment.query(
    "select public.cueva_billing_write($1::uuid,$2::jsonb) as operation_id",
    [paymentOperationIds[index], JSON.stringify({
      kind: "payment",
      student_id: studentIds[index],
      period_id: periodIds[index],
      cents: "10000",
      paid_on: localDate,
      method: "efectivo",
    })],
  );
}

try {
  await Promise.all([admin.connect(), payment.connect(), worker.connect()]);
  connected = true;

  const { rows: [{ month, localDate, dueDate }] } = await admin.query(`
    select
      to_char(date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires'),'YYYY-MM-DD') as month,
      to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD') as "localDate",
      to_char((now() at time zone 'America/Argentina/Buenos_Aires')::date + 10,'YYYY-MM-DD') as "dueDate"
  `);

  await admin.query(`
    insert into auth.users(id,aud,role,email,created_at,updated_at)
    values($1,'authenticated','authenticated',$2,now(),now())
  `, [userId, `payment-notification-${userId}@example.test`]);
  await admin.query(`
    insert into auth.sessions(id,user_id,created_at,updated_at)
    values($1,$2,now(),now())
  `, [sessionId, userId]);
  await admin.query(`
    insert into cueva_private.access_state(user_id,ready,session_not_before)
    values($1,true,now()-interval '1 minute')
  `, [userId]);
  await admin.query(
    "insert into public.cueva_profiles(user_id,role) values($1,'admin')",
    [userId],
  );
  for (let index = 0; index < studentIds.length; index += 1) {
    await admin.query(
      `insert into public.cueva_students(id,first_name,last_name,email,joined_on,active)
       values($1,'Payment','Race',$2,$3::date,true)`,
      [studentIds[index], `payment-race-${index}-${userId}@example.test`, localDate],
    );
  }
  await admin.query(
    `insert into public.cueva_prices(id,effective_month,cents,actor)
     values($1,$2::date,10000,$3)`,
    [priceId, month, userId],
  );

  await payment.query("set role authenticated");
  await payment.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
  await payment.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: userId, role: "authenticated", session_id: sessionId }),
  ]);
  await worker.query("set role service_role");
  await worker.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ role: "service_role" }),
  ]);

  await createPendingEmailScenario(0, month, localDate, dueDate);
  await createPendingEmailScenario(1, month, localDate, dueDate);

  // Ordering A: the payment transaction obtains the shared advisory lock
  // first. Provider-start must wait, then observe the fully paid period.
  await payment.query("begin");
  paymentTransactionOpen = true;
  await recordFullPayment(0, localDate);
  const startAfterPayment = worker.query(
    "select * from public.cueva_mark_notification_delivery_started_with_balance($1,$2)",
    [deliveryIds[0], leaseTokens[0]],
  );
  await waitForLockWait("cueva-payment-notification-test-worker");
  await payment.query("commit");
  paymentTransactionOpen = false;

  const [afterPayment] = (await startAfterPayment).rows;
  assert.equal(afterPayment.started, false,
    "provider-start waits for an in-flight payment and refuses a fully paid period");
  const { rows: [cancelledDelivery] } = await admin.query(
    "select status,last_error_code,provider_started_at from public.cueva_notification_deliveries where id=$1",
    [deliveryIds[0]],
  );
  assert.equal(cancelledDelivery.status, "cancelled",
    "the delivery is cancelled when payment commits before provider-start");
  assert.equal(cancelledDelivery.last_error_code, "balance_zero",
    "the cancellation records the zero-balance reason");
  assert.equal(cancelledDelivery.provider_started_at, null,
    "no external provider boundary is recorded after the payment");

  // Ordering B: provider-start obtains the lock first and returns the balance
  // from that serialized point. A concurrent payment must wait until the
  // worker transaction commits; this ordering permits the already-started send.
  await worker.query("begin");
  workerTransactionOpen = true;
  const beforePayment = await worker.query(
    "select * from public.cueva_mark_notification_delivery_started_with_balance($1,$2)",
    [deliveryIds[1], leaseTokens[1]],
  );
  assert.equal(beforePayment.rows[0].started, true,
    "provider-start succeeds when it serializes before payment");
  assert.equal(beforePayment.rows[0].balance_cents, "10000",
    "provider-start returns the balance observed under the shared lock");

  await payment.query("begin");
  paymentTransactionOpen = true;
  const paymentAfterStart = recordFullPayment(1, localDate);
  await waitForLockWait("cueva-payment-notification-test-payment");
  await worker.query("commit");
  workerTransactionOpen = false;
  await paymentAfterStart;
  await payment.query("commit");
  paymentTransactionOpen = false;

  const { rows: [paidAfterStart] } = await admin.query(`
    select delivery.provider_started_at,
           period.cents - coalesce(sum(payment.cents) filter (
             where payment.id is not null and reversal.id is null
           ),0)::bigint as balance_cents
      from public.cueva_notification_deliveries delivery
      join public.cueva_notifications notification on notification.id=delivery.notification_id
      join public.cueva_periods period on period.id=notification.period_id
      left join public.cueva_payments payment on payment.period_id=period.id
      left join public.cueva_reversals reversal on reversal.payment_id=payment.id
     where delivery.id=$1
     group by delivery.provider_started_at,period.cents
  `, [deliveryIds[1]]);
  assert.ok(paidAfterStart.provider_started_at,
    "the provider-start boundary remains recorded when it serializes before payment");
  assert.equal(paidAfterStart.balance_cents, "0",
    "the subsequent payment is committed after the provider-start boundary");

  process.stdout.write(
    "PASS: payment-before-provider-start suppresses dispatch; provider-start-before-payment is serialized and records its observed balance.\n",
  );
} finally {
  if (paymentTransactionOpen) await payment.query("rollback").catch(() => undefined);
  if (workerTransactionOpen) await worker.query("rollback").catch(() => undefined);
  if (connected) {
    await Promise.all([payment.end(), worker.end()]);
    try {
      await admin.query("delete from public.cueva_notification_deliveries where id = any($1::uuid[])", [deliveryIds]);
      await admin.query("delete from public.cueva_notifications where id = any($1::uuid[])", [notificationIds]);
      await admin.query("delete from public.cueva_payments where id = any($1::uuid[])", [paymentOperationIds]);
      await admin.query("delete from public.cueva_periods where id = any($1::uuid[])", [periodIds]);
      await admin.query("delete from public.cueva_prices where id=$1", [priceId]);
      await admin.query("delete from cueva_private.billing_operations where id = any($1::uuid[])", [paymentOperationIds]);
      await admin.query("delete from public.cueva_students where id = any($1::uuid[])", [studentIds]);
      await admin.query("delete from public.cueva_profiles where user_id=$1", [userId]);
      await admin.query("delete from cueva_private.access_state where user_id=$1", [userId]);
      await admin.query("delete from auth.sessions where id=$1", [sessionId]);
      await admin.query("delete from auth.users where id=$1", [userId]);
    } finally {
      await admin.end();
    }
  } else {
    await admin.end().catch(() => undefined);
  }
}

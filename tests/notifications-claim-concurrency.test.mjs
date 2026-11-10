import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.CUEVA_TEST_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = new Client({ connectionString });
const workers = [new Client({ connectionString }), new Client({ connectionString })];
const unauthorized = new Client({ connectionString });
const suffix = randomUUID();
const adminId = randomUUID();
const studentIds = Array.from({ length: 8 }, () => randomUUID());
const priceId = randomUUID();
const periodIds = Array.from({ length: 8 }, () => randomUUID());
const notificationIds = Array.from({ length: 8 }, () => randomUUID());
const deliveryIds = Array.from({ length: 8 }, () => randomUUID());
let adminConnected = false;
let workerTransactionsOpen = false;

async function expectSqlState(promise, code, label) {
  await assert.rejects(promise, error => {
    assert.equal(error.code, code, `${label}: SQLSTATE`);
    return true;
  }, label);
}

try {
  await admin.connect();
  adminConnected = true;
  const { rows: [{ localDate, month }] } = await admin.query(`
    select
      to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM-DD') as "localDate",
      to_char(date_trunc('month', now() at time zone 'America/Argentina/Buenos_Aires'),'YYYY-MM-DD') as month
  `);

  await admin.query(`
    insert into auth.users(id,aud,role,email,created_at,updated_at)
    values($1,'authenticated','authenticated',$2,now(),now())
  `, [adminId, `notification-worker-${suffix}@example.test`]);
  await admin.query(`
    insert into public.cueva_prices(id,effective_month,cents,actor)
    values($1,$2,10000,$3)
  `, [priceId, month, adminId]);

  for (let index = 0; index < studentIds.length; index += 1) {
    await admin.query(`
      insert into public.cueva_students(id,first_name,last_name,email,joined_on)
      values($1,'Worker','Test',$2,$3)
    `, [studentIds[index], `worker-${index}-${suffix}@example.test`, localDate]);
    await admin.query(`
      insert into public.cueva_periods(id,student_id,month,due_on,cents,price_id,actor)
      values($1,$2,$3::date,$4::date + case when $5 then 0 else 10 end,10000,$6,$7)
    `, [periodIds[index], studentIds[index], month, localDate, index === 7, priceId, adminId]);
    await admin.query(`
      insert into public.cueva_notifications(id,period_id,reminder_days,due_on,scheduled_at)
      select $1, period.id, 5, period.due_on, now()-interval '1 minute'
      from public.cueva_periods period where period.id=$2
    `, [notificationIds[index], periodIds[index]]);
  }

  await admin.query(`
    insert into public.cueva_notification_deliveries(
      id,notification_id,channel,status,attempt_count,next_attempt_at
    ) values
      ($1,$2,'email','pending',0,now()-interval '1 minute'),
      ($3,$4,'email','pending',0,now()-interval '1 minute')
  `, [deliveryIds[0], notificationIds[0], deliveryIds[1], notificationIds[1]]);

  await Promise.all(workers.map(client => client.connect()));
  await Promise.all(workers.map(client => client.query(
    "select set_config('request.jwt.claims',$1,false)",
    [JSON.stringify({ role: "service_role" })],
  )));
  await Promise.all(workers.map(client => client.query("set role service_role")));

  // Keep worker one's transaction open so its row lock remains held while
  // worker two claims. SKIP LOCKED must make the second worker take another row.
  await workers[0].query("begin");
  workerTransactionsOpen = true;
  const first = await workers[0].query(
    "select * from public.cueva_claim_notification_deliveries(1,300)",
  );
  assert.equal(first.rows.length, 1, "worker one claims one delivery");
  const second = await workers[1].query(
    "select * from public.cueva_claim_notification_deliveries(1,300)",
  );
  assert.equal(second.rows.length, 1, "worker two skips the locked delivery and claims another");
  assert.notEqual(second.rows[0].delivery_id, first.rows[0].delivery_id,
    "two workers never claim the same locked delivery");
  await workers[0].query("commit");
  workerTransactionsOpen = false;

  // Expired leases at attempts 1..5 must use the approved retry policy.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const index = attempt + 1;
    await admin.query(`
      insert into public.cueva_notification_deliveries(
        id,notification_id,channel,status,attempt_count,next_attempt_at,
        last_attempt_at,lease_token,lease_expires_at
      ) values($1,$2,'push','processing',$3,now(),now()-interval '10 minutes',$4,now()-interval '1 second')
    `, [deliveryIds[index], notificationIds[index], attempt, randomUUID()]);
  }
  await admin.query(`
    insert into public.cueva_notification_deliveries(
      id,notification_id,channel,status,attempt_count,next_attempt_at,
      last_attempt_at,lease_token,lease_expires_at
    ) values($1,$2,'internal','processing',1,now(),now()-interval '10 minutes',$3,now()-interval '1 second')
  `, [deliveryIds[7], notificationIds[7], randomUUID()]);

  await workers[1].query("select * from public.cueva_claim_notification_deliveries(100,300)");

  const { rows: retryRows } = await admin.query(`
    select delivery.id, delivery.status, delivery.attempt_count,
           extract(epoch from (delivery.next_attempt_at - delivery.updated_at))::integer as delay_seconds,
           attempt.outcome, attempt.error_code
    from public.cueva_notification_deliveries delivery
    left join public.cueva_notification_attempts attempt
      on attempt.delivery_id=delivery.id
     and attempt.attempt_number=delivery.attempt_count
    where delivery.id=any($1::uuid[])
    order by delivery.attempt_count
  `, [[2,3,4,5,6].map(index => deliveryIds[index])]);
  assert.equal(retryRows.length, 5, "all five expired attempts are recovered");
  const delays = [900, 1800, 3600, 10800];
  for (let index = 0; index < 4; index += 1) {
    assert.equal(retryRows[index].status, "pending", `attempt ${index + 1} returns to pending`);
    assert.equal(retryRows[index].delay_seconds, delays[index], `attempt ${index + 1} uses the approved delay`);
    assert.equal(retryRows[index].outcome, "unknown", `attempt ${index + 1} is recorded as unknown`);
    assert.equal(retryRows[index].error_code, "lease_expired", `attempt ${index + 1} records lease expiry`);
  }
  assert.equal(retryRows[4].status, "failed", "the fifth attempt exhausts retries");
  assert.equal(retryRows[4].outcome, "unknown", "the exhausted attempt is recorded as unknown");

  const { rows: [pastDue] } = await admin.query(
    "select status,last_error_code from public.cueva_notification_deliveries where id=$1",
    [deliveryIds[7]],
  );
  assert.equal(pastDue.status, "cancelled", "expired lease after due date is cancelled");
  assert.equal(pastDue.last_error_code, "lease_expired_after_due_date",
    "past-due cancellation has an explicit reason");

  await expectSqlState(
    workers[1].query("select * from public.cueva_claim_notification_deliveries(0,300)"),
    "22023", "invalid batch size is rejected",
  );
  await expectSqlState(
    workers[1].query("select * from public.cueva_claim_notification_deliveries(1,29)"),
    "22023", "invalid lease duration is rejected",
  );

  await unauthorized.connect();
  await unauthorized.query("select set_config('request.jwt.claims',$1,false)",
    [JSON.stringify({ role: "authenticated" })]);
  await unauthorized.query("set role authenticated");
  await expectSqlState(
    unauthorized.query("select * from public.cueva_claim_notification_deliveries(1,300)"),
    "42501", "authenticated cannot claim notification deliveries",
  );

  process.stdout.write(
    "PASS: concurrent claims are disjoint; retry delays, attempt limit, due-date cancellation, and permissions are enforced.\\n",
  );
} finally {
  if (workerTransactionsOpen) await workers[0].query("rollback").catch(() => undefined);
  await Promise.all([...workers, unauthorized].map(client => client.end().catch(() => undefined)));
  if (adminConnected) {
    try {
      await admin.query("delete from public.cueva_notification_attempts where delivery_id=any($1::uuid[])", [deliveryIds]);
      await admin.query("delete from public.cueva_notification_deliveries where id=any($1::uuid[])", [deliveryIds]);
      await admin.query("delete from public.cueva_notifications where id=any($1::uuid[])", [notificationIds]);
      await admin.query("delete from public.cueva_periods where id=any($1::uuid[])", [periodIds]);
      await admin.query("delete from public.cueva_students where id=any($1::uuid[])", [studentIds]);
      await admin.query("delete from public.cueva_prices where id=$1", [priceId]);
      await admin.query("delete from public.cueva_profiles where user_id=$1", [adminId]);
      await admin.query("delete from auth.users where id=$1", [adminId]);
    } finally {
      await admin.end();
    }
  }
}

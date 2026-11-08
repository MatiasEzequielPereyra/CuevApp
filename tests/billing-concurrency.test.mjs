import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.CUEVA_TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = new Client({ connectionString });
const userId = randomUUID();
const sessionId = randomUUID();
const studentId = randomUUID();
const priceOperation = randomUUID();
const periodOperations = [randomUUID(), randomUUID()];
const dueDayOperations = [randomUUID(), randomUUID()];
const clients = [new Client({ connectionString }), new Client({ connectionString })];

let month;
let adminConnected = false;
try {
  await admin.connect();
  adminConnected = true;
  await admin.query("select 1");
  ({ rows: [{ month }] } = await admin.query(`
    select to_char(date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires'),'YYYY-MM') as month
  `));

  await admin.query(`
    insert into auth.users(id,aud,role,email,created_at,updated_at)
    values($1,'authenticated','authenticated',$2,now(),now())
  `, [userId, `concurrency-${userId}@example.test`]);
  await admin.query(`
    insert into auth.sessions(id,user_id,created_at,updated_at)
    values($1,$2,now(),now())
  `, [sessionId, userId]);
  await admin.query(`
    insert into cueva_private.access_state(user_id,ready,session_not_before)
    values($1,true,now()-interval '1 minute')
  `, [userId]);
  await admin.query("insert into public.cueva_profiles(user_id,role) values($1,'admin')", [userId]);
  await admin.query(`
    insert into public.cueva_students(id,first_name,last_name,email,joined_on)
    values($1,'Concurrency','Student',$2,date '2026-01-31')
  `, [studentId, `student-${studentId}@example.test`]);

  await Promise.all(clients.map(client => client.connect()));
  for (const client of clients) {
    await client.query("set role authenticated");
    await client.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    await client.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: userId, role: "authenticated", session_id: sessionId }),
    ]);
  }

  const pricePayload = { kind: "price", month, cents: "10000" };
  const priceResult = await clients[0].query(
    "select public.cueva_billing_write($1::uuid,$2::jsonb) as operation_id",
    [priceOperation, JSON.stringify(pricePayload)],
  );
  assert.equal(priceResult.rows[0].operation_id, priceOperation, "fixture price is created");

  const periodPayload = { kind: "period", student_id: studentId, month };
  await Promise.all(clients.map(client => client.query("select pg_sleep(0.05)")));
  const attempts = await Promise.allSettled(clients.map((client, index) =>
    client.query(
      "select public.cueva_billing_write($1::uuid,$2::jsonb) as operation_id",
      [periodOperations[index], JSON.stringify(periodPayload)],
    ),
  ));

  const succeeded = attempts.filter(result => result.status === "fulfilled");
  const rejected = attempts.filter(result => result.status === "rejected");
  assert.equal(succeeded.length, 1, "exactly one concurrent period creation succeeds");
  assert.equal(rejected.length, 1, "the competing creation is rejected");
  assert.equal(rejected[0].reason.code, "23505", "the unique student/month constraint rejects the race");

  const { rows } = await admin.query(
    "select count(*)::integer as total from public.cueva_periods where student_id=$1 and month=($2||'-01')::date",
    [studentId, month],
  );
  assert.equal(rows[0].total, 1, "database contains exactly one period after the race");

  const { rows: [{ next_month: nextMonth }] } = await admin.query(`
    select to_char((date_trunc('month',now() at time zone 'America/Argentina/Buenos_Aires')+interval '1 month'),'YYYY-MM') as next_month
  `);
  const dueDayPayloads = [
    { kind: "due_day", student_id: studentId, due_day: "20", expected_old_due_day: "31", effective_month: nextMonth, scope: "next_period" },
    { kind: "due_day", student_id: studentId, due_day: "21", expected_old_due_day: "31", effective_month: nextMonth, scope: "next_period" },
  ];
  const dueDayResults = await Promise.all(clients.map((client, index) =>
    client.query(
      "select public.cueva_billing_write($1::uuid,$2::jsonb) as operation_id",
      [dueDayOperations[index], JSON.stringify(dueDayPayloads[index])],
    ),
  ));
  const dueDaySuccesses = dueDayResults.filter(result => result.rows[0].operation_id !== null);
  const dueDayRejections = dueDayResults.filter(result => result.rows[0].operation_id === null);
  assert.equal(dueDaySuccesses.length, 1, "exactly one concurrent due-day change succeeds");
  assert.equal(dueDayRejections.length, 1, "the competing stale due-day preview is rejected");

  const { rows: dueSchedules } = await admin.query(
    "select due_day from public.cueva_due_schedules where student_id=$1 and effective_month=($2||'-01')::date order by recorded_at desc,id desc",
    [studentId, nextMonth],
  );
  assert.equal(dueSchedules.length, 1, "the race leaves exactly one effective schedule for the month");
  assert.ok([20, 21].includes(dueSchedules[0].due_day), "the winning due-day value is persisted");

  const { rows: dueAudit } = await admin.query(
    "select count(*)::integer as total from public.cueva_due_date_audit where student_id=$1",
    [studentId],
  );
  const { rows: dueAttempts } = await admin.query(
    "select count(*)::integer as total from public.cueva_due_date_attempts where student_id=$1",
    [studentId],
  );
  assert.equal(dueAudit[0].total, 1, "only the winning due-day change is audited as applied");
  assert.equal(dueAttempts[0].total, 1, "the stale competing change is retained as a rejected attempt");
  process.stdout.write("PASS: concurrent period creation is unique and concurrent due-day changes reject stale previews.\n");
} finally {
  await Promise.all(clients.map(client => client.end().catch(() => undefined)));
  if (adminConnected) {
    try {
      await admin.query("delete from public.cueva_due_date_audit where student_id=$1", [studentId]);
      await admin.query("delete from public.cueva_due_date_attempts where student_id=$1", [studentId]);
      await admin.query("delete from public.cueva_periods where student_id=$1", [studentId]);
      await admin.query("delete from public.cueva_students where id=$1", [studentId]);
      await admin.query("delete from public.cueva_prices where id=$1", [priceOperation]);
      await admin.query("delete from cueva_private.billing_operations where id = any($1::uuid[])", [[priceOperation, ...periodOperations, ...dueDayOperations]]);
      await admin.query("delete from public.cueva_profiles where user_id=$1", [userId]);
      await admin.query("delete from cueva_private.access_state where user_id=$1", [userId]);
      await admin.query("delete from auth.sessions where id=$1", [sessionId]);
      await admin.query("delete from auth.users where id=$1", [userId]);
    } finally {
      await admin.end();
    }
  }
}

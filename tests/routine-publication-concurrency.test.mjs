import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const connectionString = process.env.CUEVA_TEST_DATABASE_URL
  ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const admin = new Client({ connectionString, application_name: "cueva-routine-race-admin" });
const admins = [randomUUID(), randomUUID()];
const sessions = [randomUUID(), randomUUID()];
const studentId = randomUUID();
const saveId = randomUUID();
const publicationIds = [randomUUID(), randomUUID()];
const clients = admins.map((_, index) => new Client({
  connectionString,
  application_name: `cueva-routine-publisher-${index + 1}`,
}));
let connected = false;
let firstTransactionOpen = false;

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
  throw new Error(`Timed out waiting for routine publication lock: ${applicationName}`);
}

async function publish(client, operationId) {
  return client.query(
    `select public.cueva_routine_text_write(
       'publish',$1::uuid,1,'',null,$2::uuid,null,'text',
       'Rutina concurrente de prueba','[]'::jsonb
     ) as publication`,
    [studentId, operationId],
  );
}

try {
  await admin.connect();
  await Promise.all(clients.map(client => client.connect()));
  connected = true;

  for (let index = 0; index < admins.length; index += 1) {
    await admin.query(
      `insert into auth.users(id,aud,role,email,created_at,updated_at)
       values($1,'authenticated','authenticated',$2,now(),now())`,
      [admins[index], `routine-race-${admins[index]}@example.test`],
    );
    await admin.query(
      `insert into auth.sessions(id,user_id,created_at,updated_at)
       values($1,$2,now(),now())`,
      [sessions[index], admins[index]],
    );
    await admin.query(
      `insert into cueva_private.access_state(user_id,ready,session_not_before)
       values($1,true,now()-interval '1 minute')`,
      [admins[index]],
    );
    await admin.query(
      "insert into public.cueva_profiles(user_id,role) values($1,'admin')",
      [admins[index]],
    );
    await clients[index].query("set role authenticated");
    await clients[index].query(
      "select set_config('request.jwt.claim.sub',$1,false)",
      [admins[index]],
    );
    await clients[index].query(
      "select set_config('request.jwt.claims',$1,false)",
      [JSON.stringify({
        sub: admins[index],
        role: "authenticated",
        session_id: sessions[index],
      })],
    );
  }

  await admin.query(
    `insert into public.cueva_students(id,first_name,last_name,email,joined_on)
     values($1,'Routine','Race',$2,date '2026-01-01')`,
    [studentId, `routine-race-student-${studentId}@example.test`],
  );

  const draft = await clients[0].query(
    `select public.cueva_routine_text_write(
       'draft',$1::uuid,0,'',null,$2::uuid,null,'text',
       'Rutina concurrente de prueba','[]'::jsonb
     ) as document`,
    [studentId, saveId],
  );
  assert.equal(draft.rows[0].document.revision, 1,
    "the initial text draft is committed before concurrent publication");

  // Keep publisher 1's transaction open after it acquires the advisory lock.
  await clients[0].query("begin");
  firstTransactionOpen = true;
  const firstAttempt = await publish(clients[0], publicationIds[0]);

  // Publisher 2 uses a distinct authenticated administrator and operation ID.
  // Publisher 1's successful return proves it acquired the lock; its transaction
  // remains open so publisher 2 must wait until the first snapshot commits.
  const secondAttempt = publish(clients[1], publicationIds[1]);
  await waitForLockWait("cueva-routine-publisher-2");

  await clients[0].query("commit");
  firstTransactionOpen = false;

  assert.ok(firstAttempt.rows[0].publication,
    "the first administrator receives the committed publication");

  const secondResult = await Promise.allSettled([secondAttempt]);
  assert.equal(secondResult[0].status, "rejected",
    "the competing administrator cannot create a second publication");
  assert.equal(secondResult[0].reason.code, "40001",
    "the competing stale publication is rejected as a serialization conflict");

  const { rows: [snapshot] } = await admin.query(
    `select count(*)::integer as base_count,
            count(text_document.publication_id)::integer as text_count,
            min(publication.id::text) as publication_id,
            min(publication.published_by::text) as published_by
       from public.cueva_routine_publications publication
       left join public.cueva_routine_text_publications text_document
         on text_document.publication_id = publication.id
      where publication.student_id = $1 and publication.draft_revision = 1`,
    [studentId],
  );
  assert.equal(snapshot.base_count, 1,
    "exactly one base publication exists for the draft revision");
  assert.equal(snapshot.text_count, 1,
    "the winning base publication has exactly one text snapshot");
  assert.equal(snapshot.publication_id, publicationIds[0],
    "the first serialized publisher owns the immutable snapshot");
  assert.equal(snapshot.published_by, admins[0],
    "the snapshot records the authenticated winning administrator");

  process.stdout.write(
    "PASS: two authenticated administrators publish the same revision concurrently; PostgreSQL serializes them and leaves one atomic publication snapshot.\\n",
  );
} finally {
  if (firstTransactionOpen) {
    await clients[0].query("rollback").catch(() => undefined);
  }
  if (connected) {
    await Promise.all(clients.map(client => client.end().catch(() => undefined)));
  }
  // The test runs only against the disposable Supabase stack created by CI.
  // Published rows are immutable and intentionally remain as audit fixtures.
  await admin.end().catch(() => undefined);
}

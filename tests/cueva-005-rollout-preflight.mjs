// Standalone smoke test. Install PGlite in a disposable directory outside the repo.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { buildReminderPlan } from '../src/lib/notifications/core.ts';

if (!process.argv[2]) throw new Error('Pass the directory containing the temporary PGlite install');
const { PGlite } = createRequire(resolve(process.argv[2], 'fixture.cjs'))('@electric-sql/pglite');
const read = (path) => readFileSync(path, 'utf8');
const ops = (file) => read(`docs/operations/CUEVA-005-${file}.sql`);
const manifest = JSON.parse(read('docs/operations/CUEVA-005-migration-manifest.json'));
const hosted = JSON.parse(read('docs/operations/CUEVA-005-hosted-baseline.json'));
assert.equal(manifest.project, hosted.project);
assert.equal(manifest.migrations.length, 12);
assert.equal(new Set(manifest.migrations.map(migration => migration.name)).size, 12);
assert.deepEqual(
  manifest.migrations.map(migration => migration.gitVersion),
  manifest.migrations.map(migration => migration.gitVersion).sort(),
);
assert.ok(manifest.migrations.every(migration => !hosted.history.some(row => row.name === migration.name)));
const now = new Date('2026-11-16T15:05:00Z'); // 12:05 in Buenos Aires
const planned = (dueOn) => buildReminderPlan({
  dueOn, periodMonth: '2026-11-01', balanceCents: 10000n, studentActive: true,
}, '12:00', now).filter(candidate => candidate.ready).map(candidate => candidate.reminderDays);
assert.deepEqual(planned('2026-11-21'), [5]);
assert.deepEqual(planned('2026-11-17'), [5, 1]);
console.log('PASS: explicit manifest excludes deployed history and pilot fixture has one eligible reminder');

const db = await PGlite.create();
try {
  await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; grant usage on schema auth to authenticated, service_role;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, last_sign_in_at timestamptz);
  create table auth.sessions(id uuid primary key, user_id uuid, created_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
  create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid, bucket_id text, name text, metadata jsonb);
  alter table storage.objects enable row level security;
  `);
  const firstMigration = manifest.migrations[0].gitVersion;
  const baselineFiles = readdirSync('supabase/migrations')
    .filter(file => file.endsWith('.sql') && file.slice(0, 14) < firstMigration)
    .sort();
  for (const file of baselineFiles) {
    await applySql(`supabase/migrations/${file}`);
  }
  const contract = read('supabase/standalone-tests/hosted-schema-compatibility.sql');
  await db.exec(`begin read only; set local plpgsql.check_asserts=on; ${contract} rollback;`);
  const baseline = (await db.query(ops('finance-fingerprint'))).rows;
  assert.equal(baseline[0].shared_payment_lock, true);
  for (const migration of manifest.migrations) {
    const hash = createHash('sha256').update(readFileSync(migration.file)).digest('hex');
    assert.equal(hash, migration.sha256, migration.file);
    await applySql(migration.file);
  }
  await db.exec(`begin read only; ${ops('schema-postflight')} rollback;`);
  assert.deepEqual((await db.query(ops('finance-fingerprint'))).rows, baseline);
  console.log('PASS: baseline contract, exact twelve files, schema postflight and unchanged finance fingerprint');
  await db.exec(`
  create schema cron; create schema vault; create schema net;
  create table cron.job(jobid bigint generated always as identity primary key, jobname text, schedule text, command text, active boolean default true, database text default current_database());
  create table vault.decrypted_secrets(name text, decrypted_secret text);
  create table net.http_request_queue(id bigint generated always as identity, url text, body jsonb, headers jsonb, timeout integer);
  create function cron.schedule(text,text,text) returns bigint language sql as $$ insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid $$;
  create function cron.alter_job(job_id bigint, active boolean) returns void language sql as $$ update cron.job set active=$2 where jobid=$1 $$;
  create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds integer) returns bigint language sql as $$ insert into net.http_request_queue(url,body,headers,timeout) values($1,$2,$3,$4) returning id $$;
  insert into cron.job(jobname,schedule,command) values('other','0 0 * * *','select 1');
  insert into vault.decrypted_secrets values ('cueva_notifications_worker_url','https://invalid.example.test'), ('cueva_notifications_worker_secret',repeat('x',48));
  `);
  const enable = ops('cron-enable');
  await rejectInstall('wrong origin vetoes installation', /Vault configuration invalid/);
  await db.exec(`
    update vault.decrypted_secrets
    set decrypted_secret='https://cueva-gym.vercel.app/api/notifications/worker'
    where name='cueva_notifications_worker_url';
    grant select(headers) on net.http_request_queue to authenticated;
  `);
  await rejectInstall('column read grant vetoes installation', /accessible to API roles/);
  await db.exec(`
    revoke select(headers) on net.http_request_queue from authenticated;
    grant update(url) on net.http_request_queue to anon;
  `);
  await rejectInstall('column write grant vetoes installation', /accessible to API roles/);
  await db.exec('revoke update(url) on net.http_request_queue from anon;');
  await db.exec(enable);
  await rejectInstall('duplicate install vetoed', /already exists/);
  const { rows: [{ command }] } = await db.query(`
    select command from cron.job where jobname='cueva-notifications-worker'
  `);
  assert.ok(!command.includes('x'.repeat(48)));
  await db.exec(command);
  const queued = await db.query(`
    select count(*)::int as total,
      bool_and(url='https://cueva-gym.vercel.app/api/notifications/worker'
        and body='{}'::jsonb and headers->>'Content-Type'='application/json'
        and headers->>'Authorization'='Bearer '||repeat('x',48) and timeout=65000) as match
    from net.http_request_queue
  `);
  assert.deepEqual(queued.rows, [{ total: 1, match: true }]);
  await db.exec(ops('cron-stop'));
  const jobs = await db.query('select jobname, active from cron.job order by jobname');
  assert.deepEqual(jobs.rows, [
    { jobname: 'cueva-notifications-worker', active: false },
    { jobname: 'other', active: true },
  ]);
  console.log('PASS: one enqueue with exact POST arguments and dedicated stop preserves other jobs (extensions simulated)');

  async function rejectInstall(label, error) {
    await assert.rejects(db.exec(enable), error);
    await db.exec('rollback');
    console.log(`PASS: ${label}`);
  }
} finally {
  await db.close();
}

async function applySql(file) {
  try {
    await db.exec(read(file));
  } catch (error) {
    throw new Error(`${file}: ${error.message}`, { cause: error });
  }
}

// Focused SQL boundary test: Auth/Storage tables below are synthetic, not services.
// Full Supabase-schema replay remains covered by the PR's native CI matrix.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const image = "public.ecr.aws/supabase/postgres@sha256:c141fd17ac6a76c4323e90b3aee8ff1a23d2e89e547c2b963cfadc309c079cc2";
const name = `cueva-006d-json-${randomUUID()}`;
const label = "cueva-006d-json-types";
const dbName = "cueva_mentions_validation";
const docker = (args, input, env) => execFileSync("docker", args, {
  encoding:"utf8", input, stdio:["pipe","pipe","pipe"], ...(env ? {env:{...process.env,...env}} : {}),
});
const sql = input => docker(["exec","-i",name,"psql","-U","postgres","-d",dbName,"-v","ON_ERROR_STOP=1"], input);
const migrations = [
  "20261102151526_cueva_product_access.sql", "20261104090000_cueva_students.sql",
  "20261104120000_cueva_student_invitations.sql", "20261106142345_cueva_routines.sql",
  "20261106145843_cueva_structured_routines.sql", "20261106223307_cueva_routine_days.sql",
  "20261106223644_cueva_exercise_videos.sql", "20261114120000_cueva_student_assigned_exercises.sql",
  "20261115160000_cueva_my_routine_video_ids.sql", "20261116120000_cueva_routine_text_mentions.sql",
];
let created = false;
try {
  docker(["run","-d","--name",name,"--label",`cueva.task=${label}`,"--network","none",
    "--memory","768m","--cpus","1","--pids-limit","128","--log-driver","none",
    "-e","POSTGRES_PASSWORD",image], undefined, {POSTGRES_PASSWORD:randomBytes(32).toString("hex")});
  created = true;
  let ready = false;
  for (let i=0;i<60;i++) {
    try { docker(["exec",name,"pg_isready","-h","127.0.0.1","-U","postgres"]); ready=true; break; } catch {}
    await delay(250);
  }
  assert.ok(ready,"owned PostgreSQL readiness");
  docker(["exec",name,"psql","-U","postgres","-v","ON_ERROR_STOP=1","-c",`create database ${dbName}`]);
  sql(`
    do $$ begin
      if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
      if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role; end if;
    end $$;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,last_sign_in_at timestamptz,
      aud text,role text,created_at timestamptz,updated_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
    create extension pgtap;
  `);
  for (const migration of migrations) sql(readFileSync(`supabase/migrations/${migration}`,"utf8"));
  const result = sql(readFileSync("supabase/tests/cueva_student_assigned_exercises.test.sql","utf8"));
  const lines = result.split("\n").map(line=>line.trim()).filter(line=>/^(not ok|ok \d+|1\.\.|# (?:Failed test|Looks like| +caught:| +wanted:))/.test(line));
  console.log(lines.join("\n"));
  assert.ok(!lines.some(line=>line.startsWith("not ok") || /Looks like/.test(line)),"native SQL regression failed");
  assert.equal(lines.filter(line=>/^ok \d+/.test(line)).length,60,"all declared SQL assertions ran");
  console.log("PASS: native PostgreSQL validates mention types and atomic rejection; no Auth/Storage service or hosted proof is claimed.");
} finally {
  if (created) {
    const owner = docker(["inspect","--format",'{{index .Config.Labels "cueva.task"}}',name]).trim();
    assert.equal(owner,label,"only the owned SQL container may be stopped");
    docker(["stop","-t","5",name]);
    docker(["rm","-v",name]);
  }
}

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import {smtpRepairBinding} from './smtp-repair-binding.mjs';

class ReconciliationStop extends Error {}
const stop = code => { throw new ReconciliationStop(code); };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const project = 'vbkzoojkdkcugxhneyzi';

export function reconciliationDatabaseOptions(database, local=false) {
  let d,user;
  try { d=new URL(database);user=decodeURIComponent(d.username);decodeURIComponent(d.password); }
  catch { stop('DATABASE_INVALID'); }
  if (!['postgres:','postgresql:'].includes(d.protocol) || d.pathname!=='/postgres' ||
      d.search || d.hash || database.includes('?') || database.includes('#')) stop('DATABASE_INVALID');
  if (local) {
    if(d.hostname!=='127.0.0.1')stop('DATABASE_INVALID');
  } else {
    const direct=d.hostname===`db.${project}.supabase.co` && user==='postgres' && (!d.port||d.port==='5432');
    const session=d.hostname==='aws-1-ca-central-1.pooler.supabase.com' && user===`postgres.${project}` && d.port==='5432';
    if(!direct&&!session)stop('DATABASE_INVALID');
    // Keep an omitted direct port from falling back to PGPORT in the driver.
    d.port='5432';
  }
  return {connectionString:d.href,ssl:local?false:{rejectUnauthorized:true},connectionTimeoutMillis:10000};
}

function validate(config) {
  const r = config.request;
  const reauthorize=r?.previousAttemptId!==undefined;
  if (!r || ![r.studentId,r.jobLease,r.authUserId,r.attemptId].every(uuid) || r.attemptId.toLowerCase() === r.jobLease.toLowerCase() ||
      !Number.isSafeInteger(r.generation) || r.generation < 1 || r.generation > 999999999999998 ||
      r.expectedState !== 'review' || typeof r.email !== 'string' || r.email !== r.email.trim().toLowerCase() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email) || r.email.length > 254) stop('REQUEST_INVALID');
  const proof = r.priorRejection;
  const diagnosticValid=proof&&(proof.smtpCode===535&&proof.diagnostic==='BadCredentials'||
    reauthorize&&proof.smtpCode===534&&proof.diagnostic==='Application-specific password required');
  // Trusted operator attestation, not a claim that the SDK can prove SMTP delivery.
  if (!diagnosticValid ||
      !/^[0-9a-f]{64}$/.test(proof.evidenceSha256 ?? '') || !Number.isFinite(Date.parse(proof.observedAt)) ||
      Date.parse(proof.observedAt) > Date.now() || r.requestsQuiescent !== true ||
      r.noSmtpAcceptance !== true || r.originalRequestCompleted !== true) stop('REJECTION_EVIDENCE_REQUIRED');
  if (typeof config.evidence !== 'string' || Buffer.byteLength(config.evidence)>16384 ||
      createHash('sha256').update(config.evidence).digest('hex') !== proof.evidenceSha256) stop('EVIDENCE_FILE_MISMATCH');
  const record = JSON.parse(config.evidence);
  if (record.source !== 'operator-reviewed-smtp-rejection' || record.smtpCode !== proof.smtpCode || record.diagnostic !== proof.diagnostic ||
      record.studentId !== r.studentId || record.jobLease !== r.jobLease || record.authUserId !== r.authUserId ||
      record.email !== r.email || record.generation !== r.generation || record.observedAt !== proof.observedAt ||
      record.originalRequestCompleted !== true || record.noSmtpAcceptance !== true || record.requestsQuiescent !== true) stop('EVIDENCE_RECORD_MISMATCH');
  if(reauthorize){
    if(!uuid(r.previousAttemptId)||r.jobLease!==r.previousAttemptId||r.generation!==2||
      !/^[0-9a-f]{64}$/.test(r.previousAuthorizationHash??'')||!/^[0-9a-f]{64}$/.test(r.smtpLoginSha256??'')||
      r.supabaseSmtpConfigReviewed!==true||record.previousAttemptId!==r.previousAttemptId||
      record.previousAuthorizationHash!==r.previousAuthorizationHash||!/^[0-9a-f]{64}$/.test(record.providerResponseSha256??'')||
      record.smtpEnhancedCode!==(proof.smtpCode===534?'5.7.9':'5.7.8'))stop('REAUTHORIZATION_INVALID');
    if(typeof config.repairEvidence!=='string'||Buffer.byteLength(config.repairEvidence)>16384||
      createHash('sha256').update(config.repairEvidence).digest('hex')!==r.smtpRepairEvidenceSha256)stop('SMTP_REPAIR_EVIDENCE_REQUIRED');
    const repair=JSON.parse(config.repairEvidence);
    if(repair.source!=='cueva-smtp-auth-preflight-v1'||repair.provider!=='brevo'||repair.tlsVerified!==true||
      repair.smtpAuthenticated!==true||repair.noMailCommands!==true||repair.supabaseSmtpConfigReviewed!==true||
      repair.binding!==smtpRepairBinding(r)||repair.smtpLoginSha256!==r.smtpLoginSha256||
      !Number.isFinite(Date.parse(repair.checkedAt))||Date.parse(repair.checkedAt)<Date.parse(proof.observedAt)||Date.parse(repair.checkedAt)>Date.now()||
      (config.local?repair.localSynthetic!==true||repair.host!=='127.0.0.1':repair.localSynthetic!==false||repair.host!=='smtp-relay.brevo.com'||repair.port!==587))stop('SMTP_REPAIR_EVIDENCE_INVALID');
  }
  for (const value of [config.url,config.site]) {
    const u = new URL(value);
    if (u.origin !== value || u.username || u.password) stop('ORIGIN_INVALID');
    if (config.local && (u.protocol !== 'http:' || u.hostname !== '127.0.0.1' || !u.port)) stop('LOCAL_TARGET_INVALID');
  }
  if (!config.local && (config.url !== `https://${project}.supabase.co` || config.site !== 'https://cueva-gym.vercel.app')) stop('PROJECT_MISMATCH');
  return reconciliationDatabaseOptions(config.database,config.local);
}

// Lock in application order: fiche -> job -> gate -> profile -> Auth user.
async function snapshot(db, r) {
  const fiche = (await db.query('select email from public.cueva_students where id=$1 for update',[r.studentId])).rows[0];
  const job = (await db.query('select * from public.cueva_student_invitations where student_id=$1 for update',[r.studentId])).rows[0];
  const gate = (await db.query('select * from cueva_private.access_state where user_id=$1 for update',[r.authUserId])).rows[0];
  const profile = (await db.query('select role from public.cueva_profiles where user_id=$1 for update',[r.authUserId])).rows[0];
  const user = (await db.query('select email,email_confirmed_at,last_sign_in_at,deleted_at,banned_until from auth.users where id=$1 for update',[r.authUserId])).rows[0];
  const sessions = (await db.query('select exists(select 1 from auth.sessions where user_id=$1) as present',[r.authUserId])).rows[0].present;
  const safe = fiche?.email === r.email && job?.email === r.email && job?.user_id === r.authUserId &&
    profile?.role === 'alumno' && user?.email === r.email && user.email_confirmed_at === null &&
    user.last_sign_in_at === null && user.deleted_at === null && user.banned_until === null && !sessions &&
    gate && !gate.ready && gate.allowed_session === null;
  return {job,gate,safe};
}

export async function reconcile(config, mode='check') {
  const databaseOptions=validate(config);
  if (!['check','apply'].includes(mode)) stop('MODE_INVALID');
  const r = config.request;
  const evidenceHash = createHash('sha256').update(JSON.stringify(r)).digest('hex');
  const db = new pg.Client(databaseOptions);
  let transaction = false, reserved = false, resultState;
  try {
    await db.connect();
    // No expiry, takeover, network retry or attempt resumption.
    const lock = await db.query('select pg_try_advisory_lock(hashtextextended($1, 20261104)) as acquired',[r.studentId]);
    if (!lock.rows[0].acquired) return {mode:'NO_SEND',state:'busy'};
    const previous = (await db.query('select * from cueva_private.invitation_reconciliation where student_id=$1',[r.studentId])).rows[0];
    const reauthorize=r.previousAttemptId!==undefined;
    if (previous && previous.attempt_id===r.attemptId) {
      if (previous.attempt_id !== r.attemptId || previous.source_lease !== r.jobLease || previous.user_id !== r.authUserId ||
          previous.source_generation !== String(r.generation) || previous.evidence_hash !== evidenceHash ||
          (reauthorize&&previous.previous_attempt_id!==r.previousAttemptId)) stop('ATTEMPT_ALREADY_EXISTS');
      return {mode:'NO_SEND',state:previous.state};
    }
    if(previous&&(!reauthorize||previous.attempt_id!==r.previousAttemptId))stop('ATTEMPT_ALREADY_EXISTS');
    if(reauthorize&&!previous)stop('PREVIOUS_ATTEMPT_REQUIRED');
    await db.query('begin'); transaction = true;
    await db.query("set local lock_timeout='5s'");
    const current = await snapshot(db,r);
    let prior;
    if(reauthorize){
      prior=(await db.query('select * from cueva_private.invitation_reconciliation where student_id=$1 for update',[r.studentId])).rows[0];
      if(!prior||prior.attempt_id!==r.previousAttemptId||prior.evidence_hash!==r.previousAuthorizationHash||
        prior.student_id!==r.studentId||prior.user_id!==r.authUserId||prior.email!==r.email||prior.state!=='uncertain'||
        prior.source_generation!=='1'||prior.previous_attempt_id!==null||prior.finished_at===null||
        r.attemptId===prior.source_lease)stop('PREVIOUS_ATTEMPT_NOT_ELIGIBLE');
    }
    if (!current.safe || current.job.state !== r.expectedState || current.job.lease !== r.jobLease ||
        current.gate.generation !== String(r.generation) || current.gate.operation_id !== (reauthorize?r.previousAttemptId:null) ||
        current.gate.operation_kind !== (reauthorize?'invite-resend':null) || !/^[0-9a-f]{64}$/.test(current.gate.nonce_hash ?? '')) stop('PRECONDITIONS_FAILED');
    if (Date.parse(r.priorRejection.observedAt) < new Date(current.job.requested_at).getTime()) stop('EVIDENCE_PREDATES_JOB');
    if (mode === 'check') { await db.query('rollback'); transaction = false; return {mode:'CHECKED_NO_SEND',state:'eligible'}; }
    if (!config.key) stop('SERVICE_KEY_REQUIRED');
    const nonce = randomBytes(32).toString('hex');
    if(reauthorize){
      await db.query(`insert into cueva_private.invitation_reconciliation_history
        (attempt_id,student_id,successor_attempt_id,authorization_hash,rejection_hash,repair_hash,prior_row)
        select attempt_id,student_id,$2,$3,$4,$5,to_jsonb(r) from cueva_private.invitation_reconciliation r where student_id=$1 and attempt_id=$6`,
        [r.studentId,r.attemptId,evidenceHash,r.priorRejection.evidenceSha256,r.smtpRepairEvidenceSha256,r.previousAttemptId]);
      const replaced=await db.query(`update cueva_private.invitation_reconciliation set attempt_id=$2,source_lease=$3,
        source_generation=$4,evidence_hash=$5,state='reserved',reserved_at=clock_timestamp(),finished_at=null,previous_attempt_id=$3
        where student_id=$1 and attempt_id=$3 and state='uncertain'`,[r.studentId,r.attemptId,r.previousAttemptId,r.generation,evidenceHash]);
      if(replaced.rowCount!==1)stop('RESERVATION_NOT_REPLACED');
    }else await db.query(`insert into cueva_private.invitation_reconciliation
      (student_id,attempt_id,source_lease,user_id,source_generation,email,evidence_hash,state)
      values($1,$2,$3,$4,$5,$6,$7,'reserved')`,[r.studentId,r.attemptId,r.jobLease,r.authUserId,r.generation,r.email,evidenceHash]);
    await db.query(`update cueva_private.access_state set generation=generation+1,nonce_hash=$2,
      operation_id=$3,operation_kind='invite-resend',session_not_before=clock_timestamp() where user_id=$1`,
      [r.authUserId,createHash('sha256').update(nonce).digest('hex'),r.attemptId]);
    await db.query("update public.cueva_student_invitations set state='processing',lease=$2,finished_at=null where student_id=$1",[r.studentId,r.attemptId]);
    await db.query('commit'); transaction = false; reserved = true;
    // Test hooks emulate process death, never enabled by CLI/environment.
    if (config.local && config.testHooks?.afterReserve) await config.testHooks.afterReserve();
    await db.query("update cueva_private.invitation_reconciliation set state='dispatching' where attempt_id=$1 and state='reserved'",[r.attemptId]);
    const service = createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
      const target = new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      if (target.origin !== config.url || target.pathname !== '/auth/v1/invite') stop('UNEXPECTED_AUTH_OPERATION');
      return (config.local && config.fetch ? config.fetch : fetch)(input,{...init,signal:AbortSignal.timeout(20000)});
    }}});
    const redirect = new URL('/aceptar-invitacion',config.site);
    redirect.search = new URLSearchParams({nonce,generation:String(r.generation+1),type:'invite'}).toString();
    resultState = 'uncertain';
    try {
      const sent = await service.auth.admin.inviteUserByEmail(r.email,{redirectTo:redirect.href});
      // A 5xx from GoTrue does not establish a new SMTP rejection: keep uncertain.
      if (!sent.error && sent.data.user?.id === r.authUserId) resultState = 'accepted';
    } catch { /* Network/process ambiguity must never authorize another send. */ }
    if (config.local && config.testHooks?.afterSend) await config.testHooks.afterSend();
    await db.query('begin'); transaction = true;
    await db.query("set local lock_timeout='5s'");
    const after = await snapshot(db,r);
    if (!after.safe || after.job?.lease !== r.attemptId || after.job?.state !== 'processing' ||
        after.gate?.operation_id !== r.attemptId || after.gate?.operation_kind !== 'invite-resend' ||
        after.gate?.generation !== String(r.generation+1)) resultState = 'uncertain';
    await db.query('update cueva_private.invitation_reconciliation set state=$2,finished_at=clock_timestamp() where attempt_id=$1',[r.attemptId,resultState]);
    await db.query("update public.cueva_student_invitations set state=$3,finished_at=clock_timestamp() where student_id=$1 and lease=$2 and state='processing'",[r.studentId,r.attemptId,resultState==='accepted'?'sent':'review']);
    if (resultState === 'accepted') await db.query("update cueva_private.access_state set operation_id=null,operation_kind=null where user_id=$1 and operation_id=$2 and operation_kind='invite-resend' and not ready",[r.authUserId,r.attemptId]);
    await db.query('commit'); transaction = false;
    return {mode:'APPLIED',state:resultState};
  } catch (error) {
    // Durable reservation remains closed after interruption, including before SMTP.
    if (reserved) stop('ATTEMPT_REQUIRES_REVIEW_NO_RETRY');
    if (error instanceof ReconciliationStop) throw error;
    stop('OPERATION_STOPPED_NO_AUTOMATIC_RETRY');
  } finally {
    if (transaction) await db.query('rollback').catch(()=>{});
    await db.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length!==3 || !['--check','--apply'].includes(process.argv[2])) stop('ARGUMENTS_INVALID');
    const env = process.env;
    const raw = await readFile(env.CUEVA_RECONCILIATION_REQUEST);
    if (raw.length>16384) stop('REQUEST_TOO_LARGE');
    const evidence = await readFile(env.CUEVA_RECONCILIATION_EVIDENCE,'utf8');
    const request=JSON.parse(raw.toString('utf8'));
    const repairEvidence=request.previousAttemptId!==undefined?await readFile(env.CUEVA_SMTP_REPAIR_EVIDENCE,'utf8'):undefined;
    const result = await reconcile({url:env.CUEVA_SUPABASE_URL,site:env.CUEVA_PRODUCT_ORIGIN,
      database:env.CUEVA_OPERATIONS_DATABASE_URL,key:env.CUEVA_SERVICE_KEY,request,evidence,repairEvidence,local:false},process.argv[2].slice(2));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({mode:'STOPPED',code:error instanceof ReconciliationStop?error.message:'INVALID_INPUT_OR_UNKNOWN_STATE'}));
    process.exitCode=1;
  }
}

import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {reconcile} from '../../scripts/reconcile-student-invitation.mjs';
import {verifySmtpRepair} from '../../tools/cueva-smtp/preflight.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
export async function runBrowserFlow({base,rest,mailBase,gateBase,admin,anon,id,password,launch,chromium,dbPort,dbPassword,coordinatorPassword,pg,request,note,smtpPort,smtpCa}){
  const db=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'postgres',password:dbPassword});
  const q=async(text,values)=>(await db.query(text,values)).rows;
  const check=(name,ok)=>{note(name,ok?'PASS':'FAIL');if(!ok)throw Error('ASSERTION');};
  const fetchLocal=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);return fetch(`${u.pathname.startsWith('/auth/v1/')?base:rest}${u.pathname.replace(/^\/(auth|rest)\/v1/,'')}${u.search}`,init);};
  const service=createClient(base,admin,{global:{fetch:fetchLocal},auth:{persistSession:false,autoRefreshToken:false}});
  const status=async()=>await(await request(`${gateBase}/status`)).json();
  const control=async mode=>await request(`${gateBase}/${mode}`,{method:'POST'});
  const count=async()=>(await(await request(`${mailBase}/api/v1/messages`)).json()).total;
  let app,browser,step='setup';
  const config=f=>({local:true,url:base,site:app.origin,key:admin,database:`postgres://postgres:${dbPassword}@127.0.0.1:${dbPort}/postgres`,request:f.r,evidence:f.evidence,repairEvidence:f.repairEvidence,fetch:fetchLocal});
  async function stopped(name,c,expected){let code;try{await reconcile(c,'apply');}catch(e){code=e.message;}check(name,code===expected);}
  async function repair(f){
    await control('repair');
    const before=await status();
    const proof=await verifySmtpRepair({local:true,port:smtpPort,ca:smtpCa,request:f.r,username:'synthetic',password:'synthetic-only'});
    const after=await status();
    if(after.authSuccess!==before.authSuccess+1||after.mailCommands!==before.mailCommands||after.messages!==before.messages)throw Error('PREFLIGHT_SENT_MAIL');
    f.repairEvidence=JSON.stringify(proof);f.r.smtpRepairEvidenceSha256=hash(f.repairEvidence);return f;
  }
  async function fixture(label){
    await control('reject/535');
    const student=randomUUID(),lease=randomUUID(),nonce=randomBytes(32).toString('hex'),email=`reauth-${label}-${id}@example.com`;
    const made=await service.auth.admin.createUser({email,email_confirm:false});if(made.error)throw Error('FIXTURE_USER');const user=made.data.user.id;
    await db.query("insert into public.cueva_students values($1,'Synthetic','Reauthorization',$2,null,'2026-11-05',true)",[student,email]);
    await db.query("insert into public.cueva_student_invitations(student_id,email,state,lease,requested_by) values($1,$2,'processing',$3,$4)",[student,email,lease,user]);
    const prep=await service.rpc('cueva_prepare_student_invitation',{student,claim:lease,created_user:user,nonce_hash:hash(nonce)});if(prep.data!==true)throw Error('FIXTURE_PREPARE');
    const rejected=await service.auth.admin.inviteUserByEmail(email,{redirectTo:`${app.origin}/aceptar-invitacion?nonce=${nonce}&generation=1&type=invite`});if(!rejected.error)throw Error('INITIAL_REJECTION_MISSING');
    await service.rpc('cueva_finish_student_invitation',{student,claim:lease,outcome:'review'});
    const observedAt=new Date().toISOString();
    const evidence0=JSON.stringify({source:'operator-reviewed-smtp-rejection',studentId:student,jobLease:lease,authUserId:user,email,generation:1,smtpCode:535,diagnostic:'BadCredentials',observedAt,requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true});
    const r0={studentId:student,jobLease:lease,authUserId:user,email,generation:1,attemptId:randomUUID(),expectedState:'review',priorRejection:{smtpCode:535,diagnostic:'BadCredentials',observedAt,evidenceSha256:hash(evidence0)},requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true};
    await control('reject/534');const before=await status();
    const result=await reconcile({...config({r:r0,evidence:evidence0})},'apply');const after=await status();
    if(result.state!=='uncertain'||after.authRejected<=before.authRejected||after.code!==534)throw Error('RETAINED_534_NOT_OBSERVED');
    const old=(await q('select to_jsonb(r) as snapshot from cueva_private.invitation_reconciliation r where student_id=$1',[student]))[0].snapshot;
    const gate=(await q('select * from cueva_private.access_state where user_id=$1',[user]))[0];
    const recordedAt=new Date().toISOString();
    const evidence=JSON.stringify({source:'operator-reviewed-smtp-rejection',studentId:student,jobLease:r0.attemptId,authUserId:user,email,generation:2,
      previousAttemptId:r0.attemptId,previousAuthorizationHash:old.evidence_hash,smtpCode:534,smtpEnhancedCode:'5.7.9',diagnostic:'Application-specific password required',
      providerResponseSha256:hash(`534 5.7.9 Application-specific password required; synthetic rejection ${after.authRejected}`),observedAt:recordedAt,requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true});
    const r={studentId:student,jobLease:r0.attemptId,authUserId:user,email,generation:2,attemptId:randomUUID(),expectedState:'review',previousAttemptId:r0.attemptId,
      previousAuthorizationHash:old.evidence_hash,smtpLoginSha256:hash('synthetic'),supabaseSmtpConfigReviewed:true,
      priorRejection:{smtpCode:534,diagnostic:'Application-specific password required',observedAt:recordedAt,evidenceSha256:hash(evidence)},requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true};
    if(gate.generation!=='2'||gate.operation_id!==r.previousAttemptId||gate.operation_kind!=='invite-resend'||gate.ready)throw Error('GEN2_FIXTURE');
    return {r,evidence,old,r0,evidence0,nonceHash:gate.nonce_hash};
  }
  try{
    await db.connect();app=await launch({authBase:base,restBase:rest,anonKey:anon,admin,dbPort,dbPassword:coordinatorPassword});
    const f=await fixture('positive');check('exact_gen2_uncertain_pending_after_real_534',await count()===0&&f.old.state==='uncertain');
    step='repair';await repair(f);check('tls_auth_preflight_succeeds_without_mail',await count()===0);
    const beforeBadCa=await status();let badCa=false;try{await verifySmtpRepair({local:true,port:smtpPort,ca:'not-a-ca',request:f.r,username:'synthetic',password:'synthetic-only'});}catch{badCa=true;}check('untrusted_tls_fails_before_auth',badCa&&(await status()).authCommands===beforeBadCa.authCommands);
    await control('no-auth');let missingAuth=false;try{await verifySmtpRepair({local:true,port:smtpPort,ca:smtpCa,request:f.r,username:'synthetic',password:'synthetic-only'});}catch{missingAuth=true;}check('tls_without_auth_is_not_repair_proof',missingAuth&&(await status()).authSuccess===beforeBadCa.authSuccess);
    await control('repair');let badPassword=false;try{await verifySmtpRepair({local:true,port:smtpPort,ca:smtpCa,request:f.r,username:'synthetic',password:'wrong-password'});}catch{badPassword=true;}check('wrong_smtp_credential_no_repair_proof',badPassword&&await count()===0);
    const c=config(f);step='negative_evidence';
    await stopped('repair_absent',{...c,repairEvidence:undefined},'SMTP_REPAIR_EVIDENCE_REQUIRED');
    await stopped('repair_tampered',{...c,repairEvidence:f.repairEvidence+' '},'SMTP_REPAIR_EVIDENCE_REQUIRED');
    await stopped('rejection_tampered',{...c,evidence:f.evidence+' '},'EVIDENCE_FILE_MISMATCH');
    await stopped('http500_not_rejection',{...c,request:{...f.r,priorRejection:{...f.r.priorRejection,smtpCode:500}}},'REJECTION_EVIDENCE_REQUIRED');
    await stopped('prior_acceptance_not_excluded',{...c,request:{...f.r,noSmtpAcceptance:false}},'REJECTION_EVIDENCE_REQUIRED');
    await stopped('request_not_completed',{...c,request:{...f.r,originalRequestCompleted:false}},'REJECTION_EVIDENCE_REQUIRED');
    await stopped('not_quiescent',{...c,request:{...f.r,requestsQuiescent:false}},'REJECTION_EVIDENCE_REQUIRED');
    await stopped('different_identity',{...c,request:{...f.r,authUserId:randomUUID()}},'EVIDENCE_RECORD_MISMATCH');
    await stopped('generation3_not_general_takeover',{...c,request:{...f.r,generation:3}},'EVIDENCE_RECORD_MISMATCH');
    const forged=JSON.stringify({...JSON.parse(f.repairEvidence),tlsVerified:false});await stopped('tls_proof_not_verified',{...c,repairEvidence:forged,request:{...f.r,smtpRepairEvidenceSha256:hash(forged)}},'SMTP_REPAIR_EVIDENCE_INVALID');
    await stopped('synthetic_proof_cannot_be_used_remotely',{...c,local:false},'SMTP_REPAIR_EVIDENCE_INVALID');
    step='negative_state';
    for(const state of ['accepted','reserved','dispatching']){await db.query('update cueva_private.invitation_reconciliation set state=$2 where student_id=$1',[f.r.studentId,state]);await stopped(`previous_${state}_refused`,c,'PREVIOUS_ATTEMPT_NOT_ELIGIBLE');}
    await db.query("update cueva_private.invitation_reconciliation set state='uncertain' where student_id=$1",[f.r.studentId]);
    await db.query('update cueva_private.invitation_reconciliation set evidence_hash=$2 where student_id=$1',[f.r.studentId,hash('different authorization')]);await stopped('previous_authorization_hash_must_match',c,'PREVIOUS_ATTEMPT_NOT_ELIGIBLE');await db.query('update cueva_private.invitation_reconciliation set evidence_hash=$2 where student_id=$1',[f.r.studentId,f.old.evidence_hash]);
    await db.query('update cueva_private.invitation_reconciliation set finished_at=null where student_id=$1',[f.r.studentId]);await stopped('unfinished_previous_request_refused',c,'PREVIOUS_ATTEMPT_NOT_ELIGIBLE');await db.query('update cueva_private.invitation_reconciliation set finished_at=$2 where student_id=$1',[f.r.studentId,f.old.finished_at]);
    await db.query('update cueva_private.access_state set operation_id=$2 where user_id=$1',[f.r.authUserId,randomUUID()]);await stopped('unrecognized_pending_operation',c,'PRECONDITIONS_FAILED');await db.query('update cueva_private.access_state set operation_id=$2 where user_id=$1',[f.r.authUserId,f.r.previousAttemptId]);
    await db.query('update auth.users set email_confirmed_at=now() where id=$1',[f.r.authUserId]);await stopped('confirmed_identity_refused',c,'PRECONDITIONS_FAILED');await db.query('update auth.users set email_confirmed_at=null where id=$1',[f.r.authUserId]);
    check('negative_cases_preserve_old_ledger_and_no_mail',(await q('select to_jsonb(r)=$2::jsonb as equal from cueva_private.invitation_reconciliation r where student_id=$1',[f.r.studentId,JSON.stringify(f.old)]))[0].equal&&await count()===0);
    check('check_eligible_no_archive',(await reconcile(c,'check')).mode==='CHECKED_NO_SEND'&&(await q('select count(*)::int as n from cueva_private.invitation_reconciliation_history'))[0].n===0);
    step='reserve_send';let calls=0;
    const usersBefore=(await q('select count(*)::int as n from auth.users'))[0].n;
    const runs=await Promise.all([1,2,3].map(()=>reconcile({...c,fetch:(...args)=>{calls++;return fetchLocal(...args);}},'apply')));
    check('concurrent_one_new_reservation_and_send',calls===1&&runs.filter(r=>r.mode==='APPLIED'&&r.state==='accepted').length===1&&runs.filter(r=>r.mode==='NO_SEND').length===2&&await count()===1);
    const history=(await q('select * from cueva_private.invitation_reconciliation_history where attempt_id=$1',[f.r.previousAttemptId]))[0];
    check('prior_snapshot_complete_and_exact',JSON.stringify(history.prior_row)===JSON.stringify(f.old)&&history.successor_attempt_id===f.r.attemptId&&history.rejection_hash===f.r.priorRejection.evidenceSha256&&history.repair_hash===f.r.smtpRepairEvidenceSha256);
    check('history_closed_to_api_roles',(await q("select bool_and(not has_table_privilege(r,'cueva_private.invitation_reconciliation_history',p)) as denied from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p"))[0].denied);
    const current=(await q('select r.*,g.generation,g.ready,g.operation_id,g.nonce_hash from cueva_private.invitation_reconciliation r join cueva_private.access_state g using(user_id) where r.student_id=$1',[f.r.studentId]))[0];
    check('same_uuid_profile_fiche_gen3_not_ready',current.user_id===f.r.authUserId&&current.previous_attempt_id===f.r.previousAttemptId&&current.source_generation==='2'&&current.generation==='3'&&!current.ready&&current.operation_id===null&&(await q('select count(*)::int as n from auth.users'))[0].n===usersBefore);
    check('old_nonce_invalidated',current.nonce_hash!==f.nonceHash&&(await service.rpc('cueva_preflight',{p_generation:2,p_nonce_hash:f.nonceHash})).data===false);
    for(const command of ['update cueva_private.invitation_reconciliation_history set prior_row=\'{}\' where attempt_id=$1','delete from cueva_private.invitation_reconciliation_history where attempt_id=$1']){let denied=false;try{await db.query(command,[f.r.previousAttemptId]);}catch(e){denied=e.code==='P0001';}check(command.startsWith('update')?'history_update_denied':'history_delete_denied',denied);}
    await stopped('old_authorization_cannot_replay',{...c,request:f.r0,evidence:f.evidence0},'ATTEMPT_ALREADY_EXISTS');
    check('new_authorization_replay_no_send',(await reconcile(c,'apply')).mode==='NO_SEND'&&await count()===1);
    const alternate={...f,r:{...f.r,attemptId:randomUUID()}};await repair(alternate);await stopped('different_id_even_with_new_auth_probe_cannot_bypass',config(alternate),'ATTEMPT_ALREADY_EXISTS');check('no_duplicate_mail_after_replays',await count()===1);
    step='own_password';browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage();
    const mails=await(await request(`${mailBase}/api/v1/messages`)).json(),message=await(await request(`${mailBase}/api/v1/message/${mails.messages[0].ID}`)).json();const href=message.HTML.match(/href="([^"]+)"/i)?.[1];if(!href)throw Error('MAIL_LINK');const url=new URL(href.replaceAll('&amp;','&'));check('real_link_generation3',url.searchParams.get('generation')==='3'&&url.searchParams.get('type')==='invite');
    await page.goto(url.href);await page.getByRole('button',{name:'Aceptar y continuar'}).click();await page.waitForURL('**/crear-contrasena');check('acceptance_still_not_ready',!(await q('select ready from cueva_private.access_state where user_id=$1',[f.r.authUserId]))[0].ready);
    await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Guardar contraseña'}).click();await page.waitForURL('**/cuenta');check('own_password_enables_same_identity',(await q('select ready from cueva_private.access_state where user_id=$1',[f.r.authUserId]))[0].ready&&await page.getByText('Perfil: alumno',{exact:true}).count()===1);await context.close();
    step='new_rejection';const failed=await repair(await fixture('new-rejection'));await control('reject/535');const start=await count();const rejected=await reconcile(config(failed),'apply');check('new_rejection_retained_no_retry',rejected.state==='uncertain'&&(await reconcile(config(failed),'apply')).mode==='NO_SEND'&&await count()===start);
    step='new_timeout';const timeout=await repair(await fixture('new-timeout'));let networkCalls=0;const before=await count();const uncertain=await reconcile({...config(timeout),fetch:async(...args)=>{networkCalls++;await fetchLocal(...args);throw Error('SYNTHETIC_LOST_RESPONSE');}},'apply');check('new_lost_response_retained_one_mail',uncertain.state==='uncertain'&&networkCalls===1&&await count()===before+1&&(await reconcile(config(timeout),'apply')).mode==='NO_SEND');
    const retained=await q("select count(*)::int as n from cueva_private.invitation_reconciliation r join cueva_private.access_state g using(user_id) where r.state='uncertain' and r.previous_attempt_id is not null and g.generation=3 and not g.ready and g.operation_id=r.attempt_id and g.operation_kind='invite-resend'");check('new_failures_keep_exact_pending_marker',retained[0].n===2);
    check('history_kept_for_all_new_attempts',(await q('select count(*)::int as n from cueva_private.invitation_reconciliation_history'))[0].n===3);
  }catch(e){note('reauthorization_diagnostic','BLOCKED',`step=${step}; location=${String(e.stack).match(/reauthorization-test.mjs:\d+:\d+/)?.[0]??'unknown'}; kind=${e.message==='ASSERTION'?'ASSERTION':'REDACTED'}`);throw e;}
  finally{if(browser)await browser.close();if(app)await app.close();await db.end();}
}

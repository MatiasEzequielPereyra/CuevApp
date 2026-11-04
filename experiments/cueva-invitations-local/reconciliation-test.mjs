import {createClient} from '@supabase/supabase-js';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {reconcile} from '../../scripts/reconcile-student-invitation.mjs';

export async function runBrowserFlow({base,rest,mailBase,gateBase,admin,anon,id,password,request,note,launch,chromium,dbPort,dbPassword,coordinatorPassword,pg}) {
  let app,browser,step='setup';
  const db=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'postgres',password:dbPassword});
  const check=(name,ok)=>{note(name,ok?'PASS':'FAIL');if(!ok)throw Error('ASSERTION');};
  const q=async(text,values)=>(await db.query(text,values)).rows;
  const localFetch=(input,init)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);return fetch(`${u.pathname.startsWith('/auth/v1/')?base:rest}${u.pathname.replace(/^\/(auth|rest)\/v1/,'')}${u.search}`,init);};
  const service=createClient(base,admin,{global:{fetch:localFetch},auth:{persistSession:false,autoRefreshToken:false}});
  const control=mode=>request(`${gateBase}/${mode}`,{method:'POST'});
  const count=async()=>(await(await request(`${mailBase}/api/v1/messages`)).json()).total;
  const makeConfig=f=>({local:true,url:base,site:app.origin,key:admin,database:`postgres://postgres:${dbPassword}@127.0.0.1:${dbPort}/postgres`,request:f.request,evidence:f.evidence,fetch:localFetch});
  async function blocked(name,config,expected='PRECONDITIONS_FAILED') {
    let stopped=false;try{await reconcile(config,'apply');}catch(error){stopped=error.message===expected;}
    check(name,stopped);
  }
  function attested(config,change) {
    const r={...config.request,...change},record=JSON.parse(config.evidence);
    for(const field of ['studentId','jobLease','authUserId','generation','email'])record[field]=r[field];
    const evidence=JSON.stringify(record);
    if(r.priorRejection)r.priorRejection={...r.priorRejection,evidenceSha256:createHash('sha256').update(evidence).digest('hex')};
    return {...config,request:r,evidence};
  }
  async function fixture(label,oldLink=false) {
    await control('reject');
    const student=randomUUID(),lease=randomUUID(),nonce=randomBytes(32).toString('hex');
    const email=`reconcile-${label}-${id}@example.com`;
    await db.query("insert into public.cueva_students values($1,'Prueba','Reconciliacion',$2,null,'2026-11-04',true)",[student,email]);
    const reserved=await request(`${rest}/rpc/cueva_claim_student_invitation`,{method:'POST',token:operatorToken,body:{student,claim:lease}});
    if(!(await reserved.json()).claimed)throw Error('FIXTURE_RESERVATION');
    const made=await service.auth.admin.createUser({email,email_confirm:false});if(made.error)throw Error('FIXTURE_CREATE');
    const user=made.data.user.id;
    const prepared=await service.rpc('cueva_prepare_student_invitation',{student,claim:lease,created_user:user,nonce_hash:createHash('sha256').update(nonce).digest('hex')});
    if(prepared.error||prepared.data!==true)throw Error('FIXTURE_PREPARE');
    let previousLink;
    if(oldLink){const link=await service.auth.admin.generateLink({type:'invite',email});if(link.error||link.data.user.id!==user)throw Error('OLD_LINK_FIXTURE');previousLink=new URL('/aceptar-invitacion',app.origin);previousLink.search=new URLSearchParams({nonce,generation:'1',type:'invite',token_hash:link.data.properties.hashed_token}).toString();}
    if(oldLink)await new Promise(resolve=>setTimeout(resolve,1200));
    const before=(await(await request(`${gateBase}/status`)).json()).rejections;
    const rejected=await service.auth.admin.inviteUserByEmail(email,{redirectTo:`${app.origin}/aceptar-invitacion?nonce=${nonce}&generation=1&type=invite`});
    const after=(await(await request(`${gateBase}/status`)).json()).rejections;
    if(!rejected.error||after<=before){note('smtp_fixture_diagnostic','OBSERVED',`status=${rejected.error?.status??0}; authentication_rejections=${after-before}`);throw Error('SMTP_535_NOT_OBSERVED');}
    const finished=await service.rpc('cueva_finish_student_invitation',{student,claim:lease,outcome:'review'});
    if(finished.error||finished.data!==true)throw Error('FIXTURE_REVIEW');
    const observedAt=new Date().toISOString();
    const evidence=JSON.stringify({source:'operator-reviewed-smtp-rejection',studentId:student,jobLease:lease,authUserId:user,email,generation:1,smtpCode:535,diagnostic:'BadCredentials',observedAt,requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true});
    const proof={smtpCode:535,diagnostic:'BadCredentials',evidenceSha256:createHash('sha256').update(evidence).digest('hex'),observedAt};
    return {student,user,nonce,evidence,previousLink,request:{studentId:student,jobLease:lease,authUserId:user,attemptId:randomUUID(),generation:1,expectedState:'review',email,priorRejection:proof,requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true}};
  }
  let operatorToken;
  try {
    await db.connect();
    const operator=await service.auth.admin.createUser({email:`operator-${id}@example.com`,password,email_confirm:true});
    if(operator.error)throw Error('OPERATOR_FIXTURE');
    await db.query("insert into public.cueva_profiles values($1,'admin');",[operator.data.user.id]);
    await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,true,'2000-01-01')",[operator.data.user.id]);
    const login=await(await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:operator.data.user.email,password}})).json();operatorToken=login.access_token;
    if(!operatorToken)throw Error('OPERATOR_LOGIN');
    app=await launch({authBase:base,restBase:rest,anonKey:anon,admin,dbPort,dbPassword:coordinatorPassword});
    browser=await chromium.launch({headless:true});
    const main=await fixture('happy',true),config=makeConfig(main);
    check('initial_smtp_535_review_no_mail',await count()===0&&(await q('select state from public.cueva_student_invitations where student_id=$1',[main.student]))[0].state==='review');
    check('check_no_mutation',(await reconcile(config)).state==='eligible'&&(await q('select generation from cueva_private.access_state where user_id=$1',[main.user]))[0].generation==='1');
    step='preconditions';
    for(const [name,change] of [['wrong_student',{studentId:randomUUID()}],['wrong_job',{jobLease:randomUUID()}],['wrong_identity',{authUserId:operator.data.user.id}],['wrong_generation',{generation:2}],['wrong_email',{email:`other-${id}@example.com`}]])await blocked(name,attested(config,change));
    for(const [name,change] of [['acceptance_not_excluded',{noSmtpAcceptance:false}],['missing_rejection',{priorRejection:null}],['original_pending',{originalRequestCompleted:false}],['not_quiescent',{requestsQuiescent:false}]]) await blocked(name,{...config,request:{...main.request,...change}},'REJECTION_EVIDENCE_REQUIRED');
    await blocked('missing_evidence_file',{...config,evidence:undefined},'EVIDENCE_FILE_MISMATCH');
    await blocked('generation_exceeds_existing_callback_format',attested(config,{generation:999999999999999}),'REQUEST_INVALID');
    await blocked('original_lease_cannot_be_reused',attested(config,{attemptId:main.request.jobLease}),'REQUEST_INVALID');
    await blocked('tampered_evidence_file',{...config,evidence:config.evidence+' '},'EVIDENCE_FILE_MISMATCH');
    const wrongRecord=JSON.stringify({...JSON.parse(main.evidence),authUserId:randomUUID()});await blocked('unrelated_rejection_record',{...config,evidence:wrongRecord,request:{...main.request,priorRejection:{...main.request.priorRejection,evidenceSha256:createHash('sha256').update(wrongRecord).digest('hex')}}},'EVIDENCE_RECORD_MISMATCH');
    for(const [name,table,field,value,restore,key] of [
      ['confirmed_account','auth.users','email_confirmed_at',new Date(),'null','id'],
      ['previous_login','auth.users','last_sign_in_at',new Date(),'null','id'],
      ['auth_email_changed','auth.users','email',`changed-${id}@example.com`,null,'id'],
      ['wrong_profile','public.cueva_profiles','role','admin',"'alumno'",'user_id'],
      ['ready_gate','cueva_private.access_state','ready',true,'false','user_id'],
      ['bound_session','cueva_private.access_state','allowed_session',randomUUID(),'null','user_id'],
      ['pending_job','public.cueva_student_invitations','state','processing',"'review'",'student_id'],
      ['smtp_already_accepted','public.cueva_student_invitations','state','sent',"'review'",'student_id']]) {
      const target=key==='student_id'?main.student:main.user;
      await db.query(`update ${table} set ${field}=$2 where ${key}=$1`,[target,value]);await blocked(name,config);
      if(restore===null)await db.query(`update ${table} set ${field}=$2 where ${key}=$1`,[target,main.request.email]);else await db.query(`update ${table} set ${field}=${restore} where ${key}=$1`,[target]);
    }
    await db.query("update cueva_private.access_state set operation_id=$2,operation_kind='reset' where user_id=$1",[main.user,randomUUID()]);await blocked('pending_access_operation',config);await db.query('update cueva_private.access_state set operation_id=null,operation_kind=null where user_id=$1',[main.user]);
    // A real Auth session belonging to another synthetic user is reassigned only in this fixture.
    const sid=(await q('select id from auth.sessions where user_id=$1',[operator.data.user.id]))[0].id;
    await db.query('update auth.sessions set user_id=$2 where id=$1',[sid,main.user]);await blocked('existing_auth_session',config);await db.query('update auth.sessions set user_id=$2 where id=$1',[sid,operator.data.user.id]);
    check('negative_cases_no_send_or_reservation',await count()===0&&(await q('select count(*)::int as n from cueva_private.invitation_reconciliation'))[0].n===0);
    const privileges=await q("select bool_and(not has_table_privilege(r,'cueva_private.invitation_reconciliation',p)) as denied from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['SELECT','INSERT','UPDATE','DELETE']) p");check('no_new_api_role_permissions',privileges[0].denied);
    for(const [name,token] of [['visitor',anon],['authenticated_admin',login.access_token]]) {
      const denied=await request(`${rest}/invitation_reconciliation`,{token});check(`${name}_ledger_not_exposed`,!denied.ok);
    }
    step='repaired_concurrent';await control('repair');
    let calls=0;const beforeUsers=(await q('select count(*)::int as n from auth.users'))[0].n;
    const trackedFetch=(input,init)=>{calls++;return localFetch(input,init);};
    const cfg={...config,fetch:trackedFetch,testHooks:{afterReserve:async()=>{
      const old=await service.rpc('cueva_preflight',{p_generation:1,p_nonce_hash:createHash('sha256').update(main.nonce).digest('hex')});check('old_nonce_invalidated_before_smtp',old.data===false);
      const g=(await q('select * from cueva_private.access_state where user_id=$1',[main.user]))[0];check('reserved_generation_gate_closed',g.generation==='2'&&!g.ready&&g.operation_id===main.request.attemptId&&g.operation_kind==='invite-resend');
      const reset=await service.rpc('cueva_begin_operation',{p_user:main.user,p_operation:randomUUID(),p_kind:'reset',p_session:null});check('concurrent_reset_cannot_acquire_gate',reset.data===null&&!reset.error);
      const finish=await service.rpc('cueva_finish_operation',{p_user:main.user,p_operation:main.request.attemptId,p_generation:2,p_session:null});check('ordinary_finish_cannot_release_reservation',finish.data===false&&!finish.error);
      const recovery=await service.rpc('cueva_prepare_recovery',{p_user:main.user,p_operation:main.request.attemptId,p_generation:2,p_nonce_hash:createHash('sha256').update('synthetic-test').digest('hex')});check('recovery_cannot_replace_invitation_nonce',recovery.data===false&&!recovery.error);
    }}};
    const runs=await Promise.all([1,2,3].map(()=>reconcile(cfg,'apply')));
    check('concurrent_one_dispatch',calls===1&&runs.filter(r=>r.state==='accepted'&&r.mode==='APPLIED').length===1&&runs.filter(r=>r.mode==='NO_SEND').length===2);
    check('repaired_one_smtp_message',await count()===1);
    const sent=(await q('select user_id,state from public.cueva_student_invitations where student_id=$1',[main.student]))[0];
    const g=(await q('select ready,operation_id,generation from cueva_private.access_state where user_id=$1',[main.user]))[0];
    check('same_uuid_profile_fiche_preserved',sent.user_id===main.user&&sent.state==='sent'&&!g.ready&&g.operation_id===null&&g.generation==='2'&&(await q('select count(*)::int as n from auth.users'))[0].n===beforeUsers&&(await q("select role from public.cueva_profiles where user_id=$1",[main.user]))[0].role==='alumno'&&(await q('select count(*)::int as n from public.cueva_students where id=$1',[main.student]))[0].n===1);
    check('accepted_replay_no_send',(await reconcile(cfg,'apply')).state==='accepted'&&calls===1&&await count()===1);
    step='link';const context=await browser.newContext(),page=await context.newPage();
    await page.goto(main.previousLink.href);const oldResponse=page.waitForResponse(r=>r.url()===`${app.origin}/api/acceso/invitacion`&&r.request().method()==='POST');await page.getByRole('button',{name:'Aceptar y continuar'}).click();check('old_auth_link_rejected_by_application',(await oldResponse).status()===409&&(await context.cookies()).length===0);
    const mails=await(await request(`${mailBase}/api/v1/messages`)).json();const message=await(await request(`${mailBase}/api/v1/message/${mails.messages[0].ID}`)).json();
    const href=message.HTML.match(/href="([^"]+)"/i)?.[1];if(!href)throw Error('MAIL_HREF');const link=new URL(href.replaceAll('&amp;','&'));
    check('real_invite_template_new_generation',link.origin===app.origin&&link.pathname==='/aceptar-invitacion'&&link.searchParams.get('generation')==='2'&&link.searchParams.get('type')==='invite');
    await page.goto(link.href);await page.getByRole('button',{name:'Aceptar y continuar'}).click();await page.waitForURL('**/crear-contrasena');
    const pending=(await q('select ready from cueva_private.access_state where user_id=$1',[main.user]))[0];check('accepted_link_still_requires_password',!pending.ready);
    await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Guardar contraseña'}).click();await page.waitForURL('**/cuenta');
    check('own_password_enables_same_student',await page.getByText('Perfil: alumno',{exact:true}).count()===1&&(await q('select ready from cueva_private.access_state where user_id=$1',[main.user]))[0].ready);
    const identity=await(await request(`${base}/user`,{token:(await(await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:main.request.email,password}})).json()).access_token})).json();check('new_login_has_original_uuid',identity.id===main.user);
    check('post_acceptance_replay_no_mutation',(await reconcile(config,'apply')).state==='accepted'&&await count()===1);
    // Real alumno session, unlike the earlier API schema visibility check.
    const pupilToken=(await(await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:main.request.email,password}})).json()).access_token;
    for(const [name,token] of [['pupil',pupilToken],['anon',anon]])check(`${name}_cannot_mutate_or_read_private_ledger`,!(await request(`${rest}/rpc/cueva_reconcile_student_invitation`,{method:'POST',token,body:{}})).ok&&!(await request(`${rest}/invitation_reconciliation`,{token})).ok);
    await context.close();
    step='second_rejection';const repeated=await fixture('rejected'),repeatConfig=makeConfig(repeated);const rejected=await reconcile(repeatConfig,'apply');
    check('second_rejection_review_no_auto_retry',rejected.state==='uncertain'&&(await q('select state from public.cueva_student_invitations where student_id=$1',[repeated.student]))[0].state==='review'&&(await reconcile(repeatConfig,'apply')).mode==='NO_SEND'&&await count()===1);
    step='crash_before';const before=await fixture('before');await control('repair');const beforeConfig=makeConfig(before),beforeCount=await count();
    await blocked('interruption_after_reservation',{...beforeConfig,testHooks:{afterReserve:()=>{throw Error('PROCESS_DEATH');}}},'ATTEMPT_REQUIRES_REVIEW_NO_RETRY');
    check('interrupted_before_smtp_no_resume',(await reconcile(beforeConfig,'apply')).state==='reserved'&&await count()===beforeCount);
    step='ambiguous_after_accept';const ambiguous=await fixture('ambiguous');await control('repair');const uncertainConfig=makeConfig(ambiguous),start=await count();let ambiguousCalls=0;
    const unclear=await reconcile({...uncertainConfig,fetch:async(input,init)=>{ambiguousCalls++;await localFetch(input,init);throw Error('LOST_RESPONSE');}},'apply');
    check('lost_response_after_smtp_review',unclear.state==='uncertain'&&ambiguousCalls===1&&await count()===start+1);
    check('ambiguous_replay_no_resend',(await reconcile(uncertainConfig,'apply')).state==='uncertain'&&await count()===start+1);
    check('ambiguous_gate_remains_closed',(await q('select ready,operation_id from cueva_private.access_state where user_id=$1',[ambiguous.user]))[0].operation_id===ambiguous.request.attemptId);
    const ambiguousMails=await(await request(`${mailBase}/api/v1/messages`)).json();
    let ambiguousHref;
    for(const m of ambiguousMails.messages){const body=await(await request(`${mailBase}/api/v1/message/${m.ID}`)).json();if(JSON.stringify(body.To).includes(ambiguous.request.email)){ambiguousHref=body.HTML.match(/href="([^"]+)"/i)?.[1];break;}}
    if(!ambiguousHref)throw Error('AMBIGUOUS_MAIL_MISSING');
    const ambiguousLink=new URL(ambiguousHref.replaceAll('&amp;','&')),isolated=await browser.newContext();
    const response=await isolated.request.post(`${app.origin}/api/acceso/invitacion`,{headers:{origin:app.origin},form:{token:ambiguousLink.searchParams.get('token_hash'),nonce:ambiguousLink.searchParams.get('nonce'),generation:ambiguousLink.searchParams.get('generation'),type:'invite'}});
    check('ambiguous_accepted_mail_cannot_create_app_session',response.status()===409&&(await isolated.cookies()).length===0);await isolated.close();
    step='crash_after';const afterCrash=await fixture('after');await control('repair');const afterConfig=makeConfig(afterCrash),afterStart=await count();
    await blocked('interruption_after_smtp',{...afterConfig,testHooks:{afterSend:()=>{throw Error('PROCESS_DEATH');}}},'ATTEMPT_REQUIRES_REVIEW_NO_RETRY');
    check('interrupted_after_smtp_no_resume',(await reconcile(afterConfig,'apply')).state==='dispatching'&&await count()===afterStart+1);
    step='uuid_response_mismatch';const mismatch=await fixture('mismatch');await control('repair');const mismatchConfig=makeConfig(mismatch);
    const different=await reconcile({...mismatchConfig,fetch:async(input,init)=>{const response=await localFetch(input,init);const body=await response.json();body.id=operator.data.user.id;return new Response(JSON.stringify(body),{status:response.status,headers:{'content-type':'application/json'}});}},'apply');
    check('provider_uuid_mismatch_never_opens_gate',different.state==='uncertain'&&!(await q('select ready from cueva_private.access_state where user_id=$1',[mismatch.user]))[0].ready);
    await blocked('new_attempt_cannot_bypass_existing',{...mismatchConfig,request:{...mismatch.request,attemptId:randomUUID()}},'ATTEMPT_ALREADY_EXISTS');
    check('nonaccepted_gates_keep_reservations',(await q("select count(*)::int as n from cueva_private.invitation_reconciliation r join cueva_private.access_state g using(user_id) where r.state<>'accepted' and not g.ready and g.operation_id=r.attempt_id and g.operation_kind='invite-resend'"))[0].n===5);
  } catch(error) {
    note('reconciliation_diagnostic','BLOCKED',`step=${step}; location=${String(error.stack).match(/reconciliation-test.mjs:\d+:\d+/)?.[0]??'unknown'}; code=${error.message==='ASSERTION'?'ASSERTION':'REDACTED'}`);throw error;
  } finally {if(browser)await browser.close();if(app)await app.close();await db.end();}
}

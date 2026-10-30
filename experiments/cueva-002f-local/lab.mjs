import { execFileSync, spawnSync, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Isolated test-only stack. All keys and accounts are synthetic and ephemeral.
const images = {
  db: 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
  auth: 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
  mail: 'public.ecr.aws/supabase/mailpit@sha256:37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6',
  rest: 'public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962',
};
const id = randomUUID().replaceAll('-', '').slice(0, 12);
const names = { network: `cueva-002f-net-${id}`, db: `cueva-002f-db-${id}`, auth: `cueva-002f-auth-${id}`, mail: `cueva-002f-mail-${id}`, rest: `cueva-002f-rest-${id}` };
const secret = () => randomBytes(32).toString('hex');
const dbPassword = secret(), jwtSecret = secret(), password = `Aa9!${secret()}`;
const fixtureEmail = `student-${id}@example.com`, strangerEmail = `stranger-${id}@example.com`;
const created = [], results = [];
let networkCreated = false, stage = 'network';
const note = (name, status, detail = '') => results.push({name, status, detail});
const docker = (args, extraEnv = {}) => execFileSync('docker', args, {encoding:'utf8', stdio:['ignore','pipe','pipe'], env:{...process.env,...extraEnv}}).trim();
const sql = input => { try { return execFileSync('docker', ['exec','-i',names.db,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], {input, encoding:'utf8', stdio:['pipe','pipe','pipe']}).trim(); } catch (error) { const match=String(error.stderr || '').match(/ERROR:\s*(function|role|schema|relation|permission|syntax)[^\n]{0,80}/i)?.[0] || 'DATABASE_SETUP_FAILED'; throw new Error(match); } };
async function withLock(uid, run, hooks = {}) {
  if(!/^[0-9a-f-]{36}$/i.test(uid))throw new Error('BAD_FIXTURE_ID');
  const child=spawn('docker',['exec','-i',names.db,'psql','-X','-q','-t','-A','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','ignore']});
  const closed=new Promise(resolve=>child.once('close',resolve));
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  async function query(statement) {
    const marker=`END${randomUUID().replaceAll('-','')}`;
    child.stdin.write(`${statement};\nSELECT '${marker}';\n`);
    const output=[];
    while(true){const item=await lines.next(); if(item.done)throw new Error('LOCK_CONNECTION_CLOSED'); if(item.value===marker)return output.join('\n').trim(); output.push(item.value);}
  }
  try {
    const backend=await query('SELECT pg_backend_pid()');
    if(!/^\d+$/.test(backend))throw new Error('INVALID_BACKEND');
    hooks.onAttempt?.(Number(backend));
    await query(`SELECT pg_advisory_lock(hashtextextended('${uid}', 42))`);
    hooks.onAcquired?.();
    return await run(query);
  }
  finally { child.stdin.end(); await closed; }
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function testJwt(role) { const value = `${enc({alg:'HS256',typ:'JWT'})}.${enc({role, aud:'authenticated', exp:Math.floor(Date.now()/1000)+300})}`; return `${value}.${createHmac('sha256',jwtSecret).update(value).digest('base64url')}`; }
async function request(url, {method='GET',token,body,redirect='follow'}={}) {
  return fetch(url, {method,redirect,headers:{...(token?{authorization:`Bearer ${token}`} : {}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
}
async function waitFor(fn) { for(let i=0;i<60;i++){try{if(await fn())return;}catch{}await sleep(1000);}throw new Error('READINESS_TIMEOUT'); }
function start(name, image, args, env, diagnostic=false) { docker(['run','-d',...(diagnostic?[]:['--rm']),'--name',name,'--network',names.network,'--memory','512m','--cpus','1','--log-driver',diagnostic?'local':'none',...args,image],env); created.push(name); }
function port(name, inner) { const ports=JSON.parse(docker(['inspect','--format','{{json .NetworkSettings.Ports}}',name])); const bindings=ports?.[`${inner}/tcp`]; if(!bindings || bindings.length!==1 || bindings[0].HostIp!=='127.0.0.1'){ note('port_diagnostic','OBSERVED',`mapping=${JSON.stringify(bindings ?? null)}`); throw new Error('PORT_NOT_LOOPBACK'); } return Number(bindings[0].HostPort); }
try {
  docker(['network','create','--driver','bridge',names.network]); networkCreated=true;
  stage='db_start';
  start(names.db,images.db,['--network-alias','db','-e','POSTGRES_PASSWORD'],{POSTGRES_PASSWORD:dbPassword});
  stage='db_ready';
  await waitFor(()=>{try{docker(['exec',names.db,'pg_isready','-U','postgres']);return true;}catch{return false;}});
  docker(['exec',names.db,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE SCHEMA auth; ALTER ROLE postgres SET search_path = auth, public']);
  start(names.mail,images.mail,['--network-alias','mail','-p','127.0.0.1::8025'],{});
  stage='mail_port';
  const mailBase=`http://127.0.0.1:${port(names.mail,8025)}`;
  stage='mail_ready';
  await waitFor(async()=>(await request(`${mailBase}/api/v1/messages`)).ok);
  const db = new URL('postgres://db:5432/postgres');
  db.username = 'postgres';
  db.password = dbPassword;
  const env={GOTRUE_DB_DRIVER:'postgres',GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',GOTRUE_SITE_URL:'http://127.0.0.1:9999',API_EXTERNAL_URL:'http://127.0.0.1:9999',GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_DISABLE_SIGNUP:'true',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_SMTP_HOST:'mail',GOTRUE_SMTP_PORT:'1025',GOTRUE_SMTP_ADMIN_EMAIL:'admin@example.com',GOTRUE_SMTP_SENDER_NAME:'Cueva Lab'};
  env.GOTRUE_DB_DATABASE_URL = db.href;
  stage='auth_start';
  start(names.auth,images.auth,['-p','127.0.0.1::9999',...Object.keys(env).flatMap(key=>['-e',key])],env,true);
  stage='auth_ready';
  const base=`http://127.0.0.1:${port(names.auth,9999)}`;
  for(let i=0;i<60;i++){if(docker(['inspect','--format','{{.State.Running}}',names.auth])!=='true')throw new Error('AUTH_EXIT'); try{if((await request(`${base}/health`)).ok)break;}catch{} if(i===59)throw new Error('READINESS_TIMEOUT'); await sleep(1000);}
  stage='database_setup'; sql(await readFile('experiment.sql','utf8'));
  stage='database_role';
  sql(`ALTER ROLE authenticator PASSWORD '${dbPassword}';`);
  const restDb = new URL('postgres://db:5432/postgres'); restDb.username='authenticator'; restDb.password=dbPassword;
  const restEnv={PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:jwtSecret,PGRST_SERVER_HOST:'0.0.0.0',PGRST_SERVER_PORT:'3000'};
  restEnv.PGRST_DB_URI = restDb.href;
  stage='rest_start'; start(names.rest,images.rest,['-p','127.0.0.1::3000',...Object.keys(restEnv).flatMap(key=>['-e',key])],restEnv);
  const rest=`http://127.0.0.1:${port(names.rest,3000)}`;
  stage='rest_ready'; await waitFor(async()=>(await request(`${rest}/`)).status<500);
  const admin=testJwt('service_role');
  stage='signup'; const signup=await request(`${base}/signup`,{method:'POST',body:{email:strangerEmail,password}});
  const signupBody=await signup.json();
  const signupCode=String(signupBody.error_code||signupBody.code||'unknown');
  note('public_signup_closed',signup.status>=400 && signupCode==='signup_disabled'?'PASS':'FAIL',`status=${signup.status}; code=${/^[a-z0-9_]+$/.test(signupCode)?signupCode:'other'}`);
  stage='invite'; const invite=await request(`${base}/invite`,{method:'POST',token:admin,body:{email:fixtureEmail}});
  const inviteBody=await invite.json(); const inviteCode=String(inviteBody.error_code||inviteBody.code||'unknown');
  note('admin_invite',invite.ok?'PASS':'FAIL',`status=${invite.status}; code=${/^[a-z0-9_]+$/.test(inviteCode)?inviteCode:'other'}`);
  if(!invite.ok)throw new Error('INVITE_FAILED');
  await waitFor(async()=>{const r=await request(`${mailBase}/api/v1/messages`);const x=await r.json();return x.total>0;});
  const messages=await (await request(`${mailBase}/api/v1/messages`)).json();
  const message=await (await request(`${mailBase}/api/v1/message/${encodeURIComponent(messages.messages[0].ID)}`)).json();
  const html=message.HTML || '';
  const match=html.match(/href="([^"]+)"/i);
  if(!match)throw new Error('INVITE_LINK_MISSING');
  const inviteUrl=new URL(match[1].replaceAll('&amp;','&'));
  const inviteToken=inviteUrl.searchParams.get('token');
  if(!inviteToken || inviteUrl.searchParams.get('type')!=='invite')throw new Error('INVITE_TOKEN_MISSING');
  const verify=await request(`${base}/verify`,{method:'POST',body:{token_hash:inviteToken,type:'invite'}});
  note('invite_verified',verify.ok?'PASS':'FAIL',`status=${verify.status}`);
  if(!verify.ok)throw new Error('VERIFY_FAILED');
  const session=await verify.json();
  if(!session.access_token)throw new Error('SESSION_MISSING');
  note('session_before_password','OBSERVED','Verification issued an access token before password setup; the app must enforce onboarding independently.');
  if(!/^[0-9a-f-]{36}$/i.test(session.user?.id || ''))throw new Error('BAD_FIXTURE_ID');
  const uid=session.user.id, other=randomUUID();
  sql(`INSERT INTO private.onboarding(user_id) VALUES ('${uid}'); INSERT INTO public.lab_records VALUES (1,'${uid}','own fixture'),(2,'${other}','other fixture');`);
  const passwordBefore=sql(`SELECT coalesce(encrypted_password, '') = '' AS password_empty FROM auth.users WHERE id='${uid}';`);
  note('initial_password_state','OBSERVED',`password_empty=${/\bt\b/.test(passwordBefore)}`);
  const getRows=async token=>{const r=await request(`${rest}/lab_records?select=id,owner_id`,{token});return {status:r.status,data:r.ok?await r.json():[]};};
  const before=await getRows(session.access_token);
  note('before_password_denied',before.status===200 && before.data.length===0?'PASS':'FAIL',`status=${before.status}; visible=${before.data.length}`);
  const anonymous=await getRows(undefined);
  note('anonymous_data_denied',anonymous.status===401 || anonymous.status===403?'PASS':'FAIL',`status=${anonymous.status}`);
  const spoof=await request(`${base}/user`,{method:'PUT',token:session.access_token,body:{data:{ready:true}}});
  const afterSpoof=await getRows(session.access_token);
  note('editable_metadata_cannot_unlock',spoof.ok && afterSpoof.status===200 && afterSpoof.data.length===0?'PASS':'FAIL',`metadata_status=${spoof.status}; visible=${afterSpoof.data.length}`);
  const directGate=await request(`${rest}/onboarding`,{method:'PATCH',token:session.access_token,body:{ready:true}});
  note('private_gate_not_exposed',directGate.status===404 || directGate.status===401 || directGate.status===403?'PASS':'FAIL',`status=${directGate.status}`);
  // Local proof of concept: all authorized paths must take this per-user lock.
  // A real deployment needs bounded timeouts, least privilege and operator controls.
  async function serverComplete(token, selectedPassword, beforeActivation = async () => {}, onActivated = () => {}) {
    const verified=await request(`${base}/user`,{token});
    if(!verified.ok)return 'INVALID_SESSION';
    const verifiedUser=await verified.json(); const verifiedUid=verifiedUser.id;
    if(!/^[0-9a-f-]{36}$/i.test(verifiedUid || ''))return 'INVALID_SUBJECT';
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
    const sid=claims.session_id;
    if(!/^[0-9a-f-]{36}$/i.test(sid || ''))return 'INVALID_SESSION';
    return withLock(verifiedUid, async query => {
    const check=await request(`${base}/user`,{token});
    if(!check.ok || (await check.json()).id!==verifiedUid)return 'INVALID_SESSION';
    const pending=await query(`SELECT generation::text FROM private.onboarding WHERE user_id='${verifiedUid}' AND NOT ready`);
    if(!/^\d+$/.test(pending))return 'NOT_PENDING';
    const changed=await request(`${base}/user`,{method:'PUT',token,body:{password:selectedPassword}});
    if(!changed.ok)return 'PASSWORD_REJECTED';
    const changedUser=await changed.json();
    if(changedUser.id!==verifiedUid)return 'SUBJECT_MISMATCH';
    const stillValid=await request(`${base}/user`,{token});
    if(!stillValid.ok || (await stillValid.json()).id!==verifiedUid)return 'INVALID_SESSION';
    await beforeActivation();
    const updated=await query(`UPDATE private.onboarding SET ready=true WHERE user_id='${verifiedUid}' AND ready=false AND generation=${pending} AND EXISTS (SELECT 1 FROM auth.sessions WHERE id='${sid}' AND user_id='${verifiedUid}') RETURNING generation::text`);
    if(updated===pending)onActivated();
    return updated===pending ? 'DONE' : 'NOT_PENDING';
    });
  }
  async function coordinatedReset(uid, credential, newPassword, beforeProvider = async () => {}, hooks = {}) {
    return withLock(uid, async query => {
      const generation=await query(`UPDATE private.onboarding SET ready=false, generation=generation+1 WHERE user_id='${uid}' RETURNING generation::text`);
      if(!/^\d+$/.test(generation))return 'NO_GATE';
      await beforeProvider();
      const reset=await request(`${base}/admin/users/${uid}`,{method:'PUT',token:credential,body:{password:newPassword}});
      return reset.ok ? 'RESET' : 'PROVIDER_FAILED_CLOSED';
    }, hooks);
  }
  const userInvite=await request(`${base}/invite`,{method:'POST',token:session.access_token,body:{email:strangerEmail}});
  note('student_invite_rejected',userInvite.status===401 || userInvite.status===403?'PASS':'FAIL',`status=${userInvite.status}`);
  const unauthedUpdate=await request(`${base}/user`,{method:'PUT',body:{password}});
  note('anonymous_password_update_rejected',unauthedUpdate.status===401 || unauthedUpdate.status===403?'PASS':'FAIL',`status=${unauthedUpdate.status}`);
  const directPassword=`Cc7!${secret()}`;
  const directUpdate=await request(`${base}/user`,{method:'PUT',token:session.access_token,body:{password:directPassword}});
  const afterDirect=await getRows(session.access_token);
  note('direct_password_change_does_not_unlock',directUpdate.ok && afterDirect.status===200 && afterDirect.data.length===0?'PASS':'FAIL',`status=${directUpdate.status}; visible=${afterDirect.data.length}`);
  const [completed, competing]=await Promise.all([serverComplete(session.access_token,password),serverComplete(session.access_token,password)]);
  note('concurrent_activation_once',[completed,competing].sort().join(',')==='DONE,NOT_PENDING'?'PASS':'FAIL',`results=${[completed,competing].sort().join(',')}`);
  const replayComplete=await serverComplete(session.access_token,password);
  note('activation_replay_rejected',replayComplete==='NOT_PENDING'?'PASS':'FAIL',`result=${replayComplete}`);
  const after=await getRows(session.access_token);
  const gateAfter=sql(`SELECT ready FROM private.onboarding WHERE user_id='${uid}';`);
  note('gate_after_password','OBSERVED',`ready=${/\bt\b/.test(gateAfter)}`);
  note('password_unlocks_only_own_row',after.status===200 && after.data.length===1 && after.data[0].owner_id===uid?'PASS':'FAIL',`status=${after.status}; visible=${after.data.length}; owner_matches=${after.data[0]?.owner_id===uid}`);
  const crossWrite=await request(`${rest}/lab_records`,{method:'POST',token:session.access_token,body:{id:3,owner_id:other,content:'forbidden'}});
  note('cross_user_insert_denied',crossWrite.status===401 || crossWrite.status===403?'PASS':'FAIL',`status=${crossWrite.status}`);
  const login=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:fixtureEmail,password}});
  note('password_login',login.ok?'PASS':'FAIL',`status=${login.status}`);
  const wrongLogin=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:fixtureEmail,password:`Incorrect!${secret()}`}});
  note('wrong_password_rejected',wrongLogin.status===400 || wrongLogin.status===401?'PASS':'FAIL',`status=${wrongLogin.status}`);
  const replay=await request(`${base}/verify`,{method:'POST',body:{token_hash:inviteToken,type:'invite'}});
  note('invite_replay_rejected',replay.status>=400?'PASS':'FAIL',`status=${replay.status}`);
  const anonInvite=await request(`${base}/invite`,{method:'POST',body:{email:strangerEmail}});
  note('unprivileged_invite_rejected',anonInvite.status>=400?'PASS':'FAIL',`status=${anonInvite.status}`);
  stage='admin_negative_fixture';
  const secondEmail=`second-${id}@example.com`;
  const secondInvite=await request(`${base}/invite`,{method:'POST',token:admin,body:{email:secondEmail}});
  if(!secondInvite.ok)throw new Error('SECOND_INVITE_FAILED');
  await waitFor(async()=>{const x=await (await request(`${mailBase}/api/v1/messages`)).json();return x.total>1;});
  const secondMessages=await (await request(`${mailBase}/api/v1/messages`)).json();
  const secondId=secondMessages.messages.find(item=>item.ID!==messages.messages[0].ID)?.ID;
  if(!secondId)throw new Error('SECOND_MESSAGE_MISSING');
  const secondMessage=await (await request(`${mailBase}/api/v1/message/${encodeURIComponent(secondId)}`)).json();
  const secondLink=(secondMessage.HTML || '').match(/href="([^"]+)"/i)?.[1];
  if(!secondLink)throw new Error('SECOND_LINK_MISSING');
  const secondToken=new URL(secondLink.replaceAll('&amp;','&')).searchParams.get('token');
  const secondVerify=await request(`${base}/verify`,{method:'POST',body:{token_hash:secondToken,type:'invite'}});
  if(!secondVerify.ok)throw new Error('SECOND_VERIFY_FAILED');
  const secondSession=await secondVerify.json();
  if(!/^[0-9a-f-]{36}$/i.test(secondSession.user?.id || ''))throw new Error('BAD_FIXTURE_ID');
  const secondUid=secondSession.user.id;
  sql(`INSERT INTO private.onboarding(user_id) VALUES ('${secondUid}'); INSERT INTO public.lab_records VALUES (4,'${secondUid}','second fixture');`);
  const secondBefore=await getRows(secondSession.access_token);
  const operatorPassword=`Bb8!${secret()}`;
  const adminUpdate=await request(`${base}/admin/users/${secondUid}`,{method:'PUT',token:admin,body:{password:operatorPassword}});
  const secondAfter=await getRows(secondSession.access_token);
  note('admin_change_must_not_complete_student_onboarding',secondBefore.status===200 && secondBefore.data.length===0 && adminUpdate.ok && secondAfter.status===200 && secondAfter.data.length===0?'PASS':'FAIL',`before=${secondBefore.data.length}; admin_status=${adminUpdate.status}; after=${secondAfter.data.length}; cannot attribute change to student.`);
  const revokedComplete=await serverComplete(secondSession.access_token,`Dd6!${secret()}`);
  const afterRevoked=await getRows(secondSession.access_token);
  note('revoked_session_cannot_complete',revokedComplete==='INVALID_SESSION' && afterRevoked.data.length===0?'PASS':'FAIL',`result=${revokedComplete}; visible=${afterRevoked.data.length}`);
  const secondLogin=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:secondEmail,password:operatorPassword}});
  if(!secondLogin.ok)throw new Error('SECOND_LOGIN_FAILED');
  const secondLoginSession=await secondLogin.json();
  let resetPromise, observedWaiting=false; const events=[]; const coordinatedPassword=`Ff4!${secret()}`;
  let resolveAttempt; const attempted = new Promise(resolve=>{resolveAttempt=resolve;});
  const raced=await serverComplete(secondLoginSession.access_token,`Ee5!${secret()}`,async()=>{
    resetPromise=coordinatedReset(secondUid,admin,coordinatedPassword,undefined,{
      onAttempt: pid=>{events.push('reset_attempt');resolveAttempt(pid);},
      onAcquired: ()=>events.push('reset_acquired'),
    });
    const pid=await attempted;
    for(let i=0;i<100;i++){
      await sleep(50);
      const locks=sql(`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE pid=${pid} AND locktype='advisory' AND NOT granted);`);
      if(/\bt\b/.test(locks)){observedWaiting=true;events.push('reset_waiting');break;}
    }
  },()=>events.push('activation_committed'));
  const concurrentResetStatus=await resetPromise;
  const racedRows=await getRows(secondLoginSession.access_token);
  const correctOrder=events.join(',')==='reset_attempt,reset_waiting,activation_committed,reset_acquired';
  note('coordinated_reset_after_inflight_activation',observedWaiting && correctOrder && raced==='DONE' && concurrentResetStatus==='RESET' && racedRows.status===200 && racedRows.data.length===0?'PASS':'FAIL',`waiting=${observedWaiting}; order=${events.join(',')}; reset=${concurrentResetStatus}; completion=${raced}; visible=${racedRows.data.length}.`);
  const freshLogin=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:secondEmail,password:coordinatedPassword}});
  if(!freshLogin.ok)throw new Error('THIRD_LOGIN_FAILED');
  const freshSession=await freshLogin.json();
  let interrupted=false;
  try { await serverComplete(freshSession.access_token,`Hh2!${secret()}`,async()=>{throw new Error('SIMULATED_INTERRUPTION');}); } catch { interrupted=true; }
  const partialRows=await getRows(freshSession.access_token);
  note('interrupted_activation_stays_closed',interrupted && partialRows.status===200 && partialRows.data.length===0?'PASS':'FAIL',`interrupted=${interrupted}; visible=${partialRows.data.length}.`);
  const directPasswordAdmin=`Ii1!${secret()}`;
  const directOperator=await request(`${base}/admin/users/${uid}`,{method:'PUT',token:admin,body:{password:directPasswordAdmin}});
  const oldAfterDirect=await getRows(session.access_token);
  note('old_session_after_direct_reset',directOperator.ok && oldAfterDirect.status===200 && oldAfterDirect.data.length===0?'PASS':'FAIL',`visible=${oldAfterDirect.data.length}; direct reset does not advance gate generation.`);
  const bypassLogin=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:fixtureEmail,password:directPasswordAdmin}});
  if(!directOperator.ok || !bypassLogin.ok)throw new Error('DIRECT_OPERATOR_TEST_FAILED');
  const bypassSession=await bypassLogin.json(); const bypassRows=await getRows(bypassSession.access_token);
  note('direct_operator_bypasses_coordinator','OBSERVED',`operator_status=${directOperator.status}; new_session_visible=${bypassRows.data.length}; requires provider-admin authority.`);
  const failureReset=await coordinatedReset(uid,'invalid-test-token',`Gg3!${secret()}`);
  const afterFailure=await getRows(bypassSession.access_token);
  note('provider_reset_failure_stays_closed',bypassRows.status===200 && bypassRows.data.length===1 && failureReset==='PROVIDER_FAILED_CLOSED' && afterFailure.status===200 && afterFailure.data.length===0?'PASS':'FAIL',`before=${bypassRows.data.length}; result=${failureReset}; after=${afterFailure.data.length}.`);
  // Privileged synthetic fixture setup, to start the separate interruption test open.
  sql(`UPDATE private.onboarding SET ready=true WHERE user_id='${uid}';`);
  const beforeInterruption=await getRows(bypassSession.access_token);
  let resetInterrupted=false;
  try { await coordinatedReset(uid,admin,`Jj0!${secret()}`,async()=>{throw new Error('SIMULATED_INTERRUPTION');}); } catch { resetInterrupted=true; }
  const afterInterruptedReset=await getRows(bypassSession.access_token);
  note('interrupted_reset_stays_closed',resetInterrupted && beforeInterruption.status===200 && beforeInterruption.data.length===1 && afterInterruptedReset.status===200 && afterInterruptedReset.data.length===0?'PASS':'FAIL',`before=${beforeInterruption.data.length}; interrupted=${resetInterrupted}; after=${afterInterruptedReset.data.length}.`);
  if(!adminUpdate.ok || secondBefore.status!==200 || secondAfter.status!==200)throw new Error('ADMIN_CHANGE_TEST_FAILED');
  note('hosted_ssr_and_production','NOT_RUN','Isolated Auth/PostgREST/RLS experiment; not app integration or hosted configuration.');
} catch (error) {
  if(created.includes(names.auth)) {
    const logs=spawnSync('docker',['logs',names.auth],{encoding:'utf8'}); const output=String(logs.stdout)+String(logs.stderr);
    const categories=[['database',/database|postgres|migration/i],['configuration',/config|environment|invalid/i],['network',/connection|network|dial tcp/i]].filter(([,pattern])=>pattern.test(output)).map(([label])=>label);
    const indicators=[['missing_database_url',/DATABASE_URL.*(missing|required)|missing.*DATABASE_URL/i],['missing_jwt',/JWT.*(missing|required)|missing.*JWT/i],['schema',/schema.*(does not exist|missing)/i],['database_connection',/failed to connect|connection refused/i],['jwt_configuration',/JWT.*(invalid|error)/i],['migrations',/migrat/i],['namespace',/namespace/i],['mail_failure',/smtp.*(error|fail|refused)|error.*smtp/i],['email_invalid',/email.*(invalid|not allowed)/i]].filter(([,pattern])=>pattern.test(output)).map(([label])=>label);
    note('auth_startup_diagnostic','OBSERVED',`categorías=${categories.join(',')||'unknown'}; indicadores=${indicators.join(',')||'unknown'}; logs descartados`);
  }
  note('execution','BLOCKED',`Etapa ${stage}; causa=${stage==='database_setup' ? error.message : (['PORT_NOT_LOOPBACK','READINESS_TIMEOUT','INVITE_FAILED','INVITE_LINK_MISSING','INVITE_TOKEN_MISSING','VERIFY_FAILED','SESSION_MISSING'].includes(error.message)?error.message:'OTHER')}; detalles sensibles omitidos.`);
}
finally {
  for(const name of created.reverse()) { try { if(name===names.auth){docker(['rm','-f',name]);}else{docker(['stop','--time','5',name]);} note(`cleanup_${name.split('-')[2]}`,'PASS'); } catch { note(`cleanup_${name.split('-')[2]}`,'FAIL'); } }
  if(networkCreated){try{docker(['network','rm',names.network]);note('cleanup_network','PASS');}catch{note('cleanup_network','FAIL');}}
  await writeFile('results.json',JSON.stringify({date:new Date().toISOString(),images,results},null,2)+'\n');
  console.log(JSON.stringify({results},null,2));
  if(results.some(x=>['FAIL','BLOCKED'].includes(x.status)))process.exitCode=1;
}

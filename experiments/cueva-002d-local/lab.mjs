import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

// Isolated test-only stack. All keys and accounts are synthetic and ephemeral.
const images = {
  db: 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
  auth: 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
  mail: 'public.ecr.aws/supabase/mailpit@sha256:37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6',
};
const id = randomUUID().replaceAll('-', '').slice(0, 12);
const names = { network: `cueva-002d-net-${id}`, db: `cueva-002d-db-${id}`, auth: `cueva-002d-auth-${id}`, mail: `cueva-002d-mail-${id}` };
const secret = () => randomBytes(32).toString('hex');
const dbPassword = secret(), jwtSecret = secret(), password = `Aa9!${secret()}`;
const fixtureEmail = `student-${id}@example.com`, strangerEmail = `stranger-${id}@example.com`;
const created = [], results = [];
let networkCreated = false, stage = 'network';
const note = (name, status, detail = '') => results.push({name, status, detail});
const docker = (args, extraEnv = {}) => execFileSync('docker', args, {encoding:'utf8', stdio:['ignore','pipe','pipe'], env:{...process.env,...extraEnv}}).trim();
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
  const env={GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://postgres:${dbPassword}@db:5432/postgres`,GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',GOTRUE_SITE_URL:'http://127.0.0.1:9999',API_EXTERNAL_URL:'http://127.0.0.1:9999',GOTRUE_JWT_SECRET:jwtSecret,GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_DISABLE_SIGNUP:'true',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_SMTP_HOST:'mail',GOTRUE_SMTP_PORT:'1025',GOTRUE_SMTP_ADMIN_EMAIL:'admin@example.com',GOTRUE_SMTP_SENDER_NAME:'Cueva Lab'};
  stage='auth_start';
  start(names.auth,images.auth,['-p','127.0.0.1::9999',...Object.keys(env).flatMap(key=>['-e',key])],env,true);
  stage='auth_ready';
  const base=`http://127.0.0.1:${port(names.auth,9999)}`;
  for(let i=0;i<60;i++){if(docker(['inspect','--format','{{.State.Running}}',names.auth])!=='true')throw new Error('AUTH_EXIT'); try{if((await request(`${base}/health`)).ok)break;}catch{} if(i===59)throw new Error('READINESS_TIMEOUT'); await sleep(1000);}
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
  const userInvite=await request(`${base}/invite`,{method:'POST',token:session.access_token,body:{email:strangerEmail}});
  note('student_invite_rejected',userInvite.status===401 || userInvite.status===403?'PASS':'FAIL',`status=${userInvite.status}`);
  const unauthedUpdate=await request(`${base}/user`,{method:'PUT',body:{password}});
  note('anonymous_password_update_rejected',unauthedUpdate.status===401 || unauthedUpdate.status===403?'PASS':'FAIL',`status=${unauthedUpdate.status}`);
  const update=await request(`${base}/user`,{method:'PUT',token:session.access_token,body:{password}});
  note('set_password',update.ok?'PASS':'FAIL',`status=${update.status}`);
  const login=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:fixtureEmail,password}});
  note('password_login',login.ok?'PASS':'FAIL',`status=${login.status}`);
  const wrongLogin=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:fixtureEmail,password:`Incorrect!${secret()}`}});
  note('wrong_password_rejected',wrongLogin.status===400 || wrongLogin.status===401?'PASS':'FAIL',`status=${wrongLogin.status}`);
  const replay=await request(`${base}/verify`,{method:'POST',body:{token_hash:inviteToken,type:'invite'}});
  note('invite_replay_rejected',replay.status>=400?'PASS':'FAIL',`status=${replay.status}`);
  const anonInvite=await request(`${base}/invite`,{method:'POST',body:{email:strangerEmail}});
  note('unprivileged_invite_rejected',anonInvite.status>=400?'PASS':'FAIL',`status=${anonInvite.status}`);
  note('rls_and_application_session','NOT_RUN','Auth-only lab; no PostgREST, RLS, SSR client or production configuration.');
} catch (error) {
  if(created.includes(names.auth)) {
    const logs=spawnSync('docker',['logs',names.auth],{encoding:'utf8'}); const output=String(logs.stdout)+String(logs.stderr);
    const categories=[['database',/database|postgres|migration/i],['configuration',/config|environment|invalid/i],['network',/connection|network|dial tcp/i]].filter(([,pattern])=>pattern.test(output)).map(([label])=>label);
    const indicators=[['missing_database_url',/DATABASE_URL.*(missing|required)|missing.*DATABASE_URL/i],['missing_jwt',/JWT.*(missing|required)|missing.*JWT/i],['schema',/schema.*(does not exist|missing)/i],['database_connection',/failed to connect|connection refused/i],['jwt_configuration',/JWT.*(invalid|error)/i],['migrations',/migrat/i],['namespace',/namespace/i],['mail_failure',/smtp.*(error|fail|refused)|error.*smtp/i],['email_invalid',/email.*(invalid|not allowed)/i]].filter(([,pattern])=>pattern.test(output)).map(([label])=>label);
    note('auth_startup_diagnostic','OBSERVED',`categorías=${categories.join(',')||'unknown'}; indicadores=${indicators.join(',')||'unknown'}; logs descartados`);
  }
  note('execution','BLOCKED',`Etapa ${stage}; causa=${['PORT_NOT_LOOPBACK','READINESS_TIMEOUT','INVITE_FAILED','INVITE_LINK_MISSING','INVITE_TOKEN_MISSING','VERIFY_FAILED','SESSION_MISSING'].includes(error.message)?error.message:'OTHER'}; detalles sensibles omitidos.`);
}
finally {
  for(const name of created.reverse()) { try { if(name===names.auth){docker(['rm','-f',name]);}else{docker(['stop','--time','5',name]);} note(`cleanup_${name.split('-')[2]}`,'PASS'); } catch { note(`cleanup_${name.split('-')[2]}`,'FAIL'); } }
  if(networkCreated){try{docker(['network','rm',names.network]);note('cleanup_network','PASS');}catch{note('cleanup_network','FAIL');}}
  await writeFile('results.json',JSON.stringify({date:new Date().toISOString(),images,results},null,2)+'\n');
  console.log(JSON.stringify({results},null,2));
  if(results.some(x=>['FAIL','BLOCKED'].includes(x.status)))process.exitCode=1;
}

import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { launch } from './application.mjs';
import pg from 'pg';

// Isolated test-only stack. All keys and accounts are synthetic and ephemeral.
const images = {
  db: 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
  auth: 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
  mail: 'public.ecr.aws/supabase/mailpit@sha256:37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6',
  rest: 'public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962',
};
const id = randomUUID().replaceAll('-', '').slice(0, 12);
const names = { network: `cueva-002g-net-${id}`, db: `cueva-002g-db-${id}`, auth: `cueva-002g-auth-${id}`, mail: `cueva-002g-mail-${id}`, rest: `cueva-002g-rest-${id}` };
const secret = () => randomBytes(32).toString('hex');
const dbPassword = secret(), authenticatorPassword = secret(), coordinatorPassword = secret(), jwtSecret = secret(), password = `Aa9!${secret()}`;
const created = [], results = [];
let networkCreated = false, stage = 'network';
const note = (name, status, detail = '') => results.push({name, status, detail});
const docker = (args, extraEnv = {}) => execFileSync('docker', args, {encoding:'utf8', stdio:['ignore','pipe','pipe'], env:{...process.env,...extraEnv}}).trim();
const sql = input => { try { return execFileSync('docker', ['exec','-i',names.db,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], {input, encoding:'utf8', stdio:['pipe','pipe','pipe']}).trim(); } catch (error) { const match=String(error.stderr || '').match(/ERROR:\s*(function|role|schema|relation|permission|syntax)[^\n]{0,80}/i)?.[0] || 'DATABASE_SETUP_FAILED'; throw new Error(match); } };
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
  start(names.db,images.db,['--network-alias','db','-p','127.0.0.1::5432','-e','POSTGRES_PASSWORD'],{POSTGRES_PASSWORD:dbPassword});
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
  sql(`ALTER ROLE authenticator PASSWORD '${authenticatorPassword}'; ALTER ROLE cueva_coordinator PASSWORD '${coordinatorPassword}';`);
  const dbPort=port(names.db,5432);
  const wrongAdmin=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'postgres',password:authenticatorPassword,connectionTimeoutMillis:5000});
  let rejected=false;
  try { await wrongAdmin.connect(); } catch (error) { rejected=error.code==='28P01'; } finally { await wrongAdmin.end(); }
  note('authenticator_password_cannot_login_as_postgres',rejected?'PASS':'FAIL');
  const restDb = new URL('postgres://db:5432/postgres'); restDb.username='authenticator'; restDb.password=authenticatorPassword;
  const restEnv={PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:jwtSecret,PGRST_SERVER_HOST:'0.0.0.0',PGRST_SERVER_PORT:'3000'};
  restEnv.PGRST_DB_URI = restDb.href;
  stage='rest_start'; start(names.rest,images.rest,['-p','127.0.0.1::3000',...Object.keys(restEnv).flatMap(key=>['-e',key])],restEnv);
  const rest=`http://127.0.0.1:${port(names.rest,3000)}`;
  stage='rest_ready'; await waitFor(async()=>(await request(`${rest}/`)).status<500);
  const admin=testJwt('service_role');
  stage='browser_flow';
  const { runBrowserFlow }=await import('./browser-test.mjs');
  await runBrowserFlow({base,rest,mailBase,dbPort,coordinatorPassword,admin,anon:testJwt('anon'),id,password,sql,request,note,launch,chromium,pg,secret});
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

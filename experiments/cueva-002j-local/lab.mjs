import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID, createHmac } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { freePort, launch } from './application.mjs';
import { run } from './flow.mjs';

const images = {
  db: 'postgres@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24',
  auth: 'public.ecr.aws/supabase/gotrue@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b',
  mail: 'public.ecr.aws/supabase/mailpit@sha256:37a38e48e9338cd7e89dfeb487f37b02ebfcd9cb23111bed2d345e79d37d6dd6',
  rest: 'public.ecr.aws/supabase/postgrest@sha256:ec0e25a4e24b0a3bc5e4f011369bfc736bd1b19f513bd01079b86329a7636962',
  templates: 'public.ecr.aws/supabase/studio@sha256:32a293ffd7b081926b225f6503bf13730447e544041d1f37f0a5586578183e91',
};
const id = randomUUID().replaceAll('-', '').slice(0, 12);
const network = `cueva-002j-net-${id}`, created = [], results = [];
const names = Object.fromEntries(Object.keys(images).map(key => [key, `cueva-002j-${key}-${id}`]));
const secret = () => randomBytes(32).toString('hex');
const dbPassword = secret(), restPassword = secret(), jwtSecret = secret();
const docker = (args, env = {}) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } }).trim();
const note = (name, ok, detail = '') => results.push({ name, status: typeof ok === 'string' ? ok : ok ? 'PASS' : 'FAIL', detail });
const sql = text => execFileSync('docker', ['exec', '-i', names.db, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function wait(fn) { for (let i = 0; i < 60; i++) { try { if (await fn()) return; } catch {} await sleep(1000); } throw new Error('READINESS'); }
function start(key, args, env = {}) { docker(['run', '-d', '--name', names[key], '--network', network, '--memory', '512m', '--cpus', '1', '--log-driver', 'none', ...args, images[key]], env); created.push(key); }
function port(key, inner) { const bindings = JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', names[key]]))[`${inner}/tcp`]; if (bindings?.length !== 1 || bindings[0].HostIp !== '127.0.0.1') throw new Error('LOOPBACK'); return Number(bindings[0].HostPort); }
function token(role) { const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url'); const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role, aud: 'authenticated', exp: Math.floor(Date.now()/1000)+1800 })}`; return `${unsigned}.${createHmac('sha256', jwtSecret).update(unsigned).digest('base64url')}`; }
let networkCreated = false, app, stage = 'setup';
try {
  docker(['network', 'create', network]); networkCreated = true;
  start('db', ['--network-alias', 'db', '-p', '127.0.0.1::5432', '-e', 'POSTGRES_PASSWORD'], { POSTGRES_PASSWORD: dbPassword });
  await wait(() => { docker(['exec', names.db, 'pg_isready', '-U', 'postgres']); return true; });
  sql('create schema auth; alter role postgres set search_path=auth,public');
  start('mail', ['--network-alias', 'mail', '-p', '127.0.0.1::8025']);
  const mail = `http://127.0.0.1:${port('mail', 8025)}`;
  await wait(async () => (await fetch(`${mail}/api/v1/messages`)).ok);
  const templatePath = fileURLToPath(new URL('../../supabase/templates/', import.meta.url));
  const server = "const http=require('http'),fs=require('fs');http.createServer((q,s)=>{const p={'/invite.html':'invite.html','/recovery.html':'recovery.html'}[q.url];if(!p){s.writeHead(404);return s.end()}s.setHeader('Content-Type','text/html');s.end(fs.readFileSync('/templates/'+p))}).listen(8080,'0.0.0.0')";
  // The studio image's default CMD would start Studio. Replace it with only a
  // static template server; no other service or host port is exposed.
  docker(['run', '-d', '--name', names.templates, '--network', network, '--network-alias', 'templates', '--memory', '128m', '--cpus', '1', '--log-driver', 'none', '--mount', `type=bind,source=${templatePath},target=/templates,readonly`, '--entrypoint', 'node', images.templates, '-e', server]); created.push('templates');
  const appPort = await freePort(), site = `http://127.0.0.1:${appPort}`;
  const dbUrl = new URL('postgres://postgres@db:5432/postgres'); dbUrl.password = dbPassword;
  const env = { GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: dbUrl.href, GOTRUE_API_HOST: '0.0.0.0', GOTRUE_API_PORT: '9999', API_EXTERNAL_URL: 'http://127.0.0.1:9999', GOTRUE_SITE_URL: site, GOTRUE_URI_ALLOW_LIST: `${site}/aceptar-invitacion*`, GOTRUE_JWT_SECRET: jwtSecret, GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_DISABLE_SIGNUP: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'false', GOTRUE_SMTP_HOST: 'mail', GOTRUE_SMTP_PORT: '1025', GOTRUE_SMTP_ADMIN_EMAIL: 'admin@example.com', GOTRUE_SMTP_SENDER_NAME: 'Cueva Lab', GOTRUE_SMTP_MAX_FREQUENCY: '1s', GOTRUE_MAILER_TEMPLATES_INVITE: 'http://templates:8080/invite.html', GOTRUE_MAILER_TEMPLATES_RECOVERY: 'http://templates:8080/recovery.html' };
  start('auth', ['-p', '127.0.0.1::9999', ...Object.keys(env).flatMap(key => ['-e', key])], env);
  const base = `http://127.0.0.1:${port('auth', 9999)}`;
  await wait(async () => (await fetch(`${base}/health`)).ok);
  sql('create role anon nologin; create role authenticated nologin; create role authenticator login; create role service_role nologin bypassrls; grant anon,authenticated,service_role to authenticator; grant usage on schema auth to authenticated; revoke all on function auth.uid() from public; grant execute on function auth.uid() to authenticated');
  sql(await readFile(new URL('../../supabase/migrations/20261102151526_cueva_product_access.sql', import.meta.url), 'utf8'));
  sql(`alter role authenticator password '${restPassword}'`);
  const restDb = new URL('postgres://authenticator@db:5432/postgres'); restDb.password = restPassword;
  const restEnv = { PGRST_DB_URI: restDb.href, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: jwtSecret, PGRST_SERVER_HOST: '0.0.0.0', PGRST_SERVER_PORT: '3000' };
  start('rest', ['-p', '127.0.0.1::3000', ...Object.keys(restEnv).flatMap(key => ['-e', key])], restEnv);
  const rest = `http://127.0.0.1:${port('rest', 3000)}`, anon = token('anon'), admin = token('service_role');
  await wait(async () => (await fetch(rest)).status < 500);
  app = await launch({ port: appPort, base, rest, anon, admin }); stage = 'flow';
  const localDb = new URL(`postgres://postgres@127.0.0.1:${port('db', 5432)}/postgres`); localDb.password = dbPassword;
  await run({ base, rest, mail, site, anon, admin, database: localDb.href, id, secret, sql, note, stopApp: async () => { await app.close(); app = null; }, stopAuth: () => { docker(['stop', '--time', '10', names.auth]); return docker(['inspect', '--format', '{{.State.Running}}', names.auth]) === 'false'; } });
} catch (error) {
  const safe = ['READINESS','LOOPBACK','NEXT_EXIT','NEXT_NOT_READY','MAIL_MISSING','TEMPLATE_MISMATCH','FIXTURE_ID','REDIRECT_FIXTURE','INTERRUPTED_FIXTURE','QUIESCENCE_FAILED'];
  const locations = [...String(error.stack).matchAll(/(?:flow|lab|access-operations)\.mjs:\d+:\d+/g)].map(match => match[0]);
  note('error_location', 'OBSERVED', `kind=${/^[A-Za-z]+$/.test(error.name) ? error.name : 'unknown'}; locations=${locations.join(',')}`);
  note('execution', false, `stage=${stage}; cause=${safe.includes(error.message) ? error.message : 'OTHER'}; sensitive error details discarded`);
}
finally {
  if (app) await app.close();
  for (const key of created.reverse()) { try { docker(['rm', '-f', names[key]]); note(`cleanup_${key}`, true); } catch { note(`cleanup_${key}`, false); } }
  if (networkCreated) { try { docker(['network', 'rm', network]); note('cleanup_network', true); } catch { note('cleanup_network', false); } }
  await writeFile(new URL('results.json', import.meta.url), JSON.stringify({ date: new Date().toISOString(), images, results }, null, 2)+'\n');
  console.log(JSON.stringify({ results }, null, 2));
  if (results.some(row => ['FAIL', 'BLOCKED'].includes(row.status))) process.exitCode = 1;
}

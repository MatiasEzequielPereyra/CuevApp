import nodemailer from 'nodemailer';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {smtpRepairBinding} from '../../scripts/smtp-repair-binding.mjs';

export async function verifySmtpRepair(config) {
  const r=config.request;
  const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  if(!r||![r.previousAttemptId,r.attemptId,r.studentId,r.authUserId].every(uuid)||r.generation!==2||r.expectedState!=='review'||
    r.attemptId===r.previousAttemptId||!/^[0-9a-f]{64}$/.test(r.previousAuthorizationHash??'')||
    !/^[0-9a-f]{64}$/.test(r.priorRejection?.evidenceSha256??'')||r.jobLease!==r.previousAttemptId||r.supabaseSmtpConfigReviewed!==true||
    r.originalRequestCompleted!==true||r.requestsQuiescent!==true||r.noSmtpAcceptance!==true||
    ![534,535].includes(r.priorRejection?.smtpCode))throw Error('PREFLIGHT_INPUT_INVALID');
  if(typeof config.username!=='string'||!config.username||typeof config.password!=='string'||!config.password)throw Error('SMTP_CREDENTIALS_REQUIRED');
  if(createHash('sha256').update(config.username).digest('hex')!==r.smtpLoginSha256)throw Error('SMTP_LOGIN_MISMATCH');
  const host=config.local?'127.0.0.1':'smtp-relay.brevo.com',port=config.local?config.port:587;
  if(config.local&&(!Number.isInteger(port)||port<1||port>65535||!config.ca))throw Error('LOCAL_TLS_REQUIRED');
  const transport=nodemailer.createTransport({host,port,secure:false,requireTLS:true,forceAuth:true,
    auth:{user:config.username,pass:config.password},tls:{rejectUnauthorized:true,minVersion:'TLSv1.2',servername:config.local?'localhost':host,...(config.local?{ca:config.ca}:{})},
    logger:false,debug:false,connectionTimeout:10000,greetingTimeout:10000,socketTimeout:10000,disableFileAccess:true,disableUrlAccess:true});
  try {
    if(await transport.verify()!==true)throw Error('SMTP_AUTH_NOT_VERIFIED');
    return {source:'cueva-smtp-auth-preflight-v1',provider:'brevo',host,port,localSynthetic:!!config.local,
      tlsVerified:true,smtpAuthenticated:true,noMailCommands:true,supabaseSmtpConfigReviewed:true,
      binding:smtpRepairBinding(r),smtpLoginSha256:r.smtpLoginSha256,checkedAt:new Date().toISOString()};
  } finally {transport.close();}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    if(process.argv.length!==3||process.argv[2]!=='--verify-auth')throw Error('ARGUMENTS_INVALID');
    const env=process.env,raw=await readFile(env.CUEVA_RECONCILIATION_REQUEST,'utf8');
    if(Buffer.byteLength(raw)>16384)throw Error('REQUEST_TOO_LARGE');
    const destination=resolve(env.CUEVA_SMTP_REPAIR_EVIDENCE),root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
    if(destination.toLowerCase()===root.toLowerCase()||destination.toLowerCase().startsWith(root.toLowerCase()+sep))throw Error('PRIVATE_PATH_REQUIRED');
    const proof=await verifySmtpRepair({request:JSON.parse(raw),username:env.CUEVA_SMTP_USER,password:env.CUEVA_SMTP_KEY});
    const text=JSON.stringify(proof)+'\n';
    await writeFile(destination,text,{flag:'wx',mode:0o600});
    console.log(JSON.stringify({mode:'SMTP_AUTH_VERIFIED_NO_MAIL',evidenceSha256:createHash('sha256').update(text).digest('hex')}));
  } catch {
    // SMTP errors can contain login details; never print messages, responses or stacks.
    console.error(JSON.stringify({mode:'STOPPED',code:'SMTP_PREFLIGHT_NOT_CONFIRMED_NO_RETRY'}));process.exitCode=1;
  }
}

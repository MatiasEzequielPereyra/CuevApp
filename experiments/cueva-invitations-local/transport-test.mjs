import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {reconcile} from '../../scripts/reconcile-student-invitation.mjs';

// Transport-only fixture: no historical SMTP assertion is replayed or certified.
export async function runBrowserFlow({base,admin,id,request,note,pg,dbPort,dbPassword}) {
  const db=new pg.Client({host:'127.0.0.1',port:dbPort,user:'postgres',password:dbPassword,database:'postgres'});
  const check=(name,ok)=>{note(name,ok?'PASS':'FAIL');if(!ok)throw Error('TRANSPORT_ASSERTION');};
  const original=pg.Client.prototype.query;
  try {
    await db.connect();
    const email=`transport-${id}@example.com`,student=randomUUID(),lease=randomUUID(),nonceHash=createHash('sha256').update(randomBytes(32)).digest('hex');
    const created=await(await request(`${base}/admin/users`,{method:'POST',token:admin,body:{email,email_confirm:false}})).json();
    if(!created.id)throw Error('TRANSPORT_FIXTURE');
    await db.query('select cueva_private.prepare_invitation($1,$2)',[created.id,nonceHash]);
    await db.query("insert into public.cueva_students values($1,'Synthetic','Transport',$2,null,'2026-11-05',true)",[student,email]);
    await db.query("insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,'review',$4,$3)",[student,email,created.id,lease]);
    const observedAt=new Date().toISOString();
    const evidence=JSON.stringify({source:'operator-reviewed-smtp-rejection',studentId:student,jobLease:lease,authUserId:created.id,email,generation:1,smtpCode:535,diagnostic:'BadCredentials',observedAt,requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true});
    const claim={studentId:student,jobLease:lease,authUserId:created.id,attemptId:randomUUID(),generation:1,expectedState:'review',email,priorRejection:{smtpCode:535,diagnostic:'BadCredentials',observedAt,evidenceSha256:createHash('sha256').update(evidence).digest('hex')},requestsQuiescent:true,noSmtpAcceptance:true,originalRequestCompleted:true};
    const owners=new Set(),pids=new Set();let heldAfterRollback=false,authCalls=0;
    pg.Client.prototype.query=async function(...args){
      owners.add(this);
      const result=await original.apply(this,args);
      const statement=args[0];
      const probe=await original.call(this,"select pg_backend_pid() as pid,exists(select 1 from pg_locks where pid=pg_backend_pid() and locktype='advisory' and granted) as held");
      pids.add(probe.rows[0].pid);
      if(statement==='rollback')heldAfterRollback=probe.rows[0].held;
      return result;
    };
    let result;
    try{result=await reconcile({local:true,url:base,site:base,database:`postgres://postgres:${dbPassword}@127.0.0.1:${dbPort}/postgres`,key:admin,evidence,request:claim,fetch:()=>{authCalls++;throw Error('AUTH_NOT_ALLOWED');}},'check');}
    finally{pg.Client.prototype.query=original;}
    check('actual_check_eligible_without_dispatch',result.mode==='CHECKED_NO_SEND'&&result.state==='eligible'&&authCalls===0);
    check('one_client_one_backend_for_operation',owners.size===1&&pids.size===1);
    check('session_advisory_survives_transaction_rollback',heldAfterRollback);
    const released=await db.query("select not exists(select 1 from pg_locks where pid=$1 and locktype='advisory') as released",[[...pids][0]]);
    check('session_lock_released_only_after_client_end',released.rows[0].released);
    const state=await db.query('select j.state,g.generation,g.nonce_hash,g.operation_id,g.ready from public.cueva_student_invitations j join cueva_private.access_state g on g.user_id=j.user_id where j.student_id=$1',[student]);
    const g=state.rows[0];
    check('check_preserves_review_generation_nonce_gate',g.state==='review'&&g.generation==='1'&&g.nonce_hash===nonceHash&&g.operation_id===null&&!g.ready);
    check('no_reservation_created',(await db.query('select count(*)::int as n from cueva_private.invitation_reconciliation')).rows[0].n===0);
  }finally{pg.Client.prototype.query=original;await db.end();}
}

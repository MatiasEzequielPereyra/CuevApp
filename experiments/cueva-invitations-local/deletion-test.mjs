import {randomUUID} from 'node:crypto';
import {mkdir} from 'node:fs/promises';

export async function runBrowserFlow({base,rest,mailBase,admin,anon,id,password,request,note,launch,chromium,dbPort,dbPassword,coordinatorPassword,pg}) {
  let app,browser,step='fixtures';
  const db=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'postgres',password:dbPassword});
  const check=(name,ok)=>{note(name,ok?'PASS':'FAIL');if(!ok)throw Error('ASSERTION');};
  const q=async(text,values)=>(await db.query(text,values)).rows;
  const exists=async student=>(await q('select exists(select 1 from public.cueva_students where id=$1) as present',[student]))[0].present;
  const users=[];
  const fixture=async label=>{const student=randomUUID(),email=`delete-${label}-${id}@example.com`;await db.query("insert into public.cueva_students values($1,'Ficha','Por error',$2,null,'2026-11-04',true)",[student,email]);return {id:student,email};};
  const rpc=(f,confirm=true,token=users[0].token)=>request(`${rest}/rpc/cueva_delete_empty_student`,{method:'POST',token,body:{p_student:f.id,p_expected_email:f.email,p_confirm:confirm}});
  const queue=async(f,state,user=null)=>db.query('insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values($1,$2,$3,$4,$5,$6)',[f.id,f.email,user,state,randomUUID(),users[0].id]);
  const write=async(payload,op=randomUUID())=>{const r=await request(`${rest}/rpc/cueva_billing_write`,{method:'POST',token:users[0].token,body:{op,p:payload}});if(!r.ok)throw Error('BILLING_FIXTURE');return op;};
  const today=new Date().toISOString().slice(0,10),month=today.slice(0,7);
  const period=f=>write({kind:'period',student_id:f.id,month,due_on:today});
  const post=(context,f,extra={})=>context.request.post(`${app.origin}/api/alumnos/eliminar`,{headers:{origin:app.origin},data:{id:f.id,email:f.email,confirmed:true,...extra}});
  async function race(f,hold,checkName,context){
    const connection=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'postgres',password:dbPassword});
    await connection.connect();let transaction=false;
    try {
      await connection.query('begin');transaction=true;
      await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(JSON.parse(Buffer.from(users[0].token.split('.')[1],'base64url').toString()))]);
      await hold(connection);
      const deleting=post(context,f);let waiting=false;
      for(let n=0;n<50;n++){const rows=await q("select exists(select 1 from pg_locks where not granted and locktype in ('advisory','transactionid')) as waiting");if(rows[0].waiting){waiting=true;break;}await new Promise(r=>setTimeout(r,50));}
      await connection.query('commit');transaction=false;
      const response=await deleting;check(checkName,waiting&&response.status()===409&&await exists(f.id));
    }finally{if(transaction)await connection.query('rollback');await connection.end();}
  }
  try {
    await db.connect();
    for(const role of ['admin','alumno']){
      const email=`delete-${role}-${id}@example.com`,r=await request(`${base}/admin/users`,{method:'POST',token:admin,body:{email,password,email_confirm:true}}),u=await r.json();if(!u.id)throw Error('USER_FIXTURE');
      await db.query('insert into public.cueva_profiles values($1,$2)',[u.id,role]);await db.query("insert into cueva_private.access_state(user_id,ready,session_not_before) values($1,true,'2000-01-01')",[u.id]);
      const session=await(await request(`${base}/token?grant_type=password`,{method:'POST',body:{email,password}})).json();users.push({id:u.id,email,token:session.access_token});
    }
    await write({kind:'price',month,cents:'4000000'});
    app=await launch({authBase:base,restBase:rest,anonKey:anon,admin,dbPort,dbPassword:coordinatorPassword});browser=await chromium.launch({headless:true});
    const context=await browser.newContext(),page=await context.newPage();
    await page.goto(`${app.origin}/ingresar`);await page.getByLabel('Correo electrónico').fill(users[0].email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.waitForURL('**/cuenta');
    step='confirmation';const plain=await fixture('plain');
    check('preview_read_only',(await(await rpc(plain,false)).json())==='eligible'&&await exists(plain.id));
    await page.goto(`${app.origin}/alumnos?id=${plain.id}`);await page.getByRole('button',{name:'Eliminar alumno',exact:true}).click();
    const dialog=page.getByRole('dialog');await dialog.waitFor();check('confirmation_names_student',await dialog.getByRole('heading',{name:'¿Eliminar a Ficha Por error?'}).count()===1&&await exists(plain.id));
    check('initial_focus_cancel',await dialog.getByRole('button',{name:'Cancelar'}).evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Shift+Tab');check('keyboard_focus_trapped',await dialog.getByRole('button',{name:'Eliminar definitivamente'}).evaluate(el=>el===document.activeElement));
    await page.keyboard.press('Escape');check('escape_preserves_student',!await dialog.isVisible()&&await exists(plain.id));
    await page.getByRole('button',{name:'Eliminar alumno',exact:true}).click();await dialog.getByRole('button',{name:'Cancelar'}).click();check('cancel_preserves_student',await exists(plain.id));
    await mkdir('../../evidence/runs',{recursive:true});
    for(const [width,theme] of [[390,'Oscuro'],[1440,'Claro']]){await page.setViewportSize({width,height:960});await page.getByRole('button',{name:theme,exact:true}).click();await page.getByRole('button',{name:'Eliminar alumno',exact:true}).click();check(`dialog_no_overflow_${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('dialog').getBoundingClientRect().width<=innerWidth));await page.screenshot({path:`../../evidence/runs/delete-student-${width}.png`,fullPage:true});await dialog.getByRole('button',{name:'Cancelar'}).click();}
    await page.getByRole('button',{name:'Eliminar alumno',exact:true}).click();await dialog.getByRole('button',{name:'Eliminar definitivamente'}).click();await page.waitForURL('**/alumnos?eliminado=1');check('confirmed_delete_and_banner',!await exists(plain.id)&&await page.getByText('La ficha fue eliminada correctamente.',{exact:true}).count()===1);
    await page.goto(`${app.origin}/alumnos?id=${plain.id}`);check('reload_no_record',await page.getByText('No se encontró la ficha.',{exact:true}).count()===1);
    check('replay_safe',(await post(context,plain)).ok());
    step='protection';
    for(const state of ['blocked','failed']){const f=await fixture(state);await queue(f,state);check(`unprovisioned_${state}_deletable`,(await(await rpc(f)).json())==='deleted'&&!await exists(f.id)&&(await q('select count(*)::int as n from public.cueva_student_invitations where student_id=$1',[f.id]))[0].n===0);}
    for(const state of ['processing','review','sent']){const f=await fixture(state);await queue(f,state);check(`${state}_protected`,(await(await rpc(f)).json())==='protected'&&await exists(f.id));}
    const account=await fixture('account');const created=await(await request(`${base}/admin/users`,{method:'POST',token:admin,body:{email:account.email,email_confirm:false}})).json();
    check('matching_account_blocks_without_association',(await(await rpc(account)).json())==='protected'&&await exists(account.id)&&(await q('select count(*)::int as n from auth.users where id=$1',[created.id]))[0].n===1);
    const linked=await fixture('linked');await queue(linked,'blocked',created.id);check('captured_uuid_protects_even_if_email_differs',(await(await rpc(linked)).json())==='protected'&&await exists(linked.id));
    const financial=await fixture('period');const periodId=await period(financial);check('unpaid_period_protects',(await(await rpc(financial)).json())==='protected');
    const payment=await write({kind:'payment',student_id:financial.id,period_id:periodId,cents:'1000000',paid_on:today,method:'efectivo'});await write({kind:'reverse',student_id:financial.id,payment_id:payment,reason:'Prueba de conservación'});
    check('payments_and_reversal_preserved',(await(await rpc(financial)).json())==='protected'&&(await q('select count(*)::int as n from public.cueva_payments where id=$1',[payment]))[0].n===1&&(await q('select count(*)::int as n from public.cueva_reversals where payment_id=$1',[payment]))[0].n===1);
    await page.goto(`${app.origin}/alumnos?id=${financial.id}`);check('protected_button_disabled_with_explanation',await page.getByRole('button',{name:'Eliminar alumno',exact:true}).isDisabled()&&await page.getByText(/Esta ficha tiene historial/).count()===1);
    const stale=await fixture('stale');await page.goto(`${app.origin}/alumnos?id=${stale.id}`);await page.getByRole('button',{name:'Eliminar alumno',exact:true}).click();await period(stale);await page.getByRole('dialog').getByRole('button',{name:'Eliminar definitivamente'}).click();await page.getByRole('dialog').getByRole('alert').waitFor();check('server_rechecks_after_dialog_open',await exists(stale.id)&&await page.getByRole('dialog').isVisible());
    const changed=await fixture('changed');await db.query('update public.cueva_students set email=$2 where id=$1',[changed.id,`changed-${id}@example.com`]);check('stale_email_rejected',(await post(context,changed)).status()===409&&await exists(changed.id));
    step='boundaries';const permitted=await fixture('boundaries');
    check('explicit_confirmation_required',(await post(context,permitted,{confirmed:false})).status()===400&&await exists(permitted.id));
    check('wrong_origin_denied',(await context.request.post(`${app.origin}/api/alumnos/eliminar`,{headers:{origin:'https://other.example.com'},data:{id:permitted.id,email:permitted.email,confirmed:true}})).status()===403);
    check('oversized_request_denied',(await post(context,permitted,{junk:'x'.repeat(1024)})).status()===413);
    check('invalid_uuid_denied',(await post(context,permitted,{id:'wrong'})).status()===400);
    check('get_never_deletes',(await context.request.get(`${app.origin}/api/alumnos/eliminar`)).status()===405&&await exists(permitted.id));
    for(const [name,token] of [['pupil',users[1].token],['anon',anon]])check(`${name}_rpc_denied`,!(await rpc(permitted,true,token)).ok);
    const visitor=await browser.newContext();check('visitor_http_denied',(await post(visitor,permitted)).status()===403);await visitor.close();
    const pupil=await browser.newContext(),pupilPage=await pupil.newPage();await pupilPage.goto(`${app.origin}/ingresar`);await pupilPage.getByLabel('Correo electrónico').fill(users[1].email);await pupilPage.getByLabel('Contraseña',{exact:true}).fill(password);await pupilPage.getByRole('button',{name:'Ingresar',exact:true}).click();await pupilPage.waitForURL('**/cuenta');check('pupil_http_denied',(await post(pupil,permitted)).status()===403);await pupil.close();
    const direct=await request(`${rest}/cueva_students?id=eq.${permitted.id}`,{method:'DELETE',token:users[0].token});check('direct_delete_still_denied',!direct.ok&&await exists(permitted.id));
    step='races';const duplicate=await fixture('duplicate');const pair=await Promise.all([post(context,duplicate),post(context,duplicate)]);check('parallel_delete_idempotent',pair.every(x=>x.ok())&&!await exists(duplicate.id));
    const billingRace=await fixture('billing-race');await race(billingRace,c=>c.query('select public.cueva_billing_write($1,$2)',[randomUUID(),{kind:'period',student_id:billingRace.id,month,due_on:today}]),'concurrent_period_wins_delete_refuses',context);
    const inviteRace=await fixture('invite-race');await race(inviteRace,c=>c.query('select public.cueva_claim_student_invitation($1,$2)',[inviteRace.id,randomUUID()]),'concurrent_invitation_wins_delete_refuses',context);
    const deleted=await fixture('delete-wins');check('delete_wins',(await(await rpc(deleted)).json())==='deleted');const reserve=await request(`${rest}/rpc/cueva_claim_student_invitation`,{method:'POST',token:users[0].token,body:{student:deleted.id,claim:randomUUID()}});check('later_invite_cannot_create_orphan',!reserve.ok&&(await q('select count(*)::int as n from public.cueva_student_invitations where student_id=$1',[deleted.id]))[0].n===0);
    step='unknown_result';const lost=await fixture('lost');await page.goto(`${app.origin}/alumnos?id=${lost.id}`);await page.getByRole('button',{name:'Eliminar alumno',exact:true}).click();let calls=0;
    await page.route('**/api/alumnos/eliminar',async route=>{calls++;await route.fetch();await route.abort('failed');});await page.getByRole('dialog').getByRole('button',{name:'Eliminar definitivamente'}).click();await page.getByRole('dialog').getByRole('alert').waitFor();check('lost_response_honest_no_automatic_retry',calls===1&&!await exists(lost.id));await page.unroute('**/api/alumnos/eliminar');
    step='unavailable';await db.query('revoke execute on function public.cueva_delete_empty_student(uuid,text,boolean) from authenticated');await page.goto(`${app.origin}/alumnos?id=${permitted.id}`);check('missing_capability_fails_closed',await page.getByRole('button',{name:'Eliminar alumno',exact:true}).isDisabled()&&(await post(context,permitted)).status()===503&&await exists(permitted.id));
    check('no_real_auth_or_mail_operation',(await(await request(`${mailBase}/api/v1/messages`)).json()).total===0&&(await q('select count(*)::int as n from auth.users'))[0].n===3);
    await context.close();
  }catch(error){note('deletion_diagnostic','BLOCKED',`step=${step}; type=${error.name}; location=${String(error.stack).match(/deletion-test.mjs:\d+:\d+/)?.[0]??'unknown'}`);throw error;}
  finally{if(browser)await browser.close();if(app)await app.close();await db.end();}
}

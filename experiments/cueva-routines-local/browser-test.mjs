import { mkdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function runBrowserFlow({base,rest,mailBase,admin,anon,password,sql,request,note,launch,chromium,dbPort,coordinatorPassword}) {
  let app, browser, failurePage, step='fixtures';
  const check=(name,ok)=>{note(name,ok?'PASS':'FAIL');if(!ok)throw Error('CHECK_FAILED');};
  const users=[];
  const sid=crypto.randomUUID(), otherSid=crypto.randomUUID(), blankSid=crypto.randomUUID(), emptySid=crypto.randomUUID();
  const templateId=crypto.randomUUID();
  const initial='DÍA 1 — FUERZA\n\nSentadilla 3x8\nDescanso libre';
  try {
    for (const [index,role] of ['admin','admin','alumno','alumno','alumno'].entries()) {
      const email=`rutinas-${index}@example.com`;
      const res=await request(`${base}/admin/users`,{method:'POST',token:admin,body:{email,password,email_confirm:true}});
      const u=await res.json();if(!u.id)throw Error('FIXTURE');
      users.push({email,id:u.id});
      sql(`insert into public.cueva_profiles values('${u.id}','${role}'); insert into cueva_private.access_state(user_id,ready,session_not_before) values('${u.id}',${index!==4},'2000-01-01');`);
    }
    for(const [student,first,email] of [[sid,'Alumna','rutinas-2@example.com'],[otherSid,'Otro','rutinas-3@example.com'],[blankSid,'Borrador','blank@example.com'],[emptySid,'Vacía','empty@example.com']]) {
      sql(`insert into public.cueva_students values('${student}','${first}','Laboratorio','${email}',null,'2026-11-01',true);`);
    }
    for(const [student,u] of [[sid,users[2]],[otherSid,users[3]]]) {
      sql(`insert into public.cueva_student_invitations(student_id,email,user_id,state,lease,requested_by) values('${student}','${u.email}','${u.id}','sent','${crypto.randomUUID()}','${users[0].id}');`);
    }
    const tokens=[];
    for(const user of users){const r=await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:user.email,password}});const session=await r.json();if(!session.access_token)throw Error('SESSION');tokens.push(session.access_token);}
    const rpc=async(index,kind,id,revision,content,operation=crypto.randomUUID(),title=null)=>request(`${rest}/rpc/cueva_routine_write`,{method:'POST',token:tokens[index],body:{p_kind:kind,p_id:id,p_revision:revision,p_content:content,p_title:title,p_operation:operation}});
    const conflict=async response=>!response.ok&&(await response.json()).code==='40001';
    const data=async(path,index=0)=>(await request(`${rest}/${path}`,{token:tokens[index]})).json();
    const first=await rpc(0,'draft',sid,0,initial);check('draft_rpc',first.ok);
    let saved=await first.json();
    check('draft_author_server',saved.updated_by===users[0].id&&saved.revision===1&&!!saved.updated_at);
    check('pupil_no_drafts',(await data('cueva_routine_drafts',2)).length===0);
    check('pupil_no_templates',(await data('cueva_routine_templates',2)).length===0);
    check('before_publish_empty',(await data('cueva_routine_publications',2)).length===0);
    step='browser_start';
    app=await launch({authBase:base,restBase:rest,anonKey:anon,admin,dbPort,dbPassword:coordinatorPassword});
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await context.newPage();
    failurePage=page;
    page.setDefaultTimeout(15000);
    async function login(ctx,user,indexPage=page){await indexPage.goto(`${app.origin}/ingresar`);await indexPage.getByLabel('Correo electrónico').fill(user.email);await indexPage.getByLabel('Contraseña',{exact:true}).fill(password);await indexPage.getByRole('button',{name:'Ingresar',exact:true}).click();await indexPage.waitForURL('**/cuenta');}
    await login(context,users[0]);
    const api=(p,ctx=context)=>ctx.request.post(`${app.origin}/api/rutinas`,{headers:{origin:app.origin},data:p});
    const draft=(text,revision,operation=crypto.randomUUID())=>({kind:'draft',id:sid,revision,content:text,operation});
    step='navigation';
    await page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Rutinas',exact:true}).click();
    await page.getByLabel('Buscar alumno').fill('Alumna');await page.getByRole('button',{name:'Buscar',exact:true}).click();
    await page.locator(`a[href="/rutinas?alumno=${sid}"]`).click();
    const editor=page.getByLabel('Texto de la rutina',{exact:true});
    await expect(editor).toHaveValue(initial);check('search_select_existing_student',true);
    await page.goto(`${app.origin}/alumnos?id=${sid}`);await page.getByRole('link',{name:'Abrir rutina del alumno'}).click();await expect(editor).toHaveValue(initial);check('fiche_routine_navigation',true);
    step='autosave';
    const second=initial+'\n\nDÍA 2 — MOVILIDAD';
    await editor.fill(second);
    await expect(page.getByRole('button',{name:'Publicar rutina',exact:true})).toBeDisabled();check('publish_disabled_pending_save',true);
    await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();
    await page.reload();await expect(editor).toHaveValue(second);check('autosave_reload_persisted',true);
    step='publish';
    await page.getByRole('button',{name:'Publicar rutina',exact:true}).click();await expect(page.getByText('Rutina publicada. El alumno ya puede consultarla.')).toBeVisible();
    const published=(await data(`cueva_routine_publications?student_id=eq.${sid}`))[0];
    check('publication_server_author_date',published.published_by===users[0].id&&!!published.published_at&&published.content===second);
    const pupilContext=await browser.newContext(), pupil=await pupilContext.newPage();
    await login(pupilContext,users[2],pupil);await pupil.getByRole('link',{name:'Mi rutina →'}).click();await expect(pupil.locator('.routine-reading pre')).toHaveText(second);
    check('pupil_real_session_own_publication',true);
    const pendingText=second+'\nEDICIÓN PRIVADA';await editor.fill(pendingText);await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();
    await pupil.reload();await expect(pupil.locator('.routine-reading pre')).toHaveText(second);check('editing_preserves_previous_publication',true);
    step='out_of_order';
    let release, received;
    const gate=new Promise(resolve=>{release=resolve;});
    const reached=new Promise(resolve=>{received=resolve;});
    await page.route('**/api/rutinas',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();received();await gate;await route.fulfill({response});});
    await editor.fill('PRIMER CAMBIO EN VUELO');await expect(page.getByRole('status').filter({hasText:'Guardando…'})).toBeVisible();
    check('inflight_not_claimed_saved',await page.getByRole('status').filter({hasText:'Borrador guardado'}).count()===0);
    await reached;await editor.fill('SEGUNDO CAMBIO MÁS NUEVO');release();await page.unrouteAll({behavior:'wait'});
    await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();await page.reload();await expect(editor).toHaveValue('SEGUNDO CAMBIO MÁS NUEVO');check('old_response_never_overwrites_new_typing',true);
    step='revert_inflight_navigation';
    let releaseRevert, receiveRevert, sawWarning=false;
    const revertGate=new Promise(resolve=>{releaseRevert=resolve;});
    const revertReached=new Promise(resolve=>{receiveRevert=resolve;});
    await page.route('**/api/rutinas',async route=>{if(route.request().method()!=='POST')return route.continue();const response=await route.fetch();receiveRevert();await revertGate;await route.fulfill({response});});
    await editor.fill('CAMBIO TRANSITORIO');await revertReached;await editor.fill('SEGUNDO CAMBIO MÁS NUEVO');
    page.once('dialog',async dialog=>{sawWarning=true;await dialog.dismiss();});await page.getByRole('link',{name:'Plantillas',exact:true}).click();check('inflight_reverted_text_navigation_warns',sawWarning&&new URL(page.url()).pathname==='/rutinas');
    releaseRevert();await page.unrouteAll({behavior:'wait'});await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();await page.reload();await expect(editor).toHaveValue('SEGUNDO CAMBIO MÁS NUEVO');check('inflight_revert_persists_final_intent',true);
    step='save_failure';
    await page.route('**/api/rutinas',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Falla sintética de guardado'})}):route.continue());
    await editor.fill('RECUPERAR MI TEXTO');await expect(page.locator('.routine-editor').getByRole('alert')).toHaveText('Falla sintética de guardado');await expect(editor).toHaveValue('RECUPERAR MI TEXTO');
    check('error_preserves_local_text',true);check('error_no_false_saved',await page.getByRole('status').filter({hasText:'Borrador guardado'}).count()===0);
    await page.unroute('**/api/rutinas');await page.getByRole('button',{name:'Reintentar guardado'}).click();await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();check('save_recovery',true);
    step='lost_save_response';
    await page.route('**/api/rutinas',async route=>{if(route.request().method()!=='POST')return route.continue();await route.fetch();await route.abort('failed');});
    await editor.fill('GUARDADO SIN RESPUESTA');await expect(page.locator('.routine-editor').getByRole('alert')).toContainText('No recibimos confirmación');
    await page.unrouteAll({behavior:'wait'});await page.getByRole('button',{name:'Reintentar guardado'}).click();await expect(page.locator('.routine-editor').getByRole('alert')).toContainText('otra ventana');
    await page.getByRole('button',{name:'Comparar versión guardada'}).click();await expect(page.locator('.routine-conflict pre')).toHaveText('GUARDADO SIN RESPUESTA');await page.getByRole('button',{name:'Conservar mi texto sobre esta revisión'}).click();await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();check('lost_save_response_recovered_without_loss',true);
    step='conflict';
    const otherContext=await browser.newContext(), otherAdmin=await otherContext.newPage();await login(otherContext,users[1],otherAdmin);
    await otherAdmin.goto(`${app.origin}/rutinas?alumno=${sid}`);const otherEditor=otherAdmin.getByLabel('Texto de la rutina',{exact:true});
    await editor.fill('CAMBIO DEL ADMIN A');await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();
    await otherEditor.fill('CAMBIO DEL ADMIN B');await expect(otherAdmin.locator('.routine-editor').getByRole('alert')).toContainText('otra ventana');await expect(otherEditor).toHaveValue('CAMBIO DEL ADMIN B');check('two_admin_conflict_preserves_both',true);
    await otherAdmin.getByRole('button',{name:'Comparar versión guardada'}).click();await expect(otherAdmin.locator('.routine-conflict pre')).toHaveText('CAMBIO DEL ADMIN A');
    await otherAdmin.getByRole('button',{name:'Conservar mi texto sobre esta revisión'}).click();await expect(otherAdmin.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();await otherAdmin.reload();await expect(otherEditor).toHaveValue('CAMBIO DEL ADMIN B');check('explicit_conflict_resolution',true);
    await page.reload();
    step='templates';
    let template=await rpc(0,'template',templateId,0,'PLANTILLA ORIGINAL\nDÍA 1',crypto.randomUUID(),'Fuerza base');check('template_created',template.ok);
    await page.reload();await page.getByLabel('Plantilla',{exact:true}).selectOption(templateId);
    page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Copiar al borrador'}).click();await expect(editor).toHaveValue('CAMBIO DEL ADMIN B');check('template_replacement_requires_confirmation',true);
    page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Copiar al borrador'}).click();await expect(editor).toHaveValue('PLANTILLA ORIGINAL\nDÍA 1');await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();
    const templateUpdate=await rpc(0,'template',templateId,1,'PLANTILLA MODIFICADA',crypto.randomUUID(),'Fuerza nueva');check('template_update_real',(await templateUpdate.json()).revision===2&&templateUpdate.ok);
    await page.reload();await expect(editor).toHaveValue('PLANTILLA ORIGINAL\nDÍA 1');check('template_copy_independent',true);
    await rpc(0,'draft',otherSid,0,'OTRA RUTINA');await page.reload();await expect(editor).toHaveValue('PLANTILLA ORIGINAL\nDÍA 1');check('other_student_edits_independent',true);
    await pupil.reload();await expect(pupil.locator('.routine-reading pre')).toHaveText(second);check('template_never_auto_publishes',true);
    await page.goto(`${app.origin}/rutinas/plantillas`);await page.getByRole('link',{name:'+ Nueva plantilla'}).click();await page.getByLabel('Título de la plantilla').fill('Movilidad');await page.getByLabel('Texto de la plantilla').fill('MOVILIDAD\nRespiración');await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();
    await page.reload();await expect(page.getByLabel('Texto de la plantilla')).toHaveValue('MOVILIDAD\nRespiración');check('new_template_reload_same_note',true);
    await page.goto(`${app.origin}/rutinas/plantillas`);await page.getByRole('link',{name:'Movilidad Editar plantilla'}).click();await expect(page.getByLabel('Texto de la plantilla')).toHaveValue('MOVILIDAD\nRespiración');await page.getByLabel('Texto de la plantilla').fill('MOVILIDAD ACTUALIZADA');await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();await page.reload();await expect(page.getByLabel('Texto de la plantilla')).toHaveValue('MOVILIDAD ACTUALIZADA');check('template_ui_create_list_edit_persist',true);
    const templateConflict=await rpc(1,'template',templateId,1,'PÉRDIDA',crypto.randomUUID(),'viejo');check('template_conflict_denied',await conflict(templateConflict));
    step='publish_consistency';
    let d=(await data(`cueva_routine_drafts?student_id=eq.${sid}`))[0];
    const stale=await rpc(0,'publish',sid,d.revision-1,d.content);check('stale_publication_denied',await conflict(stale));
    const unsavedPub=await rpc(0,'publish',sid,d.revision,'NO GUARDADO');check('unsaved_publication_denied',await conflict(unsavedPub));
    const op=crypto.randomUUID();const simultaneous=await Promise.all([rpc(0,'publish',sid,d.revision,d.content,op),rpc(0,'publish',sid,d.revision,d.content,op),rpc(0,'publish',sid,d.revision,d.content)]);
    const receipts=await Promise.all(simultaneous.map(x=>x.json()));check('publication_concurrent_deduplicated',simultaneous.every(x=>x.ok)&&new Set(receipts.map(x=>x.id)).size===1);
    check('publication_history_preserved',(await data(`cueva_routine_publications?student_id=eq.${sid}`)).length===2);
    check('pupil_latest_only',(await data(`cueva_routine_publications?student_id=eq.${sid}`,2)).length===1);
    const replay=await rpc(0,'publish',sid,d.revision,d.content,op);check('publication_retry_same_id',(await replay.json()).id===receipts[0].id);
    check('operation_rebound_denied',!(await rpc(0,'publish',otherSid,d.revision,d.content,op)).ok);
    const saveOp=crypto.randomUUID();const saveOnce=await rpc(0,'draft',sid,d.revision,'IDEMPOTENTE',saveOp);const saveRepeat=await rpc(0,'draft',sid,d.revision,'IDEMPOTENTE',saveOp);
    check('save_retry_idempotent',saveOnce.ok&&saveRepeat.ok&&(await saveOnce.json()).revision===(await saveRepeat.json()).revision);
    d=(await data(`cueva_routine_drafts?student_id=eq.${sid}`))[0];
    const competing=await Promise.all([rpc(0,'draft',sid,d.revision,'CONCURRENTE A'),rpc(1,'draft',sid,d.revision,'CONCURRENTE B')]);check('cas_concurrent_one_winner',competing.filter(x=>x.ok).length===1&&await conflict(competing.find(x=>!x.ok)));
    step='text_safety';
    await page.goto(`${app.origin}/rutinas?alumno=${sid}`);const hostile='<img src=x onerror="globalThis.__routineXss=1">\n<script>alert(1)</script>\nDÍA FINAL';
    await editor.fill(hostile);await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();await page.getByRole('button',{name:'Publicar rutina',exact:true}).click();await expect(page.getByText('Rutina publicada. El alumno ya puede consultarla.')).toBeVisible();
    await pupil.reload();await expect(pupil.locator('.routine-reading pre')).toHaveText(hostile);
    check('content_text_not_html',await pupil.locator('.routine-reading img,.routine-reading script').count()===0&&await pupil.evaluate(()=>!globalThis.__routineXss));
    step='permissions';
    for(const [index,label] of [[2,'pupil'],[3,'other_pupil'],[4,'not_ready']]) {
      check(`${label}_write_rpc_denied`,!(await rpc(index,'draft',sid,0,'DENEGADO')).ok);
      check(`${label}_template_rpc_denied`,!(await rpc(index,'template',crypto.randomUUID(),0,'DENEGADO',crypto.randomUUID(),'x')).ok);
      check(`${label}_drafts_hidden`,(await data('cueva_routine_drafts',index)).length===0);
      check(`${label}_templates_hidden`,(await data('cueva_routine_templates',index)).length===0);
    }
    check('other_pupil_own_empty',(await data('cueva_routine_publications',3)).length===0);
    check('not_ready_publications_hidden',(await data('cueva_routine_publications',4)).length===0);
    const visitor=await browser.newContext();
    const payload=draft('HTTP DENEGADO',0);
    check('visitor_http_denied',(await api(payload,visitor)).status()===403);
    check('pupil_http_write_denied',(await api(payload,pupilContext)).status()===403);
    check('pupil_http_draft_get_denied',(await pupilContext.request.get(`${app.origin}/api/rutinas?id=${sid}`)).status()===403);
    check('origin_mismatch_denied',(await context.request.post(`${app.origin}/api/rutinas`,{headers:{origin:'https://example.com'},data:payload})).status()===403);
    check('malformed_request_denied',(await api({...payload,revision:-1})).status()===400);
    check('oversized_text_denied',(await api({...payload,content:'a'.repeat(40001)})).status()===400);
    check('anonymous_rest_denied',!(await request(`${rest}/cueva_routine_publications`,{token:anon})).ok);
    check('anonymous_rpc_denied',!(await request(`${rest}/rpc/cueva_routine_write`,{method:'POST',token:anon,body:{p_kind:'draft',p_id:sid,p_revision:0,p_content:'x',p_title:null,p_operation:crypto.randomUUID()}})).ok);
    for(const table of ['drafts','templates','publications']) {
      const write=await request(`${rest}/cueva_routine_${table}`,{method:'PATCH',token:tokens[0],body:{content:'BYPASS'}});check(`no_direct_${table}_writes`,!write.ok);
    }
    const pendingContext=await browser.newContext(), pendingPage=await pendingContext.newPage();await login(pendingContext,users[4],pendingPage);await pendingPage.goto(`${app.origin}/mi-rutina`);check('pending_session_ui_closed',await pendingPage.getByRole('heading',{name:'Acceso restringido'}).count()===1);
    check('pending_session_http_closed',(await api(payload,pendingContext)).status()===403);
    const otherPupilContext=await browser.newContext(), otherPupil=await otherPupilContext.newPage();await login(otherPupilContext,users[3],otherPupil);await otherPupil.goto(`${app.origin}/mi-rutina?alumno=${sid}`);check('other_pupil_cannot_choose_owner',await otherPupil.getByRole('heading',{name:'Tu rutina está en preparación'}).count()===1);
    check('private_response_no_store',(await pupilContext.request.get(`${app.origin}/mi-rutina`)).headers()['cache-control'].includes('no-store'));
    step='deletion';
    const del=(id,email,confirm)=>request(`${rest}/rpc/cueva_delete_empty_student`,{method:'POST',token:tokens[0],body:{p_student:id,p_expected_email:email,p_confirm:confirm}});
    await rpc(0,'draft',blankSid,0,'');
    check('blank_draft_protects_eligibility',(await (await del(blankSid,'blank@example.com',false)).json())==='protected');
    check('blank_draft_prevents_delete',(await (await del(blankSid,'blank@example.com',true)).json())==='protected');
    await rpc(0,'draft',blankSid,1,'PUBLICACIÓN SIN CUENTA');await rpc(0,'publish',blankSid,2,'PUBLICACIÓN SIN CUENTA');
    sql(`delete from public.cueva_routine_drafts where student_id='${blankSid}';`);
    check('unlinked_publication_protects_eligibility',(await (await del(blankSid,'blank@example.com',false)).json())==='protected');
    check('unlinked_publication_prevents_delete',(await (await del(blankSid,'blank@example.com',true)).json())==='protected');
    check('publication_protects_delete',(await (await del(sid,'rutinas-2@example.com',true)).json())==='protected');
    check('empty_fiche_deletion_preserved',(await (await del(emptySid,'empty@example.com',true)).json())==='deleted');
    check('history_retained_after_delete_attempt',(await data(`cueva_routine_publications?student_id=eq.${sid}`)).length===3);
    let immutable=false;try{sql(`update public.cueva_routine_publications set content='x' where student_id='${sid}';`);}catch{immutable=true;}check('published_history_immutable',immutable);
    step='representative_routine';
    const representative='DÍA 1 — FUERZA\n\nSentadilla 3x8\nPress plano 3x10\nRemo 3x12\n\nDÍA 2 — MOVILIDAD\n\nCaminata suave 10 minutos\nMovilidad de hombros y cadera';
    await page.goto(`${app.origin}/rutinas?alumno=${sid}`);await editor.fill(representative);await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();await page.getByRole('button',{name:'Publicar rutina',exact:true}).click();await expect(page.getByText('Rutina publicada. El alumno ya puede consultarla.')).toBeVisible();
    const billing=async p=>request(`${rest}/rpc/cueva_billing_write`,{method:'POST',token:tokens[0],body:{op:crypto.randomUUID(),p}});
    const billingMonth=sql("select to_char(now() at time zone 'America/Argentina/Buenos_Aires','YYYY-MM')");
    const yesterday=sql("select ((now() at time zone 'America/Argentina/Buenos_Aires')::date-1)::text");
    check('debt_fixture_real',(await billing({kind:'price',month:billingMonth,cents:'10000'})).ok&&(await billing({kind:'period',student_id:sid,month:billingMonth,due_on:yesterday})).ok);
    await pupil.reload();await expect(pupil.locator('.routine-reading pre')).toHaveText(representative);check('debt_does_not_block_routine',true);
    step='visual_keyboard';
    await mkdir('../../evidence/CUEVA-006A',{recursive:true});
    for(const width of [390,1440])for(const theme of ['light','dark']) {
      await page.setViewportSize({width,height:960});await page.goto(`${app.origin}/rutinas?alumno=${sid}`);await page.getByRole('button',{name:theme==='light'?'Claro':'Oscuro',exact:true}).click();
      check(`admin_layout_${width}_${theme}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:`../../evidence/CUEVA-006A/admin-${width}-${theme}.png`,fullPage:true});
      await pupil.setViewportSize({width,height:960});await pupil.goto(`${app.origin}/mi-rutina`);await pupil.getByRole('button',{name:theme==='light'?'Claro':'Oscuro',exact:true}).click();
      check(`pupil_layout_${width}_${theme}`,await pupil.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await pupil.screenshot({path:`../../evidence/CUEVA-006A/pupil-${width}-${theme}.png`,fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});check('admin_mobile_routines_active',await page.getByRole('navigation',{name:'Navegación móvil'}).getByRole('link',{name:'Rutinas',exact:true}).getAttribute('aria-current')==='page');
    await editor.focus();await page.keyboard.press('End');await page.keyboard.type('\nCAMBIO CON TECLADO');await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Guardar ahora'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('status').filter({hasText:'Borrador guardado'})).toBeVisible();check('keyboard_edit_save_focus',true);
    await page.setViewportSize({width:1440,height:960});await page.goto(`${app.origin}/rutinas?alumno=${sid}`);await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Saltar al contenido'})).toBeFocused();await page.keyboard.press('Enter');check('keyboard_skip_content',await page.locator('#panel').evaluate(node=>document.activeElement===node));
    const axeAdmin=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();check('axe_admin_no_violations',axeAdmin.violations.length===0);
    const axePupil=await new AxeBuilder({page:pupil}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();check('axe_pupil_no_violations',axePupil.violations.length===0);
    await pupil.getByRole('button',{name:'Sistema',exact:true}).click();await pupil.emulateMedia({colorScheme:'dark'});await expect(pupil.locator('html')).toHaveAttribute('data-theme','dark');check('system_theme_preserved',await pupil.evaluate(()=>document.documentElement.dataset.preference==='system'));
    step='regression';
    await page.goto(`${app.origin}/pagos`);await expect(page.getByRole('heading',{name:'Pagos y cuotas',exact:true})).toBeVisible();check('billing_still_available',true);
    await page.goto(`${app.origin}/alumnos?id=${sid}`);await expect(page.getByText('Invitación: Enviada',{exact:true})).toBeVisible();check('students_invitation_unchanged',true);
    const mail=await (await request(`${mailBase}/api/v1/messages`)).json();check('publishing_sends_no_mail',(mail.total??mail.messages?.length)===0);
    await pupil.getByRole('button',{name:'Cerrar sesión'}).click();await pupil.waitForURL('**/ingresar');await pupil.goto(`${app.origin}/mi-rutina`);check('logout_closes_routine',await pupil.getByRole('heading',{name:'Ingresá para continuar'}).count()===1);
  } catch(error) {
    if(failurePage){await mkdir('../../evidence/runs',{recursive:true});await failurePage.screenshot({path:'../../evidence/runs/routines-failure.png',fullPage:true}).catch(()=>{});}
    const category= /strict mode violation/.test(error.message)?'ambiguous_locator':/element\(s\) not found|locator resolved to 0/.test(error.message)?'missing_element':/Received string/.test(error.message)?'value_mismatch':'other';
    note('flow_diagnostic','BLOCKED',`step=${step}; type=${error.name}; category=${category}; location=${String(error.stack).match(/browser-test.mjs:\d+:\d+/)?.[0]??'unknown'}`);throw Error('ROUTINE_FLOW_FAILED');
  }
  finally { if(browser)await browser.close();if(app)await app.close(); }
}

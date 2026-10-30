// Uses real local Auth, PostgREST, Postgres and a headless browser.
export async function runBrowserFlow({base,rest,mailBase,dbPort,coordinatorPassword,admin,anon,id,password,sql,request,note,launch,chromium,pg,secret}) {
  const email=`student-${id}@example.com`;
  const foreignId='9c70f53f-6d90-4064-ad85-1488dbd58aad';
  let app, browser;
  try {
    const signup=await request(`${base}/signup`,{method:'POST',body:{email:`other-${id}@example.com`,password}});
    const signupBody=await signup.json();
    note('public_signup_closed',signup.status===422 && signupBody.error_code==='signup_disabled'?'PASS':'FAIL',`status=${signup.status}`);
    const anonInvite=await request(`${base}/invite`,{method:'POST',token:anon,body:{email:`other-${id}@example.com`}});
    note('public_admin_invitation_rejected',anonInvite.status===401 || anonInvite.status===403?'PASS':'FAIL',`status=${anonInvite.status}`);
    const invite=await request(`${base}/invite`,{method:'POST',token:admin,body:{email}});
    if(!invite.ok)throw new Error('INVITE_FAILED');
    const invited=await invite.json(); const uid=invited.id;
    if(!/^[0-9a-f-]{36}$/i.test(uid || ''))throw new Error('BAD_FIXTURE_ID');
    sql(`INSERT INTO private.onboarding(user_id) VALUES ('${uid}'); INSERT INTO public.lab_records VALUES (1,'${uid}','own fixture'),(2,'${foreignId}','other fixture');`);
    let messageList;
    for(let i=0;i<30;i++){messageList=await (await request(`${mailBase}/api/v1/messages`)).json();if(messageList.total>0)break;await new Promise(r=>setTimeout(r,500));}
    if(!messageList?.messages?.length)throw new Error('MAIL_MISSING');
    const message=await (await request(`${mailBase}/api/v1/message/${encodeURIComponent(messageList.messages[0].ID)}`)).json();
    const link=(message.HTML||'').match(/href="([^"]+)"/i)?.[1];
    if(!link)throw new Error('LINK_MISSING');
    const token=new URL(link.replaceAll('&amp;','&')).searchParams.get('token');
    if(!token)throw new Error('TOKEN_MISSING');
    const coordinator=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'cueva_coordinator',password:coordinatorPassword});
    await coordinator.connect();
    let denied=false;
    try{await coordinator.query('select * from private.onboarding');}catch(error){denied=error.code==='42501';}
    let writeDenied=false;
    try{await coordinator.query('update private.onboarding set ready=true');}catch(error){writeDenied=error.code==='42501';}
    const role=await coordinator.query('select rolsuper, rolbypassrls from pg_roles where rolname=current_user');
    const grants=await coordinator.query("select has_function_privilege('authenticated','private.activate(uuid,bigint,uuid)','EXECUTE') as allowed");
    const capability=await coordinator.query('select private.pending($1) as generation',[uid]);
    await coordinator.end();
    const nonPrivileged=role.rows[0]?.rolsuper===false && role.rows[0]?.rolbypassrls===false;
    note('coordinator_minimum_privilege',denied && writeDenied && nonPrivileged && grants.rows[0]?.allowed===false && capability.rows[0]?.generation==='1'?'PASS':'FAIL',`read_denied=${denied}; write_denied=${writeDenied}; no_superuser_or_bypass=${nonPrivileged}; authenticated_execute=${grants.rows[0]?.allowed}; narrow_function=${capability.rows[0]?.generation==='1'}`);
    app=await launch({authBase:base,restBase:rest,anonKey:anon,dbPort,dbPassword:coordinatorPassword,diagnostic:(name,detail)=>note(`diagnostic_${name}`,'OBSERVED',detail)});
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext();
    const page=await context.newPage(); page.setDefaultTimeout(5000);
    const anonymous=await page.goto(`${app.origin}/data`);
    note('anonymous_data_rejected',anonymous?.status()===401?'PASS':'FAIL',`status=${anonymous?.status()}`);
    const inviteUrl=`${app.origin}/invite?token_hash=${encodeURIComponent(token)}`;
    await page.goto(inviteUrl); await page.reload();
    const [inviteResponse]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/invite' && r.request().method()==='POST'),page.getByRole('button',{name:'Aceptar invitación'}).click()]);
    const accepted=page.url().endsWith('/password');
    note('browser_invitation_confirmed',accepted?'PASS':'FAIL',`status=${inviteResponse.status()}; redirected_to_password=${accepted}`);
    if(!accepted)throw new Error('BROWSER_INVITE_FAILED');
    await page.goto(`${app.origin}/data`);
    note('before_password_data_denied',await page.getByText('Registros visibles: 0').count()===1?'PASS':'FAIL');
    const noOrigin=await context.request.post(`${app.origin}/password`,{form:{password:`Xx1!${secret()}`},headers:{origin:'http://wrong.invalid'}});
    note('cross_origin_password_rejected',noOrigin.status()===403?'PASS':'FAIL',`status=${noOrigin.status()}`);
    await page.goto(`${app.origin}/password`);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button',{name:'Guardar contraseña'}).click();
    note('browser_password_and_private_data',page.url().endsWith('/data') && await page.getByText('Registros visibles: 1').count()===1?'PASS':'FAIL');
    const cookieMeta=await context.cookies();
    note('local_session_cookies_http_only',cookieMeta.some(x=>x.name.startsWith('sb-') && x.httpOnly && x.sameSite==='Lax')?'PASS':'FAIL');
    await page.getByRole('button',{name:'Salir'}).click();
    const loggedOut=await page.goto(`${app.origin}/data`);
    note('logout_data_rejected',loggedOut?.status()===401?'PASS':'FAIL',`status=${loggedOut?.status()}`);
    await page.goto(`${app.origin}/login`);
    await page.getByLabel('Correo').fill(email); await page.getByLabel('Contraseña').fill(`Wrong!${secret()}`);
    await page.getByRole('button',{name:'Ingresar'}).click();
    note('wrong_login_rejected',await page.getByRole('heading',{name:'No se pudo ingresar'}).count()===1?'PASS':'FAIL');
    await page.goto(`${app.origin}/login`);
    await page.getByLabel('Correo').fill(email); await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button',{name:'Ingresar'}).click();
    note('browser_login_after_setup',page.url().endsWith('/data') && await page.getByText('Registros visibles: 1').count()===1?'PASS':'FAIL');
    const duplicate=await context.request.post(`${app.origin}/invite`,{form:{token},headers:{origin:app.origin}});
    note('invitation_replay_rejected',duplicate.status()===400?'PASS':'FAIL',`status=${duplicate.status()}`);
    const directPassword=`Zz9!${secret()}`;
    const directReset=await request(`${base}/admin/users/${uid}`,{method:'PUT',token:admin,body:{password:directPassword}});
    const oldSession=await page.goto(`${app.origin}/data`);
    await page.goto(`${app.origin}/login`);
    await page.getByLabel('Correo').fill(email); await page.getByLabel('Contraseña').fill(directPassword);
    await page.getByRole('button',{name:'Ingresar'}).click();
    const directVisible=page.url().endsWith('/data') && await page.getByText('Registros visibles: 1').count()===1;
    note('direct_operator_bypass','OBSERVED',`provider_admin_status=${directReset.status}; old_session_status=${oldSession?.status()}; new_session_visible=${directVisible}; requires provider-admin authority.`);
    if(!directReset.ok)throw new Error('DIRECT_OPERATOR_TEST_FAILED');
    note('hosted_nextjs_and_real_email','NOT_RUN','Local standalone server and translated fixture link; no hosted provider, actual Next.js integration or delivery.');
  } finally {
    if(browser)await browser.close();
    if(app)await app.close();
  }
}

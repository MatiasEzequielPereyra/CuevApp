import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

// Exercise the production date helper with fixed instants, independent of test day.
const dateModule = { exports: {} };
const dateSource = readFileSync(new URL('../../src/lib/students/date.ts', import.meta.url), 'utf8');
new Function('require', 'module', 'exports', ts.transpileModule(dateSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(createRequire(import.meta.url), dateModule, dateModule.exports);
export async function runBrowserFlow({base,rest,admin,anon,id,password,sql,request,note,launch,chromium,dbPort,coordinatorPassword}) {
 let app,browser,step='fixtures';
 try{
 const { buenosAiresDate } = dateModule.exports;
 note('joined_on_buenos_aires_boundary', buenosAiresDate(new Date('2026-11-05T01:30:00Z')) === '2026-11-04' && buenosAiresDate(new Date('2026-11-05T03:00:00Z')) === '2026-11-05' ? 'PASS' : 'FAIL');
 const users=[];
 for(const role of ['admin','alumno']){const email=`${role}-${id}@example.com`;const res=await request(`${base}/admin/users`,{method:'POST',token:admin,body:{email,password,email_confirm:true}});const u=await res.json();if(!u.id)throw Error('FIXTURE');users.push({email,id:u.id});sql(`insert into public.cueva_profiles values ('${u.id}','${role}'); insert into cueva_private.access_state(user_id,ready,session_not_before) values ('${u.id}',true,'2000-01-01');`);}
 const initialAuthCount=sql('select count(*) from auth.users');
 step='launch';app=await launch({authBase:base,restBase:rest,anonKey:anon,admin,dbPort,dbPassword:coordinatorPassword});browser=await chromium.launch({headless:true});const context=await browser.newContext();const page=await context.newPage();
 async function login(user){await context.clearCookies();await page.goto(`${app.origin}/ingresar`);await page.getByLabel('Correo electrónico').fill(user.email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Ingresar',exact:true}).click();await page.waitForURL('**/cuenta');}
 step='create';await login(users[0]);await page.goto(`${app.origin}/alumnos`);await page.getByRole('link',{name:'+ Nuevo alumno'}).click();
 await page.getByLabel('Nombre',{exact:true}).fill('Ana');await page.getByLabel('Apellido').fill('Prueba');await page.getByLabel('Correo electrónico').fill('ana@example.test');await page.getByLabel('DNI (opcional)').fill('12345678');await page.getByRole('button',{name:'Guardar ficha'}).click();await page.waitForURL('**/alumnos?id=**');
 const studentId=new URL(page.url()).searchParams.get('id');await page.reload();note('create_reload',await page.getByText('ana@example.test',{exact:true}).count()===1?'PASS':'FAIL');
 await page.getByRole('link',{name:'Editar ficha'}).click();await page.getByLabel('Nombre',{exact:true}).fill('Ana Editada');await page.getByLabel('Estado administrativo').selectOption('false');await page.getByLabel('Fecha de alta').fill('2020-02-29');await page.getByRole('button',{name:'Guardar ficha'}).click();await page.waitForURL('**/alumnos?id=**');await page.getByRole('heading',{name:'Ana Editada Prueba'}).waitFor();note('edit',await page.getByRole('heading',{name:'Ana Editada Prueba'}).count()===1?'PASS':'FAIL');note('joined_on_edit_preserved',await page.getByText('Fecha de alta: 2020-02-29',{exact:true}).count()===1?'PASS':'FAIL');
 await page.goto(`${app.origin}/alumnos?q=Editada`);await page.getByRole('link',{name:/Prueba, Ana Editada/}).waitFor();note('search',await page.getByRole('link',{name:/Prueba, Ana Editada/}).count()===1?'PASS':'FAIL');
 step='literal_search';
 const literalNames=["O'Connor", 'Punto.Coma,(Doble)"Barra\\Final', 'Literal%_texto', '"),active.eq.true,("'];
 const literalRows=[];
 for(let index=0;index<literalNames.length;index++){
  const literalRow={id:crypto.randomUUID(),first_name:'Literal',last_name:literalNames[index],email:`literal${index}@example.test`,dni:null,joined_on:'2020-02-29',active:true};
  const saved=await context.request.post(`${app.origin}/api/alumnos`,{headers:{origin:app.origin},data:literalRow});if(!saved.ok())throw Error('LITERAL_FIXTURE');literalRows.push(literalRow);
 }
 for(const [term,expectedId,label] of [['ana@example.test',studentId,'full_email'],['12345678',studentId,'dni'],...literalRows.map((row,index)=>[row.last_name,row.id,`punctuation_${index}`])]){
  await page.goto(`${app.origin}/alumnos?${new URLSearchParams({q:term})}`);
  await page.locator(`.student-list a[href="/alumnos?id=${expectedId}"]`).waitFor();
  const matches=page.locator('.student-list a');
  note(`literal_search_${label}`,await matches.count()===1 && (await matches.first().getAttribute('href'))===`/alumnos?id=${expectedId}`?'PASS':'FAIL');
 }
 await page.goto(`${app.origin}/alumnos?${new URLSearchParams({q:'"),active.eq.true,("missing'})}`);
 await page.getByRole('heading',{name:'No encontramos coincidencias'}).waitFor();
 note('literal_search_no_filter_injection',await page.getByRole('heading',{name:'No encontramos coincidencias'}).count()===1?'PASS':'FAIL');
 step='duplicate';
 await page.goto(`${app.origin}/alumnos?nuevo=1`);await page.getByLabel('Nombre',{exact:true}).fill('Duplicada');await page.getByLabel('Apellido').fill('Prueba');await page.getByLabel('Correo electrónico').fill('ANA@example.test');await page.getByRole('button',{name:'Guardar ficha'}).click();await page.getByRole('alert').waitFor();note('duplicate_preservation',await page.getByLabel('Nombre',{exact:true}).inputValue()==='Duplicada'?'PASS':'FAIL');
 const row={id:crypto.randomUUID(),first_name:'Otra',last_name:'Prueba',email:'otra@example.test',dni:null,joined_on:'2026-11-04',active:true};
 const invalid=await context.request.post(`${app.origin}/api/alumnos`,{headers:{origin:app.origin},data:{...row,joined_on:'2026-02-31'}});note('invalid_date',invalid.status()===400?'PASS':'FAIL');
 await page.getByLabel('Correo electrónico').fill('retry@example.test');
 sql('revoke insert on public.cueva_students from authenticated');
 try { await page.getByRole('button',{name:'Guardar ficha'}).click();await page.getByRole('alert').filter({hasText:'No se pudo guardar'}).waitFor();note('save_error_preserves_input',await page.getByLabel('Correo electrónico').inputValue()==='retry@example.test'?'PASS':'FAIL'); }finally{sql('grant insert on public.cueva_students to authenticated');}
 await page.goto(`${app.origin}/alumnos?q=NO_MATCH_SYNTHETIC`);await page.getByRole('heading',{name:'No encontramos coincidencias'}).waitFor();note('empty_search','PASS');const search=page.getByRole('textbox',{name:'Buscar alumnos'});await search.focus();await search.fill('Editada');await page.keyboard.press('Tab');await page.keyboard.press('Enter');await page.getByRole('link',{name:/Prueba, Ana Editada/}).waitFor();note('keyboard_search','PASS');
 const adminSession=await (await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:users[0].email,password}})).json();
 const insert=await request(`${rest}/cueva_students`,{method:'POST',token:adminSession.access_token,body:row});const duplicate=await request(`${rest}/cueva_students`,{method:'POST',token:adminSession.access_token,body:row});note('database_double_send',insert.ok&&duplicate.status===409?'PASS':'FAIL');const dniConflict=await request(`${rest}/cueva_students`,{method:'POST',token:adminSession.access_token,body:{...row,id:crypto.randomUUID(),email:'dni@example.test',dni:'12345678'}});note('dni_unique',dniConflict.status===409?'PASS':'FAIL');
 const pupil=await (await request(`${base}/token?grant_type=password`,{method:'POST',body:{email:users[1].email,password}})).json();const denied=await request(`${rest}/cueva_students?id=eq.${studentId}`,{token:pupil.access_token});const data=await denied.json();const write=await request(`${rest}/cueva_students`,{method:'POST',token:pupil.access_token,body:{...row,id:crypto.randomUUID(),email:'denied@example.test'}});note('real_rls_pupil',denied.ok&&data.length===0&&!write.ok?'PASS':'FAIL');note('real_privileges_anon',!(await request(`${rest}/cueva_students`,{token:anon})).ok?'PASS':'FAIL');
 await context.clearCookies();await page.goto(`${app.origin}/alumnos?id=${studentId}`);note('visitor_direct_write_denied',(await context.request.post(`${app.origin}/api/alumnos`,{headers:{origin:app.origin},data:row})).status()===403?'PASS':'FAIL');note('visitor_denied',await page.getByRole('heading',{name:'Acceso restringido'}).count()===1?'PASS':'FAIL');await login(users[1]);await page.goto(`${app.origin}/alumnos?id=${studentId}`);await page.getByRole('heading',{name:'Acceso restringido'}).waitFor();note('pupil_detail_denied',await page.getByRole('heading',{name:'Acceso restringido'}).count()===1?'PASS':'FAIL');note('pupil_direct_write_denied',(await context.request.post(`${app.origin}/api/alumnos`,{headers:{origin:app.origin},data:row})).status()===403?'PASS':'FAIL');
 await login(users[0]);step='shared_shell';
 for(const suffix of ['', '?nuevo=1', `?id=${studentId}`, `?id=${studentId}&editar=1`]){
  await page.goto(`${app.origin}/alumnos${suffix}`);
  const active=page.getByRole('navigation',{name:'Navegación principal'}).getByRole('link',{name:'Alumnos',exact:true});
  note(`shared_shell_${suffix.includes('nuevo')?'create':suffix.includes('editar')?'edit':suffix.includes('id')?'detail':'list'}`,await active.getAttribute('aria-current')==='page' && await page.getByRole('button',{name:'Cerrar sesión'}).count()===1 && await page.getByRole('link',{name:'Ir a mi cuenta'}).count()===1?'PASS':'FAIL');
 }
 await mkdir('../../evidence/runs',{recursive:true});for(const width of [390,1440])for(const theme of ['light','dark']){await page.setViewportSize({width,height:960});await page.goto(`${app.origin}/alumnos`);await page.getByRole('button',{name:theme==='light'?'Claro':'Oscuro',exact:true}).click();note(`layout_${width}_${theme}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)?'PASS':'FAIL');await page.screenshot({path:`../../evidence/runs/students-${width}-${theme}.png`,fullPage:true});}
 await page.setViewportSize({width:390,height:844});const mobile=page.getByRole('navigation',{name:'Navegación móvil'});note('mobile_students_active',await mobile.getByRole('link',{name:'Alumnos',exact:true}).getAttribute('aria-current')==='page'?'PASS':'FAIL');
 await mobile.getByRole('link',{name:'Cuenta',exact:true}).click();await page.getByRole('button',{name:'Cerrar sesión'}).waitFor();note('mobile_account_navigation',new URL(page.url()).hash==='#cuenta'?'PASS':'FAIL');
 note('no_auth_account_created',sql('select count(*) from auth.users')===initialAuthCount?'PASS':'FAIL');await page.getByRole('button',{name:'Cerrar sesión'}).click();await page.waitForURL('**/ingresar');note('logout','PASS');
 }catch(error){note('flow_diagnostic','BLOCKED',`step=${step}; type=${error.name}; location=${String(error.stack).match(/browser-test.mjs:\d+:\d+/)?.[0]??'unknown'}`);throw error;}finally{if(browser)await browser.close();if(app)await app.close();}
}

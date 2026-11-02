// Throwaway loopback-only prototype; not a Next.js route or deployable server.
import { createServer } from 'node:http';
import { createServerClient } from '@supabase/ssr';
import pg from 'pg';

const esc = s => String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const page = (title, content) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1>${content}</main></body></html>`;
const validUuid = s => /^[0-9a-f-]{36}$/i.test(s || '');

export async function launch({authBase,restBase,anonKey,dbPort,dbPassword,diagnostic=()=>{}}) {
  const server=createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','strict-origin');
    res.setHeader('X-Content-Type-Options','nosniff');
    const origin=`http://127.0.0.1:${server.address().port}`;
    const send=(status,html)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8'});res.end(html);};
    const redirect=path=>{res.writeHead(303,{Location:path});res.end();};
    try {
      const url=new URL(req.url,origin);
      if(req.method==='POST' && req.headers.origin!==origin){diagnostic('origin',req.headers.origin==='null'?'null':req.headers.origin?'other':'missing');return send(403,page('Acceso denegado',''));}
      const raw=[]; let size=0;
      for await (const chunk of req){size+=chunk.length;if(size>8192)return send(413,page('Solicitud demasiado grande',''));raw.push(chunk);}
      const form=new URLSearchParams(Buffer.concat(raw).toString());
      const cookieValues=[];
      const supabase=createServerClient('http://cueva-test.invalid',anonKey,{
        global:{fetch:(input,init)=>{const target=new URL(typeof input==='string'?input:input.url);const prefix=target.pathname.startsWith('/auth/v1/')?'/auth/v1':target.pathname.startsWith('/rest/v1/')?'/rest/v1':null;if(!prefix)throw new Error('INVALID_PATH');return fetch(`${prefix==='/auth/v1'?authBase:restBase}${target.pathname.slice(prefix.length)}${target.search}`,init);}},
        cookies:{getAll:()=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return {name:x.slice(0,i),value:decodeURIComponent(x.slice(i+1))};}),
          setAll:items=>{for(const item of items){cookieValues.push(`${item.name}=${encodeURIComponent(item.value)}; Path=/; HttpOnly; SameSite=Lax${item.options.maxAge===0?'; Max-Age=0':''}`);}res.setHeader('Set-Cookie',cookieValues);}},
      });
      if(req.method==='GET' && url.pathname==='/invite')return send(200,page('Aceptar invitación',`<form method="post"><input type="hidden" name="token" value="${esc(url.searchParams.get('token_hash')||'')}"><button>Aceptar invitación</button></form>`));
      if(req.method==='POST' && url.pathname==='/invite'){
        const {error}=await supabase.auth.verifyOtp({token_hash:form.get('token')||'',type:'invite'});
        if(error)diagnostic('invite_verify',/^[a-z0-9_]+$/.test(error.code||'')?error.code:'unknown');
        return error?send(400,page('Invitación inválida o vencida','')):redirect('/password');
      }
      if(req.method==='GET' && url.pathname==='/password')return send(200,page('Elegí tu contraseña','<form method="post"><label>Contraseña <input name="password" type="password" required minlength="8"></label><button>Guardar contraseña</button></form>'));
      if(req.method==='GET' && url.pathname==='/login')return send(200,page('Ingresar','<form method="post"><label>Correo <input name="email" type="email" required></label><label>Contraseña <input name="password" type="password" required></label><button>Ingresar</button></form>'));
      if(req.method==='POST' && url.pathname==='/login'){
        const {error}=await supabase.auth.signInWithPassword({email:form.get('email')||'',password:form.get('password')||''});
        return error?send(401,page('No se pudo ingresar','Revisá los datos e intentá nuevamente.')):redirect('/data');
      }
      if(req.method==='POST' && url.pathname==='/logout'){
        await supabase.auth.signOut();
        return redirect('/login');
      }
      if(req.method==='GET' && url.pathname==='/data'){
        const {data:{user},error}=await supabase.auth.getUser();
        if(error || !user)return send(401,page('Ingresá para continuar',''));
        const result=await supabase.from('lab_records').select('id,content');
        if(result.error)return send(503,page('Datos no disponibles',''));
        const records=result.data.map(record=>`<li data-record-id="${esc(record.id)}">${esc(record.content)}</li>`).join('');
        return send(200,page('Datos de prueba',`<p>Registros visibles: ${result.data.length}</p><ul>${records}</ul><form method="post" action="/logout"><button>Salir</button></form>`));
      }
      if(req.method==='POST' && url.pathname==='/password'){
        const chosen=form.get('password')||''; if(chosen.length<8)return send(400,page('Contraseña inválida',''));
        const {data:{user},error}=await supabase.auth.getUser();
        const sessionResult=await supabase.auth.getSession();
        const token=sessionResult.data.session?.access_token;
        if(error || !user || !token || !validUuid(user.id))return send(401,page('Sesión inválida',''));
        const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
        if(claims.sub!==user.id || !validUuid(claims.session_id))return send(401,page('Sesión inválida',''));
        const client=new pg.Client({host:'127.0.0.1',port:dbPort,database:'postgres',user:'cueva_coordinator',password:dbPassword,connectionTimeoutMillis:5000});
        await client.connect();
        try {
          await client.query('select pg_advisory_lock(hashtextextended($1,42))',[user.id]);
          const again=await supabase.auth.getUser();
          if(again.error || again.data.user?.id!==user.id)return send(401,page('Sesión inválida',''));
          const pending=await client.query('select private.pending($1) as generation',[user.id]);
          if(!pending.rows[0]?.generation)return send(409,page('Solicitud ya utilizada',''));
          const changed=await supabase.auth.updateUser({password:chosen});
          if(changed.error || changed.data.user?.id!==user.id)return send(400,page('No se pudo guardar la contraseña',''));
          const still=await supabase.auth.getUser();
          if(still.error || still.data.user?.id!==user.id)return send(401,page('Sesión inválida',''));
          const activated=await client.query('select private.activate($1,$2,$3) as ok',[user.id,pending.rows[0].generation,claims.session_id]);
          return activated.rows[0]?.ok?redirect('/data'):send(409,page('Acceso no habilitado',''));
        } finally { await client.end(); }
      }
      return send(404,page('No encontrado',''));
    } catch (error) { diagnostic('application_exception',['TypeError','Error','AuthError'].includes(error.name)?error.name:'OTHER'); if(!res.headersSent)return send(500,page('Servicio no disponible','')); res.end(); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(resolve=>server.close(resolve))};
}

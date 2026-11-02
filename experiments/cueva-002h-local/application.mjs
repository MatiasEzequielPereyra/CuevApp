import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

// Start the actual Next.js app as a loopback-only disposable development process.
export async function launch({authBase,restBase,anonKey,dbPort,dbPassword}) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const port = await new Promise((resolve,reject) => {
    const server=createServer(); server.on('error',reject);
    server.listen(0,'127.0.0.1',()=>{const value=server.address().port;server.close(()=>resolve(value));});
  });
  const origin=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',String(port)],{
    cwd:root,stdio:'ignore',env:{...process.env,CUEVA_LOCAL_AUTH:'1',CUEVA_AUTH_URL:authBase,CUEVA_REST_URL:restBase,CUEVA_ANON_KEY:anonKey,CUEVA_LAB_ORIGIN:origin,CUEVA_DB_PORT:String(dbPort),CUEVA_DB_PASSWORD:dbPassword},
  });
  let alive=true; child.on('exit',()=>{alive=false;});
  for(let i=0;i<120;i++){
    if(!alive)throw new Error('NEXT_PROCESS_EXITED');
    try { const response=await fetch(`${origin}/laboratorio/login`);if(response.ok)return {origin,close:()=>new Promise(resolve=>{if(!alive)return resolve();child.once('exit',resolve);child.kill();})}; } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  child.kill();throw new Error('NEXT_NOT_READY');
}

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export { freePort } from '../cueva-002j-local/application.mjs';

export async function launch({ port, base, rest, anon, admin, ownerEmail, ownerTest = true }) {
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'ignore',
    env: { ...process.env, CUEVA_PRODUCT_AUTH_LOCAL: '1', CUEVA_SUPABASE_URL: base, CUEVA_AUTH_URL: base,
      CUEVA_REST_URL: rest, CUEVA_PUBLISHABLE_KEY: anon, CUEVA_SERVICE_KEY: admin, CUEVA_PRODUCT_ORIGIN: origin,
      CUEVA_DEFAULT_MAIL_OWNER_TEST: ownerTest ? '1' : '0', CUEVA_FIRST_ADMIN_EMAIL: ownerEmail, CUEVA_EMAIL_TEMPLATE_READY: '0' },
  });
  let alive = true; child.on('exit', () => { alive = false; });
  const close = () => new Promise(resolve => { if (!alive) return resolve(); child.once('exit', resolve); child.kill(); });
  for (let i = 0; i < 90; i++) {
    if (!alive) throw new Error('NEXT_EXIT');
    try { if ((await fetch(`${origin}/ingresar`)).ok) return { origin, close }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await close(); throw new Error('NEXT_NOT_READY');
}

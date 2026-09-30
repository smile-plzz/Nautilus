import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Vercel starts with a read-only app path and unconfigured owner access', async () => {
  const port=44000+Math.floor(Math.random()*10000);
  const child=spawn(process.execPath,['--input-type=module','-e',`import server from './server.js'; server.listen(${port}, '127.0.0.1');`],{
    env:{...process.env,VERCEL:'1',NODE_ENV:'production',DATA_DIR:'/var/task/data',ADMIN_PASSWORD:'',SESSION_SECRET:''},stdio:'pipe'
  });
  let logs='';child.stderr.on('data',chunk=>logs+=chunk);
  try {
    let ready=false;
    for(let i=0;i<60;i++){
      try { const r=await fetch(`http://127.0.0.1:${port}/api/health`);const health=await r.json();assert.equal(r.status,200);assert.equal(health.storage,'ephemeral');assert.equal(health.owner_configured,false);ready=true;break; }catch{}
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert.ok(ready,logs||'Vercel server did not start');
    const root=await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(root.status,200);assert.match(await root.text(),/NAUTILUS/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/catalog`)).status,200);
    const login=await fetch(`http://127.0.0.1:${port}/api/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:'anything'})});
    assert.equal(login.status,503);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/owner/catalog`)).status,401);
  } finally { child.kill();await new Promise(resolve=>child.once('exit',resolve)); }
});

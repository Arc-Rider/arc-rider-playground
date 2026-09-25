import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:net';
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const dir = await mkdtemp(path.join(os.tmpdir(), 'arc-event-http-'));
const child = spawn(process.execPath, ['dist/main.js'], {env: {...process.env, PLAYGROUND:'1', PORT:String(port), PLAYGROUND_STORE_DIR:dir}, stdio:['ignore','pipe','pipe']});
const base = `http://127.0.0.1:${port}`;
const request = (session, pathname, body) => fetch(base + pathname, {method:body?'POST':'GET', headers:{'x-playground-session':session, 'content-type':'application/json', accept:'application/json, text/event-stream'}, ...(body?{body:JSON.stringify(body)}:{})});
try {
  await Promise.race([once(child.stdout, 'data'), once(child, 'exit').then(() => {throw new Error('HTTP server exited');}), new Promise((_, reject) => {const timer=setTimeout(()=>reject(new Error('HTTP startup timeout')),10000);timer.unref();})]);
  assert.equal((await fetch(base+'/api/plan')).status,401);
  assert.equal((await request('../invalid','/api/plan')).status,401);
  const a='a'.repeat(48), b='b'.repeat(48);
  const results=await Promise.all([600,630].map(start=>request(a,'/api/changes',{expectedRevision:0,sessions:[{id:'keynote',start}]})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  const saved=await (await request(a,'/api/plan')).json();
  const isolated=await (await request(b,'/api/plan')).json();
  assert.equal(saved.plan.revision,1);
  assert.equal(isolated.plan.revision,0);
  assert.equal(isolated.plan.sessions.find(s=>s.id==='keynote').start,540);
  const rpc=await (await request(a,'/mcp',{jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_event_plan',arguments:{}}})).json();
  assert.equal(rpc.result.structuredContent.plan.revision,1);
  console.log('HTTP: invalid sessions rejected, concurrent first writes serialized, sessions isolated, MCP readback passed.');
} finally {
  child.kill();
  await once(child,'exit');
  await rm(dir,{recursive:true,force:true});
}

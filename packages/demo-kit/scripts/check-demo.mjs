import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';

// Usage: check-demo.mjs <demoDir> [--session] [--resource=<uri>] [-- <demo args>]
const separator = process.argv.indexOf('--');
const ownArgs = separator === -1 ? process.argv.slice(2) : process.argv.slice(2, separator);
const demoArgs = separator === -1 ? [] : process.argv.slice(separator + 1);
const cwd = path.resolve(ownArgs.find((arg) => !arg.startsWith('--')) ?? process.cwd());
const sessionRequired = ownArgs.includes('--session');
const resourceUri = ownArgs.find((arg) => arg.startsWith('--resource='))?.slice(11);
const playground = sessionRequired || process.env.PLAYGROUND === '1';

const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));

const storeDir = await mkdtemp(path.join(os.tmpdir(), 'demo-kit-'));
const session = 'a'.repeat(48);
const child = spawn(process.execPath, ['dist/main.js', ...demoArgs], {
  cwd,
  env: {
    ...process.env,
    PLAYGROUND: playground ? '1' : '',
    PORT: String(port),
    PLAYGROUND_STORE_DIR: storeDir,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const base = `http://127.0.0.1:${port}`;
const headers = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
  ...(sessionRequired ? { 'x-playground-session': session } : {}),
};

try {
  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'exit').then(() => {
      throw new Error('demo server exited');
    }),
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('startup timeout')), 15000);
      timer.unref();
    }),
  ]);

  const health = await (await fetch(`${base}/healthz`)).json();
  assert.equal(health.ok, true);
  assert.equal(typeof health.commit, 'string');

  const preview = await fetch(`${base}/preview`, { headers });
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-type') ?? '', /text\/html/);
  const html = await preview.text();
  assert.ok(html.length < 2_000_000, 'preview HTML must stay under 2 MB');

  const getMcp = await fetch(`${base}/mcp`, { headers: { accept: 'text/event-stream', ...headers } });
  assert.equal(getMcp.status, 405);

  if (sessionRequired) {
    const denied = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } } }),
    });
    assert.equal(denied.status, 401);
  }

  if (!playground) {
    const foreign = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers: { ...headers, origin: 'https://example.com' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(foreign.status, 403, 'local mode must reject foreign browser origins');
  }

  const init = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'check', version: '1' } },
    }),
  });
  assert.equal(init.status, 200);
  const initBody = await init.json();
  assert.ok(initBody.result?.serverInfo);

  const listed = await fetch(`${base}/mcp`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  const tools = (await listed.json()).result.tools;
  assert.ok(Array.isArray(tools) && tools.length > 0);

  if (resourceUri) {
    const resource = await fetch(`${base}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: resourceUri } }),
    });
    const contents = (await resource.json()).result.contents[0];
    assert.match(contents.mimeType, /text\/html/);
    assert.ok(contents.text.length < 2_000_000, 'UI resource must stay under 2 MB');
  }

  console.log(`demo-kit check passed for ${cwd} (${tools.length} tools)`);
} finally {
  child.kill('SIGKILL');
  await once(child, 'exit').catch(() => {});
  await rm(storeDir, { recursive: true, force: true });
}

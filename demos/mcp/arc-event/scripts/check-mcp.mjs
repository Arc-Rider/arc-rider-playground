import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
const dir = await mkdtemp(path.join(os.tmpdir(), 'arc-event-mcp-'));
const client = new Client({ name: 'arc-event-check', version: '1.0.0' });
try {
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/main.js', '--stdio'], cwd: process.cwd(), env: { ...process.env, ARC_EVENT_STORE: path.join(dir, 'plan.json') }, stderr: 'pipe' }));
  const { tools } = await client.listTools();
  assert.equal(tools.length, 7);
  assert.equal(tools.find(t => t.name === 'show_event_calendar')._meta.ui.resourceUri, 'ui://arc-rider/arc-event.html');
  for (const view of ['calendar','timeline','table','capacity']) { const r = await client.callTool({name:`show_event_${view}`,arguments:{}}); assert.equal(r.structuredContent.view,view); assert.ok(r.structuredContent.plan.sessions.every(s=>s.date && Number.isInteger(s.bookings))); }
  const initial = await client.callTool({ name: 'show_event_calendar', arguments: {} });
  assert.equal(initial.structuredContent.plan.revision, 0);
  const preview = await client.callTool({ name: 'preview_event_changes', arguments: { expectedRevision: 0, sessions: [{ id: 'keynote', start: 660 }] } });
  assert.equal(preview.structuredContent.plan.revision, 1);
  assert.equal((await client.callTool({ name: 'get_event_plan', arguments: {} })).structuredContent.plan.revision, 0);
  const saved = await client.callTool({ name: 'update_event_plan', arguments: { expectedRevision: 0, sessions: [{ id: 'keynote', start: 660 }] } });
  assert.equal(saved.structuredContent.plan.revision, 1);
  const stale = await client.callTool({ name: 'update_event_plan', arguments: { expectedRevision: 0, sessions: [] } });
  assert.equal(stale.isError, true);
  const resource = await client.readResource({ uri: 'ui://arc-rider/arc-event.html' });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.match(resource.contents[0].text, /arcEvent · Event operations/);
  console.log('MCP v2: discovery, UI resource, preview, mutation, readback and stale-revision protection passed.');
} finally { await client.close(); await rm(dir, { recursive: true, force: true }); }

import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { examples } from '../dist/fixtures.js';
import { sortedRows, validateRender } from '../dist/contract.js';

const renderer = new Client({ name: 'renderer-check', version: '1.0.0' });
const data = new Client({ name: 'data-check', version: '1.0.0' });
const connect = (client, args) => client.connect(new StdioClientTransport({ command: process.execPath, args: ['dist/main.js', ...args], cwd: process.cwd(), stderr: 'pipe' }));
try {
  await connect(renderer, []); await connect(data, ['--data']);
  assert.deepEqual((await renderer.listTools()).tools.map(t => t.name), ['render_table']);
  assert.deepEqual((await data.listTools()).tools.map(t => t.name).sort(), ['get_demo_orders', 'get_demo_tickets']);
  const orders = await data.callTool({ name: 'get_demo_orders', arguments: { asOf: '2026-09-26', overdueOnly: true } });
  assert.deepEqual(orders.structuredContent.rows.map(r => r.id), ['order-101', 'order-102', 'order-103']);
  for (const [name, result] of [['orders', orders], ['tickets', await data.callTool({ name: 'get_demo_tickets', arguments: {} })]]) {
    const request = { ...examples[name], rows: result.structuredContent.rows };
    const rendered = await renderer.callTool({ name: 'render_table', arguments: request });
    assert.ok(!rendered.isError, JSON.stringify(rendered));
    assert.deepEqual(rendered.structuredContent.rows, result.structuredContent.rows);
    assert.equal(rendered.structuredContent.kind, 'arcwidgets-table-v1');
    assert.deepEqual(rendered.structuredContent.config, request.config);
    const revised = { ...request, config: { ...request.config, groupBy: undefined, columns: [...request.config.columns].reverse() } };
    const followup = await renderer.callTool({ name: 'render_table', arguments: revised });
    assert.ok(!followup.isError);
    assert.equal(followup.structuredContent.config.columns[0].field, revised.config.columns[0].field);
    assert.equal(followup.structuredContent.config.groupBy, undefined);
  }
  const invalid = [
    { ...examples.orders, config: { ...examples.orders.config, groupBy: 'missing' } },
    { ...examples.orders, rows: [examples.orders.rows[0], examples.orders.rows[0]] },
    { ...examples.orders, rows: [{ ...examples.orders.rows[0], amount: '1250' }] },
    { ...examples.orders, rows: [{ ...examples.orders.rows[0], dueDate: '2026-02-30' }] },
    { ...examples.orders, rows: Array.from({ length: 201 }, (_, i) => ({ ...examples.orders.rows[0], id: i })) },
    { ...examples.orders, config: { ...examples.orders.config, script: 'alert(1)' } },
  ];
  for (const request of invalid) {
    const result = await renderer.callTool({ name: 'render_table', arguments: request });
    assert.equal(result.isError, true, JSON.stringify(request));
    assert.ok(result.content[0].text.length > 10);
  }
  const empty = await renderer.callTool({ name: 'render_table', arguments: { ...examples.orders, rows: [] } });
  assert.ok(!empty.isError); assert.deepEqual(empty.structuredContent.rows, []);
  const numeric = validateRender({ ...examples.tickets, rows: [{ ...examples.tickets.rows[0], id: 'a', hoursOpen: 2 }, { ...examples.tickets.rows[0], id: 'b', hoursOpen: 100 }] });
  assert.deepEqual(sortedRows(numeric).map(r => r.hoursOpen), [100, 2]);
  const { resources } = await renderer.listResources();
  const resource = await renderer.readResource({ uri: resources[0].uri });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.match(resource.contents[0].text, /<script type="module"/);
  console.log('PASS: two separate MCP processes, both datasets, revised views, validation, empty results, numeric sorting and bundled UI.');
} finally { await renderer.close(); await data.close(); }

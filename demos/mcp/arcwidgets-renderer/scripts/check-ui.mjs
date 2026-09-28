import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { examples } from '../dist/fixtures.js';

const html = await readFile(new URL('../dist/mcp-app.html', import.meta.url));
const hostHtml = `<!doctype html><html><body><script>
window.addEventListener('message', event => {
  const message = event.data;
  if (message.method === 'ui/initialize') event.source.postMessage({jsonrpc:'2.0', id:message.id, result:{
    protocolVersion:message.params.protocolVersion, hostInfo:{name:'Test host',version:'1.0.0'},
    hostCapabilities:{}, hostContext:{theme:'light',displayMode:'inline'}
  }}, '*');
  if (message.method === 'ui/notifications/initialized') window.hostInitialized = true;
});
</script><iframe title="MCP App" src="/mcp-app.html" style="width:100%;height:750px;border:0"></iframe></body></html>`;
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/host' ? hostHtml : html); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, timeout: 15000 });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.getByRole('heading', { name: 'Ersatz für den Aufbau finden' }).waitFor();
  for (const name of ['Mara Fischer', 'Jonas Weber', 'Lea Hoffmann']) {
    await page.getByRole('group', { name: `Auswahl ${name}` }).getByText('Auswählen', { exact: true }).click();
  }
  await page.getByRole('status').filter({ hasText: '3 von 3 ausgewählt' }).waitFor();
  await page.getByRole('group', { name: 'Auswahl Tim Berger' }).getByText('Limit erreicht').click();
  assert.equal(await page.getByRole('status').textContent(), '3 von 3 ausgewählt');
  await page.getByRole('group', { name: 'Auswahl Mara Fischer' }).getByText('Abwählen').click();
  await page.getByRole('status').filter({ hasText: '2 von 3 ausgewählt' }).waitFor();
  await page.getByRole('group', { name: 'Auswahl Tim Berger' }).getByText('Auswählen', { exact: true }).click();
  await page.getByRole('status').filter({ hasText: '3 von 3 ausgewählt' }).waitFor();
  await page.screenshot({ path: '/tmp/arcwidgets-staffing.png', fullPage: true });
  for (const width of [520, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole('img', { name: 'Verfügbarkeit: Gut' }).first().waitFor();
    await page.screenshot({ path: `/tmp/arcwidgets-staffing-${width}.png`, fullPage: true });
    const bounds = await page.getByRole('group', { name: 'Auswahl Tim Berger' }).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, `Action must fit at ${width}px`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  assert.equal(await page.getByRole('img', { name: 'Verfügbarkeit: Mittel' }).count(), 1);
  assert.equal(await page.getByRole('img', { name: 'Verfügbarkeit: Niedrig' }).count(), 0);
  assert.ok(await page.getByRole('img', { name: 'Eignung: Gut' }).count() >= 1);
  await page.getByRole('group', { name: 'Auswahl Tim Berger' }).getByText('Abwählen').click();
  await page.getByRole('status').filter({ hasText: '2 von 3 ausgewählt' }).waitFor();
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  console.log('Checking orders preview.');
  await page.getByRole('heading', { name: 'Overdue orders' }).waitFor();
  await page.getByText('Northstar Bikes (2)', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Support tickets' }).click();
  console.log('Checking ticket preview.');
  await page.getByText('Support (2)', { exact: true }).waitFor();
  await page.getByText('Edit the table request', { exact: true }).click();
  const input = page.getByLabel('Data and configuration');
  const render = async value => { await input.fill(JSON.stringify(value)); await page.getByRole('button', { name: 'Render table', exact: true }).click(); };
  const changed = structuredClone(examples.tickets);
  delete changed.config.groupBy;
  changed.config.columns.reverse();
  changed.config.columns[0].title = 'Elapsed hours';
  await render(changed);
  await page.getByText('Elapsed hours', { exact: true }).waitFor();
  await page.getByText('Printer offline', { exact: true }).waitFor();
  const attack = '<img src=x onerror="window.__injected=true">';
  changed.rows[0].subject = attack;
  changed.config.columns[0].title = attack;
  await render(changed);
  await page.getByText(attack, { exact: true }).first().waitFor();
  assert.equal(await page.evaluate(() => window.__injected), undefined);
  assert.equal(await page.locator('img[src=x]').count(), 0);
  await render({ ...changed, config: { ...changed.config, groupBy: 'missing' } });
  await page.getByRole('alert').filter({ hasText: 'field missing' }).waitFor();
  await render({ ...examples.orders, rows: [] });
  await page.getByText('No matching records', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: '/tmp/arcwidgets-renderer-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.screenshot({ path: '/tmp/arcwidgets-renderer-desktop.png', fullPage: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/host`);
  await page.waitForFunction(() => window.hostInitialized);
  const frame = page.frameLocator('iframe');
  await frame.getByRole('heading', { name: 'Waiting for table data' }).waitFor();
  const notify = async structuredContent => page.evaluate(payload => {
    document.querySelector('iframe').contentWindow.postMessage({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { content: [], structuredContent: payload } }, '*');
  }, structuredContent);
  await notify({ kind: 'arcwidgets-table-v1', ...examples.orders });
  await frame.getByRole('heading', { name: 'Overdue orders' }).waitFor();
  await notify({ kind: 'arcwidgets-table-v1', ...examples.tickets });
  await frame.getByText('Support (2)', { exact: true }).waitFor();
  await notify({ kind: 'arcwidgets-table-v1', ...examples.orders, config: { ...examples.orders.config, groupBy: 'missing' } });
  await frame.getByRole('alert').filter({ hasText: 'field missing' }).waitFor();
  assert.equal(await frame.getByRole('heading', { name: 'Support tickets' }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: both datasets, changed columns, literal untrusted text, validation, empty state, mobile layout and embedded MCP handshake/result updates.');
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

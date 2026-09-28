import { startDemoServer } from '@arcrider/playground-demo-kit';
import { createServer as createRenderer, readAppHtml } from './server.js';
import { createDataServer } from './data-server.js';

const dataOnly = process.argv.includes('--data');
if (!process.argv.includes('--http') && process.env.PLAYGROUND !== '1' && !process.argv.includes('--stdio')) {
  process.argv.push('--stdio');
}

await startDemoServer({
  name: dataOnly ? 'Demo data' : 'arcWidgets renderer',
  port: dataOnly ? 4196 : 4195,
  versionDir: import.meta.dirname,
  maxBody: 2_000_000,
  previewHtml: dataOnly ? undefined : readAppHtml,
  previewPaths: ['/', '/preview', '/mcp-app.html'],
  createServer: () => (dataOnly ? createDataServer() : createRenderer()),
});

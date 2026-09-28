import { startDemoServer } from '@arcrider/playground-demo-kit';
import { createServer, readAppHtml } from './server.js';

if (!process.argv.includes('--http') && process.env.PLAYGROUND !== '1' && !process.argv.includes('--stdio')) {
  process.argv.push('--stdio');
}

await startDemoServer({
  name: 'arcTable',
  port: 4193,
  versionDir: import.meta.dirname,
  previewHtml: readAppHtml,
  previewPaths: ['/', '/preview', '/mcp-app.html'],
  createServer: () => createServer(),
});

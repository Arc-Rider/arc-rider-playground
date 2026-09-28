import path from 'node:path';
import { startDemoServer } from '@arcrider/playground-demo-kit';
import { appHtml, createServer, EventStore } from './server.js';

const playground = process.env.PLAYGROUND === '1';
const storeDir = process.env.PLAYGROUND_STORE_DIR ?? path.resolve('.local/sessions');
const defaultStore = playground
  ? null
  : await new EventStore(process.env.ARC_EVENT_STORE ?? path.resolve('.local/arc-event.json')).load();

await startDemoServer({
  name: 'arcEvent',
  port: 4194,
  versionDir: import.meta.dirname,
  previewHtml: appHtml,
  createServer,
  session: {
    required: playground,
    createStore: (sessionId) => new EventStore(path.join(storeDir, sessionId, 'arc-event.json')).load(),
    fallback: defaultStore,
  },
  extraRoutes: async ({ req, res, url, store, body }) => {
    if (req.method === 'GET' && url.pathname === '/api/plan') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(store.read()));
      return true;
    }
    if (req.method === 'POST' && url.pathname === '/api/changes') {
      try {
        const next = await store.change(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(next));
      } catch (error) {
        const status = (error as Error & { status?: number }).status ?? 400;
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (error as Error).message }));
      }
      return true;
    }
    return false;
  },
});

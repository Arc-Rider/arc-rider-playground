import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { createServer as httpServer, type IncomingMessage } from 'node:http';
import path from 'node:path';
import { appHtml, createServer, EventStore } from './server.js';

const playground = process.env.PLAYGROUND === '1';
const sessionRe = /^[a-f0-9]{48}$/;
const storeDir = process.env.PLAYGROUND_STORE_DIR ?? path.resolve('.local/sessions');
const stores = new Map<string, Promise<EventStore>>();
const defaultStore = playground
  ? null
  : await new EventStore(process.env.ARC_EVENT_STORE ?? path.resolve('.local/arc-event.json')).load();

async function storeFor(sessionId: string) {
  if (!sessionRe.test(sessionId)) {
    const error = Object.assign(new Error('Invalid session'), { status: 401 });
    throw error;
  }
  let store = stores.get(sessionId);
  if (!store) {
    store = new EventStore(path.join(storeDir, sessionId, 'arc-event.json')).load();
    stores.set(sessionId, store);
    void store.catch(() => stores.delete(sessionId));
  }
  return store;
}

function sessionFrom(req: IncomingMessage) {
  const header = req.headers['x-playground-session'];
  return (Array.isArray(header) ? header[0] : header)?.trim() ?? '';
}

if (process.argv.includes('--stdio')) {
  if (!defaultStore) throw new Error('stdio requires a single event store');
  await createServer(defaultStore).connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT ?? 4194);
  const host = playground ? '0.0.0.0' : '127.0.0.1';
  httpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      if (req.method === 'GET' && url.pathname === '/healthz') {
        res.writeHead(200).end('ok');
        return;
      }
      if (!playground && req.headers.origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin)) {
        res.writeHead(403).end('Origin not allowed');
        return;
      }
      const store = playground ? await storeFor(sessionFrom(req)) : defaultStore!;
      if (req.method === 'GET' && url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(await appHtml());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/api/plan') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(store.read()));
        return;
      }
      let body = '';
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100_000) {
          res.writeHead(413).end();
          return;
        }
      }
      if (req.method === 'POST' && url.pathname === '/api/changes') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(await store.change(JSON.parse(body))));
        return;
      }
      if (url.pathname !== '/mcp') {
        res.writeHead(404).end();
        return;
      }
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      const server = createServer(store);
      await server.connect(transport);
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        const request = new Request(url, { method: req.method, headers, ...(body ? { body } : {}) });
        const response = await transport.handleRequest(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(Buffer.from(await response.arrayBuffer()));
      } finally {
        await server.close();
      }
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 400;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  }).listen(port, host, () => console.log(`arcEvent: http://${host}:${port} · MCP: http://${host}:${port}/mcp`));
}

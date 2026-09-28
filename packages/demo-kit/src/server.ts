import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import type { McpServer } from '@modelcontextprotocol/server';
import { createServer as httpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readVersion } from './version.js';
import { SessionStoreMap, sessionFromHeader } from './session.js';

export type DemoRouteContext<T> = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  store: T;
  body: string;
};

export type StartDemoServerOptions<T> = {
  name: string;
  port?: number;
  host?: string;
  versionDir?: string;
  maxBody?: number;
  previewHtml?: () => Promise<string>;
  previewPaths?: string[];
  createServer: (store: T) => McpServer;
  extraRoutes?: (ctx: DemoRouteContext<T>) => Promise<boolean>;
  session?: {
    required: boolean;
    createStore: (sessionId: string) => Promise<T>;
    fallback?: T | null;
  };
  defaultStore?: T;
  listen?: boolean;
};

function sendJson(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...extra });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, maxBody: number) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBody) {
      const error = Object.assign(new Error('payload too large'), { status: 413 });
      throw error;
    }
  }
  return body;
}

export async function startDemoServer<T>(options: StartDemoServerOptions<T>) {
  const playground = process.env.PLAYGROUND === '1';
  const stdio = process.argv.includes('--stdio');
  const fallback = options.session?.fallback ?? options.defaultStore;
  if (stdio) {
    await options.createServer((fallback ?? undefined) as T).connect(new StdioServerTransport());
    return;
  }

  const stores = options.session ? new SessionStoreMap(options.session.createStore) : null;
  const port = Number(process.env.PORT ?? options.port ?? 4194);
  const host = options.host ?? (playground ? '0.0.0.0' : '127.0.0.1');
  const maxBody = options.maxBody ?? 100_000;
  const previewPaths = new Set(options.previewPaths ?? ['/', '/preview']);
  const versionDir = options.versionDir ?? process.cwd();
  // Local servers bind to loopback; a foreign Origin means a web page is probing localhost.
  const localOrigins = new Set([`http://localhost:${port}`, `http://127.0.0.1:${port}`]);

  async function resolveStore(req: IncomingMessage): Promise<T> {
    if (options.session?.required) {
      return stores!.get(sessionFromHeader(req.headers['x-playground-session']));
    }
    if (fallback != null) return fallback;
    if (stores) return stores.get(sessionFromHeader(req.headers['x-playground-session']));
    return undefined as T;
  }

  const server = httpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
      if (req.method === 'GET' && url.pathname === '/healthz') {
        sendJson(res, 200, { ok: true, name: options.name, ...readVersion(versionDir) });
        return;
      }
      const origin = req.headers.origin;
      if (!playground && origin && !localOrigins.has(origin)) {
        sendJson(res, 403, { error: 'Origin not allowed' });
        return;
      }
      if (req.method === 'OPTIONS' && url.pathname === '/mcp') {
        res.writeHead(204, {
          Allow: 'POST, OPTIONS',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'content-type, mcp-session-id, mcp-protocol-version, authorization',
        });
        res.end();
        return;
      }
      if (url.pathname === '/mcp' && (req.method === 'GET' || req.method === 'DELETE')) {
        sendJson(res, 405, { error: 'Method not supported. Use POST /mcp.' }, { Allow: 'POST, OPTIONS' });
        return;
      }

      const store = await resolveStore(req);
      if (req.method === 'GET' && previewPaths.has(url.pathname) && options.previewHtml) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(await options.previewHtml());
        return;
      }

      const needsBody = req.method !== 'GET' && req.method !== 'HEAD';
      const body = needsBody ? await readBody(req, maxBody) : '';
      if (options.extraRoutes && (await options.extraRoutes({ req, res, url, store, body }))) return;

      if (url.pathname !== '/mcp') {
        res.writeHead(404).end();
        return;
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const mcp = options.createServer(store);
      await mcp.connect(transport);
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
        const request = new Request(url, { method: req.method, headers, ...(body ? { body } : {}) });
        const response = await transport.handleRequest(request);
        const outgoing: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          outgoing[key] = value;
        });
        res.writeHead(response.status, outgoing);
        res.end(Buffer.from(await response.arrayBuffer()));
      } finally {
        await mcp.close().catch(() => {});
      }
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 400;
      if (!res.headersSent) sendJson(res, status, { error: (e as Error).message });
    }
  });

  if (options.listen === false) return server;
  return await new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log(`${options.name}: http://${host}:${port} · MCP: http://${host}:${port}/mcp`);
      resolve(server);
    });
  });
}

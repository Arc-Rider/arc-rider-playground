import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import { createServer as httpServer } from "node:http";
import { createServer } from "./server.js";

if (!process.argv.includes("--http") && process.env.PLAYGROUND !== "1") {
  const server = createServer();
  await server.connect(new StdioServerTransport());
} else {
  const port = Number(process.env.PORT ?? 4193);
  const host = process.env.PLAYGROUND === "1" ? "0.0.0.0" : "127.0.0.1";
  httpServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      if (req.method === "GET" && url.pathname === "/healthz") {
        res.writeHead(200).end("ok");
        return;
      }
      if (url.pathname !== "/mcp") {
        res.writeHead(404).end();
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 100_000) {
          res.writeHead(413).end();
          return;
        }
      }
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const server = createServer();
      await server.connect(transport);
      try {
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) {
          if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        const request = new Request(url, { method: req.method, headers, ...(body ? { body } : {}) });
        const response = await transport.handleRequest(request);
        res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
        res.end(Buffer.from(await response.arrayBuffer()));
      } finally {
        await server.close();
      }
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
  }).listen(port, host, () => {
    console.log(`arcTable MCP: http://${host}:${port}/mcp`);
  });
}

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { buildPayload, summarizePayload } from "./projects.js";

export const RESOURCE_URI = "ui://arc-rider/arcwidgets-table.html";

function uiMeta() {
  return {
    ui: { resourceUri: RESOURCE_URI },
    "ui/resourceUri": RESOURCE_URI,
  };
}

async function readAppHtml(): Promise<string> {
  const here = import.meta.dirname;
  const candidates = [
    path.join(here, "mcp-app.html"),
    path.join(here, "dist", "mcp-app.html"),
  ];
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate, "utf-8");
    } catch {
      // try next
    }
  }
  throw new Error(
    "Table app HTML missing. Run `npm run build` in demos/mcp/arcwidgets-table.",
  );
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "arcwidgets-table",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "show_grouped_table",
    {
      title: "arcWidgets Table",
      description:
        "Show a read-only sample database explorer as an interactive grouped table built with @arcrider/arcwidgets-react. All rows are fictional; no database connection is made.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: RESOURCE_URI },
      },
    },
    async () => {
      const payload = buildPayload();
      return {
        content: [{ type: "text" as const, text: summarizePayload(payload) }],
        structuredContent: payload,
        _meta: uiMeta(),
      };
    },
  );

  registerAppResource(
    server,
    "arcWidgets Table",
    RESOURCE_URI,
    {
      description: "Interactive grouped table from @arcrider/arcwidgets-react",
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: true,
          csp: {},
        },
      },
    },
    async () => {
      const html = await readAppHtml();
      return {
        contents: [
          {
            uri: RESOURCE_URI,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {},
              },
            },
          },
        ],
      };
    },
  );

  return server;
}

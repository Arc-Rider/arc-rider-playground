import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/server';
import { uiMeta } from '@arcrider/playground-demo-kit';
import { readFile } from 'node:fs/promises';
import { renderSchema, validateRender } from './contract.js';

export const RESOURCE_URI = 'ui://arc-rider/dynamic-table/v1.html';
export const readAppHtml = () => readFile(new URL('./mcp-app.html', import.meta.url), 'utf8');
const meta = uiMeta(RESOURCE_URI);

export function createServer() {
  const server = new McpServer({ name: 'arcwidgets-renderer', version: '0.1.0' });
  registerAppTool(server, 'render_table', {
    title: 'Render an arcWidgets table',
    description: 'Display records from a data tool as an interactive read-only table. First retrieve real rows from the data source, then choose columns matching the user request. Pass the actual rows, a source label, and config. Supports grouping, sorting, text, numbers, dates and currency. Never invent missing values. Maximum 200 rows and 12 columns. A follow-up calls this tool again with a complete revised view; it does not update an earlier message in place. Data is sent to this renderer; no source URLs are fetched or records saved.',
    inputSchema: renderSchema,
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
    _meta: meta,
  }, async args => {
    try {
      const input = validateRender(args);
      return {
        structuredContent: { kind: 'arcwidgets-table-v1', ...input },
        content: [{ type: 'text' as const, text: JSON.stringify(input) }],
      };
    } catch (error) {
      return { isError: true, content: [{ type: 'text' as const, text: `Invalid table configuration: ${(error as Error).message}` }] };
    }
  });
  registerAppResource(server, 'Dynamic arcWidgets table', RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: await readAppHtml(), _meta: { ui: { prefersBorder: true, csp: {} } } }],
  }));
  return server;
}

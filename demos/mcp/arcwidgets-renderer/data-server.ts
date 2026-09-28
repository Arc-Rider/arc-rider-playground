import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { isDate } from './contract.js';
import { orders, overdueOrders, tickets } from './fixtures.js';

export function createDataServer() {
  const server = new McpServer({ name: 'arcwidgets-demo-data', version: '0.1.0' });
  server.registerTool('get_demo_orders', {
    description: 'Read fictional orders. For overdueOnly, supply an explicit asOf date: open orders with dueDate before asOf are overdue. Fixtures are centred on September 2026. Returns records and field meanings, no UI.',
    inputSchema: z.object({ asOf: z.string().refine(isDate, 'Expected a real YYYY-MM-DD date'), overdueOnly: z.boolean().default(false) }).strict(),
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ asOf, overdueOnly }) => {
    const payload = { source: 'Fictional orders', asOf, currency: 'EUR', fields: { id: 'Stable record ID', customer: 'Customer name', subject: 'Order description', dueDate: 'YYYY-MM-DD due date', amount: 'Amount in EUR', status: 'open or paid' }, rows: overdueOnly ? overdueOrders(asOf) : orders };
    return { structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
  });
  server.registerTool('get_demo_tickets', {
    description: 'Read fictional support tickets with stable IDs, team, subject, priority and numeric hoursOpen. Returns records and field meanings, no UI.',
    inputSchema: z.object({}).strict(), annotations: { readOnlyHint: true, openWorldHint: false },
  }, async () => {
    const payload = { source: 'Fictional support tickets', fields: { id: 'Stable record ID', team: 'Responsible team', subject: 'Issue description', priority: 'High or Normal', hoursOpen: 'Hours since opening' }, rows: tickets };
    return { structuredContent: payload, content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
  });
  return server;
}

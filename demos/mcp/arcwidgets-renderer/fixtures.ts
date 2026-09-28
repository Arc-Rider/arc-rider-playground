import type { RenderInput } from './contract.js';

export const orders = [
  { id: 'order-101', customer: 'Northstar Bikes', subject: 'Workshop booking', dueDate: '2026-09-18', amount: 1250, status: 'open' },
  { id: 'order-102', customer: 'Cedar Studio', subject: 'Website update', dueDate: '2026-09-22', amount: 780, status: 'open' },
  { id: 'order-103', customer: 'Northstar Bikes', subject: 'Parts delivery', dueDate: '2026-09-24', amount: 2400, status: 'open' },
  { id: 'order-104', customer: 'Cedar Studio', subject: 'Maintenance', dueDate: '2026-10-05', amount: 350, status: 'open' },
  { id: 'order-105', customer: 'Harbor Coffee', subject: 'Installation', dueDate: '2026-09-10', amount: 960, status: 'paid' },
];
export const tickets = [
  { id: 'ticket-201', team: 'Support', subject: 'Printer offline', priority: 'High', hoursOpen: 42 },
  { id: 'ticket-202', team: 'Engineering', subject: 'Export timeout', priority: 'High', hoursOpen: 18 },
  { id: 'ticket-203', team: 'Support', subject: 'Account setup', priority: 'Normal', hoursOpen: 3 },
];
export function overdueOrders(asOf: string) {
  return orders.filter(row => row.status === 'open' && row.dueDate < asOf);
}
// Standalone previews only; the MCP renderer never substitutes these for tool input.
export const examples: Record<'orders' | 'tickets', RenderInput> = {
  orders: {
    title: 'Overdue orders', source: 'Fictional orders · as of 26 September 2026',
    rows: overdueOrders('2026-09-26'),
    config: { idField: 'id', groupBy: 'customer', sort: { field: 'dueDate', direction: 'asc' }, columns: [
      { field: 'subject', title: 'Order', width: 'auto', format: 'text' },
      { field: 'customer', title: 'Customer', width: '160px', format: 'text' },
      { field: 'dueDate', title: 'Due date', width: '160px', format: 'date' },
      { field: 'amount', title: 'Amount', width: '100px', format: 'currency', currency: 'EUR' },
    ] },
  },
  tickets: {
    title: 'Support tickets', source: 'Fictional support tickets', rows: tickets,
    config: { idField: 'id', groupBy: 'team', sort: { field: 'hoursOpen', direction: 'desc' }, columns: [
      { field: 'subject', title: 'Issue', width: 'auto', format: 'text' },
      { field: 'priority', title: 'Priority', width: '100px', format: 'text' },
      { field: 'hoursOpen', title: 'Hours open', width: '100px', format: 'number' },
    ] },
  },
};

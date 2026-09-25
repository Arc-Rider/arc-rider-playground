import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { applyChange, changeSchema, seed, snapshot } from './event.js';

export const RESOURCE_URI = 'ui://arc-rider/arc-event.html';
export class EventStore {
  private plan = seed();
  private queue = Promise.resolve();
  constructor(private file?: string) {}
  async load() {
    if (this.file) try { this.plan = JSON.parse(await fs.readFile(this.file, 'utf8')); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
    return this;
  }
  read() { return snapshot(structuredClone(this.plan)); }
  async change(input: unknown, preview = false) {
    let result = this.read();
    const operation = this.queue.then(async () => {
      const next = applyChange(this.plan, input);
      if (!preview) {
        if (this.file) { await fs.mkdir(path.dirname(this.file), { recursive: true }); await fs.writeFile(`${this.file}.tmp`, JSON.stringify(next, null, 2)); await fs.rename(`${this.file}.tmp`, this.file); }
        this.plan = next;
      }
      result = snapshot(next);
    });
    this.queue = operation.catch(() => {}); await operation; return result;
  }
}
export const appHtml = () => fs.readFile(path.join(import.meta.dirname, 'mcp-app.html'), 'utf8');
export function createServer(store: EventStore) {
  const server = new McpServer({ name: 'arc-event', version: '0.1.0' });
  const response = (state: ReturnType<EventStore['read']>, preview = false) => ({
    content: [{ type: 'text' as const, text: `${preview ? 'UNSAVED PREVIEW. ' : ''}${state.plan.title}, revision ${state.plan.revision}. ${state.conflicts.length} conflicts. Times are minutes after midnight in ${state.plan.timezone} on ${state.plan.date}. ${JSON.stringify(state.conflicts)}` }], structuredContent: { ...state, preview },
  });
  for (const view of ['calendar', 'timeline', 'table', 'capacity'] as const) registerAppTool(server, `show_event_${view}`, {
    title: `arcEvent ${view}`, description: `Show a compact ${view === 'calendar' ? 'Monday–Friday calendar with movable sessions' : view === 'timeline' ? 'segment timeline grouped by room or speaker' : view === 'table' ? 'arcTable of sessions, speakers and bookings' : 'capacity and booking progress'} view. Saved data for the current event session. Dates are ISO dates in 12–18 October 2026; start times are minutes after midnight in Europe/Berlin.`,
    inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false }, _meta: { ui: { resourceUri: RESOURCE_URI } },
  }, async () => ({ ...response(store.read()), structuredContent: { ...store.read(), view } }));
  server.registerTool('get_event_plan', { description: 'Read the authoritative event plan and room/speaker/availability conflicts. Use before edits and after UI interactions.', inputSchema: z.object({}), annotations: { readOnlyHint: true, openWorldHint: false } }, async () => response(store.read()));
  for (const preview of [true, false]) server.registerTool(preview ? 'preview_event_changes' : 'update_event_plan', {
    description: `${preview ? 'Preview without saving' : 'Save atomically'} a batch of session and speaker changes. Moving a session keeps all its segments together. To edit segments, supply the complete ordered segments array; durations determine sequential times. Speaker availability is checked per segment. Lunch is fixed. Conflicts are reported, not silently fixed. expectedRevision protects newer changes. Preview does not reserve its hypothetical revision; use the original saved revision to apply.`,
    inputSchema: changeSchema, annotations: { readOnlyHint: preview, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async args => { try { return response(await store.change(args, preview), preview); } catch (e) { return { isError: true, content: [{ type: 'text' as const, text: (e as Error).message }] }; } });
  registerAppResource(server, 'arcEvent', RESOURCE_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({ contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: await appHtml(), _meta: { ui: { prefersBorder: true, csp: {} } } }] }));
  return server;
}

# Dynamic table + independent data MCP

This demo connects two separate MCP servers through an assistant:

1. **Demo data** returns fictional orders or support tickets and their field meanings.
2. **arcWidgets renderer** accepts those rows and a model-chosen table configuration through `render_table`.
3. The MCP Apps UI renders the published `@arcrider/arcwidgets-react` table.

The renderer has no database connector, credentials, persistence or write actions. It does not fetch a `source` URL. The assistant must explicitly transfer the actual records between the two tools. Both tools must be enabled in the host. This transfer sends those records to the renderer server; use fictional data in this public example.

## Build and connect

From the repository root:

```sh
npm ci
npm run renderer:build
npm run renderer:test
npm run test:ui --workspace @arcrider/playground-mcp-renderer
```

In a host supporting local stdio servers, register **two** processes, each with this demo directory as its working directory:

```sh
node dist/main.js
node dist/main.js --data
```

Alternatively, run two terminals for local Streamable HTTP:

```sh
npm run start:http --workspace @arcrider/playground-mcp-renderer
npm run start:data:http --workspace @arcrider/playground-mcp-renderer
```

Renderer: `http://127.0.0.1:4195/mcp`. Data: `http://127.0.0.1:4196/mcp`.
Open `http://127.0.0.1:4195/` for a standalone preview with editable JSON and both datasets. The preview uses explicitly labelled fixtures; it does not simulate a model call. Embedded views wait for real tool results and never silently replace them with fixtures.

Cloud hosts cannot reach your localhost directly. Public HTTPS endpoints/tunnelling and any hosting configuration belong in `arc-rider-universe`, not this example repository. `PORT` overrides the port; `PLAYGROUND=1` selects HTTP and binds on all interfaces for the existing hosting environment. Neither endpoint supplies authentication by itself.

## Try these prompts with both MCPs enabled

1. “Get the fictional orders overdue as of 26 September 2026. Show an arcWidgets table with customer, order and due date, oldest due date first.”
2. “Group those orders by customer and add the amount in euros.”
3. “Now retrieve the support tickets. Show issue, priority and hours open, grouped by team and sorted by hours open descending.”

Expected: `get_demo_orders` → `render_table`; a revised `render_table`; then `get_demo_tickets` → the same `render_table`. For the stated date, exactly orders 101, 102 and 103 are overdue. Paid and future-due orders are excluded by the data server. No renderer changes are needed for the ticket schema.

Each call supplies a complete view. The host may create a new message; this demo does not promise to modify an earlier chat message in place. Embedded components accept subsequent tool-result notifications when the host delivers them.

## Configuration boundary

`contract.ts` defines a serializable subset mapped to the existing widget API, not a replacement for the full widget configuration:

- `title`, `source`, and `rows`: a title, provenance label and up to 200 flat records with scalar values.
- `config.idField`: a stable unique record ID.
- `config.columns`: 1–12 fields with title, optional width and format (`text`, `number`, `currency`, `date`). Currency needs `EUR`, `USD` or `GBP`; dates are real `YYYY-MM-DD` dates.
- Optional `config.groupBy` and `config.sort`: existing fields only. Sorting occurs before grouping; within each group it preserves that order. Null sort values go last.

Column definitions map to `header.columns`; row values map to `table[].columns`; groups map to nested `items`. Text is passed through React text nodes, including headers. No executable code, raw HTML, nested objects, custom CSS or arbitrary resource URLs are accepted. Missing fields, invalid types and duplicate IDs produce actionable tool errors. Null cells display an em dash. An empty dataset is valid.

The tool returns a text JSON fallback alongside structured content for hosts without UI. Large datasets, cross-source writes, persistent view IDs, authentication and packaging as a reusable SDK are later work.

## Verification scope

The MCP check launches two real stdio processes, transfers records, changes configurations and checks failures. The browser check renders the production bundle using the published widget and exercises both datasets, changed columns, literal HTML-like text, invalid input, empty results and a narrow viewport. A minimal test host also checks the MCP Apps initialization handshake, real tool-result notifications and replacement of invalid results. These tests do not prove that a particular assistant chooses the correct tool sequence; complete the three prompts in your target host before claiming end-to-end assistant compatibility.

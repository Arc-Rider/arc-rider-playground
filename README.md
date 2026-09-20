# Arc Rider Playground

Runnable, live examples built with the [published arcWidgets React package](https://www.npmjs.com/package/@arcrider/arcwidgets-react). This repository contains application examples, not the widget library's source code.

## Live demos

- [Board ↔ Table](demos/jev/prompt-driven-views/README.md) — type a view request. Jev selects bounded choices for the board or table, columns, sort, filters, grouping and highlights; the app passes the resulting data to arcWidgets. Open `/` or `/minimal-table-live`.
- [Smart Kanban](demos/jev/prompt-driven-views/README.md) — type a customer request. Jev evaluates team, urgency and whether clarification is needed; an explicit app policy places a card into Act now, Schedule or Review. Open `/smart-kanban-live`.

Both use fictional data and make real TypeSafe calls when configured. There are no scripted presentations or prerecorded decisions in this repository. Presentation scripts and videos remain in the separate local widget sandbox and can be developed independently.

The [MCP grouped table](demos/mcp/arcwidgets-table/README.md) is a third, independent example. An MCP tool returns fictional database objects and a linked UI resource renders them with published arcWidgets. You can preview its UI locally without an MCP host or connect the read-only tool to a host that supports MCP Apps. `demos/apps` is reserved for future examples.

## Run locally

Requires Node.js 20 or newer and npm:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:4192/>. Copy [`demos/jev/prompt-driven-views/.env.example`](demos/jev/prompt-driven-views/.env.example) to `.env.local` in that directory and set `TYPESAFE_API_KEY`; restart the server. The key stays server-side and the file is ignored by Git. The demos use exact `@arcrider/arcwidgets-react@0.1.0-alpha.5` from npm, with a lockfile for reproducible installation.

```sh
npm test
npm run build
npm run test:ui
```

The UI check needs Playwright Chromium (`npx playwright install chromium`). CI runs these checks. See the [MCP example setup](demos/mcp/arcwidgets-table/README.md) to run or preview its separate server.

## Publishing boundary

The repository contains no API key, GitHub issue import, customer data, scripted recording or widget-library source. The MCP table is read-only and uses fictional rows. The local Jev server is development middleware bound to localhost. A public deployment needs authentication and usage controls on its own backend. The example code is [MIT licensed](LICENSE); [brand assets](BRAND.md) and the installed arcWidgets package have separate rights and [commercial terms](https://www.arc-rider.com/terms).

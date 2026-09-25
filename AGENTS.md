# Arc Rider Playground

- Treat this as a public-facing example repository. Use the published `@arcrider/arcwidgets-react` npm package; do not copy widget source from the core repository.
- The repo contains two live Jev use cases: `/minimal-table-live` for Board ↔ Table and `/smart-kanban-live` for Smart Kanban triage. Do not add scripted presentations here; keep them in the separate widget sandbox.
- `demos/mcp/arcwidgets-table` is a read-only MCP App with fictional data. Keep its widget dependency on the published npm package, not a local `file:` link to core.
- No hosting/ops code here (no gateway, landing page, Dockerfiles, deploy scripts). That lives in `arc-rider-universe` (`infra/hetzner/playground/`) so this repo stays a pure, forkable example. `PLAYGROUND`-aware code in a demo's own `main.ts` (session header, HTTP mode) is fine — it just makes the demo multi-tenant-safe for whoever hosts it.
- Keep credentials, imported issues, customer data, generated recordings and build output out of Git.
- Preserve the English UI and square-corner visual language of the existing demos.
- Before changing the live TypeSafe schema or API integration, consult the current TypeSafe docs. Keep credentials server-side.

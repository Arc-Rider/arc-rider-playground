# Playground demo kit

Shared HTTP, session, preview and UI helpers for public MCP demos.

A demo supplies data and views. This package owns `/mcp`, `/healthz`, `/preview`, session isolation, ChatGPT metadata and the conformance check.

```sh
npm run build --workspace @arcrider/playground-demo-kit
node packages/demo-kit/scripts/check-demo.mjs demos/mcp/arc-event --session --resource=ui://arc-rider/arc-event-v2.html
```

# Grouped arcWidgets Table MCP App

This is the grouped database table MCP App originally prototyped in the local Arc Rider automation workspace, adapted as a self-contained public example. The `show_grouped_table` tool returns a structured, **fictional** set of database objects. The associated `ui://arc-rider/arcwidgets-table.html` resource bundles a React view using the published `@arcrider/arcwidgets-react@0.1.0-alpha.5` package. There is no PostgreSQL connection, external API, credential or write tool. Selecting rows and changing the theme affect only the view.

From the repository root, install and build:

```sh
npm ci
npm run build
```

To connect an MCP Apps-capable host, add a stdio server entry to its MCP configuration. Replace the example path with the absolute path to your clone:

```json
{
  "mcpServers": {
    "arcwidgets-table": {
      "command": "node",
      "args": [
        "/absolute/path/to/arc-rider-playground/demos/mcp/arcwidgets-table/dist/main.js",
        "--stdio"
      ]
    }
  }
}
```

Ask the host to call `show_grouped_table`. An MCP Apps-capable host displays the bundled table; text-only MCP clients receive a short summary. For a standalone look at the UI (sample data only), run `npm run mcp:preview` and open <http://127.0.0.1:4193/mcp-app.html>. The standalone preview does not invoke an MCP tool.

`npm run test` checks the tool's structured result, metadata and self-contained UI resource through a real stdio MCP client. The [MCP Apps quickstart](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/quickstart.md) describes this tool-plus-resource pattern.

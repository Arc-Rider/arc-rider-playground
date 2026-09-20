import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/client';
import {StdioClientTransport} from '@modelcontextprotocol/client/stdio';
import {buildPayload} from '../dist/projects.js';

const client=new Client({name:'arcwidgets-playground-check',version:'0.1.0'});
const transport=new StdioClientTransport({command:process.execPath,args:['dist/main.js','--stdio'],cwd:process.cwd(),stderr:'pipe'});

try{
  await client.connect(transport);
  const {tools}=await client.listTools();
  const tool=tools.find(item=>item.name==='show_grouped_table');
  assert.ok(tool,'The sample table tool must be available.');
  assert.equal(tool._meta?.ui?.resourceUri,'ui://arc-rider/arcwidgets-table.html');

  const result=await client.callTool({name:'show_grouped_table',arguments:{}});
  assert.equal(result.isError,undefined);
  assert.deepEqual(result.structuredContent,buildPayload());
  assert.match(result.content[0].text,/Database Explorer/);
  assert.match(result.structuredContent.subtitle,/Fictional schema/);

  const {resources}=await client.listResources();
  assert.ok(resources.some(item=>item.uri==='ui://arc-rider/arcwidgets-table.html'));
  const resource=await client.readResource({uri:'ui://arc-rider/arcwidgets-table.html'});
  assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
  assert.match(resource.contents[0].text,/<title>arcWidgets Table · MCP sample<\/title>/);
  assert.ok(resource.contents[0].text.includes('<script type="module"'),'The UI script must be bundled into the resource.');
  console.log('MCP tool, fictional payload and self-contained arcWidgets UI resource passed.');
}finally{
  await client.close();
}

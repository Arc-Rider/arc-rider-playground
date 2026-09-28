import { useMemo, useState } from 'react';
import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import { isPlaygroundPreview } from '@arcrider/playground-demo-kit/react';
import { ArcWidgetTable, type ArcWidgetTableData, type ArcWidgetTableRow } from '@arcrider/arcwidgets-react';
import { formatCell, sortedRows, validateRender, type RenderInput } from '../contract';
import { examples } from '../fixtures';
import { StaffingPreview } from './StaffingPreview';

function widgetData(input: RenderInput): ArcWidgetTableData {
  const { config } = input;
  const leaf = (row: RenderInput['rows'][number]): ArcWidgetTableRow => ({
    id: `record:${row[config.idField]}`, clickable: false, rowHeight: '42px',
    columns: config.columns.map(col => ({
      // React text nodes deliberately prevent external data being interpreted as HTML.
      value: <span>{formatCell(row[col.field], col)}</span>, width: col.width,
      align: col.format === 'number' || col.format === 'currency' ? 'right' : 'left',
    })),
  });
  const rows = sortedRows(input);
  const groups = new Map<string, { label: string; rows: typeof rows }>();
  if (config.groupBy) for (const row of rows) {
    const value = row[config.groupBy];
    const key = JSON.stringify([typeof value, value]);
    const group = groups.get(key) ?? { label: value === null ? 'Not specified' : String(value), rows: [] };
    group.rows.push(row); groups.set(key, group);
  }
  return {
    height: '400px',
    collapsible: { enabled: Boolean(config.groupBy), expandColumn: 0, indentColumn: 0 },
    header: { showHeader: true, height: '40px', backgroundColor: '#f4f4f5', fontColor: '#3f3f46',
      columns: config.columns.map(col => ({ title: <span>{col.title}</span>, width: col.width, align: col.format === 'number' || col.format === 'currency' ? 'right' : 'left' })) },
    styles: { backgroundColor: '#ffffff', fontColor: '#27272a', borderRadius: '0px', borders: { outer: true, columns: false, rows: { color: '#e4e4e7', width: '1px' } } },
    table: config.groupBy ? [...groups.values()].map((group, index) => ({
      id: `group:${index}`, rowHeight: '40px', clickable: true, rowColor: '#f4f4f5',
      columns: config.columns.map((col, i) => ({ width: col.width, value: i === 0 ? <strong>{group.label} ({group.rows.length})</strong> : <span /> })),
      items: group.rows.map(leaf),
    })) : rows.map(leaf),
    emptyTable: { title: 'No matching records', value: 'The data source returned no rows.' },
  };
}

function View({ input }: { input: RenderInput }) {
  const data = useMemo(() => widgetData(input), [input]);
  const minWidth = input.config.columns.reduce((width, col) => width + (col.width === 'auto' ? 200 : Number.parseInt(col.width)), 0);
  return <>
    <header><p className="eyebrow">arcWidgets · Dynamic table</p><h1>{input.title}</h1><p>{input.source}</p></header>
    <div className="summary"><span>{input.rows.length} records</span><span>{input.config.columns.length} columns</span><span>{input.config.groupBy ? `Grouped by ${input.config.groupBy}` : 'Ungrouped'}</span></div>
    <section aria-label="Data table">{input.rows.length ? <div style={{ minWidth }}><ArcWidgetTable id="dynamic-table" data={data} /></div> : <div className="empty"><h2>No matching records</h2><p>The data source returned no rows.</p></div>}</section>
    <p className="hint">Read-only view. Ask your assistant to change the columns, grouping or order.</p>
  </>;
}

function ConnectedTable() {
  const [input, setInput] = useState<RenderInput | null>(null);
  const [invalid, setInvalid] = useState('');
  const [revision, setRevision] = useState(0);
  const { app, error } = useApp({
    appInfo: { name: 'arcWidgets Dynamic Table', version: '0.1.0' }, capabilities: {}, autoResize: true,
    onAppCreated: instance => {
      instance.ontoolresult = result => {
        try {
          if (result.isError) throw new Error('The table request was rejected. Ask your assistant to correct it.');
          const payload = result.structuredContent as Record<string, unknown> | undefined;
          if (!payload || payload.kind !== 'arcwidgets-table-v1') throw new Error('Unsupported table result.');
          const { kind: _kind, ...value } = payload;
          setInput(validateRender(value)); setInvalid(''); setRevision(current => current + 1);
        } catch (e) { setInput(null); setInvalid((e as Error).message); }
      };
    },
  });
  useHostStyles(app, app?.getHostContext());
  return <main>{input ? <View key={revision} input={input} /> : <h1>Waiting for table data</h1>}
    {(invalid || error) && <p role="alert">{invalid || error?.message}</p>}</main>;
}

function Preview() {
  const [staffing, setStaffing] = useState(true);
  const [example, setExample] = useState<'orders' | 'tickets'>('orders');
  const [draft, setDraft] = useState(JSON.stringify(examples.orders, null, 2));
  const [input, setInput] = useState<RenderInput>(examples.orders);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  function choose(name: typeof example) {
    setStaffing(false);
    setExample(name); setInput(examples[name]); setDraft(JSON.stringify(examples[name], null, 2)); setError(''); setRevision(r => r + 1);
  }
  return <main>
    <nav aria-label="Example datasets"><button aria-pressed={staffing} onClick={() => setStaffing(true)}>Event · Ersatzsuche</button><button aria-pressed={!staffing && example === 'orders'} onClick={() => choose('orders')}>Orders</button><button aria-pressed={!staffing && example === 'tickets'} onClick={() => choose('tickets')}>Support tickets</button><span>Local preview · Fictional data</span></nav>
    {staffing ? <StaffingPreview /> : <>
    <View key={revision} input={input} />
    <details><summary>Edit the table request</summary><label htmlFor="request">Data and configuration</label>
      <textarea id="request" spellCheck={false} value={draft} onChange={event => setDraft(event.target.value)} />
      <button onClick={() => { try { setInput(validateRender(JSON.parse(draft))); setError(''); setRevision(r => r + 1); } catch (e) { setError((e as Error).message); } }}>Render table</button>
      {error && <p role="alert">{error}</p>}
    </details>
    </>}
  </main>;
}

export function TableApp() {
  return window.parent === window || isPlaygroundPreview() ? <Preview /> : <ConnectedTable />;
}

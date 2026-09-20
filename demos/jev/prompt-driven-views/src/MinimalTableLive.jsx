import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ArcWidgetKanban,ArcWidgetTable,ArcWidgetBadge,ArcWidgetText} from '@arcrider/arcwidgets-react';
import {allLiveFields,demoIssues,initialLiveView,isLiveHighlighted,liveFieldLabels,liveFilterLabels,liveGroupLabels,liveHighlightLabels,liveSortLabels,visibleLiveIssues} from './minimal-live-model.mjs';
import './minimal-table-live.css';

const widths={number:'72px',title:'fraction',type:'146px',widget:'132px',status:'116px',priority:'106px',owner:'124px',updated:'96px'};
const laneColors={Open:'#b88c53','In progress':'#7989a2',Done:'#739483',Bug:'#8a709b',Enhancement:'#647b9b',High:'#b23d4b',Medium:'#7690a9',Low:'#91a1b1'};
const badge=(value,color,background)=>({value,fontColor:color,backgroundColor:background,borderColor:'transparent',borderRadius:'0px',fontSize:'11px',paddingX:'7px',paddingY:'3px'});
const percent=value=>`${Math.round(value*100)}%`;
const pretty=value=>JSON.stringify(value,null,2);

function cellValue(issue,key,spotlight){
  if(key==='title')return <ArcWidgetText data={{value:issue.title,width:'100%',fontSize:'12px',fontWeight:'700',fontColor:'#41414a',truncate:true}}/>;
  if(key==='type')return <ArcWidgetBadge data={badge(issue.type,issue.type==='Bug'?'#503b75':'#3f5879',issue.type==='Bug'?'#d9cbea':'#ccd9ea')}/>;
  if(key==='status')return <ArcWidgetBadge data={badge(issue.status,issue.status==='Done'?'#3b5c66':'#3e5680',issue.status==='Done'?'#cbdfe2':'#ccdaef')}/>;
  if(key==='priority'){
    if(issue.priority==='High')return <ArcWidgetBadge data={badge('High',spotlight?'#fff':'#873840',spotlight?'#b23d4b':'#f0c8ce')}/>;
    return <ArcWidgetBadge data={badge(issue.priority,issue.priority==='Medium'?'#405a73':'#4f5d6d',issue.priority==='Medium'?'#ccdaea':'#dce2e9')}/>;
  }
  if(key==='owner')return <ArcWidgetBadge data={badge(issue.owner,issue.owner==='Unassigned'?'#4f457c':'#455f7c',issue.owner==='Unassigned'?'#d8d2e9':'#d3dfed')}/>;
  if(key==='widget')return <ArcWidgetBadge data={badge(issue.widget,'#445d7c','#d2deed')}/>;
  return key==='number'?`#${issue.number}`:issue[key];
}

function resultLabel(decision){
  if(!decision)return 'No decision yet';
  return {applied:'Applied',no_change:'No change',clarify:'Needs a clearer request',unsupported:'Outside this workspace'}[decision.status]||decision.status;
}

function inspectWidgetData(value){
  if(React.isValidElement(value)){
    const component=value.type===ArcWidgetText?'ArcWidgetText':value.type===ArcWidgetBadge?'ArcWidgetBadge':typeof value.type==='string'?value.type:'React component';
    return {component,props:inspectWidgetData(value.props)};
  }
  if(Array.isArray(value))return value.map(inspectWidgetData);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,inspectWidgetData(item)]));
  return value;
}

function WidgetPropsInspector({view,decision,board,table}){
  const isTable=view.view==='table';
  const component=isTable?'ArcWidgetTable':'ArcWidgetKanban';
  const data=isTable?table:board;
  const selected=decision?.answers?['view','columns_mode','sort','highlight','filter','group'].filter(key=>decision.answers[key]?.choice!=='keep').map(key=>`${key}: ${decision.answers[key].choice}`):[];
  return <section className="minimal-live-props" aria-label="Widget property mapping">
    <h3>How the properties reach the widget</h3>
    <p>Jev returns choices, not widget properties. The server validates them; React builds the <code>data</code> prop from the selected configuration and the sample issues.</p>
    <div className="minimal-live-prop-chain">
      <div><small>01 · LAST JEV CHOICES</small><span>{selected.length?selected.join(' · '):'No view choice yet'}</span></div>
      <div><small>02 · CURRENT APP CONFIG</small><span>{isTable?`columns: ${view.columns.map(key=>liveFieldLabels[key]).join(', ')} · highlight: ${view.highlight}`:`board grouped by ${view.group} · filter: ${view.filter}`}</span></div>
      <div><small>03 · REACT PROP</small><code>{`<${component} data={${isTable?'table':'board'}} />`}</code><span>{isTable?`${table.header.columns.length} header columns · ${table.table.length} rows`:`${board.swimlanes.length} swimlanes`}</span></div>
    </div>
    <details><summary>Actual <code>data</code> passed to {component}</summary><p className="minimal-live-caveat">This is the current prop value. React elements inside it are shown as component names and their props so the object can be inspected as JSON.</p><pre>{pretty(inspectWidgetData(data))}</pre></details>
  </section>;
}

export default function MinimalTableLive(){
  const [view,setView]=useState(()=>({...initialLiveView,columns:[...initialLiveView.columns]}));
  const [history,setHistory]=useState([]);
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState(null);
  const [notice,setNotice]=useState('Type a request and press Enter.');
  const [error,setError]=useState('');
  const [decision,setDecision]=useState(null);
  const [drawer,setDrawer]=useState(false);
  const inputRef=useRef(null);
  const drawerButtonRef=useRef(null);
  const closeRef=useRef(null);
  const lock=useRef(false);

  useEffect(()=>{let mounted=true;fetch('/api/minimal-live/status').then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error||'The live schema is unavailable.');if(mounted)setStatus(result);}).catch(cause=>{if(mounted)setError(cause.message);});return()=>{mounted=false;};},[]);
  useEffect(()=>{if(!drawer)return;closeRef.current?.focus();const onKey=event=>{if(event.key==='Escape'){setDrawer(false);drawerButtonRef.current?.focus();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[drawer]);

  const issues=useMemo(()=>visibleLiveIssues(view),[view]);
  const groups=useMemo(()=>{
    const buckets=new Map();
    for(const issue of issues){const label=issue[view.group];if(!buckets.has(label))buckets.set(label,[]);buckets.get(label).push(issue);}
    return [...buckets.entries()];
  },[issues,view.group]);
  const board=useMemo(()=>({height:'min(56vh, 610px)',collapsible:false,showScrollbar:false,empty:false,swimlanes:groups.map(([label,items])=>({
    id:label,title:<div className="minimal-lane-heading"><span className="minimal-status-mark" style={{background:laneColors[label]||'#8d91a2'}}/><span>{label}</span><span className="minimal-lane-count">{String(items.length).padStart(2,'0')}</span></div>,showAmount:false,minWidth:'220px',backgroundColorHeader:'#fff',backgroundColorBody:'#f5f5f7',fontColor:'#41414a',items:items.map(issue=>({id:issue.number,clickable:false,draggable:false,paddingX:'16px',paddingY:'10px',backgroundColor:'#fff',borderPosition:'left',borderWidth:'2px',borderColor:laneColors[issue.status],borderRadius:'0px',title:<span className="minimal-table-card-id">#{issue.number}</span>,value:<div className="minimal-table-card"><strong>{issue.title}</strong><div><ArcWidgetBadge data={badge(issue.type,issue.type==='Bug'?'#503b75':'#3f5879',issue.type==='Bug'?'#d9cbea':'#ccd9ea')}/><span>{issue.owner}</span></div></div>}))
  }))}),[groups]);
  const flexible=view.columns.includes('title')?'title':view.columns[0];
  const columnWidth=key=>key===flexible?'fraction':widths[key];
  const table=useMemo(()=>({height:'min(54vh, 560px)',header:{height:'47px',fontSize:'11px',backgroundColor:'#fafafb',columns:view.columns.map(key=>({title:liveFieldLabels[key],width:columnWidth(key),...(key==='title'?{minWidth:'250px'}:{}),sort:{enabled:false}}))},table:issues.map(issue=>({id:issue.number,rowHeight:'62px',rowPaddingY:'8px',rowColor:isLiveHighlighted(issue,view.highlight)?view.highlight==='high'?'#fff2f3':'#f1f3f9':'#fff',columns:view.columns.map(key=>({value:cellValue(issue,key,view.highlight==='high'&&issue.priority==='High'),width:columnWidth(key),...(key==='title'?{minWidth:'250px'}:{}),paddingX:'14px',styles:{fontSize:'11px'}}))})),emptyTable:{title:'No matching issues',value:'Try a different filter.'}}),[view,issues]);

  async function run(request=text){
    if(lock.current||!request.trim()||!status?.configured)return;
    lock.current=true;setBusy(true);setError('');setNotice('Jev is selecting a view configuration…');
    try{
      const response=await fetch('/api/minimal-live/view',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:request,currentView:view})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Jev did not respond.');
      setDecision({...result,request});
      if(result.status==='applied'){
        setHistory(previous=>[...previous.slice(-19),view]);
        setView(result.config);setText('');
        setNotice(`View updated by Jev · ${result.elapsedMs} ms · ${result.changes.length} ${result.changes.length===1?'setting':'settings'} changed`);
      }else setNotice(result.message);
    }catch(cause){setError(cause.message);setNotice('The view is unchanged.');}
    finally{lock.current=false;setBusy(false);}
  }

  const decisionRows=decision?Object.entries(decision.answers).filter(([key,answer])=>!key.startsWith('column_')||decision.answers.columns_mode.choice==='custom'&&answer.choice!=='keep'):[];
  return <div className="minimal-demo minimal-table-demo minimal-live-demo">
    <header className="topbar"><div className="brand"><img src="/logo.svg" alt=""/><span>arcWidgets</span><span className="separator">/</span><span className="project-name">Issue workspace</span></div><div className="top-meta"><span className="minimal-live-sample">SAMPLE ISSUES</span><span className="minimal-live-state" data-active={Boolean(status?.configured)}><i/>{status?.configured?'LIVE JEV':status?'JEV OFFLINE':'CONNECTING'}</span><button className="minimal-live-schema-button" type="button" ref={drawerButtonRef} onClick={()=>setDrawer(true)}>Schema ↗</button><a href="/smart-kanban-live">Smart Kanban ↗</a></div></header>
    <main className="minimal-live-stage">
      <section className="minimal-live-surface" aria-label="Live issue board or table" data-view={view.view}>
        {view.view==='board'?<ArcWidgetKanban key={`live-board-${JSON.stringify(view)}`} id="minimal-live-board" data={board}/>:<ArcWidgetTable key={`live-table-${JSON.stringify(view)}`} id="minimal-live-table" data={table}/>}
      </section>
      <div className="minimal-live-bottom"><form className="minimal-live-form" onSubmit={event=>{event.preventDefault();run();}}><label className="minimal-live-sr" htmlFor="minimal-live-request">Ask Jev to change the view</label><textarea id="minimal-live-request" ref={inputRef} rows={2} maxLength={500} value={text} disabled={busy||!status?.configured} placeholder={status&&!status.configured?'Add TYPESAFE_API_KEY to .env.local':'Ask Jev to change this view…'} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();run();}}}/><button type="submit" disabled={busy||!status?.configured||!text.trim()} aria-label="Apply request">↗</button></form><p className="minimal-live-hint">ENTER TO APPLY · SHIFT + ENTER FOR A NEW LINE</p><p className="minimal-live-notice" role="status">{busy?'MAKING A DECISION':notice}</p>{error&&<p className="minimal-live-error" role="alert">{error}</p>}</div>
    </main>
    {drawer&&<div className="minimal-live-drawer-layer"><button className="minimal-live-backdrop" aria-label="Close schema" onClick={()=>setDrawer(false)}/><aside className="minimal-live-drawer" role="dialog" aria-modal="true" aria-label="Jev schema and decisions"><div className="minimal-live-drawer-head"><span>BEHIND THE VIEW</span><button ref={closeRef} aria-label="Close schema" onClick={()=>{setDrawer(false);drawerButtonRef.current?.focus();}}>×</button></div><h2>What Jev decides</h2><p>Jev reads your request, the current view and the allowed choices. It returns typed decisions. The app validates them and configures the published arcWidgets.</p><div className="minimal-live-pipeline"><span>Request + current view</span><span>Jev choices + confidence</span><span>Validated widget data</span></div><WidgetPropsInspector view={view} decision={decision} board={board} table={table}/><section><h3>Last decision</h3>{decision?<><div className="minimal-live-decision-summary"><strong>{resultLabel(decision)}</strong><span>{decision.model} · {decision.elapsedMs} ms</span></div><p className="minimal-live-request-quote">“{decision.request}”</p><div className="minimal-live-answer-list">{decisionRows.map(([key,answer])=><div key={key}><span>{key.replaceAll('_',' ')}</span><b>{answer.choice}</b><small>{percent(answer.confidence)}</small></div>)}</div><p className="minimal-live-caveat">Questions run in parallel. The app uses only answers relevant to this edit; confidence is not a correctness guarantee.</p><h4>Applied changes</h4>{decision.changes.length?<ul>{decision.changes.map(change=><li key={change.key}><b>{change.key}</b>: {Array.isArray(change.after)?change.after.map(key=>liveFieldLabels[key]).join(', '):change.after}</li>)}</ul>:<p>No settings changed.</p>}<details><summary>Exact state sent to Jev</summary><pre>{pretty(decision.state)}</pre></details><details><summary>Raw typed answers</summary><pre>{pretty(decision.answers)}</pre></details></>:<p>Send a request to inspect Jev’s actual answer and the applied configuration here.</p>}</section><section><h3>Available decisions</h3><dl><dt>View</dt><dd>Board or Table</dd><dt>Columns</dt><dd>All, essentials, or a custom selection from {allLiveFields.length} existing fields</dd><dt>Order</dt><dd>{Object.values(liveSortLabels).join(' · ')}</dd><dt>Highlight</dt><dd>{Object.values(liveHighlightLabels).slice(1).join(' · ')}</dd><dt>Filter</dt><dd>{Object.values(liveFilterLabels).join(' · ')}</dd><dt>Board lanes</dt><dd>{Object.values(liveGroupLabels).join(' · ')}</dd></dl><p className="minimal-live-caveat">The eight tickets are sample data. The view decisions are live Jev calls; no ticket text is sent for these decisions. Jev does not generate UI code or provide a hidden reasoning trace.</p></section><section><h3>Try a request</h3><div className="minimal-live-examples">{['Show me the history','Show me only the essentials','Show me the highlights','Hide the Owner column','Group the board by widget'].map(example=><button key={example} onClick={()=>{setText(example);setDrawer(false);inputRef.current?.focus();}}>{example} ↗</button>)}</div></section><section><details><summary>Exact question schema</summary><pre>{pretty(status?.questions||{})}</pre></details></section><div className="minimal-live-drawer-actions"><button disabled={busy||history.length===0} onClick={()=>{const previous=history.at(-1);setHistory(items=>items.slice(0,-1));setView(previous);setNotice('Previous view restored locally.');}}>Undo view</button><button disabled={busy} onClick={()=>{setHistory([]);setView({...initialLiveView,columns:[...initialLiveView.columns]});setNotice('Starting view restored locally.');}}>Reset</button></div></aside></div>}
  </div>;
}

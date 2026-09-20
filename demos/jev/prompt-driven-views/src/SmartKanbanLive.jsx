import React,{useEffect,useMemo,useState} from 'react';
import {ArcWidgetBadge,ArcWidgetKanban} from '@arcrider/arcwidgets-react';
import {triageLanes} from './triage-model.mjs';
import './minimal-table-live.css';
import './smart-kanban-live.css';

const examples=[
  'The CSV export returns HTTP 500 for every user. We need it restored today before our 4 pm deadline; please fix the export error.',
  'The same item appears twice on our invoice. Could you check it when you have time?',
  'Something is wrong with our access and invoice. Can you take a look?',
];
const percent=value=>`${Math.round(value*100)}%`;
const badge=(value)=>({value,fontColor:'#5f527b',backgroundColor:'#e8e1f1',borderColor:'transparent',borderRadius:'0px',fontSize:'10px',paddingX:'7px',paddingY:'3px'});

export default function SmartKanbanLive(){
  const [cards,setCards]=useState([]);
  const [text,setText]=useState('');
  const [status,setStatus]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('Type a customer request and press Enter.');
  const [last,setLast]=useState(null);
  const [details,setDetails]=useState(false);

  useEffect(()=>{let mounted=true;fetch('/api/triage/status').then(async response=>{const value=await response.json();if(!response.ok)throw Error(value.error||'Jev status unavailable.');if(mounted)setStatus(value);}).catch(cause=>{if(mounted)setError(cause.message);});return()=>{mounted=false;};},[]);
  const board=useMemo(()=>({height:'min(55vh, 590px)',collapsible:false,showScrollbar:false,empty:false,swimlanes:triageLanes.map(lane=>({
    id:lane.id,title:<div className="minimal-lane-heading"><span className="minimal-status-mark" style={{background:lane.color}}/><span>{lane.title}</span><span className="minimal-lane-count">{String(cards.filter(card=>card.route.lane===lane.id).length).padStart(2,'0')}</span></div>,showAmount:false,minWidth:'220px',backgroundColorHeader:'#fff',backgroundColorBody:'#f5f5f7',fontColor:'#41414a',items:cards.filter(card=>card.route.lane===lane.id).map(card=>({
      id:card.id,clickable:false,draggable:false,paddingX:'16px',paddingY:'12px',backgroundColor:'#fff',borderPosition:'left',borderWidth:'2px',borderColor:lane.color,borderRadius:'0px',title:<span className="smart-card-number">#{card.id}</span>,value:<div className="smart-card"><strong>{card.text}</strong><div><ArcWidgetBadge data={badge(card.route.team)}/><span>✧ by Jev</span></div></div>
    }))
  }))}),[cards]);

  async function evaluate(){
    const request=text.trim();
    if(!request||busy||!status?.configured)return;
    setBusy(true);setError('');setNotice('Jev is assessing team, urgency and clarity…');
    try{
      const response=await fetch('/api/triage/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:request})});
      const result=await response.json();
      if(!response.ok)throw Error(result.error||'Jev could not evaluate the request.');
      setCards(current=>[{id:current.length+1,text:request,route:result.route},...current]);
      setLast({...result,request});setText('');setNotice(`${result.route.team} · ${triageLanes.find(lane=>lane.id===result.route.lane)?.title} · ${result.elapsedMs} ms`);
    }catch(cause){setError(cause.message);setNotice('No card was added.');}
    finally{setBusy(false);}
  }

  return <div className="minimal-demo minimal-live-demo smart-kanban-live">
    <header className="topbar"><div className="brand"><img src="/logo.svg" alt=""/><span>arcWidgets</span><span className="separator">/</span><span className="project-name">Smart Kanban</span></div><div className="top-meta"><span className="minimal-live-sample">CUSTOMER REQUESTS</span><span className="minimal-live-state" data-active={Boolean(status?.configured)}><i/>{status?.configured?'LIVE JEV':status?'JEV OFFLINE':'CONNECTING'}</span><a href="/minimal-table-live">Board ↔ Table ↗</a></div></header>
    <main className="minimal-live-stage">
      <section className="minimal-live-surface" aria-label="Live Smart Kanban board"><ArcWidgetKanban id="smart-live-board" data={board}/></section>
      <div className="minimal-live-bottom"><form className="minimal-live-form" onSubmit={event=>{event.preventDefault();evaluate();}}><label className="minimal-live-sr" htmlFor="smart-live-request">Customer request to evaluate</label><textarea id="smart-live-request" rows={2} maxLength={2000} value={text} disabled={busy||!status?.configured} placeholder={status&&!status.configured?'Add TYPESAFE_API_KEY to .env.local':'Type a fictional customer request…'} onChange={event=>setText(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();evaluate();}}}/><button type="submit" disabled={busy||!status?.configured||!text.trim()} aria-label="Evaluate request">↗</button></form><p className="minimal-live-hint">SAMPLE TEXT IS SENT TO JEV · ENTER TO EVALUATE</p><p className="minimal-live-notice" role="status">{busy?'MAKING A DECISION':notice}</p>{error&&<p className="minimal-live-error" role="alert">{error}</p>}{!cards.length&&<div className="smart-examples"><span>TRY A SAMPLE INPUT</span>{examples.map(example=><button key={example} onClick={()=>setText(example)} disabled={!status?.configured||busy}>{example}</button>)}</div>}</div>
    </main>
    {last&&<aside className="smart-decision"><button type="button" aria-expanded={details} onClick={()=>setDetails(!details)}>Last decision {details?'−':'+'}</button>{details&&<div><p><strong>{last.route.team} → {triageLanes.find(lane=>lane.id===last.route.lane)?.title}</strong></p><p>{last.route.reason}</p><dl><dt>Team confidence</dt><dd>{percent(last.answers.department.confidence)}</dd><dt>Immediate urgency</dt><dd>{percent(last.answers.urgency.noul)}</dd><dt>Needs clarification</dt><dd>{percent(last.answers.needs_clarification.noul)}</dd></dl><details><summary>Exact Jev answers</summary><pre>{JSON.stringify(last.answers,null,2)}</pre></details><details><summary>Question schema</summary><pre>{JSON.stringify(status?.questions,null,2)}</pre></details><small>Jev returns typed judgments; application rules choose the lane. These demo thresholds are not a production policy.</small></div>}</aside>}
  </div>;
}

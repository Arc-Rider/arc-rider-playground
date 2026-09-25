import { useApp, useHostStyles } from '@modelcontextprotocol/ext-apps/react';
import { ArcWidgetCalendarWeek, ArcWidgetCalendarTimeline, ArcWidgetTable, ArcWidgetProgressBar, ArcWidgetBadge, ArcWidgetButton, type ArcWidgetCalendarTimelineProps, type ArcWidgetCalendarWeekProps, type ArcWidgetTableData } from '@arcrider/arcwidgets-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { clock, end, parts, nativeMoveChanges, type NativeSegmentMove, weekDates, type Change, type Session, type Snapshot } from '../event';

type View = 'calendar' | 'timeline' | 'table' | 'capacity';
type Payload = Snapshot & { view?: View; preview?: boolean };
type Bridge = { read: () => Promise<Payload>; save: (change: Change) => Promise<Payload>; validate?: (text: string) => Promise<void>; context?: (text: string) => Promise<unknown> };
const parse = (value: unknown): Payload => { const s = value as Payload; if (!s?.plan?.sessions || !Array.isArray(s.conflicts)) throw new Error('Invalid event data.'); return s; };
async function request(path: string, body?: Change) { const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined); const json = await r.json(); if (!r.ok) throw new Error(json.error ?? 'Request failed'); return parse(json); }
const local: Bridge = { read: () => request('api/plan'), save: change => request('api/changes', change) };
const viewNames: Record<View,string> = {calendar:'Week',timeline:'Timeline',table:'Sessions',capacity:'Bookings'};
export function EventApp() { const preview = new URLSearchParams(window.location.search).get('mcp'); const initialView = preview && preview in viewNames ? preview as View : 'calendar'; return window.parent === window ? <Planner bridge={local} compact={!!preview} initialView={initialView}/> : <Embedded />; }
function Embedded() {
  const [incoming, setIncoming] = useState<Payload>();
  const { app, error } = useApp({ appInfo: { name: 'arcEvent', version: '0.2.0' }, capabilities: {}, autoResize: true,
    onAppCreated: instance => { instance.ontoolresult = result => { if (result.structuredContent) { const p = parse(result.structuredContent); if (!p.preview) setIncoming(p); } }; },
  });
  useHostStyles(app, app?.getHostContext());
  const bridge = useMemo<Bridge | undefined>(() => app ? {
    read: async () => { const r = await app.callServerTool({ name: 'get_event_plan', arguments: {} }); if (r.isError) throw new Error('Could not load the plan'); return parse(r.structuredContent); },
    save: async change => { const r = await app.callServerTool({ name: 'update_event_plan', arguments: change }); if (r.isError) throw new Error(r.content.filter(c => c.type === 'text').map(c => c.text).join(' ')); return parse(r.structuredContent); },
    validate: async text => { const result = await app.sendMessage({role:'user',content:[{type:'text',text}]}); if(result.isError) throw new Error('ChatGPT did not accept the validation request. Please try again.'); },
    context: text => app.updateModelContext({ content: [{ type: 'text', text }] }),
  } : undefined, [app]);
  return bridge ? <Planner bridge={bridge} incoming={incoming} compact /> : <main className="loading">{error?.message ?? 'Connecting arcEvent…'}</main>;
}
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayName = (date?: string) => days[weekDates.indexOf(date as typeof weekDates[number])] ?? '';
const fromClock = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
function Occupancy({ session }: { session: Session }) {
  const full = session.bookings! >= session.capacity!;
  return <div className="occupancy"><span>{session.bookings} / {session.capacity}<small>{full ? 'Full' : `${session.capacity! - session.bookings!} available`}</small></span><ArcWidgetProgressBar data={{ valueProgress: session.bookings, valueTotal: session.capacity, height: '5px', width: '100%', progressColor: full ? '#a66338' : '#52765b', backgroundColor: '#e9ece7', borderRadius: '0px' }} /></div>;
}
const topicThemes: Record<string,{ink:string;main:string;intro:string;demo:string}> = {
  'AI & Agents':{ink:'#6d28d9',main:'#ede9fe',intro:'#f5f3ff',demo:'#ddd6fe'},
  'Platform Engineering':{ink:'#0369a1',main:'#e0f2fe',intro:'#f0f9ff',demo:'#bae6fd'},
  'Product Design':{ink:'#be185d',main:'#fce7f3',intro:'#fdf2f8',demo:'#fbcfe8'},
  'Data & Trust':{ink:'#047857',main:'#d1fae5',intro:'#ecfdf5',demo:'#a7f3d0'},
  'MCP & Integrations':{ink:'#b45309',main:'#fef3c7',intro:'#fffbeb',demo:'#fde68a'},
  'Organization':{ink:'#57534e',main:'#e7e5e4',intro:'#fafaf9',demo:'#d6d3d1'},
};
const themeFor = (s:Session) => topicThemes[s.topic ?? 'Organization'] ?? topicThemes.Organization;
const fillFor = (s:Session,id:string) => {const t=themeFor(s);return id==='intro'?t.intro:id==='demo'?t.demo:t.main;};
const breakDay = {date:Date.UTC(2026,9,14),color:'#fff7e5',title:{label:'Wed 14 · Break'}};
function Planner({ bridge, incoming, compact=false, initialView='calendar' }: { bridge: Bridge; incoming?: Payload; compact?:boolean; initialView?:View }) {
  const [state, setState] = useState<Payload>(); const [view, setView] = useState<View>(initialView);
  const [needsValidation,setNeedsValidation] = useState(false); const [validationMessage,setValidationMessage] = useState('');
  const nativeMoves = useRef<NativeSegmentMove[]>([]); const [calendarReset, setCalendarReset] = useState(0);
  const [selected, setSelected] = useState<string>(); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const [timelineDay, setTimelineDay] = useState<string>('all'); const [groupBy, setGroupBy] = useState('rooms');
  const [filter, setFilter] = useState('all'); const [showConflicts, setShowConflicts] = useState(false);
  const accept = (next: Payload) => setState(prev => prev && prev.plan.revision > next.plan.revision ? prev : next);
  useEffect(() => { let live = true; bridge.read().then(s => { if (live) accept(s); }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, [bridge]);
  useEffect(() => { if (incoming) { accept(incoming); if (incoming.view) setView(incoming.view); } }, [incoming]);
  async function refresh() { try { accept(await bridge.read()); setError(''); } catch (e) { setError((e as Error).message); } }
  async function save(sessions: Change['sessions']) {
    if (!state || busyRef.current) return false; busyRef.current = true; setBusy(true); setError('');
    try { const next = await bridge.save({ expectedRevision: state.plan.revision, sessions, speakers: [] }); accept(next); setMessage('Saved'); setNeedsValidation(true); setValidationMessage('');
      if (bridge.context) void bridge.context(`arcEvent revision ${next.plan.revision}; ${next.conflicts.length} conflicts. Read get_event_plan for saved dates, times, segments and bookings.`).catch(() => {});
      return true;
    } catch (e) { setError((e as Error).message); return false; } finally { busyRef.current = false; setBusy(false); }
  }
  async function validatePlan() {
    if (busyRef.current) return;
    busyRef.current=true;setBusy(true);setError('');
    try {
      const latest=await bridge.read();accept(latest);
      if(bridge.validate) {
        await bridge.validate(`Validate the current Arc Tech Summit plan. Read get_event_plan first (the UI last read revision ${latest.plan.revision}). Check room and speaker overlaps, availability, booking capacities, one-hour breaks between talk blocks, and the Wednesday organization day. Explain any issues and suggest concrete fixes. Do not change the plan without my request.`);
        setValidationMessage('Validation requested in chat');
      } else {
        const overbooked = latest.plan.sessions.filter(s=>s.bookings!>s.capacity!).length;
        setValidationMessage(`Local check: ${latest.conflicts.length} scheduling conflicts, ${overbooked} overbooked sessions. AI review requires ChatGPT.`);
        setShowConflicts(latest.conflicts.length>0);
      }
      setNeedsValidation(false);
    } catch(e) {setError((e as Error).message);}
    finally {busyRef.current=false;setBusy(false);}
  }
  const onNativeDrag: NonNullable<ArcWidgetCalendarWeekProps['onEntryDragSave']> = (_index, _start, destination, source) => {
    if (!state || source.split_index !== null || source.segment_index === null) return;
    const visibleSessions = state.plan.sessions.filter(s => filter === 'all' || s.roomId === filter || s.segments.some(p => p.speakerIds.includes(filter)));
    const session = visibleSessions[source.entry_index];
    if (!session) return;
    const first = nativeMoves.current.length === 0;
    nativeMoves.current.push({sessionId:session.id,segmentIndex:source.segment_index,date:Number(destination.dateFrom),dateTo:Number(destination.dateTo),from:Number(destination.timeFrom),to:Number(destination.timeTo)});
    if (first) queueMicrotask(async () => {
      const moves = nativeMoves.current.splice(0);
      try { await save(nativeMoveChanges(state.plan.sessions,moves)); }
      catch (e) { setError((e as Error).message); }
      finally { setCalendarReset(n=>n+1); }
    });
  };
  if (!state) return <main className="loading">{error || 'Loading event…'}</main>;
  const { plan, conflicts } = state; const active = plan.sessions.find(s => s.id === selected);
  const visible = plan.sessions.filter(s => filter === 'all' || s.roomId === filter || s.segments.some(p => p.speakerIds.includes(filter)));
  const sorted = [...visible].sort((a,b) => a.date!.localeCompare(b.date!) || a.start - b.start);
  const timelineResources = groupBy==='rooms' ? plan.rooms : plan.speakers;
  const timelineParts = (row: number) => {
    const resource = timelineResources[row];
    return resource ? visible.filter(s=>timelineDay==='all' || s.date===timelineDay).flatMap(s=>parts(s).filter(p=>groupBy==='rooms'?s.roomId===resource.id:p.speakerIds.includes(resource.id))) : [];
  };
  const onTimelineDrag: NonNullable<ArcWidgetCalendarTimelineProps['onEntryDragSave']> = async (row,index,_start,rowChange,destination) => {
    try {
      const originRow = rowChange.start_row_index ?? row;
      const part = timelineParts(originRow)[index];
      const session = plan.sessions.find(s=>s.id===part?.sessionId);
      const target = timelineResources[rowChange.row_index ?? row];
      if (!part || !session || !target) throw new Error('Unknown timeline destination.');
      const overview = timelineDay === 'all';
      const date = overview ? new Date(Number(destination.dateFrom)).toISOString().slice(0,10) : session.date;
      if (overview && Number(destination.dateTo)!==Number(destination.dateFrom)) throw new Error('Sessions must stay within one day.');
      const from = overview ? part.start : Number(destination.timeFrom)/60000;
      const to = overview ? part.end : Number(destination.timeTo)/60000 + 30;
      if (![from,to].every(Number.isFinite)) throw new Error('Incomplete timeline destination.');
      const segments = session.segments.map(p=>p.id===part.id ? {...p,duration:to-from,
        speakerIds:groupBy==='speakers' && originRow!==rowChange.row_index
          ? [...new Set(p.speakerIds.map(id=>id===timelineResources[originRow].id?target.id:id))] : p.speakerIds} : p);
      await save([{id:session.id,date,start:session.start+from-part.start,segments,...(groupBy==='rooms'?{roomId:target.id}:{})}]);
    } catch(e) { setError((e as Error).message); }
    finally { setCalendarReset(n=>n+1); }
  };
  const segmentContent = (session:Session,p:ReturnType<typeof parts>[number]) => <div className="summit-segment">
    {p.id==='main' && <div className="speaker-badges">{p.speakerIds.map(id=><ArcWidgetBadge key={id} data={{value:plan.speakers.find(sp=>sp.id===id)?.name,fontSize:'10px',paddingX:'4px',paddingY:'1px',borderRadius:'0px',singleColor:themeFor(session).ink}}/>)}</div>}
    {p.id==='main' && <div className="segment-topic">{session.topic}</div>}
    <div className="segment-title">{p.title}</div>
  </div>;
  const table: ArcWidgetTableData = {
    height: '370px', styles: { fontSize: '12px', borderRadius: '0px', borders: { outer: true, columns: false, rows: { color: '#e7e7e7', width: '1px' } } },
    header: { showHeader: true, height: '34px', backgroundColor: '#fafafa', fontSize: '12px', columns: [{title:'Session',width:'auto'},{title:'When',width:'115px'},{title:'Room / speakers',width:'170px'},{title:'Bookings',width:'155px'}] },
    table: sorted.map(s => ({ id: s.id, rowHeight: '58px', columns: [
      { value: <button className="row-title" onClick={() => setSelected(s.id)}>{s.title}<small>{s.segments.length} segments {s.locked ? '· Fixed' : ''}</small></button>, width: 'auto' },
      { value: <span>{dayName(s.date)} {clock(s.start)}<small>until {clock(end(s))}</small></span>, width:'115px' },
      { value: <span>{plan.rooms.find(r=>r.id===s.roomId)?.name}<small>{[...new Set(s.segments.flatMap(p=>p.speakerIds))].map(id=>plan.speakers.find(p=>p.id===id)?.name.split(' ')[0]).join(', ') || '—'}</small></span>,width:'170px'},
      { value: <Occupancy session={s}/>,width:'155px'}
    ] })), footer: { showFooter:false },
  };
  const bookingTable: ArcWidgetTableData = {
    height: '370px',
    collapsible: { enabled: true, expandColumn: 0, indentColumn: 0 },
    styles: { fontSize: '12px', borderRadius: '0px', borders: { outer: true, columns: false, rows: { color: '#e7e7e7', width: '1px' } } },
    header: { showHeader: true, height: '34px', fontSize: '12px', backgroundColor: '#fafafa', columns: [
      { title: 'Session / attendee', width: 'fraction' }, { title: 'Booking ID', width: '110px' },
      { title: 'Status / time', width: '130px' }, { title: 'Seats / capacity', width: '170px' },
    ] },
    table: sorted.map(s => ({
      id: `bookings-${s.id}`, rowHeight: '62px', rowColor: '#f7f8f6', clickable: true,
      columns: [
        { span: 2, value: <div className="booking-group"><strong>{s.title}</strong><small>{s.bookingItems?.length} individual bookings · {plan.rooms.find(r=>r.id===s.roomId)?.name}</small></div> },
        { value: <span>{dayName(s.date)} {clock(s.start)}<small><button className="row-title" onClick={e=>{e.stopPropagation();setSelected(s.id);}}>Edit session ↗</button></small></span> },
        { value: <Occupancy session={s}/> },
      ],
      items: s.bookingItems?.map(b => ({ id: b.id, rowHeight: '54px', clickable: false, columns: [
        { value: <span>{b.name}<small>{b.company}</small></span> },
        { value: <span title={b.id}>#{b.id.split('-').at(-1)}</span> },
        { value: <span className="booking-status">{b.status}</span> },
        { value: <span>{b.seats} seat</span> },
      ] })),
    })), footer: { showFooter: false },
  };
  return <main className={`event-app ${compact ? 'mcp-view' : ''}`}>
    <header><div><strong>arcEvent</strong><span>{compact ? `Tech Summit · ${viewNames[view]}` : 'Tech Summit · 12–16 Oct 2026'}</span></div><div className="header-actions">{needsValidation && <ArcWidgetButton id="validate-plan" data={{title:busy?'Working…':'Validate Plan',height:'30px',fontSize:'12px',backgroundColor:'#27272a',fontColor:'#ffffff',borderRadius:'0px'}} onClick={validatePlan}/>} {!compact && <button onClick={refresh} disabled={busy} aria-label="Refresh plan">↻</button>}</div></header>
    {(compact && (error || validationMessage || busy)) && <div className="validation-status" role={error?'alert':'status'}>{error || (busy?'Saving…':validationMessage)}</div>}
    {!compact && <><nav aria-label="Event views">{(['calendar','timeline','table','capacity'] as View[]).map(v=><button key={v} aria-pressed={view===v} onClick={()=>{setView(v);setSelected(undefined);}}>{v==='calendar'?'Week':v==='timeline'?'Timeline':v==='table'?'Sessions':'Bookings'}</button>)}<button className="conflict-toggle" onClick={()=>setShowConflicts(!showConflicts)}>{conflicts.length} conflicts</button></nav>
    <div className="toolbar"><span>{view==='calendar'?'Drag to move · changes are saved · Berlin time':view==='timeline'?timelineDay==='all'?'Summit overview · drag between days · select a day for hours':'Drag to move session · resize to adjust segment':view==='table'?`${visible.length} sessions · click to edit`:'Expand a session to see individual bookings'}</span><select aria-label="Filter rooms or speakers" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All rooms & speakers</option><optgroup label="Rooms">{plan.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</optgroup><optgroup label="Speakers">{plan.speakers.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</optgroup></select></div>
    {view==='timeline' && <div className="timeline-controls"><select aria-label="Timeline day" value={timelineDay} onChange={e=>setTimelineDay(e.target.value)}><option value="all">Full summit · 12–16 Oct</option>{weekDates.slice(0,5).map((d,i)=><option key={d} value={d}>{days[i]} {d.slice(8)} Oct</option>)}</select><select aria-label="Timeline grouping" value={groupBy} onChange={e=>setGroupBy(e.target.value)}><option value="rooms">By room</option><option value="speakers">By speaker</option></select></div>}
    <div className="mcp-preview-links"><span>MCP App previews</span>{(Object.keys(viewNames) as View[]).map(v=><a key={v} href={`?mcp=${v}`}>{viewNames[v]} ↗</a>)}</div>
    {validationMessage && <div className="validation-status" role="status">{validationMessage}</div>}
    </>}
    {showConflicts && <div className="conflicts">{conflicts.map(c=><button key={c.id} onClick={()=>setSelected(c.sessionIds[0])}>{c.message}</button>)}{!conflicts.length && <span>No conflicts</span>}</div>}
    <div className={`stage ${view === 'timeline' ? 'timeline-stage' : view !== 'calendar' ? 'table-stage' : ''}`}>
      {view==='calendar' && <ArcWidgetCalendarWeek key={`${plan.revision}-${filter}-${calendarReset}`} id={`event-week-${filter}`} onEntryDragSave={onNativeDrag} onEntryClick={index=>{const segment=visible.flatMap(s=>parts(s))[index];if(segment)setSelected(segment.sessionId);}} data={{ height:'390px', timeSlotHeight:'56px', timeSlotWidth:'34px', timeZoneBalance:0, lang:'en', styles:{borderRadius:'0px'}, dateSettings:{startDate:Date.UTC(2026,9,12),duration:5,highlights:[breakDay],header:{title:{label:'##weekDayShort## ##day##',fontSize:'11px',alignX:'center'}}}, timeSettings:{timeStart:540*60000,duration:540*60000},timeEntries:visible.map(s=>({id:s.id,dateFrom:Date.parse(s.date!+'T00:00:00Z'),dateTo:Date.parse(s.date!+'T00:00:00Z'),timeFrom:s.start*60000,timeTo:end(s)*60000,draggable:!s.locked && !busy,clickable:true,styles:{backgroundColor:s.roomId==='studio'?'#eeebdf':'#e8ede9',color:'#294333',borderRadius:'0px'},segments:parts(s).map(p=>({id:p.id,duration:p.duration*60000,linked:true,insetBorder:{enabled:true,position:'left',stroke:p.id==='intro'||p.id==='demo'?'dotted':'solid',color:themeFor(s).ink},title:p.title,timeFrom:p.start*60000,timeTo:p.end*60000,styles:{backgroundColor:fillFor(s,p.id),color:themeFor(s).ink,borderRadius:'0px'},customLayout:segmentContent(s,p)}))})) }}/> }
      {view==='timeline' && <ArcWidgetCalendarTimeline key={`${plan.revision}-${filter}-${timelineDay}-${groupBy}-${calendarReset}`} id="event-timeline" onEntryDragSave={onTimelineDrag} onEntryClick={(row,index)=>{const resource=(groupBy==='rooms'?plan.rooms:plan.speakers)[row];const p=visible.filter(s=>timelineDay==='all' || s.date===timelineDay).flatMap(s=>parts(s).filter(p=>groupBy==='rooms'?s.roomId===resource.id:p.speakerIds.includes(resource.id)))[index];if(p)setSelected(p.sessionId);}} data={{height:'350px',lang:'en',timeZoneBalance:0,...(timelineDay==='all'?{dateSettings:{startDate:Date.UTC(2026,9,12),duration:5,highlights:[{...breakDay,applyToRows:true}]},dayWidth:'76px',zoomSettings:{enabled:true,defaultDayWidth:'76px',minDayWidth:'40px',maxDayWidth:'240px',persist:false}}:{timeSettings:{startTime:9,duration:9,amount:0.5},columnWidth:'40px',zoomSettings:{enabled:true,defaultDayWidth:'40px',minDayWidth:'24px',maxDayWidth:'120px',persist:false}}),columns:[{title:groupBy==='rooms'?'Room':'Speaker',width:'125px'}],styles:{borderRadius:'0px'},items:(groupBy==='rooms'?plan.rooms:plan.speakers).map(resource=>({id:resource.id,columns:[{title:resource.name,fontSize:'12px'}],timeEntries:visible.filter(s=>timelineDay==='all' || s.date===timelineDay).flatMap(s=>parts(s).filter(p=>groupBy==='rooms'?s.roomId===resource.id:p.speakerIds.includes(resource.id)).map(p=>({id:`${s.id}-${p.id}`,dateFrom:Date.parse(s.date!+'T00:00:00Z'),dateTo:Date.parse(s.date!+'T00:00:00Z'),timeFrom:p.start*60000,timeTo:(p.end-30)*60000,draggable:!s.locked && !busy,styles:{backgroundColor:fillFor(s,p.id),color:themeFor(s).ink,borderRadius:'0px'},customLayout:segmentContent(s,p),clickable:true,title:p.title,subtitle:`${clock(p.start)}–${clock(p.end)}`})))}))}}/>}
      {view==='table' && <ArcWidgetTable id="event-sessions" data={table}/>}
      {view==='capacity' && <ArcWidgetTable id="event-bookings" data={bookingTable}/>}
      {active && <div className="editor" role="dialog" aria-label="Edit session"><div className="editor-heading"><strong>{active.title}</strong><button aria-label="Close editor" onClick={()=>setSelected(undefined)}>×</button></div><Editor key={`${active.id}-${plan.revision}`} session={active} state={state} busy={busy} save={save}/></div>}
    </div>
    {!compact && <footer aria-live="polite"><span role={error?'alert':undefined}>{error || (busy?'Saving…':message || 'Fictional event · arcWidgets')}</span><span>Revision {plan.revision}</span></footer>}
  </main>;
}
function Editor({session,state,busy,save}:{session:Session;state:Snapshot;busy:boolean;save:(changes:Change['sessions'])=>Promise<boolean>}) {
  const [draft,setDraft]=useState(()=>structuredClone(session));
  return <form onSubmit={e=>{e.preventDefault();void save([{id:draft.id,capacity:draft.capacity,bookings:draft.bookings,...(!session.locked?{date:draft.date,start:draft.start,roomId:draft.roomId,segments:draft.segments}:{})}]);}}>
    <fieldset disabled={busy}><div className="fields"><label>Day<select disabled={session.locked} value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}>{weekDates.slice(0,5).map((d,i)=><option value={d} key={d}>{days[i]} {d.slice(8)} Oct</option>)}</select></label><label>Start<input disabled={session.locked} type="time" min="09:00" max="18:00" step="300" value={clock(draft.start)} onChange={e=>{if(e.target.value)setDraft({...draft,start:fromClock(e.target.value)});}}/></label><label>Room<select disabled={session.locked} value={draft.roomId} onChange={e=>setDraft({...draft,roomId:e.target.value})}>{state.plan.rooms.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
    <div className="fields booking-fields"><label>Bookings<input type="number" min="0" max={draft.capacity} required value={draft.bookings} onChange={e=>setDraft({...draft,bookings:Number(e.target.value)})}/></label><label>Capacity<input type="number" min="1" max="500" required value={draft.capacity} onChange={e=>setDraft({...draft,capacity:Number(e.target.value)})}/></label><Occupancy session={draft}/></div>
    <div className="segments">{parts(draft).map((p,i)=><div className="segment" key={p.id}><span>{clock(p.start)}</span><div className="segment-label">{p.title}<small>{p.speakerIds.map(id=>state.plan.speakers.find(s=>s.id===id)?.name).join(', ')||'No speaker'}</small><details className="assign-speakers"><summary>Assign speakers</summary>{state.plan.speakers.map(s=><label key={s.id}><input type="checkbox" disabled={session.locked} checked={p.speakerIds.includes(s.id)} onChange={e=>setDraft({...draft,segments:draft.segments.map((seg,j)=>i===j?{...seg,speakerIds:e.target.checked?[...seg.speakerIds,s.id]:seg.speakerIds.filter(id=>id!==s.id)}:seg)})}/>{s.name}</label>)}</details></div><input disabled={session.locked} aria-label={`${p.title} duration`} type="number" min="5" max="240" step="5" value={p.duration} onChange={e=>setDraft({...draft,segments:draft.segments.map((p,j)=>i===j?{...p,duration:Number(e.target.value)}:p)})}/><span>min</span></div>)}</div>
    <div className="save-row"><small>{session.locked?'Lunch time is fixed.':`Linked segments · ends ${clock(end(draft))}`}</small><button type="submit" className="primary">Save changes</button></div></fieldset>
  </form>;
}

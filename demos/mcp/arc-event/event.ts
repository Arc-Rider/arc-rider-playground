import { z } from 'zod';

export const weekDates = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'] as const;
export const minute = z.number().int().multipleOf(5).min(540).max(1080);
export const segmentSchema = z.object({ id: z.string().min(1), title: z.string().min(1).max(100), duration: z.number().int().multipleOf(5).min(5).max(240), speakerIds: z.array(z.string()).max(8) });
export const changeSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  sessions: z.array(z.object({ id: z.string(), date: z.string().refine(d => weekDates.some(v => v === d), 'Date must be within 12–18 October 2026').optional(), capacity: z.number().int().min(1).max(500).optional(), bookings: z.number().int().min(0).max(500).optional(), start: minute.optional(), roomId: z.string().optional(), segments: z.array(segmentSchema).min(1).max(12).optional() })).max(20).default([]),
  speakers: z.array(z.object({ id: z.string(), availableFrom: minute })).max(8).default([]),
});
export type Change = z.infer<typeof changeSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Booking = { id: string; name: string; company: string; status: 'Confirmed'; seats: number };
export type Session = { id: string; title: string; topic?: string; roomId: string; start: number; date?: string; capacity?: number; bookings?: number; bookingItems?: Booking[]; locked?: boolean; segments: Segment[] };
export type EventPlan = { revision: number; title: string; date: string; timezone: string; attendees: number; rooms: { id: string; name: string }[]; speakers: { id: string; name: string; role: string; availableFrom: number }[]; sessions: Session[] };
export const clock = (m: number) => `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
export const end = (s: Session) => s.start + s.segments.reduce((n, p) => n + p.duration, 0);
export function parts(s: Session) { let start = s.start; return s.segments.map(p => { const item = { ...p, sessionId: s.id, roomId: s.roomId, date: s.date, start, end: start + p.duration }; start = item.end; return item; }); }
export function seed(): EventPlan {
  const talk = (id:string,title:string,topic:string,day:number,start:number,speaker:string,mainDuration=120):Session => ({id,title,topic,date:weekDates[day],roomId:start<720?'stage':'studio',start,segments:[
    {id:'intro',title:'Intro',duration:30,speakerIds:[]},
    {id:'main',title,duration:mainDuration,speakerIds:[speaker]},
    {id:'demo',title:'Live demo',duration:30,speakerIds:[]},
  ]});
  const orga = (id:string,title:string,start:number):Session => ({id,title,topic:'Organization',date:weekDates[2],roomId:'foyer',start,segments:[{id:'orga',title,duration:60,speakerIds:[]}]});
  return {revision:0,title:'Arc Tech Summit 2026',date:weekDates[0],timezone:'Europe/Berlin',attendees:240,
    rooms:[{id:'stage',name:'Main stage'},{id:'studio',name:'Build studio'},{id:'foyer',name:'Summit office'}],
    speakers:[{id:'maya',name:'Maya Chen',role:'AI & product strategy',availableFrom:540},{id:'leo',name:'Leo Weber',role:'Platform engineering',availableFrom:540},{id:'nora',name:'Nora Ali',role:'Design & developer experience',availableFrom:540}],
    sessions:[
      talk('keynote','Designing useful AI agents','AI & Agents',0,540,'maya'),
      talk('automation','From prototype to production','Platform Engineering',0,780,'leo',90),
      talk('design','Interfaces for intelligent products','Product Design',1,570,'nora',90),
      talk('data','A trusted foundation for AI','Data & Trust',1,780,'maya',150),
      orga('crew','Crew check-in & run of show',540),
      orga('tech','Stage and streaming rehearsal',660),
      orga('partners','Partner & logistics briefing',840),
      talk('integrations','Connected apps with MCP','MCP & Integrations',3,600,'leo',150),
      talk('research','Designing for human control','Product Design',3,870,'nora',60),
      talk('security','Trustworthy AI in practice','Data & Trust',4,540,'maya',60),
      talk('closing','The next developer platform','Platform Engineering',4,720,'leo',150),
    ]};
}
export type Conflict = { id: string; kind: 'room' | 'speaker' | 'availability'; message: string; sessionIds: string[] };
export function conflicts(plan: EventPlan): Conflict[] {
  const found: Conflict[] = []; const all = plan.sessions.flatMap(parts);
  for (let i = 0; i < plan.sessions.length; i++) for (const b of plan.sessions.slice(i + 1)) {
    const a = plan.sessions[i];
    if (a.date === b.date && a.roomId === b.roomId && a.start < end(b) && b.start < end(a)) found.push({ id: `room-${a.id}-${b.id}`, kind: 'room', message: `${plan.rooms.find(r => r.id === a.roomId)!.name}: ${a.title} overlaps ${b.title}.`, sessionIds: [a.id, b.id] });
  }
  for (const speaker of plan.speakers) {
    const slots = all.filter(p => p.speakerIds.includes(speaker.id));
    for (const a of slots) if (a.start < speaker.availableFrom) found.push({ id: `availability-${speaker.id}-${a.sessionId}-${a.id}`, kind: 'availability', message: `${speaker.name}: ${a.title} starts at ${clock(a.start)}, available from ${clock(speaker.availableFrom)}.`, sessionIds: [a.sessionId] });
    for (let i = 0; i < slots.length; i++) for (const b of slots.slice(i + 1)) {
      const a = slots[i]; if (a.date === b.date && a.start < b.end && b.start < a.end) found.push({ id: `speaker-${speaker.id}-${a.sessionId}-${a.id}-${b.sessionId}-${b.id}`, kind: 'speaker', message: `${speaker.name}: ${a.title} overlaps ${b.title}.`, sessionIds: [a.sessionId, b.sessionId] });
    }
  }
  return found;
}
const givenNames = ['Alex', 'Sam', 'Robin', 'Taylor', 'Jamie', 'Morgan', 'Casey', 'Riley', 'Jordan', 'Avery'];
const familyNames = ['Bennett', 'Fischer', 'Reed', 'Park', 'Costa', 'Blake', 'Nguyen', 'Brooks'];
const companies = ['Northstar', 'Studio Pine', 'Fieldwork', 'Atlas Labs'];
export function hydrate(plan: EventPlan): EventPlan {
  return { ...plan, sessions: plan.sessions.map((s, i) => {
    const capacity = s.capacity ?? (s.roomId === 'studio' ? 30 : 80);
    const bookings = s.bookings ?? Math.min(capacity, [68, 74, 26, 52, 30, 80, 22, 61][i % 8]);
    // Fictional demo records: one confirmed seat per booking, stable across reloads.
    const bookingItems: Booking[] = Array.from({ length: bookings }, (_, n) => s.bookingItems?.[n] ?? ({
      id: `${s.id}-${String(n + 1).padStart(3, '0')}`,
      name: `${givenNames[n % givenNames.length]} ${familyNames[Math.floor(n / givenNames.length) % familyNames.length]}`,
      company: companies[n % companies.length], status: 'Confirmed', seats: 1,
    }));
    return { ...s, date: s.date ?? plan.date, capacity, bookings, bookingItems };
  }) };
}
export function snapshot(plan: EventPlan) { plan = hydrate(plan); return { plan, conflicts: conflicts(plan) }; }
export type Snapshot = ReturnType<typeof snapshot>;
export function applyChange(plan: EventPlan, input: unknown): EventPlan {
  const changes = changeSchema.parse(input);
  if (changes.expectedRevision !== plan.revision) throw new Error('This plan changed. Refresh before saving.');
  const next = hydrate(structuredClone(plan));
  for (const patch of changes.sessions) {
    const s = next.sessions.find(s => s.id === patch.id); if (!s) throw new Error('Unknown session.');
    if (s.locked && (patch.start !== undefined || patch.date !== undefined || patch.roomId !== undefined || patch.segments !== undefined)) throw new Error('Lunch is fixed at 12:30. This session cannot be changed.');
    Object.assign(s, patch);
    if (!next.rooms.some(r => r.id === s.roomId)) throw new Error('Unknown room.');
    if (s.bookings! > s.capacity!) throw new Error('Bookings cannot exceed session capacity.');
    if (end(s) > 1080) throw new Error('Sessions must finish by 18:00.');
    if (new Set(s.segments.map(p => p.id)).size !== s.segments.length) throw new Error('Segment IDs must be unique within a session.');
    for (const p of s.segments) if (new Set(p.speakerIds).size !== p.speakerIds.length || p.speakerIds.some(id => !next.speakers.some(s => s.id === id))) throw new Error('Invalid speaker selection.');
  }
  for (const patch of changes.speakers) {
    const speaker = next.speakers.find(s => s.id === patch.id); if (!speaker) throw new Error('Unknown speaker.');
    speaker.availableFrom = patch.availableFrom;
  }
  next.revision++; return hydrate(next);
}

// Native callbacks fire once per changed segment. Persist one atomic batch per drop.
export type NativeSegmentMove = { sessionId: string; segmentIndex: number; date: number; dateTo: number; from: number; to: number };
export function nativeMoveChanges(sessions: Session[], moves: NativeSegmentMove[]): Change['sessions'] {
  return [...new Set(moves.map(m=>m.sessionId))].map(id=>{
    const session = sessions.find(s=>s.id===id);
    if (!session) throw new Error('Unknown dragged session.');
    const spans = parts(session).map(p=>({date:Date.parse(p.date!+'T00:00:00Z'),dateTo:Date.parse(p.date!+'T00:00:00Z'),from:p.start*60000,to:p.end*60000}));
    for(const move of moves.filter(m=>m.sessionId===id)) {
      if(!spans[move.segmentIndex] || ![move.date,move.dateTo,move.from,move.to].every(Number.isFinite)) throw new Error('Incomplete native drag destination.');
      spans[move.segmentIndex]=move;
    }
    if(spans.some((p,i)=>p.date!==spans[0].date || p.dateTo!==p.date || (i>0 && p.from!==spans[i-1].to))) throw new Error('Segments must stay consecutive on the same day.');
    return {id,date:new Date(spans[0].date).toISOString().slice(0,10),start:spans[0].from/60000,segments:session.segments.map((p,i)=>({...p,duration:(spans[i].to-spans[i].from)/60000}))};
  });
}

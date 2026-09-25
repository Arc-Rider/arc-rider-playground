import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { seed as summitSeed, conflicts, parts, applyChange, hydrate, nativeMoveChanges } from '../dist/event.js';
import legacyPlan from './legacy-event-fixture.json' with { type: 'json' };
const seed = () => structuredClone(legacyPlan);
import { EventStore } from '../dist/server.js';

test('seed exposes room, speaker and arrival conflicts', () => {
  assert.deepEqual(new Set(conflicts(seed()).map(c => c.kind)), new Set(['room', 'speaker', 'availability']));
});
test('linked segments shift together, speaker conflicts use segment times', () => {
  const plan = seed(); const before = parts(plan.sessions.find(s => s.id === 'keynote'));
  const next = applyChange(plan, { expectedRevision: 0, sessions: [{ id: 'keynote', start: 660 }] });
  const after = parts(next.sessions.find(s => s.id === 'keynote'));
  assert.deepEqual(after.map((p, i) => p.start - before[i].start), [90, 90, 90]);
  assert.ok(conflicts(next).some(c => c.kind === 'speaker' && c.sessionIds.includes('roundtable')));
  assert.equal(plan.revision, 0);
});
test('atomic repair clears all conflicts and preserves lunch', () => {
  const plan = applyChange(seed(), { expectedRevision: 0, speakers: [{ id: 'maya', availableFrom: 660 }], sessions: [{ id: 'keynote', start: 660 }, { id: 'roundtable', start: 900 }, { id: 'stories', start: 600 }] });
  assert.deepEqual(conflicts(plan), []);
  assert.equal(plan.sessions.find(s => s.id === 'lunch').start, 750);
});
test('rejects stale revisions, invalid ranges, unknown resources and locked changes', () => {
  for (const change of [ { expectedRevision: 2 }, { expectedRevision: 0, sessions: [{ id: 'lunch', start: 780 }] }, { expectedRevision: 0, sessions: [{ id: 'keynote', start: 1070 }] }, { expectedRevision: 0, sessions: [{ id: 'keynote', roomId: 'missing' }] }, { expectedRevision: 0, sessions: [{ id: 'missing', start: 600 }] } ]) assert.throws(() => applyChange(seed(), change));
});
test('preview does not persist; concurrent writes cannot overwrite; restart restores saved state', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'arc-event-test-'));
  try {
    const file = path.join(dir, 'event.json'); const store = await new EventStore(file).load();
    await store.change({ expectedRevision: 0, sessions: [{ id: 'keynote', start: 660 }] }, true);
    assert.equal(store.read().plan.revision, 0);
    const results = await Promise.allSettled([store.change({ expectedRevision: 0, sessions: [{ id: 'keynote', start: 660 }] }), store.change({ expectedRevision: 0, sessions: [{ id: 'keynote', start: 690 }] })]);
    assert.deepEqual(results.map(r => r.status), ['fulfilled', 'rejected']);
    assert.equal((await new EventStore(file).load()).read().plan.sessions.find(s => s.id === 'keynote').start, 660);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('moving to another day removes only same-day overlaps and preserves segments', () => {
  const p = applyChange(seed(), {expectedRevision:0,sessions:[{id:'keynote',date:'2026-10-14',start:660}]});
  assert.equal(p.sessions.find(s=>s.id==='keynote').date,'2026-10-14');
  assert.ok(!conflicts(p).some(c=>c.sessionIds.includes('keynote')));
  assert.deepEqual(p.sessions.find(s=>s.id==='keynote').segments,seed().sessions.find(s=>s.id==='keynote').segments);
  assert.throws(()=>applyChange(p,{expectedRevision:1,sessions:[{id:'keynote',date:'2026-10-19'}]}));
});
test('bookings and capacity are saved together; overbooking and fractional counts fail', () => {
  const p = applyChange(seed(),{expectedRevision:0,sessions:[{id:'automation',bookings:30,capacity:30}]});
  assert.equal(p.sessions.find(s=>s.id==='automation').bookings,30);
  for(const patch of [{bookings:31},{capacity:29},{bookings:-1},{bookings:2.5}]) assert.throws(()=>applyChange(p,{expectedRevision:1,sessions:[{id:'automation',...patch}]}));
  const q = applyChange(p,{expectedRevision:1,sessions:[{id:'lunch',bookings:79}]});
  assert.equal(q.sessions.find(s=>s.id==='lunch').bookings,79);
  assert.equal(q.sessions.find(s=>s.id==='lunch').start,750);
});

test('individual demo bookings track totals and retain existing identities', () => {
  const p = applyChange(seed(), {expectedRevision:0,sessions:[{id:'automation',bookings:28}]});
  const before = p.sessions.find(s=>s.id==='automation').bookingItems;
  assert.equal(before.length,28);
  assert.equal(new Set(before.map(b=>b.id)).size,28);
  const q = applyChange(p,{expectedRevision:1,sessions:[{id:'automation',bookings:25}]});
  assert.deepEqual(q.sessions.find(s=>s.id==='automation').bookingItems,before.slice(0,25));
});

 test('native segment callbacks persist a single linked move and reject broken chains', () => {
   const plan=hydrate(seed()); const session=plan.sessions.find(s=>s.id==='keynote');
   const date=Date.parse('2026-10-14T00:00:00Z');
   const moves=parts(session).map((p,i)=>({sessionId:session.id,segmentIndex:i,date,dateTo:date,from:(p.start+30)*60000,to:(p.end+30)*60000}));
   const patches=nativeMoveChanges(plan.sessions,moves);
   assert.equal(patches.length,1);
   const saved=applyChange(plan,{expectedRevision:0,sessions:patches}).sessions.find(s=>s.id===session.id);
   assert.equal(saved.date,'2026-10-14');assert.equal(saved.start,600);assert.deepEqual(saved.segments,session.segments);
   assert.throws(()=>nativeMoveChanges(plan.sessions,moves.slice(1)),/consecutive/);
   const resized=moves.map(m=>({...m}));resized[0].to+=300000;resized[1].from+=300000;
   assert.deepEqual(nativeMoveChanges(plan.sessions,resized)[0].segments.map(s=>s.duration),[15,30,15]);
 });

test('summit fills five days with long half-hour-aligned segments and no conflicts', () => {
 const plan=hydrate(summitSeed());
 assert.equal(new Set(plan.sessions.map(s=>s.date)).size,5);
 assert.ok(plan.sessions.every(s=>s.start%30===0 && s.segments.every(p=>p.duration>=30 && p.duration%30===0)));
 assert.deepEqual(conflicts(plan),[]);
 assert.ok(new Set(plan.sessions.flatMap(s=>s.segments.filter(p=>p.id==='main').map(p=>p.duration))).size>=3);
});

test('summit talks have intro/main/demo, main-only speakers and hour-long breaks',()=>{
 const plan=hydrate(summitSeed());
 for(const day of ['2026-10-12','2026-10-13','2026-10-15','2026-10-16']) {
  const talks=plan.sessions.filter(s=>s.date===day).sort((a,b)=>a.start-b.start);
  assert.equal(talks[1].start-parts(talks[0]).at(-1).end,60);
  for(const s of talks){assert.deepEqual(s.segments.map(p=>p.id),['intro','main','demo']);assert.deepEqual(s.segments.map(p=>p.speakerIds.length),[0,1,0]);}
 }
 assert.ok(plan.sessions.filter(s=>s.date==='2026-10-14').every(s=>s.topic==='Organization'));
});

 test('every fresh summit session can be moved without invalid generated bookings', () => {
  const plan = hydrate(summitSeed());
  for (const session of plan.sessions) {
    assert.ok(session.bookings <= session.capacity);
    const saved = applyChange(plan, {expectedRevision: 0, sessions: [{id: session.id, start: session.start + 5}]});
    assert.equal(saved.sessions.find(s => s.id === session.id).start, session.start + 5);
  }
 });

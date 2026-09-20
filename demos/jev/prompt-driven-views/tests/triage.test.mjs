import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {routeTriage,validateTriageAnswers} from '../src/triage-model.mjs';
import {createTriageApi} from '../server/triage-api.mjs';

const answers=(team='technical',confidence=.9,urgency=.9,clarification=.1)=>({
  department:{type:'choice',choice:team,confidence,probabilities:Object.fromEntries(['technical','billing','sales','other'].map(key=>[key,key===team?.97:.01]))},
  urgency:{type:'noul',noul:urgency},needs_clarification:{type:'noul',noul:clarification},
});

test('Jev judgments are routed by explicit application policy',()=>{
  assert.equal(routeTriage(answers()).lane,'urgent');
  assert.equal(routeTriage(answers('billing',.9,.1,.1)).lane,'planned');
  assert.equal(routeTriage(answers('billing',.9,.9,.8)).lane,'review');
  assert.equal(routeTriage(answers('other',.9,.1,.1)).lane,'review');
  assert.equal(routeTriage(answers('technical',.9,.5,.1)).lane,'review');
  assert.throws(()=>validateTriageAnswers({...answers(),urgency:{type:'noul',noul:2}}));
});

test('Live Smart Kanban endpoint sends the user text to Jev and keeps credentials server-side',async t=>{
  const providerRequests=[];
  const api=createTriageApi({apiKey:'test-secret',fetchImpl:async(_url,options)=>{
    providerRequests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({model:'jev-test',answers:answers(),usage:{input_tokens:10,output_tokens:4}}));
  }});
  const server=createServer((req,res)=>api(req,res,()=>{res.writeHead(404);res.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const status=await(await fetch(`${base}/api/triage/status`)).json();
  assert.equal(status.configured,true);
  assert.equal(JSON.stringify(status).includes('test-secret'),false);
  const response=await fetch(`${base}/api/triage/evaluate`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Our export is blocked and a report is due today.'})});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.route.lane,'urgent');
  assert.equal(providerRequests[0].state.message,'Our export is blocked and a report is due today.');
  assert.equal(JSON.stringify(result).includes('test-secret'),false);
  assert.equal((await fetch(`${base}/api/triage/status`,{headers:{Origin:'https://foreign.example'}})).status,403);
});

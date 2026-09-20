import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {allLiveFields,essentialLiveFields,initialLiveView,isLiveHighlighted,sanitizeLiveView,visibleLiveIssues} from '../src/minimal-live-model.mjs';
import {applyMinimalLiveAnswers,createMinimalLiveApi,minimalLiveQuestions} from '../server/minimal-live-api.mjs';

const answers=()=>Object.fromEntries(Object.keys(minimalLiveQuestions).map(key=>[key,{type:'choice',choice:key==='action'?'apply':'keep',confidence:.9}]));

test('Live view applies typed Jev choices while preserving unrelated settings',()=>{
  const history=answers();history.view.choice='table';history.columns_mode.choice='all';history.sort.choice='recent';
  const first=applyMinimalLiveAnswers(initialLiveView,history);
  assert.equal(first.status,'applied');assert.equal(first.config.view,'table');assert.deepEqual(first.config.columns,allLiveFields);
  const essentials=answers();essentials.columns_mode.choice='essentials';
  const second=applyMinimalLiveAnswers(first.config,essentials);
  assert.deepEqual(second.config.columns,essentialLiveFields);
  const highlights=answers();highlights.highlight.choice='high';highlights.filter.choice='keep';
  const third=applyMinimalLiveAnswers(second.config,highlights);
  assert.equal(third.config.highlight,'high');assert.deepEqual(third.config.columns,essentialLiveFields);
  assert.equal(visibleLiveIssues(third.config).length,8);
  assert.deepEqual(visibleLiveIssues(third.config).filter(issue=>isLiveHighlighted(issue,'high')).map(issue=>issue.number),[218,213,205]);
});

test('Custom columns, unsupported requests and malformed configurations are bounded',()=>{
  const custom=answers();custom.columns_mode.choice='custom';custom.column_owner.choice='hide';
  const result=applyMinimalLiveAnswers({...initialLiveView,view:'table'},custom);
  assert.equal(result.config.columns.includes('owner'),false);
  const unsupported=answers();unsupported.action.choice='unsupported';unsupported.highlight.choice='high';
  assert.equal(applyMinimalLiveAnswers(initialLiveView,unsupported).status,'unsupported');
  assert.deepEqual(applyMinimalLiveAnswers(initialLiveView,unsupported).config,initialLiveView);
  assert.throws(()=>sanitizeLiveView({...initialLiveView,columns:['title','title']}));
  assert.throws(()=>sanitizeLiveView({...initialLiveView,filter:'__proto__'}));
});

test('A confident board grouping can select the board when the separate view choice is uncertain',()=>{
  const grouped=answers();grouped.view.choice='board';grouped.view.confidence=.25;grouped.group.choice='widget';grouped.group.confidence=.7;
  const result=applyMinimalLiveAnswers({...initialLiveView,view:'table'},grouped);
  assert.equal(result.status,'applied');assert.equal(result.config.view,'board');assert.equal(result.config.group,'widget');
});

test('Live endpoint sends only request, schema and current view to TypeSafe',async t=>{
  const providerRequests=[];
  const api=createMinimalLiveApi({apiKey:'test-secret',fetchImpl:async(_url,options)=>{
    providerRequests.push(JSON.parse(options.body));
    const result=answers();result.view.choice='table';
    return new Response(JSON.stringify({model:'jev-test',answers:result,usage:{input_tokens:11,output_tokens:3}}));
  }});
  const server=createServer((request,response)=>api(request,response,()=>{response.writeHead(404);response.end();}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const status=await(await fetch(`${base}/api/minimal-live/status`)).json();
  assert.equal(status.configured,true);assert.equal(JSON.stringify(status).includes('test-secret'),false);
  const response=await fetch(`${base}/api/minimal-live/view`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Show me the history',currentView:initialLiveView})});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.config.view,'table');
  assert.equal(result.model,'jev-test');
  assert.equal(providerRequests.length,1);
  assert.equal(providerRequests[0].state.request,'Show me the history');
  assert.equal(JSON.stringify(providerRequests[0]).includes('Calendar Grid weekday labels overlap'),false);
  assert.equal(JSON.stringify(result).includes('test-secret'),false);
  const crossOrigin=await fetch(`${base}/api/minimal-live/status`,{headers:{Origin:'https://foreign.example'}});
  assert.equal(crossOrigin.status,403);
});

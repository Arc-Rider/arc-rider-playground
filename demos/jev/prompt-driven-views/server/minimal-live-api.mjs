import {allLiveFields,essentialLiveFields,initialLiveView,liveChanges,liveFieldLabels,liveFilterLabels,liveGroupLabels,liveHighlightLabels,liveSortLabels,sanitizeLiveView} from '../src/minimal-live-model.mjs';

function validateProviderAnswers(answers,questions){
  if(!answers||typeof answers!=='object')throw new Error('Invalid Jev response.');
  for(const [key,question] of Object.entries(questions)){
    const answer=answers[key];
    if(answer?.type!=='choice'||!Object.hasOwn(question.criteria,answer.choice)||typeof answer.confidence!=='number'||!Number.isFinite(answer.confidence)||answer.confidence<0||answer.confidence>1)throw new Error('Invalid Jev choice.');
  }
  return answers;
}

const choice=(instructions,criteria)=>({type:'choice',instructions,criteria});

export const minimalLiveQuestions={
  action:choice('Read `request` as an instruction to change the issue workspace. The short requests "Show me the history" (table with recent updates), "Show me only the essentials" (essential columns), and "Show me the highlights" (emphasize High priority) are concrete supported changes. A reversible view change or purpose-based column selection is supported. Clarify only when there is no identifiable view edit. Do not pretend to create UI code, new issue data, or edit GitHub.',{apply:'A supported change to presentation, columns, ordering, highlights, filtering or board grouping',clarify:'No concrete supported change can be identified',unsupported:'The request needs new data, writes to issues, a new widget, or a capability absent from this workspace'}),
  view:choice('Which presentation does `request` ask for? "History" or an overview of issues is a table; a board or lanes is a board. If the request only edits columns, highlights, filters, sort or grouping, keep `currentView.view` unless the edit requires a table.',{keep:'Keep the current board or table',board:'Show the Kanban board',table:'Show the issue table'}),
  columns_mode:choice('Does `request` change the visible table columns? "Show me the history" means the full table including Updated. "Essentials", "compact" or "only the essentials" means the defined essential columns. An explicit field list or add/hide request is a custom column edit. Highlighting, sorting, filtering and switching view alone do not change columns.',{keep:'Keep current columns',all:'Show all eight available fields',essentials:'Use Issue, Title, Type, Status and Priority',custom:'Apply field-by-field additions, removals or an explicit list'}),
  sort:choice('What row order does `request` ask for? "History", "latest" and "newest" mean recently updated first. If the request does not change ordering, keep the current order.',{keep:'Keep current order',recent:'Most recently updated first',oldest:'Oldest updated first',priority:'Highest priority first',number:'Highest issue number first'}),
  highlight:choice('What rows should be visually emphasized? "Show me the highlights" means High-priority issues in this workspace. Highlighting retains all rows and columns; it is not filtering. If `request` does not ask for highlighting or clearing it, keep the current rule.',{keep:'Keep current highlight rule',none:'Clear row highlighting',high:'Highlight High-priority issues',medium:'Highlight Medium-priority issues',low:'Highlight Low-priority issues',open_bugs:'Highlight open bugs',unassigned:'Highlight unassigned issues'}),
  filter:choice('Does `request` ask to show only a subset of issues? "Only", "filter" or "hide other rows" can narrow rows. "Highlight" or "show the highlights" changes appearance without filtering. Preserve the current filter if no row subset is requested.',{keep:'Keep current issue filter',all:'Show all issues',open:'Show only open issues',bugs:'Show only bugs',high:'Show only High-priority issues'}),
  group:choice('When using a board, which field should define its lanes? If grouping is not mentioned, preserve `currentView.group`. This answer is used only for the board.',{keep:'Keep current board grouping',status:'Group board by Status',type:'Group board by Type',widget:'Group board by Widget',priority:'Group board by Priority'}),
  ...Object.fromEntries(Object.entries(liveFieldLabels).map(([field,label])=>[`column_${field}`,choice(
    `For a custom column edit, what does the request say about ${label} (${field})? For a targeted edit, keep unrelated fields. For a complete "only these columns" list, show listed fields and hide unlisted fields. This answer is ignored unless columns_mode is custom.`,
    {keep:'Preserve this field',show:'Include this field',hide:'Remove this field'}
  )])),
};

const publicCapabilities={views:['board','table'],fields:liveFieldLabels,essentialColumns:essentialLiveFields,sort:liveSortLabels,highlight:liveHighlightLabels,filter:liveFilterLabels,boardGroups:liveGroupLabels,phrases:{history:'Show the full issue table, sorted by most recent update',essentials:'Show the essential table columns',highlights:'Keep every row and emphasize High-priority rows'},limits:'Existing sample issue fields only. Jev selects typed options; code applies them to the published arcWidgets. No issue writes, new data, freeform layouts, code generation or audio input.'};

export function applyMinimalLiveAnswers(previous,answers){
  const current=sanitizeLiveView(previous);
  const actionable=['view','columns_mode','sort','highlight','filter','group'].some(key=>answers[key].choice!=='keep'&&answers[key].confidence>=.35);
  if(answers.action.choice==='unsupported'&&answers.action.confidence>=.45)return {status:'unsupported',message:'This view can change its board, table, columns, sort, highlights, filters and grouping. It cannot change issue data or generate a new widget.',config:current,changes:[]};
  if(!actionable&&(answers.action.choice!=='apply'||answers.action.confidence<.4))return {status:'clarify',message:'Please describe a view, column, sorting, filter or highlight change.',config:current,changes:[]};
  const next={...current,columns:[...current.columns]};
  const tableForced=['all','essentials','custom'].includes(answers.columns_mode.choice)&&answers.columns_mode.confidence>=.35||answers.highlight.choice!=='keep'&&answers.highlight.confidence>=.35;
  const boardForced=!tableForced&&answers.group.choice!=='keep'&&answers.group.choice!==current.group&&answers.group.confidence>=.35&&!(answers.view.choice==='table'&&answers.view.confidence>=.35);
  const relevant=['columns_mode','sort','highlight','filter'];
  if(!tableForced&&!boardForced)relevant.push('view');
  if(boardForced||(answers.view.choice==='keep'?current.view:answers.view.choice)==='board')relevant.push('group');
  if(relevant.some(key=>answers[key].choice!=='keep'&&answers[key].confidence<.35))return {status:'clarify',message:'Jev was uncertain about part of that change. Please make the request more specific.',config:current,changes:[]};
  if(answers.view.choice!=='keep')next.view=answers.view.choice;
  if(boardForced)next.view='board';
  if(answers.columns_mode.choice==='all'){next.columns=[...allLiveFields];next.view='table';}
  if(answers.columns_mode.choice==='essentials'){next.columns=[...essentialLiveFields];next.view='table';}
  if(answers.columns_mode.choice==='custom'){
    const edits=allLiveFields.filter(field=>answers[`column_${field}`].choice!=='keep');
    if(edits.some(field=>answers[`column_${field}`].confidence<.35))return {status:'clarify',message:'The requested column list is uncertain. Please name the fields to add or remove.',config:current,changes:[]};
    next.columns=allLiveFields.filter(field=>answers[`column_${field}`].choice==='show'||(current.columns.includes(field)&&answers[`column_${field}`].choice!=='hide'));
    if(!next.columns.length)return {status:'clarify',message:'A table needs at least one visible field.',config:current,changes:[]};
    next.view='table';
  }
  for(const key of ['sort','highlight','filter'])if(answers[key].choice!=='keep')next[key]=answers[key].choice;
  if(answers.highlight.choice!=='keep')next.view='table';
  if(answers.group.choice!=='keep'&&next.view==='board')next.group=answers.group.choice;
  const config=sanitizeLiveView(next);
  const changes=liveChanges(current,config);
  return {status:changes.length?'applied':'no_change',message:changes.length?'Jev selected a supported view change.':'The request left this view unchanged.',config,changes};
}

export function createMinimalLiveApi({apiKey='',model='jev-latest',fetchImpl=fetch}={}){
  let active=0;
  return async(req,res,next)=>{
    const path=req.url?.split('?')[0];
    if(path!=='/api/minimal-live/status'&&path!=='/api/minimal-live/view')return next();
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
    const host=req.headers.host;
    if(req.headers.origin&&req.headers.origin!==`http://${host}`&&req.headers.origin!==`https://${host}`)return send(403,{error:'Only this local workspace may use the live view.'});
    if(path==='/api/minimal-live/status'){
      if(req.method!=='GET')return send(405,{error:'GET required.'});
      return send(200,{configured:Boolean(apiKey),model,capabilities:publicCapabilities,questions:minimalLiveQuestions});
    }
    if(req.method!=='POST')return send(405,{error:'POST required.'});
    if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required.'});
    if(!apiKey)return send(503,{error:'Add TYPESAFE_API_KEY to .env.local to enable live Jev decisions.'});
    if(active>=2)return send(429,{error:'Another view decision is in progress.'});
    active++;
    try{
      let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8000)return send(413,{error:'Request too large.'});}
      let input;try{input=JSON.parse(raw);}catch{return send(400,{error:'Invalid JSON.'});}
      if(typeof input?.text!=='string'||!input.text.trim()||input.text.length>500)return send(400,{error:'Enter a request between 1 and 500 characters.'});
      let current;try{current=sanitizeLiveView(input.currentView);}catch{return send(400,{error:'Invalid view configuration.'});}
      const state={request:input.text.trim(),currentView:current,capabilities:publicCapabilities};
      const started=performance.now();
      const response=await fetchImpl('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,state,questions:minimalLiveQuestions}),signal:AbortSignal.timeout(25000)});
      if(!response.ok)throw new Error(response.status===401||response.status===403?'Jev rejected access. Check the local API key.':response.status===429?'Jev rate limit reached. Please try again shortly.':'Jev is unavailable. Please try again.');
      const payload=await response.json();
      const answers=validateProviderAnswers(payload.answers,minimalLiveQuestions);
      return send(200,{...applyMinimalLiveAnswers(current,answers),state,answers,model:typeof payload.model==='string'?payload.model:model,elapsedMs:Math.round(performance.now()-started),usage:payload.usage,evaluatedAt:new Date().toISOString()});
    }catch(error){return send(502,{error:error.name==='TimeoutError'?'Jev did not respond in time. The view is unchanged.':error.message.startsWith('Jev ')?error.message:'The view decision could not be evaluated. The view is unchanged.'});}
    finally{active--;}
  };
}

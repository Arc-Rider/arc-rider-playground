// Fictional issue data for the live view demo; no GitHub data is imported.
export const demoIssues = [
  {number:218,title:'Calendar Grid weekday labels overlap when the sidebar narrows beyond the configured column width',type:'Bug',widget:'Calendar Grid',status:'Open',priority:'High',owner:'Unassigned',updated:'Sep 20',updatedAt:'2026-09-20'},
  {number:216,title:'Table sort resets after selecting a different status and returning to the current view',type:'Bug',widget:'Table',status:'Open',priority:'Medium',owner:'Unassigned',updated:'Sep 19',updatedAt:'2026-09-19'},
  {number:213,title:'Timeline range selection jumps by one day after changing the workspace time zone',type:'Bug',widget:'Timeline',status:'Open',priority:'High',owner:'Unassigned',updated:'Sep 18',updatedAt:'2026-09-18'},
  {number:210,title:'Upload progress indicator remains active after reconnecting an interrupted transfer',type:'Bug',widget:'Upload',status:'Open',priority:'Low',owner:'Unassigned',updated:'Sep 17',updatedAt:'2026-09-17'},
  {number:207,title:'Badge color tokens for semantic states',type:'Enhancement',widget:'Badge',status:'In progress',priority:'Medium',owner:'Maya',updated:'Sep 16',updatedAt:'2026-09-16'},
  {number:205,title:'Kanban lane headings should stay visible while the board scrolls',type:'Enhancement',widget:'Kanban',status:'In progress',priority:'High',owner:'Kai',updated:'Sep 15',updatedAt:'2026-09-15'},
  {number:202,title:'Select keyboard navigation skips grouped options',type:'Bug',widget:'Select',status:'In progress',priority:'Low',owner:'Kai',updated:'Sep 14',updatedAt:'2026-09-14'},
  {number:198,title:'Button focus ring alignment in compact layouts',type:'Bug',widget:'Button',status:'Done',priority:'Medium',owner:'Maya',updated:'Sep 12',updatedAt:'2026-09-12'},
];

export const liveFieldLabels={number:'Issue',title:'Title',type:'Type',widget:'Widget',status:'Status',priority:'Priority',owner:'Owner',updated:'Updated'};
export const allLiveFields=Object.keys(liveFieldLabels);
export const essentialLiveFields=['number','title','type','status','priority'];
export const liveHighlightLabels={none:'No highlights',high:'High priority',medium:'Medium priority',low:'Low priority',open_bugs:'Open bugs',unassigned:'Unassigned issues'};
export const liveFilterLabels={all:'All issues',open:'Open issues',bugs:'Bugs',high:'High-priority issues'};
export const liveSortLabels={recent:'Recently updated first',oldest:'Oldest updated first',priority:'Highest priority first',number:'Highest issue number first'};
export const liveGroupLabels={status:'Status',type:'Type',widget:'Widget',priority:'Priority'};
export const initialLiveView={view:'board',columns:[...allLiveFields],sort:'recent',highlight:'none',filter:'all',group:'status'};

export function sanitizeLiveView(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid view.');
  for(const [key,values] of Object.entries({view:['board','table'],sort:Object.keys(liveSortLabels),highlight:Object.keys(liveHighlightLabels),filter:Object.keys(liveFilterLabels),group:Object.keys(liveGroupLabels)})){
    if(!values.includes(input[key]))throw new Error(`Invalid ${key}.`);
  }
  if(!Array.isArray(input.columns)||input.columns.length===0||input.columns.length>allLiveFields.length||new Set(input.columns).size!==input.columns.length||input.columns.some(key=>!Object.hasOwn(liveFieldLabels,key)))throw new Error('Invalid columns.');
  return {view:input.view,columns:[...input.columns],sort:input.sort,highlight:input.highlight,filter:input.filter,group:input.group};
}

export function visibleLiveIssues(view){
  const priorityRank={High:0,Medium:1,Low:2};
  return demoIssues.filter(issue=>view.filter==='all'||(view.filter==='open'&&issue.status==='Open')||(view.filter==='bugs'&&issue.type==='Bug')||(view.filter==='high'&&issue.priority==='High')).sort((a,b)=>{
    if(view.sort==='oldest')return a.updatedAt.localeCompare(b.updatedAt);
    if(view.sort==='priority')return priorityRank[a.priority]-priorityRank[b.priority]||b.updatedAt.localeCompare(a.updatedAt);
    if(view.sort==='number')return b.number-a.number;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function isLiveHighlighted(issue,rule){
  return rule===issue.priority.toLowerCase()||(rule==='open_bugs'&&issue.status==='Open'&&issue.type==='Bug')||(rule==='unassigned'&&issue.owner==='Unassigned');
}

export function liveChanges(before,after){
  const changes=[];
  for(const key of ['view','columns','sort','highlight','filter','group']){
    if(JSON.stringify(before[key])!==JSON.stringify(after[key]))changes.push({key,before:before[key],after:after[key]});
  }
  return changes;
}

export const triageTeams={technical:'Technical',billing:'Billing',sales:'Sales',other:'Unclear'};
export const triageLanes=[
  {id:'urgent',title:'Act now',color:'#ca5965',tint:'#fdf1f2'},
  {id:'planned',title:'Schedule',color:'#8a79b3',tint:'#f5f2fa'},
  {id:'review',title:'Review',color:'#bc9563',tint:'#faf6ee'},
];

// Example policy, not a calibrated production threshold. The raw Jev answers remain visible.
export function validateTriageAnswers(answers){
  const valid=n=>Number.isFinite(n)&&n>=0&&n<=1;
  const department=answers?.department;
  const probabilities=department?.probabilities;
  if(department?.type!=='choice'||!Object.hasOwn(triageTeams,department.choice)||!valid(department.confidence)||!probabilities||Object.keys(probabilities).length!==Object.keys(triageTeams).length||!Object.keys(triageTeams).every(key=>valid(probabilities[key]))||Math.abs(Object.values(probabilities).reduce((a,b)=>a+b,0)-1)>.02||probabilities[department.choice]<Math.max(...Object.values(probabilities)))throw new Error('Invalid Jev team decision.');
  for(const key of ['urgency','needs_clarification'])if(answers[key]?.type!=='noul'||!valid(answers[key].noul))throw new Error('Incomplete Jev evaluation.');
  return answers;
}

export function routeTriage(raw){
  const answers=validateTriageAnswers(raw);
  const uncertainUrgency=answers.urgency.noul>.35&&answers.urgency.noul<.75;
  const review=answers.department.choice==='other'||answers.department.confidence<.65||answers.needs_clarification.noul>=.5||uncertainUrgency;
  const lane=review?'review':answers.urgency.noul>=.75?'urgent':'planned';
  const reason=answers.needs_clarification.noul>=.5?'The requested outcome needs clarification.':answers.department.choice==='other'||answers.department.confidence<.65?'The team assignment needs human review.':uncertainUrgency?'Urgency is uncertain; a person should review it.':lane==='urgent'?'The request is clearly assigned and time-sensitive.':'The request is clearly assigned without immediate time pressure.';
  return {lane,team:triageTeams[answers.department.choice],reason};
}

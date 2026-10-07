// Availability comes from the current evidence/answer/dispute coverage check.
// Historical publication receipts and unrelated legacy inventory cannot fill
// a new factory checkpoint after an item is withheld.
export function factoryInventoryCounts(publications,coverage){
 const usableIds=new Set((coverage?.cells||[]).flatMap(c=>(c.ideas||[]).map(q=>q.id)));
 const current=publications.filter(p=>usableIds.has(p.question_id));
 return {usable_factory:current.length,unavailable_factory:publications.length-current.length,
  by_subject_usable:Object.fromEntries([...new Set(publications.map(p=>p.subject))].map(s=>[s,current.filter(p=>p.subject===s).length]))};
}
export function factoryLifetimeEconomics(snapshot,newlyUsable,{ceiling=50,target=10000}={}){
 const committed=snapshot?.budget?.committed_micro,unit=snapshot?.cost_per_published_usd;
 if(!Number.isSafeInteger(committed)||committed<0||!Number.isFinite(unit)||unit<=0||!Number.isSafeInteger(newlyUsable)||newlyUsable<0)return {forecast:null,affordable:null,shortfall:null};
 const forecast=committed/1e6+Math.max(0,target-newlyUsable)*unit;
 return {forecast,affordable:newlyUsable+Math.floor(Math.max(0,ceiling-committed/1e6)/unit),shortfall:Math.max(0,forecast-ceiling)};
}

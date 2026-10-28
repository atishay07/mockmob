// Receipt uncertainty consumes its full budget hold, but does not occupy a
// provider-processing slot once all candidates are terminal. Publication and
// final accounting remain gated separately; a held cohort is never completed.
export function cohortSchedule(reports,{usable,target,maximumInFlight,maximumCohorts,budget}){
 if(!Number.isSafeInteger(maximumInFlight)||maximumInFlight<1||budget.unbounded_unresolved)throw Error('bounded_concurrency_required');
 const active=reports.filter(r=>!r.complete||r.provider_processing_complete===false||r.cost?.held_usd>0&&r.provider_processing_complete!==true);
 const unsettled=reports.filter(r=>r.cost?.held_usd>0);
 const unpublished=reports.filter(r=>r.newly_published!==r.approved_unique);
 // Wait for already accepted candidates when they can still fill the gap.
 // This is an upper bound, not a promised yield: rejection can justify another
 // fixed cohort later. A terminal receipt-only hold contributes no capacity,
 // because it must not block unrelated bounded work indefinitely.
 const pendingCapacity=reports.reduce((n,r)=>{
  const processing=active.includes(r)&&r.provider_processing_complete!==true&&r.pending!==0;
  const publishable=r.publication_accounting?.ready===true||r.cost?.held_usd===0;
  return n+(processing?Math.max(0,r.pending??r.denominator??100):0)+
   (processing||publishable?Math.max(0,(r.approved_unique||0)-(r.newly_published||0)):0);
 },0);
 return {active:active.length,receipt_only:unsettled.filter(r=>r.complete&&r.provider_processing_complete===true).length,
  pending_candidate_capacity:pendingCapacity,
  deliveryComplete:usable>=target&&active.length===0&&unpublished.length===0,
  complete:usable>=target&&active.length===0&&unsettled.length===0&&unpublished.length===0,
  canRegister:usable+pendingCapacity<target&&active.length<maximumInFlight&&reports.length<maximumCohorts&&budget.committed_micro<budget.limit_micro,
  conservative_holds_preserved:true};
}

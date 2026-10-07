// Receipt uncertainty consumes its full budget hold, but does not occupy a
// provider-processing slot once all candidates are terminal. Publication and
// final accounting remain gated separately; a held cohort is never completed.
export function cohortSchedule(reports,{usable,target,maximumInFlight,maximumCohorts,budget}){
 if(!Number.isSafeInteger(maximumInFlight)||maximumInFlight<1||budget.unbounded_unresolved)throw Error('bounded_concurrency_required');
 const active=reports.filter(r=>!r.complete||r.provider_processing_complete===false||r.cost?.held_usd>0&&r.provider_processing_complete!==true);
 const unsettled=reports.filter(r=>r.cost?.held_usd>0);
 const unpublished=reports.filter(r=>r.newly_published!==r.approved_unique);
 return {active:active.length,receipt_only:unsettled.filter(r=>r.complete&&r.provider_processing_complete===true).length,
  deliveryComplete:usable>=target&&active.length===0&&unpublished.length===0,
  complete:usable>=target&&active.length===0&&unsettled.length===0&&unpublished.length===0,
  canRegister:usable<target&&active.length<maximumInFlight&&reports.length<maximumCohorts&&budget.committed_micro<budget.limit_micro,
  conservative_holds_preserved:true};
}

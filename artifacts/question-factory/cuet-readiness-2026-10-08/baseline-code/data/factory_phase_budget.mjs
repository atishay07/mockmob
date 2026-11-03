// Phase release estimates a bounded checkpoint. The persistent ledger remains
// the authority for every reservation; a 10,000 forecast cannot block 500 items.
export function phaseBudgetFits(snapshot,phase,published=0){
 const target=phase==='release_1000'?1000:phase==='release_10000'?10000:null;
 if(target===null)return true;
 const committed=snapshot?.budget?.committed_micro,unit=snapshot?.cost_per_published_usd;
 if(!Number.isSafeInteger(committed)||committed<0||!Number.isFinite(unit)||unit<=0||!Number.isSafeInteger(published)||published<0)return false;
 return committed+Math.ceil(Math.max(0,target-published)*unit*1e6)<=50000000;
}

export function checkpointEvidenceReady(snapshot,phase,published=0,pilotTarget=100){
 if(phase==='release_1000'){
  const pilot=snapshot?.pilot;
  return pilot?.complete===true&&pilot.total===pilotTarget&&Number.isSafeInteger(pilot.eligible)&&pilot.eligible>0&&Number.isFinite(pilot.cost_per_eligible_usd)&&pilot.cost_per_eligible_usd>0;
 }
 if(phase==='release_10000')return Number.isSafeInteger(published)&&published>=1000;
 return phase==='resume';
}

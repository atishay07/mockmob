// Phase release estimates a bounded checkpoint. The persistent ledger remains
// the authority for every reservation; a 10,000 forecast cannot block 500 items.
export function phaseBudgetFits(snapshot,phase,published=0){
 const target=phase==='release_1000'?1000:phase==='release_10000'?10000:null;
 if(target===null)return true;
 const committed=snapshot?.budget?.committed_micro,unit=snapshot?.cost_per_published_usd;
 if(!Number.isSafeInteger(committed)||committed<0||!Number.isFinite(unit)||unit<=0||!Number.isSafeInteger(published)||published<0)return false;
 return committed+Math.ceil(Math.max(0,target-published)*unit*1e6)<=50000000;
}

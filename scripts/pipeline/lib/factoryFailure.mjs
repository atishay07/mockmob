// An uncertain item remains withheld and is never reposted. A verified full
// maximum hold can allow unrelated items to proceed; an unbounded hold cannot.
export function stopsFactory(error,ledger){
 const message=String(error?.message||error);
 if(/budget_|pricing_|input_bound|history_|factory_worker|frozen_validation_contract|current_calibration_required|separate_staging|wrong_staging/.test(message))return true;
 if(/unresolved_do_not|batch_submission_unresolved/.test(message)){
  try{ledger.assertHistoryReconciled();return false;}catch{return true;}
 }
 return false;
}

export function measuredEconomics(reports,{committedUsd,usable,authorContract}){
 const complete=reports.filter(r=>r.complete&&r.pending===0);
 // The comparison cohort is defined by the current author contract, rather
 // than selecting a favorable run. Every completed fixed cohort contributes.
 const comparable=complete.filter(r=>r.author_contract===authorContract);
 const gross=comparable.reduce((n,r)=>n+r.cost.gross_usd,0);
 const approved=comparable.reduce((n,r)=>n+r.approved_unique,0);
 const held=comparable.reduce((n,r)=>n+r.cost.held_usd,0);
 const unit=approved?gross/approved:null;
 const allGross=complete.reduce((n,r)=>n+r.cost.gross_usd,0);
 const allApproved=complete.reduce((n,r)=>n+r.approved_unique,0);
 const allHeld=complete.reduce((n,r)=>n+r.cost.held_usd,0);
 const allUnit=allApproved?allGross/allApproved:null;
 return {completed_denominator:complete.reduce((n,r)=>n+r.denominator,0),
  all_completed:{cohorts:complete.map(r=>r.id),unique_approved:allApproved,gross_usd:allGross,held_usd:allHeld,
   gross_cost_per_approved_usd:allUnit,conditional_marginal_10000_usd:allUnit===null?null:allUnit*10000,
   conditional_lifetime_to_10000_usd:allUnit===null?null:committedUsd+Math.max(0,10000-usable)*allUnit,
   estimate_settled:complete.length>0&&allHeld===0,
   forecast_basis:'Every completed fixed cohort, including earlier author contracts and their failures. Mixed-contract historical measurement, not a prediction of current-contract reliability.'},
  comparable_cohorts:comparable.map(r=>r.id),comparable_denominator:comparable.reduce((n,r)=>n+r.denominator,0),
  comparable_unique_approved:approved,comparable_gross_usd:gross,comparable_held_usd:held,
  gross_cost_per_approved_usd:unit,conditional_marginal_10000_usd:unit===null?null:unit*10000,
  conditional_lifetime_to_10000_usd:unit===null?null:committedUsd+Math.max(0,10000-usable)*unit,
  estimate_settled:comparable.length>0&&held===0,
  forecast_basis:'All completed fixed cohorts under the current author contract; rejected candidates, repairs, reasoning and validation are included. Existing lifetime committed cost is added once. Future yield and topic mix may change.'};
}

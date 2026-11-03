// Independent arithmetic: no generated answer keys or model grading.
export function solveReasoningStep({ kind, oldShare, newShare, nominal, priceIndex, assets = [], liabilities = [] } = {}) {
  const finite = values => values.every(n=>typeof n==='number' && Number.isFinite(n));
  if (kind === 'sacrificing_ratio' || kind === 'gaining_ratio') {
    if (!finite([oldShare,newShare]) || [oldShare,newShare].some(n=>n<0 || n>1)) throw new Error('INVALID_PARTNER_SHARE');
    return kind === 'sacrificing_ratio' ? oldShare-newShare : newShare-oldShare;
  }
  if (kind === 'real_value') {
    if (!finite([nominal,priceIndex]) || nominal<0 || priceIndex<=0) throw new Error('INVALID_PRICE_INDEX');
    return nominal*100/priceIndex;
  }
  if (kind === 'revaluation_result') {
    if (!finite([...assets,...liabilities])) throw new Error('INVALID_REVALUATION_VALUES');
    return assets.reduce((a,b)=>a+b,0)-liabilities.reduce((a,b)=>a+b,0);
  }
  throw new Error('INDEPENDENT_SOLVER_REQUIRED');
}

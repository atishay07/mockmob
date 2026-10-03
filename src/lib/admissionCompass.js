// Compatibility facade: practice scores cannot estimate admission probabilities.
// All actual eligibility and cutoff comparisons use the sourced DU engine.
export function buildAdmissionCompass({user,category='general'} = {}) {
  return {eligible:false,isPremium:Boolean(user?.isPremium),readiness:null,estimatedScore:null,scoreBand:null,category,categoryAdjustment:null,subjects:[],selectedSubjects:[],recommendations:[],scoreBands:[],improvementMoves:['Check programme eligibility and sourced historical cutoffs.'],href:'/cuet-cutoff-calculator',state:'historical_comparison',note:'No admission probabilities or mock-to-CUET score conversion.'};
}

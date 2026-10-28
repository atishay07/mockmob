// Additive measured source-kind clarification; canonical V714 anchors are preserved.
import { compactSystemV714 } from './compactValidationV714.mjs';
import { RESOLUTION_V713 } from './compactValidationV713.mjs';
const oldRule = 'premise_source excerpt cites evidence_id; stem/arithmetic uses empty ID and exact printed givens (arithmetic reason shows calculation).';
const newRule = 'premise_source excerpt cites evidence_id for a quoted rule/formula. stem/arithmetic uses empty ID and exact printed givens; arithmetic reason shows calculation. Never label an excerpt quote arithmetic.';
export const RESOLUTION_V715 = RESOLUTION_V713.replace(oldRule, newRule);
export function compactSystemV715(stage) { return compactSystemV714(stage).replace(oldRule, newRule); }

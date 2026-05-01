import { getCreditCostForAction, rivalTypeToQuotaAction } from '@/services/usage/getDailyUsage';

const BASIC_RIVALS = new Set(['NORTH_CAMPUS_RIVAL', 'SPEED_DEMON', 'ACCURACY_MONSTER', 'COMEBACK_RIVAL']);

export function enforceMentorActionPolicy(action, { isPaid }) {
  const safe = {
    ...action,
    params: action?.params && typeof action.params === 'object' && !Array.isArray(action.params) ? action.params : {},
  };

  switch (safe.action) {
    case 'launch_ai_rival': {
      const rivalType = typeof safe.params.rivalType === 'string' ? safe.params.rivalType : 'NORTH_CAMPUS_RIVAL';
      const quotaAction = BASIC_RIVALS.has(rivalType) ? 'rival_basic' : rivalTypeToQuotaAction(rivalType);
      return {
        ...safe,
        params: { ...safe.params, rivalType },
        creditCost: quotaAction === 'rival_basic' ? 0 : getCreditCostForAction(quotaAction),
        requiresPaid: !BASIC_RIVALS.has(rivalType) || rivalType !== 'NORTH_CAMPUS_RIVAL',
      };
    }
    case 'create_trap_drill':
    case 'create_mistake_replay':
      return { ...safe, creditCost: getCreditCostForAction('trap_drill'), requiresPaid: true };
    case 'show_mock_autopsy':
      return { ...safe, creditCost: getCreditCostForAction('mock_autopsy'), requiresPaid: true };
    case 'create_next_mock':
      return {
        ...safe,
        creditCost: safe.params?.custom === true ? getCreditCostForAction('custom_mock_plan') : 0,
        requiresPaid: Boolean(safe.params?.custom),
      };
    case 'show_admission_path':
    case 'explain_mistake':
    case 'start_revision_queue':
      return { ...safe, creditCost: 0, requiresPaid: false };
    case 'buy_credits':
      return { ...safe, creditCost: 0, requiresPaid: false, label: safe.label || 'Buy AI credits' };
    case 'upgrade_plan':
      return { ...safe, creditCost: 0, requiresPaid: !isPaid, label: safe.label || 'Upgrade plan' };
    default:
      return safe;
  }
}

export function capConfidence(modelConfidence, contextConfidence) {
  const contextScore = Number(contextConfidence?.score);
  if (!Number.isFinite(contextScore)) return clamp(modelConfidence, 0, 92);
  const modelScore = Number(modelConfidence);
  if (!Number.isFinite(modelScore)) return clamp(contextScore, 0, 92);

  // Let the model be a little more confident for narrow questions, but never
  // wildly more confident than the data supports.
  return clamp(Math.min(modelScore, contextScore + 8), 0, 92);
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

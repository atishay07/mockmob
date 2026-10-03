// Server-owned launch quote for ordinary practice. The dashboard renders this object
// and never enables a launch from its own credit arithmetic. Pure: callers supply the
// user, inventory and allowance facts they read, including "unknown" when a read failed.
import { TEST_MODES, resolveCount } from './test_modes.js';
import { MODE_CAPABILITIES, LAUNCH_SUBJECT_IDS } from './capabilities.js';
import { resolveSubject } from './subject_registry.js';

export const QUOTE_TTL_MS = 60_000;

export function allowanceKindFor({ isPremium, modeId, count, purpose, subjectId }) {
  if (isPremium) return null;
  if (purpose === 'baseline' && modeId === 'quick' && count === 5 && LAUNCH_SUBJECT_IDS.includes(subjectId)) return `baseline:${subjectId}`;
  if (purpose === 'full_sample' && modeId === 'full' && LAUNCH_SUBJECT_IDS.includes(subjectId)) return `full_sample:${subjectId}`;
  if (modeId === 'quick' && count === 10) return 'daily_practice';
  return null;
}

export function estimatedDurationSec(mode, count) {
  if (mode.fixedDurationSec) return { seconds: mode.fixedDurationSec, estimated: false };
  if (mode.adaptiveDurationByDifficulty) return { seconds: count * (mode.durationPerQuestionSec || 60), estimated: true };
  return { seconds: count * (mode.durationPerQuestionSec || 60), estimated: false };
}

/**
 * @param {object} input
 * @param {{id:string,isPremium:boolean,premiumUntil?:string|null,creditBalance:number}|null} input.user
 * @param {string} input.subject  stored or public subject ID
 * @param {string} input.mode
 * @param {number} input.count
 * @param {string} [input.purpose]
 * @param {{state:'available'|'unavailable', subjectCounts?:Record<string,number>, checkedAt?:string}} input.inventory
 * @param {{enabled:boolean, used:boolean|null}} input.allowance  used=null means the read failed
 * @param {string} input.token  idempotency token minted by the server
 */
export function buildPracticeQuote({ user, subject, mode: modeId, count, purpose = 'ordinary', inventory, allowance = { enabled: false, used: null }, token, now = Date.now() }) {
  const base = { quotedAt: new Date(now).toISOString(), expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(), idempotencyToken: null };
  const block = (state, reasonCode, reason, extra = {}) => ({ ...base, ...extra, state, launchable: false, reasonCode, reason });

  if (!user?.id) return block('unavailable', 'unauthenticated', 'Sign in to start practice.');
  const resolved = resolveSubject(subject);
  const subjectOut = { storedId: resolved.storedId, id: resolved.id, code: resolved.code, name: resolved.officialName };
  if (!resolved.launch) return block('unavailable', `subject_${resolved.practice}`, resolved.reason, { subject: subjectOut });

  const mode = TEST_MODES[modeId];
  const capability = MODE_CAPABILITIES[modeId];
  if (!mode || !capability) return block('unavailable', 'mode_unknown', 'Choose Quick Practice, Full Mock, Smart Practice or NTA Mode.', { subject: subjectOut });
  if (capability.state !== 'available') return block('unavailable', 'mode_unavailable', capability.reason || `${mode.label} is not available right now.`, { subject: subjectOut });

  const n = resolveCount(mode, Math.max(5, Math.min(50, Number(count) || mode.defaultCount || 10)));
  const isPremium = user.isPremium === true;
  const duration = estimatedDurationSec(mode, n);
  const entitlement = { kind: isPremium ? 'access' : 'free', expiresAt: isPremium ? user.premiumUntil || null : null };
  const common = {
    subject: subjectOut,
    mode: { id: mode.id, label: mode.label, capabilityId: capability.id, capabilityVersion: capability.version },
    count: n,
    durationSec: duration.seconds,
    durationEstimated: duration.estimated,
    entitlement,
  };

  if (mode.premium && !isPremium) {
    return block('blocked', 'access_required', `${mode.label} needs Pro. Quick Practice and Full Mock are available with credits.`, { ...common, upgradeHref: '/pricing?reason=premium_mode' });
  }

  // Inventory: a count is a necessary condition only; the exact set is built at launch.
  const internal = resolved.id === 'general_test' ? 'gat' : resolved.id;
  if (inventory?.state !== 'available') {
    return block('unavailable', 'inventory_unknown', 'We could not check question availability just now. Nothing was charged. Try again in a moment.', { ...common, inventory: { policy: capability.inventoryPolicy, state: 'unknown' } });
  }
  const ordinaryCount = Number(inventory.subjectCounts?.[internal] ?? inventory.subjectCounts?.[resolved.id] ?? 0);
  const inventoryOut = {
    policy: capability.inventoryPolicy,
    state: ordinaryCount >= n ? 'sufficient_count' : ordinaryCount > 0 ? 'insufficient' : 'empty',
    ordinaryCount,
    checkedAt: inventory.checkedAt || null,
    note: 'A count does not guarantee a complete set for every mode; the set is confirmed at launch and you are not charged if it cannot be built.',
  };
  if (ordinaryCount < n) {
    return block('unavailable', ordinaryCount ? 'inventory_insufficient' : 'inventory_empty',
      ordinaryCount ? `${resolved.officialName} has ${ordinaryCount} usable questions, fewer than this ${n}-question ${mode.label}. Choose fewer questions or another subject.`
        : `${resolved.officialName} has no usable practice questions yet. Choose another subject.`,
      { ...common, inventory: inventoryOut });
  }

  // Allowance and credits.
  const kind = allowance.enabled ? allowanceKindFor({ isPremium, modeId: mode.id, count: n, purpose, subjectId: resolved.id }) : null;
  const allowanceOut = kind ? { kind, state: allowance.used === null ? 'unknown' : allowance.used ? 'used' : 'available' } : null;
  const listCost = isPremium ? 0 : Number(mode.creditCost || 0);
  const creditCost = allowanceOut?.state === 'available' ? 0 : listCost;
  const balance = Math.max(0, Number(user.creditBalance) || 0);
  const out = { ...common, inventory: inventoryOut, allowance: allowanceOut, creditCost, creditBalance: isPremium ? null : balance };

  if (creditCost > balance) {
    return block('blocked', 'insufficient_credits',
      `${mode.label} costs ${creditCost} credits and you have ${balance}.${allowanceOut?.state === 'used' ? ' Today’s included set is used.' : allowanceOut?.state === 'unknown' ? ' Today’s included set could not be checked.' : ''}`,
      { ...out, upgradeHref: '/pricing?reason=credits' });
  }

  const reason = isPremium
    ? `Included with your Pro access${entitlement.expiresAt ? ` (valid until ${new Date(entitlement.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})` : ''}.`
    : allowanceOut?.state === 'available'
      ? 'Uses today’s included 10-question set. No credits are charged.'
      : `${creditCost} credits are charged only after a complete set is built.`;
  return { ...base, ...out, state: 'available', launchable: true, reasonCode: 'ok', reason, idempotencyToken: token };
}

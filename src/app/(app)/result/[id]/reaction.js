// Result page helpers shared with the app's rules (pure, no I/O).
//
// `act` is the shared MobiReact act (src/components/brand/MobiReact.jsx), which also honours the
// student's Reduce motion and Celebrations settings.
// Mobi's reaction follows the server's recap tone (src/lib/server/recap.js), the same table as the
// app (flutter_app lib/features/result/model/recap_variant.dart): proud on a first mock, a cheer when
// higher, encouragement when lower or held, a standard settle otherwise, and no Mobi in NTA mode.
// The repair key counts the same candidates the app does (lib/core/domain/repair_candidates.dart).

const REACTIONS = {
  first_mock: { act: 'proud', alt: 'Mobi, proud of your first mock in this subject.' },
  higher: { act: 'cheer', alt: 'Mobi cheering a higher result than last time.' },
  lower: { act: 'encourage', alt: 'Mobi encouraging you after a lower result.' },
  held: { act: 'encourage', alt: 'Mobi waiting with you while some answer keys are checked.' },
  default: { act: 'nod', alt: 'Mobi beside your recorded result.' },
};

export function mobiReaction(attempt) {
  if (attempt?.selectionMeta?.mode === 'nta') return null;
  return REACTIONS[attempt?.recap?.tone] || REACTIONS.default;
}

const HELD_STATES = new Set(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']);

// Wrong answers that repair can open, in paper order: not yet handled, and not held for a key check.
export function repairCandidates(analysis, handled, answerReviews = {}) {
  return (analysis?.mistakes || []).filter((row) => !handled?.has(row.q.id) && !HELD_STATES.has(answerReviews?.[row.q.id]?.state));
}

// Three minutes a mistake, rounded up to the nearest five (the app's figure).
export function repairMinutes(count) {
  return count > 0 ? Math.ceil((count * 3) / 5) * 5 : null;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Says exactly what the key opens: one chapter by name, otherwise the count and the time.
export function repairKeyLabel(candidates) {
  const count = candidates?.length || 0;
  if (!count) return null;
  const chapters = new Set(candidates.map((row) => row.chapter));
  if (chapters.size === 1) return `Repair ${candidates[0].chapter}, ${plural(count, 'mistake')}`;
  return `Repair ${plural(count, 'mistake')}, about ${repairMinutes(count)} minutes`;
}

export function verdictWord(verdict) {
  return verdict === 'correct' ? 'right' : verdict === 'wrong' ? 'wrong' : 'blank';
}

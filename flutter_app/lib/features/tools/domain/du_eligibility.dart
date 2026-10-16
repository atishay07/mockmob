// DU programme-eligibility engine, ported line for line from the website's
// `src/lib/du/eligibility.js` (UG Bulletin of Information 2026-27). Pure, no I/O.
//
// A student is eligible for a programme if ANY combination is satisfied by the subjects they
// will take. Taking extra subjects never disqualifies. Labels are kept verbatim.

import 'du_models.dart';

const Map<String, String> duCategoryLabels = {
  'UR': 'Unreserved',
  'OBC-NCL': 'OBC-NCL',
  'SC': 'SC',
  'ST': 'ST',
  'EWS': 'EWS',
  'SIKH': 'Sikh minority',
  'PwBD': 'PwBD',
  'KM': 'Kashmiri migrant',
  'SGC': 'Single girl child',
  'ORPHAN-FEMALE': 'Orphan (female)',
  'ORPHAN-MALE': 'Orphan (male)',
};

const List<String> duMainCategories = ['UR', 'OBC-NCL', 'SC', 'ST', 'EWS'];
const List<String> duOtherCategories = ['SIKH', 'PwBD', 'KM', 'SGC', 'ORPHAN-FEMALE', 'ORPHAN-MALE'];

enum DuGapKind { language, anyLanguage, domain, anyDomain, gat }

/// One thing missing from a combination.
class DuGap {
  const DuGap(this.kind, {this.id, this.count = 1});

  final DuGapKind kind;
  final String? id;
  final int count;
}

class _Need {
  final List<String> specific = [];
  int anyLang = 0;
  final List<String> domains = [];
  int free = 0;
  bool gat = false;
}

_Need _needsOf(DuCombination combination, bool requiresLanguage) {
  final need = _Need();
  for (final slot in combination.slots) {
    switch (slot.type) {
      case DuSlotType.lang:
        need.specific.addAll(slot.specific);
        need.anyLang += slot.any;
      case DuSlotType.domain:
        if (slot.subject != null) need.domains.add(slot.subject!);
      case DuSlotType.free:
        need.free += slot.count;
      case DuSlotType.gat:
        need.gat = true;
    }
  }
  final hasLangSlot = need.specific.isNotEmpty || need.anyLang > 0;
  // "Candidates must appear in any one language from List A" on top of the listed subjects.
  if (requiresLanguage && !hasLangSlot) need.anyLang = 1;
  return need;
}

/// What is missing for ONE combination.
List<DuGap> duGapsFor(DuCombination combination, bool requiresLanguage, DuSelection selection) {
  final need = _needsOf(combination, requiresLanguage);
  final langs = selection.languages.toSet();
  final doms = selection.domains.toSet();
  final gaps = <DuGap>[];
  for (final lang in need.specific) {
    if (!langs.contains(lang)) gaps.add(DuGap(DuGapKind.language, id: lang));
  }
  final spareLangs = langs.where((l) => !need.specific.contains(l)).length;
  final missingLangs = need.anyLang - spareLangs;
  if (missingLangs > 0) gaps.add(DuGap(DuGapKind.anyLanguage, count: missingLangs));
  for (final d in need.domains) {
    if (!doms.contains(d)) gaps.add(DuGap(DuGapKind.domain, id: d));
  }
  final spareDomains = doms.where((d) => !need.domains.contains(d)).length;
  final missingFree = need.free - spareDomains;
  if (missingFree > 0) gaps.add(DuGap(DuGapKind.anyDomain, count: missingFree));
  if (need.gat && !selection.gat) gaps.add(const DuGap(DuGapKind.gat));
  return gaps;
}

int duGapSize(List<DuGap> gaps) => gaps.fold(0, (n, g) => n + g.count);

final RegExp _laterCombination = RegExp(r'^Combination (III|IV)$');
final RegExp _seatsRemain = RegExp('only if seats remain vacant', caseSensitive: false);

/// Bulletin: some later combinations are "considered only if seats remain vacant" after
/// candidates who used the earlier ones. Eligible, but a lower-priority route.
bool _isSecondary(DuGroup group, DuCombination combination) =>
    _laterCombination.hasMatch(combination.label) && group.eligibility.notes.any(_seatsRemain.hasMatch);

class DuNearest {
  const DuNearest({required this.label, required this.text, required this.gaps, required this.size});

  final String label;
  final String text;
  final List<DuGap> gaps;
  final int size;
}

/// Whether a student with [DuSelection] can apply to a programme, and how.
class DuVerdict {
  const DuVerdict({required this.group, required this.eligible, this.matched, this.secondary = false, this.nearest});

  final DuGroup group;
  final bool eligible;

  /// The first combination the subjects satisfy.
  final DuCombination? matched;
  final bool secondary;

  /// The combination with the fewest missing subjects, when not eligible.
  final DuNearest? nearest;
}

DuVerdict duEvaluateGroup(DuGroup group, DuSelection selection) {
  final requiresLanguage = group.eligibility.requiresLanguage;
  DuNearest? best;
  for (final combination in group.eligibility.combinations) {
    final gaps = duGapsFor(combination, requiresLanguage, selection);
    if (gaps.isEmpty) {
      return DuVerdict(group: group, eligible: true, matched: combination, secondary: _isSecondary(group, combination));
    }
    final size = duGapSize(gaps);
    if (best == null || size < best.size) {
      best = DuNearest(label: combination.label, text: combination.text, gaps: gaps, size: size);
    }
  }
  return DuVerdict(group: group, eligible: false, nearest: best);
}

List<DuVerdict> duEvaluateAll(List<DuGroup> groups, DuSelection selection) => [
      for (final group in groups)
        selection.isEmpty ? DuVerdict(group: group, eligible: false) : duEvaluateGroup(group, selection),
    ];

/// A subject that would open more programmes if added.
class DuUnlock {
  const DuUnlock({required this.pick, required this.name, required this.unlocks, required this.programmes});

  final DuPick pick;
  final String name;
  final int unlocks;
  final List<String> programmes;
}

/// Which single added subject would unlock the most programmes?
List<DuUnlock> duSuggestUnlocks(DuCatalog catalog, DuSelection selection, {int limit = 4}) {
  final base = {
    for (final r in duEvaluateAll(catalog.groups, selection))
      if (r.eligible) r.group.id,
  };
  final candidates = <(DuPick, String)>[
    for (final l in catalog.languages)
      if (!selection.languages.contains(l.id)) (DuPick.language(l.id), l.name),
    for (final d in catalog.domains)
      if (!selection.domains.contains(d.id)) (DuPick.domain(d.id), d.name),
    if (!selection.gat) (const DuPick.gat(), 'General Aptitude Test'),
  ];
  final out = <DuUnlock>[];
  for (final (pick, name) in candidates) {
    final next = selection.toggle(pick);
    final unlocked = [
      for (final r in duEvaluateAll(catalog.groups, next))
        if (r.eligible && !base.contains(r.group.id)) r.group.name,
    ];
    if (unlocked.isNotEmpty) out.add(DuUnlock(pick: pick, name: name, unlocks: unlocked.length, programmes: unlocked));
  }
  out.sort((a, b) {
    final byCount = b.unlocks - a.unlocks;
    return byCount != 0 ? byCount : a.name.compareTo(b.name);
  });
  return out.take(limit).toList();
}

String duDescribeGap(DuGap gap, DuCatalog catalog) => switch (gap.kind) {
      DuGapKind.language => 'Add ${catalog.language(gap.id ?? '')?.name ?? gap.id}',
      DuGapKind.anyLanguage => gap.count == 1 ? 'Add one more language' : 'Add ${gap.count} more languages',
      DuGapKind.domain => 'Add ${catalog.domain(gap.id ?? '')?.name ?? gap.id}',
      DuGapKind.anyDomain => gap.count == 1 ? 'Add one more domain subject' : 'Add ${gap.count} more domain subjects',
      DuGapKind.gat => 'Add General Aptitude Test',
    };

// ---- Cutoffs ----------------------------------------------------------------------------

/// DU's UR merit list includes every candidate whatever their category, so a candidate in a
/// reserved category clears a round if they meet EITHER the UR or their category cutoff.
double? duEffectiveCutoff(List<double?>? round, int categoryIndex, {int urIndex = 0}) {
  if (round == null) return null;
  final cat = categoryIndex < round.length ? round[categoryIndex] : null;
  final ur = urIndex < round.length ? round[urIndex] : null;
  if (cat == null) return ur;
  if (ur == null) return cat;
  return cat < ur ? cat : ur;
}

/// True when the effective cutoff came from the UR list because it is lower than the category's.
bool duViaUr(List<double?>? round, int categoryIndex) {
  if (round == null || categoryIndex == 0 || round.isEmpty) return false;
  final ur = round[0];
  final eff = duEffectiveCutoff(round, categoryIndex);
  final cat = categoryIndex < round.length ? round[categoryIndex] : null;
  return ur != null && eff == ur && cat != ur;
}

enum DuSeatStatusId { r1, r2, r3, below, none }

class DuSeatStatus {
  const DuSeatStatus(this.id, this.label);

  final DuSeatStatusId id;
  final String label;

  bool get clears => id == DuSeatStatusId.r1 || id == DuSeatStatusId.r2 || id == DuSeatStatusId.r3;
}

/// Which published round(s) [score] would have cleared at one college.
DuSeatStatus duSeatStatus(double score, DuSeat seat, int categoryIndex) {
  final rounds = [for (final r in seat.rounds) duEffectiveCutoff(r, categoryIndex)];
  if (rounds.every((v) => v == null)) return const DuSeatStatus(DuSeatStatusId.none, 'No allocation recorded');
  bool cleared(int i) => rounds[i] != null && score >= rounds[i]!;
  if (cleared(0)) return const DuSeatStatus(DuSeatStatusId.r1, 'Clears Round 1');
  if (cleared(1)) return const DuSeatStatus(DuSeatStatusId.r2, 'Clears Round 2');
  if (cleared(2)) return const DuSeatStatus(DuSeatStatusId.r3, 'Clears Round 3');
  return const DuSeatStatus(DuSeatStatusId.below, 'Below Round 1, 2026');
}

/// One Bulletin combination checked against the student's subjects.
class DuRuleCheck {
  const DuRuleCheck({
    required this.label,
    required this.text,
    required this.ok,
    required this.secondary,
    required this.missing,
    required this.extraLanguage,
  });

  final String label;
  final String text;
  final bool ok;
  final bool secondary;
  final List<String> missing;

  /// The Bulletin also requires a List A language on top of this combination.
  final bool extraLanguage;
}

/// Every combination of a programme checked against the student's subjects, so the screen can
/// show the exact Bulletin rule next to what is met and what is missing (nothing is hidden).
List<DuRuleCheck> duExplainCombinations(DuGroup group, DuSelection selection, DuCatalog catalog) {
  final requiresLanguage = group.eligibility.requiresLanguage;
  return [
    for (final combination in group.eligibility.combinations)
      () {
        final gaps = duGapsFor(combination, requiresLanguage, selection);
        return DuRuleCheck(
          label: combination.label,
          text: combination.text,
          ok: gaps.isEmpty,
          secondary: _isSecondary(group, combination),
          missing: [for (final g in gaps) duDescribeGap(g, catalog)],
          extraLanguage: requiresLanguage && !combination.slots.any((s) => s.type == DuSlotType.lang),
        );
      }(),
  ];
}

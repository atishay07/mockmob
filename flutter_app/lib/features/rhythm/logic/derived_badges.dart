// The five badges worked out on the phone (app-you-1016 section 3.2, source D), from the complete
// attempts list (`GET /api/attempts` is a full dump; `milestone_progress.dart` relies on the same).
// Only server-scored attempts count, each dated by its own `completedAt`. Every rule uses a
// threshold that only grows, so a badge once earned is never taken back. Where the server also
// dates an id, the server's date wins (`mergeDerived`).
import '../../../core/models/attempt.dart';
import '../../../core/models/rhythm.dart';

/// A derived badge and the attempt that earned it.
class DerivedBadge {
  const DerivedBadge(this.id, this.at, this.attemptId);

  final String id;
  final DateTime at;
  final String attemptId;
}

/// Targets of the derived badges that can be counted exactly.
const Map<String, int> derivedTargets = {'full_mocks_5': 5, 'four_subjects': 4};

List<Attempt> _scored(List<Attempt> attempts) =>
    [for (final a in attempts) if (a.selectionMeta.isServerScored) a]..sort((a, b) => a.completedAt.compareTo(b.completedAt));

/// Each derived badge earned in [attempts], keyed by id.
Map<String, DerivedBadge> deriveBadges(List<Attempt> attempts) {
  final scored = _scored(attempts);
  final out = <String, DerivedBadge>{};
  void put(String id, Attempt a) => out.putIfAbsent(id, () => DerivedBadge(id, a.completedAt, a.id));

  var mocks = 0;
  final subjects = <String>{};
  final bestByFormat = <String, int>{};
  for (final a in scored) {
    if (a.mode == 'nta') put('first_nta', a);
    if (a.isMock && ++mocks == 5) put('full_mocks_5', a);
    if (a.total >= 10 && a.correct == a.total) put('clean_set', a);
    final subject = a.subject.trim().toLowerCase();
    if (subject.isNotEmpty && a.correct + a.wrong >= 5 && subjects.add(subject) && subjects.length == 4) put('four_subjects', a);
    final format = a.formatId ?? '';
    if (format.isNotEmpty) {
      final before = bestByFormat[format];
      if (before != null && a.marks > before) put('new_best', a);
      if (before == null || a.marks > before) bestByFormat[format] = a.marks;
    }
  }
  return out;
}

/// The exact counts toward the countable derived badges not earned yet.
Map<String, int> derivedProgress(List<Attempt> attempts) {
  final scored = _scored(attempts);
  final mocks = scored.where((a) => a.isMock).length;
  final subjects = {
    for (final a in scored)
      if (a.subject.trim().isNotEmpty && a.correct + a.wrong >= 5) a.subject.trim().toLowerCase(),
  }.length;
  return {
    if (mocks < 5) 'full_mocks_5': mocks,
    if (subjects < 4) 'four_subjects': subjects,
  };
}

/// The server's milestones with the derived badges merged in: a derived id the server already
/// dates keeps the server's date; otherwise the attempt's date is used, or the id is listed as not
/// earned so the badge always shows.
List<RhythmMilestone> mergeDerived(List<RhythmMilestone> server, Map<String, DerivedBadge> derived, {Iterable<String> derivedIds = const []}) {
  final out = <RhythmMilestone>[];
  final seen = <String>{};
  for (final m in server) {
    seen.add(m.id);
    final d = derived[m.id];
    out.add(m.earned || d == null ? m : RhythmMilestone(id: m.id, achievedAt: d.at));
  }
  for (final id in {...derivedIds, ...derived.keys}) {
    if (seen.contains(id)) continue;
    out.add(RhythmMilestone(id: id, achievedAt: derived[id]?.at));
  }
  return out;
}

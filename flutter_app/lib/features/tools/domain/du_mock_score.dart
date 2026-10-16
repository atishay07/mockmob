// A score for Compass from the student's own mocks: the latest full-length mock (50 questions,
// out of 250) in each subject they ticked, added up the way most DU programmes count, as one
// language and three domain papers (out of 1000). Raw marks, not NTA's normalised score, so the
// screen calls it "your latest mocks" and never "your CUET score". Pure: tested without a phone.

import '../../../core/models/attempt.dart';
import 'du_models.dart';

/// One paper in the total: the DU subject id, its marks out of 250, and the mock's date.
typedef DuMockPaper = ({String id, bool language, int marks, DateTime at});

class DuMockScore {
  const DuMockScore({required this.papers});

  /// One language first, then the three domain papers, highest marks first.
  final List<DuMockPaper> papers;

  int get total => papers.fold(0, (sum, p) => sum + p.marks);

  /// The newest of the mocks counted.
  DateTime get latest => papers.map((p) => p.at).reduce((a, b) => a.isAfter(b) ? a : b);
}

/// Marks a full CUET paper is out of.
const int duPaperMax = 250;

/// The latest full mock per ticked subject, then the best language and the best three domain
/// papers among them. Null unless there is a full mock in at least one ticked language and three
/// ticked domain subjects. [publicIdOf] maps an attempt's internal subject id to the public id
/// Compass uses (they differ only for a few subjects); unknown ids map to themselves.
DuMockScore? duMockScore(
  Iterable<Attempt> attempts,
  DuSelection selection, {
  String Function(String internalId)? publicIdOf,
}) {
  if (selection.languages.isEmpty || selection.domains.length < 3) return null;
  final latest = <String, Attempt>{};
  for (final a in attempts) {
    if (!a.isMock || a.maxMarks != duPaperMax) continue;
    final id = publicIdOf?.call(a.subject) ?? a.subject;
    if (!selection.languages.contains(id) && !selection.domains.contains(id)) continue;
    final had = latest[id];
    if (had == null || a.completedAt.isAfter(had.completedAt)) latest[id] = a;
  }
  DuMockPaper paper(String id, Attempt a, bool language) =>
      (id: id, language: language, marks: a.marks.clamp(0, duPaperMax), at: a.completedAt);
  final languages = [
    for (final id in selection.languages)
      if (latest[id] case final Attempt a) paper(id, a, true),
  ]..sort((a, b) => b.marks - a.marks);
  final domains = [
    for (final id in selection.domains)
      if (latest[id] case final Attempt a) paper(id, a, false),
  ]..sort((a, b) => b.marks - a.marks);
  if (languages.isEmpty || domains.length < 3) return null;
  return DuMockScore(papers: [languages.first, ...domains.take(3)]);
}

/// How many full mocks per paper set the range.
const int duRangeMocks = 3;

/// One paper of the range: its marks in up to its last [duRangeMocks] full mocks (newest first).
typedef DuRangePaper = ({String id, bool language, List<int> marks, DateTime at});

/// The student's estimate from their own full mocks: for each of the four papers DU counts (the
/// best language and the best three domain papers, by their latest mock), the lowest and highest
/// of its last three full mocks. One mock per paper makes a single figure. Raw marks out of 1000.
class DuMockRange {
  const DuMockRange({required this.papers});

  /// One language first, then the three domain papers.
  final List<DuRangePaper> papers;

  int get low => papers.fold(0, (sum, p) => sum + p.marks.reduce((a, b) => a < b ? a : b));
  int get high => papers.fold(0, (sum, p) => sum + p.marks.reduce((a, b) => a > b ? a : b));

  /// The sum of each paper's newest mock.
  int get latestTotal => papers.fold(0, (sum, p) => sum + p.marks.first);

  /// The newest mock counted.
  DateTime get at => papers.map((p) => p.at).reduce((a, b) => a.isAfter(b) ? a : b);
}

/// What is still missing before the mocks make an estimate: how many of the 4 paper slots have a
/// full mock, and the ticked subjects with none yet (languages first).
class DuMockPartial {
  const DuMockPartial({required this.filled, required this.missing});

  /// 0 to 3 (4 is a full range, never partial).
  final int filled;
  final List<String> missing;
}

/// The range for [selection] from [attempts], or null under the same rule as [duMockScore].
DuMockRange? duMockRange(
  Iterable<Attempt> attempts,
  DuSelection selection, {
  String Function(String internalId)? publicIdOf,
}) {
  if (selection.languages.isEmpty || selection.domains.length < 3) return null;
  final byId = _fullMocksBySubject(attempts, selection, publicIdOf);
  DuRangePaper paper(String id, List<Attempt> list, bool language) => (
        id: id,
        language: language,
        marks: [for (final a in list.take(duRangeMocks)) a.marks.clamp(0, duPaperMax)],
        at: list.first.completedAt,
      );
  final languages = [
    for (final id in selection.languages)
      if (byId[id] case final List<Attempt> l) paper(id, l, true),
  ]..sort((a, b) => b.marks.first - a.marks.first);
  final domains = [
    for (final id in selection.domains)
      if (byId[id] case final List<Attempt> l) paper(id, l, false),
  ]..sort((a, b) => b.marks.first - a.marks.first);
  if (languages.isEmpty || domains.length < 3) return null;
  return DuMockRange(papers: [languages.first, ...domains.take(3)]);
}

/// Which slots the student's full mocks fill when [duMockRange] is null, or null when there is no
/// mock at all in a ticked subject (nothing to say yet) or the selection cannot make four papers.
DuMockPartial? duMockPartial(
  Iterable<Attempt> attempts,
  DuSelection selection, {
  String Function(String internalId)? publicIdOf,
}) {
  if (selection.languages.isEmpty || selection.domains.length < 3) return null;
  final byId = _fullMocksBySubject(attempts, selection, publicIdOf);
  if (byId.isEmpty) return null;
  final lang = selection.languages.any(byId.containsKey) ? 1 : 0;
  final dom = selection.domains.where(byId.containsKey).length.clamp(0, 3);
  if (lang + dom >= 4) return null;
  return DuMockPartial(
    filled: lang + dom,
    missing: [
      if (lang == 0) ...selection.languages.take(1),
      ...selection.domains.where((d) => !byId.containsKey(d)).take(3 - dom),
    ],
  );
}

/// Full 250-mark mocks per ticked subject, newest first.
Map<String, List<Attempt>> _fullMocksBySubject(Iterable<Attempt> attempts, DuSelection selection, String Function(String)? publicIdOf) {
  final out = <String, List<Attempt>>{};
  for (final a in attempts) {
    if (!a.isMock || a.maxMarks != duPaperMax) continue;
    final id = publicIdOf?.call(a.subject) ?? a.subject;
    if (!selection.languages.contains(id) && !selection.domains.contains(id)) continue;
    (out[id] ??= []).add(a);
  }
  for (final l in out.values) {
    l.sort((a, b) => b.completedAt.compareTo(a.completedAt));
  }
  return out;
}

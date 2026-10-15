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

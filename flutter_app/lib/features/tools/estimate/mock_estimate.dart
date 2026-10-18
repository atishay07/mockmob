// The range from the student's own full mocks, and how far they are towards one (owner, 19 Oct,
// G19 and D109: "I don't know my range": one full mock in each subject of the student's set, then
// an estimated range they can take as theirs).
//
// The estimate adds up the four papers DU counts (the best language and the best three domain
// papers), each the average of its last three full mocks, out of 250. One paper is never a certain
// number, so the range is the total plus and minus its spread: how far a fresh paper like these
// usually lands from the average (one standard deviation, worked out from the student's own right,
// wrong and blank answers, or from how far their mocks actually swung, whichever is wider). Raw
// marks out of 1000, not NTA's normalised score. Pure: tested without a phone.

import 'dart:math' as math;

import '../../../core/models/attempt.dart';
import '../domain/du_mock_score.dart' show duPaperMax, duRangeMocks;
import '../domain/du_models.dart';
import 'estimate.dart';

/// One subject of the student's set: done once a full mock in it is scored.
typedef RangeStep = ({String id, bool language, bool done});

/// One paper the estimate counts.
typedef MockPaper = ({String id, bool language, double average, double spread, int mocks, DateTime at});

/// The estimate from full mocks: [centre] plus and minus [spread], rounded out to whole fives so it
/// never claims more precision than it has.
class MockEstimate {
  const MockEstimate({required this.papers, required this.centre, required this.spread});

  /// One language first, then the three domain papers.
  final List<MockPaper> papers;
  final double centre;
  final double spread;

  double get low => (math.max(0, centre - spread) / 5).floorToDouble() * 5;
  double get high => math.min(1000, (math.min(1000, centre + spread) / 5).ceilToDouble() * 5);

  /// The newest mock counted.
  DateTime get at => papers.map((p) => p.at).reduce((a, b) => a.isAfter(b) ? a : b);

  /// Full mocks counted across the four papers.
  int get mocks => papers.fold(0, (n, p) => n + p.mocks);

  Estimate get estimate => Estimate(
        source: EstimateSource.mocks,
        low: low,
        high: high,
        at: at,
        mocks: mocks,
        papers: [for (final p in papers) (id: p.id, marks: p.average.round())],
      );
}

/// How far the student is towards an estimate.
class RangeProgress {
  const RangeProgress({required this.steps, required this.canTotal, this.estimate, this.newest, this.mocks = 0});

  /// The subjects of the set, languages first, in the student's order.
  final List<RangeStep> steps;

  /// The set holds a language and three domain subjects, the four papers DU adds up.
  final bool canTotal;

  /// The estimate from the mocks so far, once the four papers DU counts each have one (it can come
  /// before every subject of the set is done).
  final MockEstimate? estimate;

  /// The newest full mock in a subject of the set (null when there is none).
  final DateTime? newest;

  /// Full mocks the estimate learns from: up to the last three in each subject of the set.
  final int mocks;

  int get done => steps.where((s) => s.done).length;
  int get total => steps.length;

  /// Every subject has a full mock.
  bool get complete => total > 0 && done == total;

  /// The first subject without a full mock yet.
  String? get next {
    for (final s in steps) {
      if (!s.done) return s.id;
    }
    return null;
  }

  List<String> get doneIds => [for (final s in steps) if (s.done) s.id];
}

/// Full 250-mark mocks per subject of [selection], newest first. [publicIdOf] maps an attempt's
/// internal subject id to the public id the selection uses.
Map<String, List<Attempt>> fullMocksBySubject(Iterable<Attempt> attempts, DuSelection selection, {String Function(String internalId)? publicIdOf}) {
  final out = <String, List<Attempt>>{};
  for (final a in attempts) {
    if (!a.isMock || a.maxMarks != duPaperMax || a.total <= 0) continue;
    final id = publicIdOf?.call(a.subject) ?? a.subject;
    if (!selection.languages.contains(id) && !selection.domains.contains(id)) continue;
    (out[id] ??= []).add(a);
  }
  for (final l in out.values) {
    l.sort((a, b) => b.completedAt.compareTo(a.completedAt));
  }
  return out;
}

/// One paper from its last [duRangeMocks] full mocks (newest first): the average marks and the
/// spread of one fresh paper around it.
MockPaper mockPaper(String id, bool language, List<Attempt> newestFirst) {
  final counted = newestFirst.take(duRangeMocks).toList();
  final n = counted.length;
  final marks = [for (final a in counted) a.marks.toDouble()];
  final average = (marks.reduce((a, b) => a + b) / n).clamp(0.0, duPaperMax.toDouble());
  // Each question scores +5, -1 or 0. Their variance, pooled across the mocks counted, times the
  // questions in a paper is the variance of one paper; (1 + 1/n) adds the doubt in the average.
  var questions = 0, plus = 0.0, squares = 0.0;
  for (final a in counted) {
    questions += a.total;
    plus += 5.0 * a.correct - a.wrong;
    squares += 25.0 * a.correct + a.wrong;
  }
  final mean = plus / questions;
  final perQuestion = math.max(0.0, squares / questions - mean * mean);
  final perPaper = (questions / n).roundToDouble();
  final modelled = math.sqrt(perPaper * perQuestion * (1 + 1 / n));
  // With two mocks or more, how far they actually swung, if that is wider.
  var observed = 0.0;
  if (n >= 2) {
    final m = marks.reduce((a, b) => a + b) / n;
    final variance = marks.fold(0.0, (s, x) => s + (x - m) * (x - m)) / (n - 1);
    observed = math.sqrt(variance * (1 + 1 / n));
  }
  return (id: id, language: language, average: average, spread: math.max(modelled, observed), mocks: n, at: counted.first.completedAt);
}

/// The estimate for [selection]: the best language and the best three domain papers by average,
/// added up, with their spreads combined. Null without a full mock in one language and three domain
/// subjects of the selection.
MockEstimate? mockEstimate(Iterable<Attempt> attempts, DuSelection selection, {String Function(String internalId)? publicIdOf}) {
  if (selection.languages.isEmpty || selection.domains.length < 3) return null;
  return _estimateFrom(fullMocksBySubject(attempts, selection, publicIdOf: publicIdOf), selection);
}

MockEstimate? _estimateFrom(Map<String, List<Attempt>> byId, DuSelection selection) {
  final languages = [
    for (final id in selection.languages)
      if (byId[id] case final List<Attempt> l) mockPaper(id, true, l),
  ]..sort((a, b) => b.average.compareTo(a.average));
  final domains = [
    for (final id in selection.domains)
      if (byId[id] case final List<Attempt> l) mockPaper(id, false, l),
  ]..sort((a, b) => b.average.compareTo(a.average));
  if (languages.isEmpty || domains.length < 3) return null;
  final papers = [languages.first, ...domains.take(3)];
  final centre = papers.fold(0.0, (s, p) => s + p.average);
  final spread = math.sqrt(papers.fold(0.0, (s, p) => s + p.spread * p.spread));
  return MockEstimate(papers: papers, centre: centre, spread: spread);
}

/// The student's way to a range: a step per subject of [selection] (languages first) that
/// [canSit] allows (a subject with no full mock in the app is left out, so the way never dead-ends),
/// whether the set makes DU's four papers, and the estimate so far.
RangeProgress rangeProgress(
  Iterable<Attempt> attempts,
  DuSelection selection, {
  String Function(String internalId)? publicIdOf,
  bool Function(String id)? canSit,
}) {
  final byId = fullMocksBySubject(attempts, selection, publicIdOf: publicIdOf);
  bool sittable(String id) => canSit?.call(id) ?? true;
  final languages = [for (final id in selection.languages) if (sittable(id)) id];
  final domains = [for (final id in selection.domains) if (sittable(id)) id];
  final steps = <RangeStep>[
    for (final id in languages) (id: id, language: true, done: byId.containsKey(id)),
    for (final id in domains) (id: id, language: false, done: byId.containsKey(id)),
  ];
  DateTime? newest;
  var mocks = 0;
  for (final s in steps) {
    final list = byId[s.id];
    if (list == null) continue;
    mocks += list.length < duRangeMocks ? list.length : duRangeMocks;
    final at = list.first.completedAt;
    if (newest == null || at.isAfter(newest)) newest = at;
  }
  final canTotal = languages.isNotEmpty && domains.length >= 3;
  final counted = DuSelection(languages: languages, domains: domains);
  return RangeProgress(
    steps: steps,
    canTotal: canTotal,
    estimate: canTotal ? _estimateFrom(byId, counted) : null,
    newest: newest,
    mocks: mocks,
  );
}

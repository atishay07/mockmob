import '../../../core/models/attempt.dart';
import 'subject_names.dart';

/// One scored session on a trend line: marks out of the paper's maximum.
class TrendPoint {
  const TrendPoint({required this.attemptId, required this.at, required this.marks, required this.maxMarks});

  final String attemptId;
  final DateTime at;
  final int marks;
  final int maxMarks;
}

/// Sessions of one format (same mode, subject, length and scoring), oldest first. Formats are
/// never mixed: a Quick 10 and a full mock are different papers.
class TrendSeries {
  const TrendSeries({required this.key, required this.subject, required this.mode, required this.total, required this.points});

  final String key;

  /// Internal subject id, as attempts carry it.
  final String subject;
  final String? mode;
  final int total;
  final List<TrendPoint> points;

  int get maxMarks => total * 5;
  DateTime get latest => points.last.at;

  /// "Accountancy, Quick 10" or "Economics, full mock".
  String get label => '${subjectDisplayName(subject)}, ${modeLabel(mode, total)}';
}

String modeLabel(String? mode, int total) => switch (mode) {
      'full' => 'full mock',
      'nta' => 'NTA mode',
      'smart' => 'Smart $total',
      'quick' || 'chapter' => 'Quick $total',
      _ => '$total questions',
    };

/// Answers in one subject across every recorded session.
class SubjectLine {
  const SubjectLine({required this.subject, required this.sessions, required this.right, required this.wrong, required this.blank});

  final String subject;
  final int sessions;
  final int right;
  final int wrong;
  final int blank;

  int get questions => right + wrong + blank;
  int get answered => right + wrong;

  /// Right out of answered, rounded, or null when nothing was answered.
  int? get accuracyPct => answered == 0 ? null : (right * 100 / answered).round();
  int get net => right * 5 - wrong;
}

String _formatKey(Attempt a) =>
    a.formatId ?? '${a.mode ?? 'unknown'}:${a.subject}:q${a.total}:${a.selectionMeta.scoringVersion ?? 'historical_device'}';

/// Every format with its sessions, the most recently used first.
List<TrendSeries> trendSeries(List<Attempt> attempts) {
  final groups = <String, List<Attempt>>{};
  for (final a in attempts) {
    if (a.total <= 0) continue;
    groups.putIfAbsent(_formatKey(a), () => []).add(a);
  }
  final series = [
    for (final e in groups.entries)
      () {
        final list = [...e.value]..sort((x, y) => x.completedAt.compareTo(y.completedAt));
        final first = list.first;
        return TrendSeries(
          key: e.key,
          subject: first.subject,
          mode: first.mode,
          total: first.total,
          points: [
            for (final a in list)
              TrendPoint(attemptId: a.id, at: a.completedAt, marks: a.correct * 5 - a.wrong, maxMarks: a.total * 5),
          ],
        );
      }(),
  ];
  series.sort((a, b) => b.latest.compareTo(a.latest));
  return series;
}

/// The series to open on: the most recent format that already has a line (two or more
/// sessions), otherwise the most recent format.
TrendSeries? defaultSeries(List<TrendSeries> all) {
  for (final s in all) {
    if (s.points.length >= 2) return s;
  }
  return all.isEmpty ? null : all.first;
}

/// Per subject, most sessions first.
List<SubjectLine> subjectLines(List<Attempt> attempts) {
  final map = <String, List<Attempt>>{};
  for (final a in attempts) {
    if (a.total <= 0) continue;
    map.putIfAbsent(canonicalSubjectId(a.subject), () => []).add(a);
  }
  final lines = [
    for (final e in map.entries)
      SubjectLine(
        subject: e.key,
        sessions: e.value.length,
        right: e.value.fold(0, (s, a) => s + a.correct),
        wrong: e.value.fold(0, (s, a) => s + a.wrong),
        blank: e.value.fold(0, (s, a) => s + a.unattempted),
      ),
  ];
  lines.sort((a, b) => b.sessions.compareTo(a.sessions) != 0 ? b.sessions.compareTo(a.sessions) : a.subject.compareTo(b.subject));
  return lines;
}

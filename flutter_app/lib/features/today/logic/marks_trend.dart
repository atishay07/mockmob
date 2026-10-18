// Your marks (D52 item 3, TODAY-SWIPE-1018): the marks of the last six full mocks in the move's
// subject as one line, the newest point lit, merged with the Last paper block. The student's own
// opened results only: never a sealed paper (it would spoil a reveal), never a prediction. With
// fewer than two full mocks there is no line and Your marks shows Last paper alone.
import '../../../core/models/attempt.dart';
import '../../../core/router/routes.dart';
import 'move_builder.dart' show paperLabel;
import 'subjects.dart';
import 'today_inputs.dart';
import 'today_model.dart';

/// How many full mocks the line draws, at most.
const int marksTrendPapers = 6;

class MarksTrend {
  const MarksTrend({required this.points, required this.subject, required this.ofSubject, required this.outOf});

  /// Oldest first; the last one is the newest paper.
  final List<TrendPoint> points;

  /// "Accountancy".
  final String subject;

  /// Every opened full mock in this subject with the same paper length (the line's denominator).
  final int ofSubject;
  final int outOf;

  TrendPoint get newest => points.last;
  TrendPoint? get previous => points.length < 2 ? null : points[points.length - 2];

  /// The best marks among the points; the newest wins a tie.
  TrendPoint get best {
    var b = points.last;
    for (final p in points.reversed) {
      if (p.marks > b.marks) b = p;
    }
    return b;
  }
}

/// The trend for [subject] (the move's), else the newest full mock's subject. Null with fewer than
/// two opened full mocks of one paper length in it.
MarksTrend? buildMarksTrend(TodayInputs i, {String? subject}) {
  final all = i.attempts;
  if (all == null || all.isEmpty) return null;
  final unopened = {for (final u in i.unopened) u.attemptId};
  final mocks = [for (final a in all) if (a.isMock && !unopened.contains(a.id)) a];
  if (mocks.isEmpty) return null;
  final wanted = subject == null ? null : canonicalSubject(subject);
  final inSubject = wanted == null ? const <Attempt>[] : [for (final a in mocks) if (canonicalSubject(a.subject) == wanted) a];
  final pool = inSubject.isNotEmpty ? inSubject : [for (final a in mocks) if (canonicalSubject(a.subject) == canonicalSubject(mocks.first.subject)) a];
  // One paper length, so every point is out of the same marks.
  final length = pool.first.total;
  final same = [for (final a in pool) if (a.total == length) a];
  if (same.length < 2) return null;
  final shown = same.take(marksTrendPapers).toList().reversed.toList();
  return MarksTrend(
    subject: subjectName(pool.first.subject),
    ofSubject: same.length,
    outOf: pool.first.maxMarks,
    points: [
      for (final a in shown)
        TrendPoint(
          attemptId: a.id,
          label: paperLabel(all, a),
          date: '',
          marks: a.marks,
          outOf: a.maxMarks,
          target: GoTo(AppRoutes.result(a.id)),
        ),
    ],
  );
}

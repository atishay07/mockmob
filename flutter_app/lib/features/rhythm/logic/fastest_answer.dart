// The fastest right answer (app-you-1016 section 3.6): the shortest timed right answer across the
// server-scored papers whose timings are usable. Answers under 3 seconds are not counted (a tap
// through, not a read). Null when no paper carries a timing, so the block says so, never a guess.
import '../../../core/models/attempt.dart';

/// Answers quicker than this are not counted.
const int fastestFloorMs = 3000;

class FastestAnswer {
  const FastestAnswer({required this.timeMs, required this.subject, required this.at, required this.attemptId, required this.question});

  final int timeMs;
  final String subject;
  final DateTime at;
  final String attemptId;

  /// 1-based position of the question in its paper.
  final int question;

  /// Whole seconds, rounded to the nearest.
  int get seconds => (timeMs / 1000).round();
}

FastestAnswer? fastestRightAnswer(List<Attempt> attempts) {
  FastestAnswer? best;
  for (final a in attempts) {
    if (!a.selectionMeta.isServerScored) continue;
    final recovery = a.selectionMeta.recovery;
    if (recovery != null && !recovery.isUsable) continue;
    for (var i = 0; i < a.details.length; i++) {
      final d = a.details[i];
      final t = d.timeMs;
      if (d.isCorrect != true || t == null || t < fastestFloorMs) continue;
      if (best == null || t < best.timeMs) {
        best = FastestAnswer(timeMs: t, subject: a.subject, at: a.completedAt, attemptId: a.id, question: i + 1);
      }
    }
  }
  return best;
}

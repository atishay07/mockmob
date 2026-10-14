import '../../../core/widgets/mobi.dart' show MobiAct;

/// How Mobi meets a finished practice. Chosen from the server's counts only, and never sad at
/// the student: a good run gets a cheer, a mixed one Mobi pointing at the first slip, a sheet
/// left mostly blank Mobi reading it, and a set with nothing right Mobi encouraging them.
enum FinishTone {
  /// 80% right or better: a cheer, the top of a T2 moment.
  great,

  /// 70% right or better, or better than the last practice in this subject.
  good,

  /// Some right, some to look at.
  mixed,

  /// Half or more left blank.
  blank,

  /// Nothing right yet. Calm, no celebration.
  low;

  /// Mobi's act. A practice set is a T2 moment (MOTION.md 1.2), so even a great one gets a cheer,
  /// not the celebrate jump with its own bubbles (that would be a second burst). A mixed set has
  /// him point at the first wrong bubble (see FinishStage); a set with nothing right has him
  /// encourage, never sad.
  MobiAct get act => switch (this) {
    great => MobiAct.cheer,
    good => MobiAct.cheer,
    mixed => MobiAct.point,
    blank => MobiAct.read,
    low => MobiAct.encourage,
  };

  /// Mobi points at the first wrong answer on the sheet.
  bool get pointsAtMistake => this == mixed || this == low;
}

/// The marks of a finished practice, from the server's counts (+5 right, -1 wrong, 0 blank).
/// Display only: the attempt's own `correct`, `wrong` and `unattempted` are the truth.
class FinishMarks {
  const FinishMarks({required this.correct, required this.wrong, required this.blank, required this.total});

  final int correct;
  final int wrong;
  final int blank;
  final int total;

  int get scored => correct * 5 - wrong;
  int get max => total * 5;

  /// Each wrong answer costs 6: the 5 not won plus the 1 taken away.
  int get lostToWrong => wrong * 6;
  int get leftOnBlanks => blank * 5;
  int get missed => max - scored;

  double get accuracy => total == 0 ? 0 : correct / total;
}

/// Picks the tone. [previousAccuracy] is the share right in the student's previous practice in
/// the same subject, when it is known; doing better than that counts as a good run too.
FinishTone finishToneFor(FinishMarks m, {double? previousAccuracy}) {
  if (m.total == 0) return FinishTone.low;
  if (m.blank * 2 >= m.total && m.correct * 2 < m.total) return FinishTone.blank;
  if (m.correct == 0) return FinishTone.low;
  final better = previousAccuracy != null && m.accuracy > previousAccuracy && m.accuracy >= 0.4;
  if (m.accuracy >= 0.8) return FinishTone.great;
  if (m.accuracy >= 0.7 || better) return FinishTone.good;
  return FinishTone.mixed;
}

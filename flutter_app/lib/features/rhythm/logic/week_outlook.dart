// What the rest of this week asks for, from the server's week and the student's own plan. Pure:
// plain arithmetic on real counts and the student's chosen study days. It never predicts marks
// and never scolds: a week that can no longer reach the goal is said plainly, with what still
// counts and how to keep the run.
import '../../../core/copy/formatters.dart';
import '../copy.dart';

enum OutlookKind {
  /// The goal is met (or passed) this week.
  met,

  /// More study days are needed and there are enough days left to get them.
  onTrack,

  /// The days left cannot reach the goal any more.
  outOfReach,

  /// Rhythm is paused: nothing is asked.
  paused,
}

class WeekOutlook {
  const WeekOutlook({
    required this.kind,
    required this.needed,
    required this.daysLeft,
    this.todayPlanned = false,
    this.nextPlanned,
  });

  final OutlookKind kind;

  /// More study days needed to meet the goal (0 once met).
  final int needed;

  /// Days from today to Sunday, today included while it is not a study day yet.
  final int daysLeft;

  /// Today is one of the student's chosen study days and has not counted yet.
  final bool todayPlanned;

  /// The next chosen study day after today (0 = Monday), when one is left this week.
  final int? nextPlanned;

  /// "3 more by Sunday", "Goal met", "Paused": the short form beside Today's week.
  String get short => switch (kind) {
        OutlookKind.met => RhythmCopy.outlookMetShort,
        OutlookKind.paused => RhythmCopy.outlookPausedShort,
        OutlookKind.onTrack => RhythmCopy.moreBySunday(needed),
        OutlookKind.outOfReach => RhythmCopy.everyDayCounts,
      };

  /// One or two plain sentences for the week sheet, or null when the label already says it.
  String? get sentence => switch (kind) {
        OutlookKind.met || OutlookKind.paused => null,
        OutlookKind.onTrack => [
            RhythmCopy.moreBySundaySentence(needed, daysLeft),
            if (todayPlanned) RhythmCopy.todayPlanned else if (nextPlanned != null) RhythmCopy.nextPlanned(weekdayNames[nextPlanned!]),
          ].join(' '),
        OutlookKind.outOfReach => RhythmCopy.outOfReach,
      };
}

/// [studied] has seven flags, Monday first. [todayIndex] is null when the cached week is not
/// this week; then there is nothing honest to say about the days left and this returns null.
/// [planned] is the student's chosen study days (0 = Monday), or null when none are chosen.
WeekOutlook? weekOutlook({
  required List<bool> studied,
  required int? todayIndex,
  required int goal,
  bool paused = false,
  Set<int>? planned,
}) {
  if (todayIndex == null || studied.length != 7) return null;
  final done = studied.where((s) => s).length;
  final needed = (goal - done).clamp(0, 7);
  final daysLeft = [for (var d = todayIndex; d < 7; d++) if (!studied[d]) d].length;
  if (paused) return WeekOutlook(kind: OutlookKind.paused, needed: needed, daysLeft: daysLeft);
  if (needed == 0) return WeekOutlook(kind: OutlookKind.met, needed: 0, daysLeft: daysLeft);
  if (daysLeft < needed) return WeekOutlook(kind: OutlookKind.outOfReach, needed: needed, daysLeft: daysLeft);
  final todayPlanned = planned != null && planned.contains(todayIndex) && !studied[todayIndex];
  int? next;
  if (planned != null) {
    for (var d = todayIndex + 1; d < 7; d++) {
      if (planned.contains(d) && !studied[d]) {
        next = d;
        break;
      }
    }
  }
  return WeekOutlook(kind: OutlookKind.onTrack, needed: needed, daysLeft: daysLeft, todayPlanned: todayPlanned, nextPlanned: next);
}

// Which Mobi stands beside the week ring, and what he says. Pure: the server's week, the plan's
// outlook and the clock in, one answer out. He is a presence, never a scold: an open week that
// is on track gets no Mobi at all, a paused week gets him resting, a met week gets him proud.
//
// Order of precedence (the first that applies wins):
//   paused           rest, "Paused. Your run is kept."
//   met              proud (the ring and the status line already say it)
//   late at night    asleep from 23:00 to 05:00; a tap wakes him, "Sleep well. Tomorrow counts."
//   returning        hello, once ("Welcome back. Nothing was lost.")
//   out of reach     encourage, "Every study day still counts."
//   one short, today planned   nudge, "One more day, and today is on your plan."
//   otherwise        nobody: nothing to say, so nothing is drawn
import '../../../core/domain/next_move.dart' show isLateNightHour;
import '../../../core/mascot/mobi_acts.dart';
import '../copy.dart';
import 'week_outlook.dart';
import 'week_view.dart';

enum WeekMobiKind { none, rest, proud, sleep, hello, encourage, nudge }

class WeekMobi {
  const WeekMobi(this.kind, this.act, {this.line, this.wakeLine});

  /// Nobody beside the ring.
  static const WeekMobi none = WeekMobi(WeekMobiKind.none, null);

  final WeekMobiKind kind;

  /// The act he enters on; null when he is not drawn.
  final MobiAct? act;

  /// The one line he says, or null. Shown once per run, except for a paused week, whose line is
  /// the state itself.
  final String? line;

  /// For a sleeping Mobi: the line a tap on him answers with.
  final String? wakeLine;

  bool get present => act != null;

  /// A sleeping Mobi wakes when tapped.
  bool get tapWakes => kind == WeekMobiKind.sleep;

  /// A paused week's line is always shown: it is the state, not a remark.
  bool get lineIsState => kind == WeekMobiKind.rest;

  @override
  bool operator ==(Object other) => other is WeekMobi && other.kind == kind && other.line == line && other.wakeLine == wakeLine;

  @override
  int get hashCode => Object.hash(kind, line, wakeLine);
}

/// [outlook] is null when the cached week is not this week (nothing honest to say about the days
/// left). [now] is the phone's local time. [returning] is the server's flag for 3 or more days
/// away; the caller passes it true only for the first time he greets (the daily ration).
WeekMobi mobiForWeek(WeekView week, WeekOutlook? outlook, DateTime now, {bool returning = false}) {
  if (week.status == WeekStatus.paused) {
    return const WeekMobi(WeekMobiKind.rest, MobiAct.rest, line: RhythmCopy.mobiPaused);
  }
  if (week.met) return const WeekMobi(WeekMobiKind.proud, MobiAct.proud);
  if (isLateNightHour(now.hour)) {
    return const WeekMobi(WeekMobiKind.sleep, MobiAct.sleep, wakeLine: RhythmCopy.mobiSleep);
  }
  if (returning) return const WeekMobi(WeekMobiKind.hello, MobiAct.hello, line: RhythmCopy.mobiReturning);
  if (outlook == null) return WeekMobi.none;
  switch (outlook.kind) {
    case OutlookKind.outOfReach:
      return const WeekMobi(WeekMobiKind.encourage, MobiAct.encourage, line: RhythmCopy.mobiOutOfReach);
    case OutlookKind.onTrack:
      if (outlook.needed == 1 && outlook.todayPlanned) {
        return const WeekMobi(WeekMobiKind.nudge, MobiAct.nudge, line: RhythmCopy.mobiOneShort);
      }
      return WeekMobi.none;
    case OutlookKind.met:
      return const WeekMobi(WeekMobiKind.proud, MobiAct.proud);
    case OutlookKind.paused:
      return const WeekMobi(WeekMobiKind.rest, MobiAct.rest, line: RhythmCopy.mobiPaused);
  }
}

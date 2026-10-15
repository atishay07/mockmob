import 'package:flutter/foundation.dart';

import '../../../core/widgets/widgets.dart';
import '../../rhythm/rhythm.dart' show CelebrationMode;
import '../copy.dart';
import 'sheet_fields.dart' show SheetWeek, SheetWeekState;

/// What Mobi does on the You hub after reading the student's real week (once a day).
@immutable
class HubMobiReading {
  const HubMobiReading(this.act, {this.line, this.pointAtWeek = false, this.gate = HubMobiGate.none});

  /// The act he plays.
  final MobiAct act;

  /// One factual line, typed in after the act has landed. Null is silent.
  final String? line;

  /// He points at the Rhythm field (the nudge).
  final bool pointAtWeek;

  /// Which once-a-day gate the reading consumes when it is played.
  final HubMobiGate gate;
}

enum HubMobiGate { none, met, nudge }

/// Chooses Mobi's reading of the week. Pure: the screen asks once the week has resolved.
///
/// - 0 to 4 AM: sleepy, silent, whatever the week says.
/// - The week paused: rest, silent.
/// - The server's count has met the goal: proud with "Goal met. Four of four." from the real
///   counts. Quiet swaps proud for correct (a nod), Off plays nothing and keeps the words.
/// - One study day short of the goal: a nudge pointing at the Rhythm field, no words.
/// - Anything else on a loaded week: a hello (the caller decides whether today's hello is spent).
/// - Loading, failed or Rhythm off: idle and silent. `null` means "not decided yet" (loading or
///   failed), so a later load can still play its reading.
HubMobiReading? readWeek({required SheetWeek week, required DateTime now, required CelebrationMode mode}) {
  if (now.hour >= 0 && now.hour < 5) return const HubMobiReading(MobiAct.sleepy);
  switch (week.state) {
    case SheetWeekState.loading:
    case SheetWeekState.failed:
      return null;
    case SheetWeekState.off:
      return const HubMobiReading(MobiAct.idle);
    case SheetWeekState.ready:
      break;
  }
  if (week.paused) return const HubMobiReading(MobiAct.rest);
  final done = week.done;
  final goal = week.goal;
  if (done == null || goal == null || goal < 1) return const HubMobiReading(MobiAct.hello);
  if (done >= goal) {
    final act = switch (mode) {
      CelebrationMode.full => MobiAct.proud,
      CelebrationMode.quiet => MobiAct.nod,
      CelebrationMode.off => MobiAct.idle,
    };
    return HubMobiReading(act, line: YouCopy.goalMetLine(done, goal), gate: HubMobiGate.met);
  }
  if (goal - done == 1) return const HubMobiReading(MobiAct.nudge, pointAtWeek: true, gate: HubMobiGate.nudge);
  return const HubMobiReading(MobiAct.hello);
}

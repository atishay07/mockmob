import '../domain/next_move.dart' show isLateNightHour, lateNightEndHour;
import 'mobi_acts.dart';

/// What happened, in the student's day, that Mobi should react to. Screens name the moment;
/// [MobiMoments.act] picks the act, so reactions stay consistent across the app.
enum MobiEvent {
  /// A screen opens with Mobi on it for the first time today.
  arrive,

  /// A right answer in practice (never during a timed mock).
  rightAnswer,

  /// A wrong answer in practice, or a lower result.
  wrongAnswer,

  /// Waiting on the server or the AI.
  waiting,

  /// The student is typing a question for Mobi.
  typing,

  /// A server-acknowledged milestone: a repair held, the weekly goal met, a first full mock.
  milestone,

  /// A finished session the server acknowledged (proportional: less than a milestone).
  sessionDone,

  /// Drawing attention to the one action on screen.
  showAction,

  /// Nothing to do: an empty state or all clear.
  allClear,

  /// Something failed to load or save.
  setback,
}

/// The act for each moment, and the late-night override.
abstract final class MobiMoments {
  /// The act Mobi plays for [moment].
  static MobiAct act(MobiEvent moment) => switch (moment) {
        MobiEvent.arrive => MobiAct.hello,
        MobiEvent.rightAnswer => MobiAct.correct,
        MobiEvent.wrongAnswer => MobiAct.encourage,
        MobiEvent.waiting => MobiAct.loading,
        MobiEvent.typing => MobiAct.listen,
        MobiEvent.milestone => MobiAct.proud,
        MobiEvent.sessionDone => MobiAct.cheer,
        MobiEvent.showAction => MobiAct.nudge,
        MobiEvent.allClear => MobiAct.rest,
        MobiEvent.setback => MobiAct.oops,
      };

  /// How Mobi greets at [now] (local time). The whole late-night window (11 PM to 5 AM, the
  /// shared [isLateNightHour]) is sleepy or asleep: sleepy until 1 AM, asleep from 1 AM until the
  /// window closes. Outside it, [otherwise].
  static MobiAct entranceAt(DateTime now, {MobiAct otherwise = MobiAct.hello}) {
    final h = now.hour;
    if (!isLateNightHour(h)) return otherwise;
    return h >= 1 && h < lateNightEndHour ? MobiAct.sleep : MobiAct.sleepy;
  }

  /// Whether [now] is late at night (the shared 11 PM to 5 AM window), when Mobi says the
  /// short-session line.
  static bool isLate(DateTime now) => isLateNightHour(now.hour);
}

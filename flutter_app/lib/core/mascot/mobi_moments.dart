import 'mobi_acts.dart';

/// What happened, in the student's day, that Mobi should react to. Screens name the moment;
/// [MobiMoments.act] picks the act, so reactions stay consistent across the app.
enum MobiMoment {
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
  static MobiAct act(MobiMoment moment) => switch (moment) {
        MobiMoment.arrive => MobiAct.hello,
        MobiMoment.rightAnswer => MobiAct.correct,
        MobiMoment.wrongAnswer => MobiAct.encourage,
        MobiMoment.waiting => MobiAct.loading,
        MobiMoment.typing => MobiAct.listen,
        MobiMoment.milestone => MobiAct.proud,
        MobiMoment.sessionDone => MobiAct.cheer,
        MobiMoment.showAction => MobiAct.nudge,
        MobiMoment.allClear => MobiAct.rest,
        MobiMoment.setback => MobiAct.oops,
      };

  /// How Mobi greets at [now] (local time): asleep from 1 AM to 5 AM, sleepy from 11 PM, and
  /// otherwise [otherwise].
  static MobiAct entranceAt(DateTime now, {MobiAct otherwise = MobiAct.hello}) {
    final h = now.hour;
    if (h >= 1 && h < 5) return MobiAct.sleep;
    if (h >= 23 || h < 1) return MobiAct.sleepy;
    return otherwise;
  }

  /// Whether [now] is late at night (11 PM to 5 AM), when Mobi says the short-session line.
  static bool isLate(DateTime now) => now.hour >= 23 || now.hour < 5;
}

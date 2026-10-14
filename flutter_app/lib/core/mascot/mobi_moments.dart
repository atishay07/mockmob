import '../domain/next_move.dart' show isLateNightHour, lateNightEndHour;
import 'mobi_acts.dart';

/// What happened, in the student's day, that Mobi should react to. Screens name the moment;
/// [MobiMoments.act] picks the act, so reactions stay consistent across the app. Play it with
/// `controller.react(MobiMoments.act(event), key: ...)` so the rate limit, the Celebrations
/// setting and reduced motion all apply.
///
/// | Event             | Act       | When                                                        |
/// |-------------------|-----------|-------------------------------------------------------------|
/// | arrive            | hello     | a screen opens with Mobi, first time today                  |
/// | rightAnswer       | correct   | a right answer in practice (never in a timed mock)          |
/// | wrongAnswer       | encourage | a wrong answer in practice, a lower result                  |
/// | waiting           | loading   | waiting on the server or the AI                             |
/// | typing            | listen    | the student types to Mobi                                   |
/// | milestone         | proud     | a server-acknowledged milestone                             |
/// | sessionDone       | cheer     | a finished session the server acknowledged                  |
/// | showAction        | nudge     | drawing attention to the one action on screen               |
/// | allClear          | rest      | an empty state, nothing to do                               |
/// | setback           | oops      | something failed to load or save                            |
/// | answerRight       | correct   | same as rightAnswer (the name feature packets use)          |
/// | answerWrong       | encourage | same as wrongAnswer                                         |
/// | saveConfirmed     | nod       | the server confirmed a save (never before it confirms)      |
/// | saveFailed        | oops      | a save failed; the screen says what to do                   |
/// | waitLong          | loading   | a wait past about 2 s (shorter waits get no Mobi)           |
/// | choiceWitnessed   | listen    | the student picked an option Mobi should take in            |
/// | dayCounted        | correct   | the server counted the day's practice toward the streak     |
/// | goalMet           | proud     | the weekly goal met, confirmed by the server                |
/// | refused           | oops      | an action was refused (a limit, a locked item)              |
/// | goodbye           | wave      | signing out, leaving a flow for the day                     |
/// | lateNight         | sleepy    | opened in the late-night window (11 PM to 5 AM)             |
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

  // ---- Added 15 Oct 2026 --------------------------------------------------------------------

  /// A right answer in practice (the same act as [rightAnswer]).
  answerRight,

  /// A wrong answer in practice (the same act as [wrongAnswer]).
  answerWrong,

  /// The server confirmed a save. Never fire it before the server answers.
  saveConfirmed,

  /// A save failed.
  saveFailed,

  /// A wait that has gone on past about two seconds.
  waitLong,

  /// The student chose something Mobi should take in (an option, a filter, a subject).
  choiceWitnessed,

  /// The server counted the day's practice.
  dayCounted,

  /// The weekly goal is met, confirmed by the server.
  goalMet,

  /// An action was refused (a limit reached, a locked item).
  refused,

  /// Leaving: signing out, closing a flow for the day.
  goodbye,

  /// Opened late at night (the shared 11 PM to 5 AM window).
  lateNight,
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
        MobiEvent.answerRight => MobiAct.correct,
        MobiEvent.answerWrong => MobiAct.encourage,
        MobiEvent.saveConfirmed => MobiAct.nod,
        MobiEvent.saveFailed => MobiAct.oops,
        MobiEvent.waitLong => MobiAct.loading,
        MobiEvent.choiceWitnessed => MobiAct.listen,
        MobiEvent.dayCounted => MobiAct.correct,
        MobiEvent.goalMet => MobiAct.proud,
        MobiEvent.refused => MobiAct.oops,
        MobiEvent.goodbye => MobiAct.wave,
        MobiEvent.lateNight => MobiAct.sleepy,
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

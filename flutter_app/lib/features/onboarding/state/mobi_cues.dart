import 'package:flutter/foundation.dart';

import '../../../core/mascot/mascot.dart';
import '../choices_copy.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/deck.dart';

/// What the guide Mobi does after a change to the sheet: an [act] and a short [line]. Pure, so
/// the choreography is testable.
///
/// MOTION.md 1.3 and 4.2: he is a presence, not a show. He never points at the sheet as a bubble
/// inks (the tile the student touched already gets his glance); he speaks on arriving at a step
/// only where that step changes something (the worry, the warm-up, the plan); a warm-up answer
/// gets `correct` or `encourage`, never a frown; the seal is the one celebration.
@immutable
class MobiCue {
  const MobiCue({this.act, this.line});

  final MobiAct? act;
  final String? line;

  /// The seal's celebration: the flow plays it only once the stamp has landed, and only when
  /// the Celebrations setting is Full.
  bool get celebrates => act == MobiAct.celebrate;

  @override
  bool operator ==(Object other) => other is MobiCue && other.act == act && other.line == line;

  @override
  int get hashCode => Object.hash(act, line);

  @override
  String toString() => 'MobiCue($act, $line)';
}

/// The steps where Mobi says a line on arrival: each changes what happens next.
const Set<String> spokenOnArrival = {Steps.worry, Steps.question, Steps.plan};

/// The cue for the change from [before] to [after], or null when Mobi has nothing to do.
/// The order is the order of importance: the seal, the warm-up, the worry, then simply arriving
/// on a step.
MobiCue? mobiCueFor(OnboardingAnswers? before, OnboardingAnswers after) {
  if (before == null) return null;
  if (!before.sealed && after.sealed) return const MobiCue(act: MobiAct.celebrate, line: OnboardingCopy.mobiSealed);

  final w = after.warmup;
  if (w != null && before.warmup == null) {
    final seconds = (w.millis / 1000).round();
    return w.correct
        ? MobiCue(act: MobiAct.correct, line: OnboardingCopy.mobiRight(seconds))
        : const MobiCue(act: MobiAct.encourage, line: OnboardingCopy.mobiTrap);
  }

  // Up to three picks (D45): Mobi answers the newest one, never a drop.
  final added = [for (final w in after.worries) if (!before.worries.contains(w)) w];
  if (added.isNotEmpty) {
    return MobiCue(act: MobiAct.idle, line: added.last.mobiShort);
  }

  // The pace step's days at its ends (D47): short and steady works; every day keeps one to rest.
  if (after.step == Steps.rhythm && before.step == Steps.rhythm && after.days.length != before.days.length) {
    final n = after.days.length;
    if (n <= 2) return MobiCue(act: MobiAct.nod, line: ChoicesCopy.mobiFewDays(n));
    if (n == 7) return const MobiCue(act: MobiAct.tilt, line: ChoicesCopy.mobiEveryDay);
  }

  final step = after.step;
  if (step != before.step && step != null) {
    return MobiCue(act: enterAct(step), line: spokenOnArrival.contains(step) ? OnboardingCopy.mobiArrive[step] : null);
  }
  return null;
}

/// How Mobi stands on arriving at [step]: thinking it over at the worry, reading along with the
/// question and the plan, idle elsewhere (which also ends any held act).
MobiAct enterAct(String step) => switch (step) {
      Steps.worry => MobiAct.think,
      Steps.question || Steps.plan => MobiAct.read,
      Steps.save => MobiAct.hello,
      _ => MobiAct.idle,
    };

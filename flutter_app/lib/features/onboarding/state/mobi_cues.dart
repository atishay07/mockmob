import 'package:flutter/foundation.dart';

import '../../../core/mascot/mascot.dart';
import '../copy.dart';
import '../model/answers.dart';
import '../model/deck.dart';

/// What the guide Mobi does after a change to the sheet: an [act], a short [line], and the
/// sheet bubble to point at ([pointAt], a step id). Pure, so the choreography is testable.
@immutable
class MobiCue {
  const MobiCue({this.act, this.line, this.pointAt});

  final MobiAct? act;
  final String? line;
  final String? pointAt;

  @override
  bool operator ==(Object other) => other is MobiCue && other.act == act && other.line == line && other.pointAt == pointAt;

  @override
  int get hashCode => Object.hash(act, line, pointAt);

  @override
  String toString() => 'MobiCue($act, $line, $pointAt)';
}

/// The steps whose answer Mobi points out on the sheet as its bubble inks.
const Set<String> _pointed = {Steps.stage, Steps.course, Steps.subjects, Steps.rhythm};

/// The cue for the change from [before] to [after], or null when Mobi has nothing to do.
/// The order is the order of importance: the seal, the warm-up, the worry, a newly inked
/// bubble, then simply arriving on a step.
MobiCue? mobiCueFor(OnboardingAnswers? before, OnboardingAnswers after) {
  if (before == null) return null;
  if (!before.sealed && after.sealed) return const MobiCue(act: MobiAct.celebrate, line: OnboardingCopy.mobiSealed);

  final w = after.warmup;
  if (w != null && before.warmup == null) {
    final seconds = (w.millis / 1000).round();
    return w.correct
        ? MobiCue(act: MobiAct.cheer, line: OnboardingCopy.mobiRight(seconds))
        : const MobiCue(act: MobiAct.oops, line: OnboardingCopy.mobiTrap);
  }

  final worry = after.worry;
  if (worry != null && worry != before.worry) {
    return MobiCue(act: MobiAct.idle, line: worry.mobiShort, pointAt: Steps.worry);
  }

  for (final id in _pointed) {
    if (after.isDone(id) && !before.isDone(id)) return MobiCue(pointAt: id);
  }

  if (after.step != before.step && after.step != null) {
    return MobiCue(act: enterAct(after.step!), line: OnboardingCopy.mobiArrive[after.step!]);
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

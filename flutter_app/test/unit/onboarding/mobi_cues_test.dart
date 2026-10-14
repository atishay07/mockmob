import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/mascot/mascot.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/choices.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/state/mobi_cues.dart';

import '../../golden/onboarding/support.dart';

/// The guide Mobi's choreography: what he does after each change to the sheet.
void main() {
  test('nothing before the stored sheet is read', () {
    expect(mobiCueFor(null, studentUpTo(Steps.stage)), isNull);
  });

  // MOTION.md 4.2: he glances at the tile the student touched; he does not point at every bubble.
  test('a newly inked bubble asks nothing of him', () {
    const before = OnboardingAnswers(step: Steps.stage);
    final after = before.copyWith(stage: Stage.classTwelve).mark(Steps.stage);
    expect(mobiCueFor(before, after), isNull);

    final rated = studentUpTo(Steps.course, step: Steps.subjects);
    expect(mobiCueFor(rated, rated.mark(Steps.subjects)), isNull);
  });

  test('he speaks on arrival only where the step changes something', () {
    final a = studentUpTo(Steps.stage);
    expect(mobiCueFor(a, a.copyWith(step: Steps.course)), MobiCue(act: enterAct(Steps.course)), reason: 'no line on the course step');
    final r = studentUpTo(Steps.question);
    expect(mobiCueFor(r, r.copyWith(step: Steps.rhythm))?.line, isNull);
    final p = studentUpTo(Steps.rhythm);
    expect(mobiCueFor(p, p.copyWith(step: Steps.plan))?.line, OnboardingCopy.mobiArrive[Steps.plan]);
  });

  test('arriving at the worry he thinks; at the question and plan he reads along', () {
    final a = studentUpTo(Steps.subjects);
    expect(mobiCueFor(a, a.copyWith(step: Steps.worry)), MobiCue(act: MobiAct.think, line: OnboardingCopy.mobiArrive[Steps.worry]));
    final w = studentUpTo(Steps.worry);
    expect(mobiCueFor(w, w.copyWith(step: Steps.question)), MobiCue(act: MobiAct.read, line: OnboardingCopy.mobiArrive[Steps.question]));
  });

  test('choosing a worry gets his short line, and no point', () {
    final a = studentUpTo(Steps.subjects, step: Steps.worry);
    final cue = mobiCueFor(a, a.copyWith(worry: Worry.time));
    expect(cue, MobiCue(act: MobiAct.idle, line: Worry.time.mobiShort));
  });

  test('a right warm-up gets correct with the real time; a wrong one encourage, never a frown', () {
    final a = studentUpTo(Steps.worry, step: Steps.question);
    final right = a.copyWith(warmup: const WarmupResult(questionId: 'acc-1', chosen: 0, correct: true, millis: 41000));
    expect(mobiCueFor(a, right), MobiCue(act: MobiAct.correct, line: OnboardingCopy.mobiRight(41)));
    final wrong = a.copyWith(warmup: const WarmupResult(questionId: 'acc-1', chosen: 1, correct: false, millis: 52000));
    expect(mobiCueFor(a, wrong), const MobiCue(act: MobiAct.encourage, line: OnboardingCopy.mobiTrap));
  });

  test('the seal is celebrated, ahead of anything else in the same change', () {
    final a = studentUpTo(Steps.rhythm, step: Steps.plan);
    final sealed = a.copyWith(sealedAt: kNow).mark(Steps.plan);
    final cue = mobiCueFor(a, sealed);
    expect(cue, const MobiCue(act: MobiAct.celebrate, line: OnboardingCopy.mobiSealed));
    expect(cue!.celebrates, isTrue, reason: 'the flow holds it until the stamp lands, and only on Full');
  });

  test('an unchanged sheet asks nothing of him', () {
    final a = studentUpTo(Steps.rhythm);
    expect(mobiCueFor(a, a), isNull);
  });
}

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

  test('a newly inked bubble is pointed out on the sheet', () {
    const before = OnboardingAnswers(step: Steps.stage);
    final after = before.copyWith(stage: Stage.classTwelve).mark(Steps.stage);
    expect(mobiCueFor(before, after), const MobiCue(pointAt: Steps.stage));

    final rated = studentUpTo(Steps.course, step: Steps.subjects);
    expect(mobiCueFor(rated, rated.mark(Steps.subjects)), const MobiCue(pointAt: Steps.subjects));
  });

  test('arriving at the worry he thinks; at the question and plan he reads along', () {
    final a = studentUpTo(Steps.subjects);
    expect(mobiCueFor(a, a.copyWith(step: Steps.worry)), MobiCue(act: MobiAct.think, line: OnboardingCopy.mobiArrive[Steps.worry]));
    final w = studentUpTo(Steps.worry);
    expect(mobiCueFor(w, w.copyWith(step: Steps.question)), MobiCue(act: MobiAct.read, line: OnboardingCopy.mobiArrive[Steps.question]));
  });

  test('choosing a worry gets his short line and a point at the worry bubble', () {
    final a = studentUpTo(Steps.subjects, step: Steps.worry);
    final cue = mobiCueFor(a, a.copyWith(worry: Worry.time));
    expect(cue, MobiCue(act: MobiAct.idle, line: Worry.time.mobiShort, pointAt: Steps.worry));
  });

  test('a right warm-up gets a cheer with the real time; a wrong one a small shrug', () {
    final a = studentUpTo(Steps.worry, step: Steps.question);
    final right = a.copyWith(warmup: const WarmupResult(questionId: 'acc-1', chosen: 0, correct: true, millis: 41000));
    expect(mobiCueFor(a, right), MobiCue(act: MobiAct.cheer, line: OnboardingCopy.mobiRight(41)));
    final wrong = a.copyWith(warmup: const WarmupResult(questionId: 'acc-1', chosen: 1, correct: false, millis: 52000));
    expect(mobiCueFor(a, wrong), const MobiCue(act: MobiAct.oops, line: OnboardingCopy.mobiTrap));
  });

  test('the seal is celebrated, ahead of anything else in the same change', () {
    final a = studentUpTo(Steps.rhythm, step: Steps.plan);
    final sealed = a.copyWith(sealedAt: kNow).mark(Steps.plan);
    expect(mobiCueFor(a, sealed), const MobiCue(act: MobiAct.celebrate, line: OnboardingCopy.mobiSealed));
  });

  test('an unchanged sheet asks nothing of him', () {
    final a = studentUpTo(Steps.rhythm);
    expect(mobiCueFor(a, a), isNull);
  });
}

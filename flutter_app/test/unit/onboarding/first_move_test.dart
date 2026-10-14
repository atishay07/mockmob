import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockmob/core/widgets/widgets.dart';
import 'package:mockmob/features/onboarding/copy.dart';
import 'package:mockmob/features/onboarding/data/subjects.dart';
import 'package:mockmob/features/onboarding/model/answers.dart';
import 'package:mockmob/features/onboarding/model/deck.dart';
import 'package:mockmob/features/onboarding/steps/first_move_step.dart';

import '../../golden/onboarding/support.dart';
import '../../helpers/fonts.dart';
import '../../helpers/golden_harness.dart';

/// Records where Mobi was asked to point, and what he was asked to play.
class _RecordingMobi extends MobiController {
  final List<Offset> points = [];
  final List<MobiAct> acts = [];

  @override
  void play(MobiAct act) {
    acts.add(act);
    super.play(act);
  }

  @override
  void pointAt(Offset globalPoint) {
    points.add(globalPoint);
    super.pointAt(globalPoint);
  }
}

void main() {
  setUpAll(loadAppFonts);
  setUp(MobiRation.reset);
  tearDown(MobiRation.reset);

  Future<_RecordingMobi> pump(WidgetTester tester, OnboardingAnswers answers, {Size size = kPhone}) async {
    final mobi = _RecordingMobi();
    addTearDown(mobi.dispose);
    await pumpMockmob(
      tester,
      FirstMoveStep(answers: answers, onStart: () {}, mobi: mobi),
      size: size,
      disableAnimations: true,
      overrides: onboardingOverrides(answers: answers),
    );
    await tester.pump(const Duration(milliseconds: 100));
    return mobi;
  }

  final student = studentUpTo(Steps.plan, step: Steps.firstMove).copyWith(notNow: true);

  testWidgets("Mobi points at the start key's centre", (tester) async {
    final mobi = await pump(tester, student);
    final start = find.byWidgetPredicate((w) => w is KeyButton && w.label == OnboardingCopy.startNow);
    expect(start, findsOneWidget);
    expect(mobi.points, isNotEmpty);
    expect(mobi.points.last, offsetMoreOrLessEquals(tester.getCenter(start), epsilon: 0.5));
  });

  testWidgets('a scroll keeps the aim (Mobi and the key move together) and a resize re-aims', (tester) async {
    final mobi = await pump(tester, student, size: const Size(360, 560));
    final before = mobi.points.length;
    await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -120));
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(mobi.points.length, before, reason: 'the relative aim did not change, so no new point');

    tester.view.physicalSize = const Size(840, 1400);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    final start = find.byWidgetPredicate((w) => w is KeyButton && w.label == OnboardingCopy.startNow);
    expect(mobi.points.length, greaterThan(before));
    expect(mobi.points.last, offsetMoreOrLessEquals(tester.getCenter(start), epsilon: 0.5));
  });

  testWidgets('with no touch for 4 s Mobi nudges at the start key, once', (tester) async {
    final mobi = await pump(tester, student);
    expect(mobi.acts, isNot(contains(MobiAct.nudge)));
    await tester.pump(const Duration(milliseconds: 1200));
    expect(mobi.acts, isNot(contains(MobiAct.nudge)), reason: 'not at 1.2 s: that reads as nagging');
    await tester.pump(FirstMoveStep.nudgeAfter - const Duration(milliseconds: 1200));
    expect(mobi.acts.where((a) => a == MobiAct.nudge), hasLength(1));
    await tester.pump(const Duration(seconds: 3));
    expect(mobi.acts.where((a) => a == MobiAct.nudge), hasLength(1), reason: 'one nudge per visit');
  });

  testWidgets('a finger landing first means no nudge', (tester) async {
    final mobi = await pump(tester, student);
    final gesture = await tester.startGesture(tester.getTopLeft(find.byType(SingleChildScrollView)) + const Offset(2, 2));
    await gesture.up();
    await tester.pump(const Duration(seconds: 2));
    expect(mobi.acts, isNot(contains(MobiAct.nudge)));
  });

  testWidgets('a Physics-only student is offered practice, in plain words', (tester) async {
    await pump(tester, student.copyWith(subjects: const [SheetSubject.physics], confidence: const {}));
    expect(find.text('Start with 10 questions in Physics'), findsOneWidget);
    expect(find.textContaining('starting point'), findsNothing);
  });
}
